import { randomUUID } from 'crypto';
import { pool, getNextBusinessSequence } from '../db/neon.js';
import { Payment } from '../../src/types.js';
import { formatPaymentReceiptNumber } from '../utils/business-format.js';

export class PaymentRepository {
  public async getPayments(query?: {
    clientId?: string;
    inscriptionId?: string;
    campaignId?: string;
    includeTest?: boolean;
  }): Promise<Payment[]> {
    let sql = `SELECT * FROM payments WHERE 1=1`;
    const params: any[] = [];

    if (!query?.includeTest && !query?.clientId && !query?.inscriptionId) {
      sql += ` AND is_test = FALSE`;
    }

    if (query?.clientId) {
      params.push(query.clientId);
      sql += ` AND client_id = $${params.length}`;
    }
    if (query?.inscriptionId) {
      params.push(query.inscriptionId);
      sql += ` AND inscription_id = $${params.length}`;
    }
    if (query?.campaignId) {
      params.push(query.campaignId);
      sql += ` AND campaign_id = $${params.length}`;
    }

    sql += ` ORDER BY payment_date DESC, created_at DESC`;

    const res = await pool.query(sql, params);
    return res.rows.map(this.mapRowToPayment);
  }

  public async getPaymentById(id: string): Promise<Payment | null> {
    const res = await pool.query(`SELECT * FROM payments WHERE id = $1`, [id]);
    if (res.rows.length === 0) return null;
    return this.mapRowToPayment(res.rows[0]);
  }

  public async getNextReceiptNumber(year: number = 2027, client?: any): Promise<string> {
    const seq = await getNextBusinessSequence('PAYMENT', year, client);
    return formatPaymentReceiptNumber(year, seq);
  }

  /**
   * Transactional Payment creation (Rule 8, 13 & 14)
   */
  public async createPayment(data: {
    clientId: string;
    inscriptionId: string;
    amount: number;
    paymentMethod: string;
    reference?: string;
    comment?: string;
    paymentDate?: string;
    agentId?: string;
    agentName?: string;
  }): Promise<Payment> {
    if (!data.amount || data.amount <= 0) {
      throw new Error('Le montant du paiement doit être strictement positif.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Vérifier l'existence du dossier
      const insRes = await client.query(
        `SELECT i.*, v.code as campaign_code, c.first_name, c.last_name
         FROM inscriptions i
         JOIN campaigns v ON i.campaign_id = v.id
         JOIN clients c ON i.client_id = c.id
         WHERE i.id = $1`,
        [data.inscriptionId]
      );
      if (insRes.rows.length === 0) {
        throw new Error('Dossier d\'inscription introuvable.');
      }
      const ins = insRes.rows[0];

      // Générer numéro de reçu officiel infalsifiable avec séquence annuelle atomique
      const paymentDate = data.paymentDate ? new Date(data.paymentDate) : new Date();
      const year = paymentDate.getFullYear();
      const receiptNumber = await this.getNextReceiptNumber(year, client);
      const id = randomUUID();

      const isTestPayment = Boolean(ins.is_test);
      const insertRes = await client.query(
        `INSERT INTO payments (
          id, receipt_number, inscription_id, client_id, campaign_id, amount, currency,
          payment_method, reference, comment, status, agent_id, agent_name, client_name,
          campaign_code, is_test, payment_date, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'FCFA', $7, $8, $9, 'VALIDE', $10, $11, $12, $13, $14, $15, NOW())
        RETURNING *`,
        [
          id,
          receiptNumber,
          data.inscriptionId,
          data.clientId,
          ins.campaign_id,
          data.amount,
          data.paymentMethod,
          data.reference || null,
          data.comment || null,
          data.agentId || null,
          data.agentName || null,
          `${ins.first_name} ${ins.last_name}`,
          ins.campaign_code,
          isTestPayment,
          paymentDate,
        ]
      );

      await client.query('COMMIT');
      return this.mapRowToPayment(insertRes.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Cancellation with Payment Reversal Audit Trail (Rule 8 & 13)
   * A validated payment is NEVER physically deleted. It is marked ANNULE and an entry in payment_reversals is created.
   */
  public async cancelPayment(
    paymentId: string,
    reason: string,
    actorUserId: string,
    actorUserName: string
  ): Promise<Payment> {
    if (!reason || !reason.trim()) {
      throw new Error('Le motif d\'annulation est obligatoire pour la traçabilité financière.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const payRes = await client.query(`SELECT * FROM payments WHERE id = $1 FOR UPDATE`, [paymentId]);
      if (payRes.rows.length === 0) {
        throw new Error('Paiement introuvable.');
      }
      const payment = payRes.rows[0];

      if (payment.status === 'ANNULE') {
        throw new Error('Ce paiement a déjà été annulé.');
      }

      // Protection absolue du Sanctuaire Financier : Seuls les paiements de test peuvent être annulés
      if (!payment.is_test) {
        throw new Error('SANCTUAIRE_FINANCIER_INVIOLABLE: L\'annulation de versements certifiés réels est strictement interdite.');
      }

      // 1. Enregistrement dans payment_reversals
      const reversalId = randomUUID();
      await client.query(
        `INSERT INTO payment_reversals (
          id, payment_id, reason, amount, actor_user_id, actor_user_name, reversed_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)`,
        [
          reversalId,
          paymentId,
          reason.trim(),
          payment.amount,
          actorUserId,
          actorUserName,
          JSON.stringify({
            originalReceipt: payment.receipt_number,
            clientId: payment.client_id,
            inscriptionId: payment.inscription_id,
            paymentMethod: payment.payment_method,
          }),
        ]
      );

      // 2. Mise à jour statut paiement vers ANNULE
      const commentAppend = payment.comment ? `${payment.comment} | Annulé par ${actorUserName}: ${reason.trim()}` : `Annulé par ${actorUserName}: ${reason.trim()}`;
      const updateRes = await client.query(
        `UPDATE payments SET status = 'ANNULE', comment = $1 WHERE id = $2 RETURNING *`,
        [commentAppend, paymentId]
      );

      await client.query('COMMIT');
      return this.mapRowToPayment(updateRes.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private mapRowToPayment(r: any): Payment {
    return {
      id: r.id,
      receiptNumber: r.receipt_number,
      clientId: r.client_id,
      inscriptionId: r.inscription_id,
      voyageId: r.campaign_id,
      amount: Number(r.amount),
      currency: r.currency || 'FCFA',
      paymentMethod: r.payment_method,
      reference: r.reference || undefined,
      comment: r.comment || undefined,
      status: r.status,
      agentId: r.agent_id || '',
      agentName: r.agent_name || '',
      clientName: r.client_name || undefined,
      voyageCode: r.campaign_code || undefined,
      isTest: Boolean(r.is_test),
      paymentDate: r.payment_date ? new Date(r.payment_date).toISOString() : new Date().toISOString(),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    };
  }
}

export const paymentRepository = new PaymentRepository();
