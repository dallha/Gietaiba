import { randomUUID } from 'crypto';
import { pool, getNextBusinessSequence } from '../db/neon.js';
import { Inscription, Client, Voyage, VoyagePackage, PaymentSchedule } from '../../src/types.js';

export class InscriptionRepository {
  public async getInscriptions(query?: { campaignId?: string; clientId?: string }): Promise<Inscription[]> {
    let sql = `
      SELECT 
        i.*,
        c.code as client_code, c.first_name, c.last_name, c.phone as client_phone, c.email as client_email,
        v.code as campaign_code, v.title as campaign_title, v.type as campaign_type, v.year as campaign_year,
        p.code as package_code, p.name as package_name, p.category as package_category,
        COALESCE(pay.total_paid, 0) as total_paid,
        COALESCE(doc.valid_docs_count, 0) as valid_docs_count
      FROM inscriptions i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN campaigns v ON i.campaign_id = v.id
      LEFT JOIN packages p ON i.package_id = p.id
      LEFT JOIN (
        SELECT inscription_id, SUM(amount) as total_paid
        FROM payments
        WHERE status = 'VALIDE'
        GROUP BY inscription_id
      ) pay ON pay.inscription_id = i.id
      LEFT JOIN (
        SELECT inscription_id, COUNT(*) as valid_docs_count
        FROM documents
        WHERE status = 'VALIDE'
        GROUP BY inscription_id
      ) doc ON doc.inscription_id = i.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (query?.campaignId) {
      params.push(query.campaignId);
      sql += ` AND i.campaign_id = $${params.length}`;
    }
    if (query?.clientId) {
      params.push(query.clientId);
      sql += ` AND i.client_id = $${params.length}`;
    }

    sql += ` ORDER BY i.created_at ASC`;

    const res = await pool.query(sql, params);
    return res.rows.map(this.mapRowToInscription);
  }

  public async getInscriptionById(id: string): Promise<Inscription | null> {
    const list = await this.getInscriptions();
    const found = list.find((i) => i.id === id);
    return found || null;
  }

  public async getNextInscriptionCode(year: number = 2027, client?: any): Promise<string> {
    const seq = await getNextBusinessSequence('INSCRIPTION', year, client);
    return `INS-${year}-${String(seq).padStart(6, '0')}`;
  }

  /**
   * Transactional Inscription creation with price snapshot & initial visa tracking (Rule 7 & 14)
   */
  public async createInscription(data: {
    clientId: string;
    campaignId: string;
    packageId: string;
    status?: 'CONFIRMEE' | 'EN_ATTENTE';
    agentId?: string;
    agentName?: string;
  }): Promise<Inscription> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Anti-doublon strict (index unique partiel)
      const existing = await client.query(
        `SELECT id FROM inscriptions WHERE client_id = $1 AND campaign_id = $2 AND status != 'ANNULEE'`,
        [data.clientId, data.campaignId]
      );
      if (existing.rows.length > 0) {
        throw new Error('Ce pèlerin possède déjà une inscription active pour cette campagne.');
      }

      // 2. Récupération du package et de sa version tarifaire active
      const pkgRes = await client.query(`SELECT * FROM packages WHERE id = $1`, [data.packageId]);
      if (pkgRes.rows.length === 0) {
        throw new Error('Package introuvable.');
      }
      const pkg = pkgRes.rows[0];

      const campRes = await client.query(`SELECT year FROM campaigns WHERE id = $1`, [data.campaignId]);
      const campaignYear = campRes.rows[0]?.year || new Date().getFullYear();

      const verRes = await client.query(
        `SELECT * FROM package_versions WHERE package_id = $1 ORDER BY version_number DESC LIMIT 1`,
        [data.packageId]
      );
      const activeVersion = verRes.rows[0];
      const packageVersionId = activeVersion ? activeVersion.id : 'ver-1';
      const versionNumber = activeVersion ? activeVersion.version_number : 1;
      const appliedPrice = Number(pkg.price);

      const code = await this.getNextInscriptionCode(campaignYear, client);
      const id = randomUUID();

      // 3. Insertion de l'inscription avec snapshot tarifaire
      await client.query(
        `INSERT INTO inscriptions (
          id, code, client_id, campaign_id, package_id, package_version_id, applied_price, agreed_price,
          price_version_snapshotted, status, agent_id, agent_name, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
        [
          id,
          code,
          data.clientId,
          data.campaignId,
          data.packageId,
          packageVersionId,
          appliedPrice,
          appliedPrice,
          versionNumber,
          data.status || 'CONFIRMEE',
          data.agentId || null,
          data.agentName || null,
        ]
      );

      // 4. Initialisation automatique du suivi de visa
      const visaId = randomUUID();
      await client.query(
        `INSERT INTO visas (
          id, client_id, inscription_id, status, notes, updated_at
        ) VALUES ($1, $2, $3, 'NON_DEMANDE', 'Initialisé automatiquement à l’inscription', NOW())`,
        [visaId, data.clientId, id]
      );

      await client.query('COMMIT');

      const created = await this.getInscriptionById(id);
      if (!created) throw new Error('Erreur lors de la récupération de l\'inscription créée.');
      return created;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async updateInscriptionPrice(id: string, newPrice: number): Promise<Inscription> {
    if (!newPrice || newPrice <= 0) {
      throw new Error('Le montant du tarif doit être supérieur à 0');
    }

    const res = await pool.query(
      `UPDATE inscriptions SET applied_price = $1, agreed_price = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [newPrice, id]
    );
    if (res.rows.length === 0) throw new Error('Inscription introuvable');

    const updated = await this.getInscriptionById(id);
    if (!updated) throw new Error('Erreur lors du rechargement de l\'inscription');
    return updated;
  }

  public async updateInscriptionStatus(id: string, status: Inscription['status']): Promise<Inscription> {
    const res = await pool.query(
      `UPDATE inscriptions SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (res.rows.length === 0) throw new Error('Inscription introuvable');

    const updated = await this.getInscriptionById(id);
    if (!updated) throw new Error('Erreur lors du rechargement de l\'inscription');
    return updated;
  }

  public async deleteInscription(id: string): Promise<void> {
    const payCheck = await pool.query(`SELECT COUNT(*) as count FROM payments WHERE inscription_id = $1`, [id]);
    if (parseInt(payCheck.rows[0].count, 10) > 0) {
      throw new Error('Impossible de supprimer une inscription possédant des paiements enregistrés.');
    }
    await pool.query(`DELETE FROM visas WHERE inscription_id = $1`, [id]);
    await pool.query(`DELETE FROM room_assignments WHERE inscription_id = $1`, [id]);
    await pool.query(`DELETE FROM group_members WHERE inscription_id = $1`, [id]);
    await pool.query(`DELETE FROM documents WHERE inscription_id = $1`, [id]);
    await pool.query(`DELETE FROM inscriptions WHERE id = $1`, [id]);
  }

  private mapRowToInscription(r: any): Inscription {
    const appliedPrice = Number(r.applied_price);
    const totalPaid = Number(r.total_paid || 0);
    const balance = Math.max(0, appliedPrice - totalPaid);
    const paymentRate = appliedPrice > 0 ? Math.round((totalPaid / appliedPrice) * 100) : 0;

    let paymentStatus: 'SOLDE' | 'EN_COURS' | 'EN_RETARD' | 'IMPAYE' = 'IMPAYE';
    if (totalPaid >= appliedPrice && appliedPrice > 0) {
      paymentStatus = 'SOLDE';
    } else if (totalPaid > 0) {
      paymentStatus = 'EN_COURS';
    }

    const validDocs = parseInt(r.valid_docs_count || '0', 10);
    const docRate = Math.min(100, Math.round((validDocs / 5) * 100)); // Default 5 required doc types

    return {
      id: r.id,
      code: r.code,
      clientId: r.client_id,
      voyageId: r.campaign_id,
      packageId: r.package_id,
      packageVersionId: r.package_version_id,
      appliedPrice,
      agreedPrice: Number(r.agreed_price),
      priceVersionSnapshotted: r.price_version_snapshotted,
      status: r.status,
      agentId: r.agent_id || '',
      agentName: r.agent_name || '',
      totalPaid,
      balance,
      paymentRate,
      paymentStatus,
      documentCompletenessRate: docRate,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      client: r.client_code ? {
        id: r.client_id,
        code: r.client_code,
        firstName: r.first_name,
        lastName: r.last_name,
        phone: r.client_phone,
        email: r.client_email,
      } as any : undefined,
      voyage: r.campaign_code ? {
        id: r.campaign_id,
        code: r.campaign_code,
        title: r.campaign_title,
        type: r.campaign_type,
        year: r.campaign_year,
      } as any : undefined,
      package: r.package_code ? {
        id: r.package_id,
        code: r.package_code,
        name: r.package_name,
        category: r.package_category,
      } as any : undefined,
    };
  }

  public async getPaymentSchedules(inscriptionId: string): Promise<PaymentSchedule[]> {
    const res = await pool.query(
      `SELECT * FROM payment_schedules WHERE inscription_id = $1 ORDER BY due_date ASC`,
      [inscriptionId]
    );
    return res.rows.map((r: any) => ({
      id: r.id,
      inscriptionId: r.inscription_id,
      dueDate: r.due_date ? new Date(r.due_date).toISOString().split('T')[0] : '',
      amountDue: Number(r.amount_due),
      status: r.status,
      comment: r.comment || undefined,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    }));
  }

  public async createPaymentSchedule(data: Omit<PaymentSchedule, 'id' | 'createdAt' | 'updatedAt'>): Promise<PaymentSchedule> {
    const id = randomUUID();
    const res = await pool.query(
      `INSERT INTO payment_schedules (id, inscription_id, due_date, amount_due, status, comment, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [
        id,
        data.inscriptionId,
        new Date(data.dueDate),
        data.amountDue,
        data.status || 'PENDING',
        data.comment || null,
      ]
    );
    const r = res.rows[0];
    return {
      id: r.id,
      inscriptionId: r.inscription_id,
      dueDate: r.due_date ? new Date(r.due_date).toISOString().split('T')[0] : '',
      amountDue: Number(r.amount_due),
      status: r.status,
      comment: r.comment || undefined,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    };
  }
}

export const inscriptionRepository = new InscriptionRepository();

