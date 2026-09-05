import crypto from 'crypto';
import pg from 'pg';
import { pool, withTransaction, getNextBusinessSequence } from '../db/neon.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { notificationRepository } from '../repositories/notification.repository.js';
import { idempotencyService } from './idempotency.service.js';
import { campaignWorkflowService } from './campaign-workflow.service.js';
import { Inscription, UserSession } from '../../src/types.js';

export interface CreateInscriptionInput {
  clientId: string;
  campaignId: string;
  packageId: string;
  agreedPrice?: number;
  priceModificationReason?: string;
  registrationDate?: string;
  idempotencyKey?: string;
  overrideClosedCampaign?: { allowOverride?: boolean; reason?: string };
}

export interface InscriptionSchedulePlan {
  dueDate: string;
  amountDue: number;
  comment: string;
}

export class InscriptionWorkflowService {
  /**
   * Calcule un échéancier prévisionnel dynamique et cohérent (Correction 1) :
   * - Aucune échéance ne peut être égale ou postérieure à la date de départ
   * - Répartition intelligente des acomptes selon le délai restant avant le départ
   */
  public calculateDynamicSchedules(
    totalPrice: number,
    registrationDateStr: string,
    campaignStartDateStr: string
  ): InscriptionSchedulePlan[] {
    const regDate = new Date(registrationDateStr);
    const startDate = new Date(campaignStartDateStr);

    if (isNaN(regDate.getTime()) || isNaN(startDate.getTime())) {
      throw new Error('Dates d\'inscription ou de départ invalides.');
    }

    const diffMs = startDate.getTime() - regDate.getTime();
    const daysUntilDeparture = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (daysUntilDeparture <= 0) {
      throw new Error(
        `DATE_INCOHERENTE: La date d'inscription (${registrationDateStr}) ne peut être postérieure ou égale à la date de départ (${campaignStartDateStr}).`
      );
    }

    const addDays = (d: Date, days: number): string => {
      const copy = new Date(d.getTime());
      copy.setDate(copy.getDate() + days);
      return copy.toISOString().split('T')[0];
    };

    const schedules: InscriptionSchedulePlan[] = [];

    if (daysUntilDeparture > 90) {
      // Cas standard : départ à plus de 3 mois
      // 1. Acompte 30% à J+7
      const due1 = addDays(regDate, 7);
      // 3. Solde 30% à J-30 avant départ
      const due3 = addDays(startDate, -30);
      // 2. Tranche 40% à mi-chemin
      const midDays = Math.floor((daysUntilDeparture - 37) / 2);
      const due2 = addDays(new Date(due1), Math.max(15, midDays));

      const p1 = Math.round(totalPrice * 0.3);
      const p2 = Math.round(totalPrice * 0.4);
      const p3 = totalPrice - p1 - p2;

      schedules.push(
        { dueDate: due1, amountDue: p1, comment: 'Acompte initial (30%)' },
        { dueDate: due2, amountDue: p2, comment: 'Tranche intermédiaire (40%)' },
        { dueDate: due3, amountDue: p3, comment: 'Solde avant départ (30%)' }
      );
    } else if (daysUntilDeparture > 30) {
      // Départ rapproché : 1 à 3 mois
      // 1. Acompte 50% à J+7
      const due1 = addDays(regDate, 7);
      // 2. Solde 50% à J-15 avant départ
      const due2 = addDays(startDate, -15);

      const p1 = Math.round(totalPrice * 0.5);
      const p2 = totalPrice - p1;

      schedules.push(
        { dueDate: due1, amountDue: p1, comment: 'Acompte initial (50%)' },
        { dueDate: due2, amountDue: p2, comment: 'Solde avant départ (50%)' }
      );
    } else {
      // Inscription de dernière minute (< 30 jours)
      // Solde unique 100% à J+3 ou J-3 avant départ
      const daysAllowed = Math.max(1, Math.min(3, daysUntilDeparture - 2));
      const due1 = addDays(regDate, daysAllowed);

      schedules.push({
        dueDate: due1,
        amountDue: totalPrice,
        comment: 'Règlement intégral comptant (Départ imminent)',
      });
    }

    // Validation absolue : aucune date d'échéance >= startDate
    for (const sch of schedules) {
      if (new Date(sch.dueDate) >= startDate) {
        throw new Error(
          `ECHEANCE_APRES_DEPART: L'échéance du ${sch.dueDate} dépasse la date de départ ${campaignStartDateStr}.`
        );
      }
    }

    return schedules;
  }

