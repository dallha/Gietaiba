import crypto from 'crypto';
import pg from 'pg';
import { pool, withTransaction, getNextBusinessSequence } from '../db/neon.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { notificationRepository } from '../repositories/notification.repository.js';
import { idempotencyService } from './idempotency.service.js';
import { campaignWorkflowService } from './campaign-workflow.service.js';
import { formatPaymentReceiptNumber } from '../utils/business-format.js';
import { Payment, UserSession } from '../../src/types.js';

export interface RecordPaymentInput {
  clientId: string;
  inscriptionId: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
  comment?: string;
  paymentDate?: string;
  idempotencyKey?: string;
  overrideClosedCampaign?: { allowOverride?: boolean; reason?: string };
}

export interface CancelPaymentInput {
  paymentId: string;
  reason: string;
  idempotencyKey?: string;
  overrideClosedCampaign?: { allowOverride?: boolean; reason?: string };
}

export class PaymentWorkflowService {
  /**
   * Enregistre un encaissement sous transaction ACID avec :
   * - Vérification d'idempotence multi-acteurs (fingerprint SHA-256)
   * - Contrôle du statut de la campagne (interdiction si CLOTUREE sans dérogation)
   * - Numéro de reçu atomique séquentiel par année (PAY-YYYY-XXXXXX)
   * - Allocation comptable traçable FIFO dans payment_schedule_allocations
   * - Mise à jour du statut des tranches d'échéances (PAID / PARTIAL)
   * - Notification pèlerin et Audit log dans la même transaction
   */
  public async recordPayment(input: RecordPaymentInput, actor: UserSession): Promise<Payment> {
    if (!input.amount || input.amount <= 0) {
      throw new Error('Le montant du versement doit être strictement supérieur à 0.');
    }

    // 1. Contrôle Idempotence en amont
    let fingerprint = '';
    if (input.idempotencyKey) {
      fingerprint = idempotencyService.computeFingerprint({
        action: 'RECORD_PAYMENT',
        clientId: input.clientId,
        inscriptionId: input.inscriptionId,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        reference: input.reference,
      });

      const cached = await idempotencyService.getExistingResponse(
        input.idempotencyKey,
        actor.id,
        fingerprint
      );
      if (cached) {
        console.log(`[Idempotency] Réponse en cache retournée pour la clé ${input.idempotencyKey}`);
        return cached;
      }
    }

    // 2. Transaction ACID
    const payment = await withTransaction(async (client) => {
      // a. Verrouiller le dossier d'inscription
      const insRes = await client.query<{
        id: string;
        code: string;
        campaign_id: string;
        applied_price: string;
        status: string;
        client_id: string;
      }>(
        `SELECT id, code, campaign_id, applied_price, status, client_id
         FROM inscriptions WHERE id = $1 FOR UPDATE`,
        [input.inscriptionId]
      );

      if (insRes.rows.length === 0) {
        throw new Error(`Dossier d'inscription ${input.inscriptionId} introuvable.`);
      }

      const inscription = insRes.rows[0];
      const campaignId = inscription.campaign_id;

      if (inscription.status === 'ANNULEE') {
        throw new Error('Impossible d\'enregistrer un paiement sur une inscription annulée.');
      }

      // b. Contrôle de campagne non clôturée
      await campaignWorkflowService.assertCampaignAllowsMutation(
        campaignId,
        'ENCAISSEMENT_PAIEMENT',
        actor,
        input.overrideClosedCampaign,
        client
      );

      // c. Résolution de l'année pour la numérotation
      const campRes = await client.query<{ year: number }>(`SELECT year FROM campaigns WHERE id = $1`, [campaignId]);
      const year = campRes.rows[0]?.year || new Date().getFullYear();

      // d. Numéro de reçu atomique annuel GT-PAY<YY>-XXXXXX
      const seq = await getNextBusinessSequence('PAYMENT', year, client);
      const receiptNumber = formatPaymentReceiptNumber(year, seq);

      // e. Insertion du paiement (statut VALIDE, UUID v4)
      const paymentId = crypto.randomUUID();
      const paymentDate = input.paymentDate || new Date().toISOString().split('T')[0];

      const insertRes = await client.query(
        `INSERT INTO payments (
          id, inscription_id, client_id, campaign_id, amount, payment_date, payment_method,
          reference, receipt_number, status, agent_id, agent_name, comment, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'VALIDE', $10, $11, $12, NOW())
        RETURNING *`,
        [
          paymentId,
          input.inscriptionId,
          input.clientId,
          campaignId,
          input.amount,
          paymentDate,
          input.paymentMethod,
          input.reference || null,
          receiptNumber,
          actor.id,
          actor.displayName || actor.email,
          input.comment || null,
        ]
      );

      // f. Allocation FIFO traçable sur l'échéancier (payment_schedule_allocations)
      let unallocatedAmount = Number(input.amount);
      const schedulesRes = await client.query<{
        id: string;
        due_date: string;
        amount_due: string;
        status: string;
      }>(
        `SELECT id, due_date, amount_due, status
         FROM payment_schedules
         WHERE inscription_id = $1 AND status IN ('PENDING', 'PARTIAL')
         ORDER BY due_date ASC
         FOR UPDATE`,
        [input.inscriptionId]
      );

      for (const schedule of schedulesRes.rows) {
        if (unallocatedAmount <= 0) break;

        // Récupérer le cumul déjà alloué à cette échéance
        const allocSumRes = await client.query<{ sum: string }>(
          `SELECT COALESCE(SUM(amount_allocated), 0) as sum
           FROM payment_schedule_allocations
           WHERE payment_schedule_id = $1`,
          [schedule.id]
        );
        const currentAllocated = Number(allocSumRes.rows[0].sum);
        const amountDue = Number(schedule.amount_due);
        const remainingOnSchedule = Math.max(0, amountDue - currentAllocated);

        if (remainingOnSchedule > 0) {
          const allocAmount = Math.min(remainingOnSchedule, unallocatedAmount);
          const allocId = crypto.randomUUID();

          // Enregistrer l'allocation explicite
          await client.query(
            `INSERT INTO payment_schedule_allocations (
              id, payment_id, payment_schedule_id, amount_allocated, created_at
            ) VALUES ($1, $2, $3, $4, NOW())`,
            [allocId, paymentId, schedule.id, allocAmount]
          );

          // Mettre à jour le statut de l'échéance
          const newTotalAllocated = currentAllocated + allocAmount;
          const newStatus = newTotalAllocated >= amountDue ? 'PAID' : 'PARTIAL';

          await client.query(
            `UPDATE payment_schedules SET status = $1, updated_at = NOW() WHERE id = $2`,
            [newStatus, schedule.id]
          );

          unallocatedAmount -= allocAmount;
        }
      }

      // g. Audit log dans la transaction
      await auditRepository.logAudit({
        actorUserId: actor.id,
        actorUserName: actor.displayName || actor.email,
        action: 'ENREGISTREMENT_PAIEMENT',
        entityType: 'PAYMENT',
        entityId: paymentId,
        newValue: {
          receiptNumber,
          amount: input.amount,
          paymentMethod: input.paymentMethod,
          clientId: input.clientId,
          inscriptionId: input.inscriptionId,
          inscriptionCode: inscription.code,
        },
      }, client);

      // h. Notification pèlerin
      await notificationRepository.createNotification({
        recipientClientId: input.clientId,
        inscriptionId: input.inscriptionId,
        type: 'PAYMENT_VALIDATED',
        category: 'PAYMENT',
        title: `Paiement validé : ${input.amount.toLocaleString('fr-FR')} FCFA`,
        message: `Votre versement de ${input.amount.toLocaleString('fr-FR')} FCFA (${input.paymentMethod}) a été validé. Reçu officiel n° ${receiptNumber}.`,
        entityType: 'payment',
        entityId: paymentId,
        priority: 'HIGH',
        actionUrl: 'finances',
      }, client);

      const row = insertRes.rows[0];
      const result: Payment = {
        id: row.id,
        clientId: row.client_id,
        inscriptionId: row.inscription_id,
        voyageId: campaignId,
        amount: Number(row.amount),
        currency: 'XOF',
        paymentDate: row.payment_date,
        paymentMethod: row.payment_method,
        reference: row.reference,
        receiptNumber: row.receipt_number,
        status: row.status,
        agentId: row.agent_id,
        agentName: row.agent_name,
        comment: row.comment,
        createdAt: row.created_at,
      };

      // i. Enregistrer clé d'idempotence si présente
      if (input.idempotencyKey) {
        await idempotencyService.storeResponse(
          {
            key: input.idempotencyKey,
            actorUserId: actor.id,
            resourceType: 'PAYMENT',
            resourceId: paymentId,
            requestFingerprint: fingerprint,
            responsePayload: result,
          },
          client
        );
      }

      return result;
    });

    return payment;
  }