  /**
   * Création transactionnelle complète d'une inscription :
   * - Vérification d'idempotence multi-acteurs
   * - Contrôle de non-clôture de la campagne
   * - Contrôle d'unicité strict (anti-doublon de contrat pèlerin/campagne)
   * - Snapshot tarifaire contractuel figé
   * - Génération atomique INS-YYYY-XXXXXX
   * - Initialisation de l'échéancier dynamique
   * - Initialisation du dossier Visa
   * - Traçabilité audit infalsifiable
   */
  public async createInscription(input: CreateInscriptionInput, actor: UserSession): Promise<Inscription> {
    // 1. Idempotence
    let fingerprint = '';
    if (input.idempotencyKey) {
      fingerprint = idempotencyService.computeFingerprint({
        action: 'CREATE_INSCRIPTION',
        clientId: input.clientId,
        campaignId: input.campaignId,
        packageId: input.packageId,
        agreedPrice: input.agreedPrice,
      });

      const cached = await idempotencyService.getExistingResponse(
        input.idempotencyKey,
        actor.id,
        fingerprint
      );
      if (cached) {
        console.log(`[Idempotency] Dossier d'inscription retourné depuis le cache (${input.idempotencyKey})`);
        return cached;
      }
    }

    // 2. Transaction ACID
    const inscription = await withTransaction(async (client) => {
      // a. Vérifier existence client
      const cliRes = await client.query(`SELECT id, first_name, last_name, code FROM clients WHERE id = $1`, [input.clientId]);
      if (cliRes.rows.length === 0) throw new Error(`Client ${input.clientId} introuvable.`);
      const clientRecord = cliRes.rows[0];
      const clientFullName = `${clientRecord.first_name} ${clientRecord.last_name}`;

      // b. Vérifier campagne
      const campRes = await client.query<{ id: string; title: string; year: number; departure_date: string; status: string }>(
        `SELECT id, title, year, departure_date, status FROM campaigns WHERE id = $1`,
        [input.campaignId]
      );
      if (campRes.rows.length === 0) throw new Error(`Campagne ${input.campaignId} introuvable.`);
      const campaign = campRes.rows[0];

      await campaignWorkflowService.assertCampaignAllowsMutation(
        input.campaignId,
        'CREATION_INSCRIPTION',
        actor,
        input.overrideClosedCampaign,
        client
      );

      // c. Vérifier package
      const pkgRes = await client.query<{ id: string; name: string; price: string }>(
        `SELECT id, name, price FROM packages WHERE id = $1`,
        [input.packageId]
      );
      if (pkgRes.rows.length === 0) throw new Error(`Package ${input.packageId} introuvable.`);
      const pkg = pkgRes.rows[0];

      // d. Contrôle d'unicité anti-doublon
      const dupRes = await client.query<{ id: string; code: string; status: string }>(
        `SELECT id, code, status FROM inscriptions
         WHERE client_id = $1 AND campaign_id = $2 AND status != 'ANNULEE'
         FOR UPDATE`,
        [input.clientId, input.campaignId]
      );

      if (dupRes.rows.length > 0) {
        throw new Error(
          `DUPLICATE_INSCRIPTION: Le client ${clientFullName} (${clientRecord.code}) possède déjà un dossier actif (${dupRes.rows[0].code}, statut: ${dupRes.rows[0].status}) sur cette campagne.`
        );
      }

      // e. Snapshot tarifaire
      const basePackagePrice = Number(pkg.price);
      let appliedPrice = basePackagePrice;
      if (input.agreedPrice !== undefined && input.agreedPrice !== null) {
        if (input.agreedPrice <= 0) {
          throw new Error('Le prix convenu doit être strictement supérieur à 0.');
        }
        if (input.agreedPrice !== basePackagePrice && (!input.priceModificationReason || !input.priceModificationReason.trim())) {
          throw new Error('Un motif est obligatoire lorsque le prix convenu diffère du tarif catalogue du package.');
        }
        appliedPrice = input.agreedPrice;
      }

      // Récupération de la version de package active
      const verRes = await client.query<{ id: string; version_number: number }>(
        `SELECT id, version_number FROM package_versions WHERE package_id = $1 ORDER BY version_number DESC LIMIT 1`,
        [input.packageId]
      );
      const activeVersion = verRes.rows[0];
      const packageVersionId = activeVersion ? activeVersion.id : 'ver-default';
      const versionNumber = activeVersion ? activeVersion.version_number : 1;

      // f. Numéro de dossier atomique séquentiel
      const year = campaign.year || new Date().getFullYear();
      const seq = await getNextBusinessSequence('INSCRIPTION', year, client);
      const code = `INS-${year}-${seq.toString().padStart(6, '0')}`;

      // g. Insertion inscription
      const inscriptionId = crypto.randomUUID();

      const insInsertRes = await client.query(
        `INSERT INTO inscriptions (
          id, code, client_id, campaign_id, package_id, package_version_id,
          applied_price, agreed_price, price_version_snapshotted, status,
          agent_id, agent_name, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'CONFIRMEE', $10, $11, NOW(), NOW())
        RETURNING *`,
        [
          inscriptionId,
          code,
          input.clientId,
          input.campaignId,
          input.packageId,
          packageVersionId,
          appliedPrice,
          appliedPrice,
          versionNumber,
          actor.id,
          actor.displayName || actor.email,
        ]
      );

      // h. Génération dynamique de l'échéancier prévisionnel
      const departureDateStr = campaign.departure_date
        ? new Date(campaign.departure_date).toISOString().split('T')[0]
        : `${year}-06-01`;

      const regDate = input.registrationDate || new Date().toISOString().split('T')[0];

      const dynamicPlans = this.calculateDynamicSchedules(
        appliedPrice,
        regDate,
        departureDateStr
      );

      for (const plan of dynamicPlans) {
        const schId = crypto.randomUUID();
        await client.query(
          `INSERT INTO payment_schedules (
            id, inscription_id, due_date, amount_due, status, comment, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, 'PENDING', $5, NOW(), NOW())`,
          [schId, inscriptionId, plan.dueDate, plan.amountDue, plan.comment]
        );
      }

      // i. Initialisation automatique du dossier visa
      const visaId = crypto.randomUUID();
      await client.query(
        `INSERT INTO visas (
          id, client_id, inscription_id, status, notes, updated_at
        ) VALUES ($1, $2, $3, 'NON_DEMANDE', 'Initialisé automatiquement à l’inscription', NOW())`,
        [visaId, input.clientId, inscriptionId]
      );

      // j. Audit log
      await auditRepository.logAudit({
        actorUserId: actor.id,
        actorUserName: actor.displayName || actor.email,
        action: 'CREATION_INSCRIPTION',
        entityType: 'INSCRIPTION',
        entityId: inscriptionId,
        newValue: {
          code,
          clientId: input.clientId,
          clientName: clientFullName,
          campaignId: input.campaignId,
          packageId: input.packageId,
          appliedPrice,
          schedulesCount: dynamicPlans.length,
        },
      }, client);

      // k. Notification pèlerin
      await notificationRepository.createNotification({
        recipientClientId: input.clientId,
        inscriptionId,
        type: 'INSCRIPTION_CONFIRMED',
        category: 'INSCRIPTION',
        title: 'Inscription confirmée',
        message: `Votre contrat Hajj/Oumrah n° ${code} pour la campagne ${campaign.title} a été validé avec succès.`,
        entityType: 'inscription',
        entityId: inscriptionId,
        priority: 'HIGH',
        actionUrl: 'inscriptions',
      }, client);

      const row = insInsertRes.rows[0];
      const result: Inscription = {
        id: row.id,
        clientId: row.client_id,
        campaignId: row.campaign_id,
        voyageId: row.voyage_id,
        packageId: row.package_id,
        packageVersionId: row.package_version_id || 'pkg-ver-default',
        status: row.status,
        appliedPrice: Number(row.applied_price),
        code: row.code,
        registrationDate: row.registration_date,
        agentId: row.agent_id,
        agentName: row.agent_name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };

      if (input.idempotencyKey) {
        await idempotencyService.storeResponse(
          {
            key: input.idempotencyKey,
            actorUserId: actor.id,
            resourceType: 'INSCRIPTION',
            resourceId: inscriptionId,
            requestFingerprint: fingerprint,
            responsePayload: result,
          },
          client
        );
      }

      return result;
    });

    return inscription;
  }
}

export const inscriptionWorkflowService = new InscriptionWorkflowService();