  /**
   * Annulation (Reversal) transactionnelle d'un versement :
   * - Retrouve et supprime les allocations exactes dans payment_schedule_allocations
   * - Réajuste l'échéancier prévisionnel à son état antérieur exact (sans devinette)
   * - Crée l'enregistrement payment_reversals
   * - Statut paiement -> ANNULE
   * - Traçabilité audit infalsifiable
   */
  public async cancelPayment(input: CancelPaymentInput, actor: UserSession): Promise<Payment> {
    if (!input.reason || !input.reason.trim()) {
      throw new Error('Le motif d\'annulation du versement est obligatoire.');
    }

    let fingerprint = '';
    if (input.idempotencyKey) {
      fingerprint = idempotencyService.computeFingerprint({
        action: 'CANCEL_PAYMENT',
        paymentId: input.paymentId,
        reason: input.reason.trim(),
      });

      const cached = await idempotencyService.getExistingResponse(
        input.idempotencyKey,
        actor.id,
        fingerprint
      );
      if (cached) return cached;
    }

    const cancelledPayment = await withTransaction(async (client) => {
      // a. Verrouiller le paiement
      const payRes = await client.query(
        `SELECT * FROM payments WHERE id = $1 FOR UPDATE`,
        [input.paymentId]
      );
      if (payRes.rows.length === 0) throw new Error('Paiement introuvable.');
      const payment = payRes.rows[0];

      if (payment.status === 'ANNULE') {
        throw new Error('Ce paiement a déjà été annulé.');
      }

      // b. Vérifier statut campagne
      const insRes = await client.query<{ campaign_id: string }>(
        `SELECT campaign_id FROM inscriptions WHERE id = $1`,
        [payment.inscription_id]
      );
      const campaignId = insRes.rows[0]?.campaign_id;
      if (campaignId) {
        await campaignWorkflowService.assertCampaignAllowsMutation(
          campaignId,
          'ANNULATION_PAIEMENT',
          actor,
          input.overrideClosedCampaign,
          client
        );
      }

      // c. Enregistrer le Reversal
      const reversalId = crypto.randomUUID();
      await client.query(
        `INSERT INTO payment_reversals (
          id, payment_id, reason, amount, actor_user_id, actor_user_name, reversed_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)`,
        [
          reversalId,
          payment.id,
          input.reason.trim(),
          payment.amount,
          actor.id,
          actor.displayName || actor.email,
          JSON.stringify({
            receiptNumber: payment.receipt_number,
            clientId: payment.client_id,
            inscriptionId: payment.inscription_id,
          }),
        ]
      );

      // d. Trouver toutes les allocations enregistrées pour ce paiement
      const allocsRes = await client.query<{ id: string; payment_schedule_id: string; amount_allocated: string }>(
        `SELECT id, payment_schedule_id, amount_allocated
         FROM payment_schedule_allocations
         WHERE payment_id = $1`,
        [payment.id]
      );

      const impactedScheduleIds = [...new Set(allocsRes.rows.map((a) => a.payment_schedule_id))];

      // e. Supprimer les allocations du paiement annulé
      await client.query(`DELETE FROM payment_schedule_allocations WHERE payment_id = $1`, [payment.id]);

      // f. Recalculer l'état exact de chaque échéance impactée
      for (const scheduleId of impactedScheduleIds) {
        const schRes = await client.query<{ amount_due: string }>(
          `SELECT amount_due FROM payment_schedules WHERE id = $1 FOR UPDATE`,
          [scheduleId]
        );
        if (schRes.rows.length > 0) {
          const amountDue = Number(schRes.rows[0].amount_due);
          const remainingAllocsRes = await client.query<{ sum: string }>(
            `SELECT COALESCE(SUM(amount_allocated), 0) as sum
             FROM payment_schedule_allocations
             WHERE payment_schedule_id = $1`,
            [scheduleId]
          );
          const totalRemaining = Number(remainingAllocsRes.rows[0].sum);

          let newStatus = 'PENDING';
          if (totalRemaining >= amountDue) {
            newStatus = 'PAID';
          } else if (totalRemaining > 0) {
            newStatus = 'PARTIAL';
          }

          await client.query(
            `UPDATE payment_schedules SET status = $1, updated_at = NOW() WHERE id = $2`,
            [newStatus, scheduleId]
          );
        }
      }

      // g. Mettre à jour le paiement
      const commentAppend = payment.comment
        ? `${payment.comment} | Annulé par ${actor.displayName || actor.email}: ${input.reason.trim()}`
        : `Annulé par ${actor.displayName || actor.email}: ${input.reason.trim()}`;

      const updateRes = await client.query(
        `UPDATE payments SET status = 'ANNULE', comment = $1 WHERE id = $2 RETURNING *`,
        [commentAppend, payment.id]
      );

      // h. Audit log
      await auditRepository.logAudit({
        actorUserId: actor.id,
        actorUserName: actor.displayName || actor.email,
        action: 'ANNULATION_PAIEMENT',
        entityType: 'PAYMENT',
        entityId: payment.id,
        newValue: {
          receiptNumber: payment.receipt_number,
          amount: payment.amount,
          reason: input.reason.trim(),
          status: 'ANNULE',
        },
        reason: input.reason.trim(),
      }, client);

      // i. Notification
      await notificationRepository.createNotification({
        recipientClientId: payment.client_id,
        inscriptionId: payment.inscription_id,
        type: 'PAYMENT_CANCELLED',
        category: 'PAYMENT',
        title: 'Paiement annulé',
        message: `Le versement n° ${payment.receipt_number} a été annulé. Motif : ${input.reason.trim()}.`,
        entityType: 'payment',
        entityId: payment.id,
        priority: 'HIGH',
        actionUrl: 'finances',
      }, client);

      const row = updateRes.rows[0];
      const result: Payment = {
        id: row.id,
        clientId: row.client_id,
        inscriptionId: row.inscription_id,
        voyageId: campaignId || '',
        amount: Number(row.amount),
        currency: 'XOF',
        paymentDate: row.payment_date,
        paymentMethod: row.payment_method,
        reference: row.reference,
        receiptNumber: row.receipt_number,
        status: row.status,
        agentId: row.agent_id,
        agentName: row.agent_name,
        comment: row.comment,
        createdAt: row.created_at,
      };

      if (input.idempotencyKey) {
        await idempotencyService.storeResponse(
          {
            key: input.idempotencyKey,
            actorUserId: actor.id,
            resourceType: 'PAYMENT_REVERSAL',
            resourceId: payment.id,
            requestFingerprint: fingerprint,
            responsePayload: result,
          },
          client
        );
      }

      return result;
    });

    return cancelledPayment;
  }
}

export const paymentWorkflowService = new PaymentWorkflowService();
