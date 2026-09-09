import 'dotenv/config';
import pg from 'pg';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { pool } from '../server/db/neon.js';
import { inscriptionWorkflowService } from '../server/services/inscription-workflow.service.js';
import { paymentWorkflowService } from '../server/services/payment-workflow.service.js';
import { campaignWorkflowService } from '../server/services/campaign-workflow.service.js';
import { logisticsWorkflowService } from '../server/services/logistics-workflow.service.js';
import { documentService } from '../server/services/document.service.js';
import { idempotencyService } from '../server/services/idempotency.service.js';
import { UserSession } from '../src/types.js';

interface TestResult {
  suite: string;
  index: number;
  description: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];
let testIndex = 1;

function record(suite: string, description: string, passed: boolean, details?: string) {
  results.push({ suite, index: testIndex++, description, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [${suite}] #${testIndex - 1}: ${description}${details ? ` -> ${details}` : ''}`);
}

const mockActorAdmin: UserSession = {
  id: 'usr-admin',
  email: 'admin@taiba-voyages.sn',
  role: 'SUPER_ADMIN',
  displayName: 'El Hadj Amadou Niang (Super Admin)',
};

const mockActorAgent: UserSession = {
  id: 'usr-agent',
  email: 'agent@taiba-voyages.sn',
  role: 'AGENT_SAISIE',
  displayName: 'Mariama Ba (Conseillère Pèlerinage)',
};

async function getHistoricalFinancialMetrics() {
  const client = await pool.connect();
  try {
    // CA Attendu
    const insRes = await client.query<{ sum: string }>(
      `SELECT COALESCE(SUM(applied_price), 0) as sum FROM inscriptions WHERE status != 'ANNULEE' AND code NOT LIKE 'TEST-%'`
    );
    const expectedRevenue = Number(insRes.rows[0].sum);

    // Encaissements validés
    const payRes = await client.query<{ sum: string }>(
      `SELECT COALESCE(SUM(amount), 0) as sum FROM payments WHERE status = 'VALIDE' AND receipt_number NOT LIKE 'TEST-%'`
    );
    const collectedRevenue = Number(payRes.rows[0].sum);

    // Dépenses
    const expRes = await client.query<{ sum: string }>(
      `SELECT COALESCE(SUM(amount), 0) as sum FROM expenses`
    );
    const totalExpenses = Number(expRes.rows[0].sum);

    // Fatoumata Sow
    const fatouRes = await client.query<{ sum: string }>(
      `SELECT COALESCE(SUM(p.amount), 0) as sum
       FROM payments p
       JOIN clients c ON p.client_id = c.id
       WHERE (c.code = 'GT-000003' OR c.id = 'cli-003') AND p.status = 'VALIDE'`
    );
    const fatoumataPaid = Number(fatouRes.rows[0].sum);

    return {
      expectedRevenue,
      collectedRevenue,
      totalExpenses,
      fatoumataPaid,
    };
  } finally {
    client.release();
  }
}

async function cleanTestEnvironment(campaignId?: string) {
  const cleanClient = await pool.connect();
  try {
    await cleanClient.query('BEGIN');
    const filter = campaignId ? '= $1' : 'LIKE \'test-camp-%\'';
    const params = campaignId ? [campaignId] : [];

    await cleanClient.query(`DELETE FROM room_assignments WHERE room_id LIKE 'test-room-%' OR client_id LIKE 'test-cli%' OR room_id IN (SELECT id FROM rooms WHERE campaign_id ${filter})`, params);
    await cleanClient.query(`DELETE FROM rooms WHERE id LIKE 'test-room-%' OR campaign_id ${filter}`, params);
    await cleanClient.query(`DELETE FROM hotels WHERE id LIKE 'test-hot-%' OR campaign_id ${filter}`, params);
    await cleanClient.query(`DELETE FROM payment_schedule_allocations WHERE payment_id IN (SELECT id FROM payments WHERE inscription_id IN (SELECT id FROM inscriptions WHERE campaign_id ${filter}) OR client_id LIKE 'test-cli%')`, params);
    await cleanClient.query(`DELETE FROM payment_reversals WHERE payment_id IN (SELECT id FROM payments WHERE inscription_id IN (SELECT id FROM inscriptions WHERE campaign_id ${filter}) OR client_id LIKE 'test-cli%')`, params);
    await cleanClient.query(`DELETE FROM payments WHERE inscription_id IN (SELECT id FROM inscriptions WHERE campaign_id ${filter}) OR client_id LIKE 'test-cli%'`, params);
    await cleanClient.query(`DELETE FROM payment_schedules WHERE inscription_id IN (SELECT id FROM inscriptions WHERE campaign_id ${filter})`, params);
    await cleanClient.query(`DELETE FROM visas WHERE inscription_id IN (SELECT id FROM inscriptions WHERE campaign_id ${filter}) OR client_id LIKE 'test-cli%'`, params);
    await cleanClient.query(`DELETE FROM notifications WHERE recipient_client_id LIKE 'test-cli%'`);
    await cleanClient.query(`DELETE FROM audit_logs WHERE entity_id LIKE 'test-%'`);
    await cleanClient.query(`DELETE FROM idempotency_keys WHERE key LIKE 'IDEMP-%'`);
    await cleanClient.query(`DELETE FROM inscriptions WHERE campaign_id ${filter} OR client_id LIKE 'test-cli%'`, params);
    await cleanClient.query(`DELETE FROM package_versions WHERE package_id IN (SELECT id FROM packages WHERE campaign_id ${filter}) OR package_id LIKE 'test-pkg-%'`, params);
    await cleanClient.query(`DELETE FROM packages WHERE campaign_id ${filter} OR id LIKE 'test-pkg-%'`, params);
    await cleanClient.query(`DELETE FROM clients WHERE id LIKE 'test-cli%'`);
    await cleanClient.query(`DELETE FROM campaigns WHERE id ${filter}`, params);
    await cleanClient.query('COMMIT');
  } catch (e) {
    await cleanClient.query('ROLLBACK');
    console.error('[CLEANUP ERROR]:', e);
  } finally {
    cleanClient.release();
  }
}

async function runPhase42TestSuite() {
  console.log('=====================================================================');
  console.log('  SUITE DE TESTS PHASE 4.2 — WORKFLOWS MÉTIER & TRANSACTIONNELS');
  console.log('=====================================================================\n');

  // Pré-nettoyage automatique pour garantir l'isolation
  await cleanTestEnvironment();

  const testUid = crypto.randomUUID().substring(0, 8);
  const testCampaignId = `test-camp-${testUid}`;
  const testPackageId = `test-pkg-${testUid}`;
  const testClientId1 = `test-cli1-${testUid}`;
  const testClientId2 = `test-cli2-${testUid}`;
  const testClientId3 = `test-cli3-${testUid}`;
  const testHotelId = `test-hot-${testUid}`;
  const testRoomId = `test-room-${testUid}`;

  let tempInscriptionId1 = '';
  let tempPaymentId1 = '';
  let tempPaymentId2 = '';

  try {
    // -------------------------------------------------------------
    // CONTRÔLE 0 : INVARIANTS FINANCIERS INITIAUX DE PRODUCTION
    // -------------------------------------------------------------
    const initialFinances = await getHistoricalFinancialMetrics();
    console.log('[FINANCIAL BASELINE INITIALE]:', initialFinances);
    record(
      'FINANCIAL_INVARIANTS',
      'Vérification initiale des invariants financiers de référence',
      initialFinances.expectedRevenue === 30600000 &&
        initialFinances.collectedRevenue === 4500000 &&
        initialFinances.totalExpenses === 0 &&
        initialFinances.fatoumataPaid === 4000000,
      `CA: ${initialFinances.expectedRevenue}, Encaissé: ${initialFinances.collectedRevenue}, Dépenses: ${initialFinances.totalExpenses}, Fatoumata Sow: ${initialFinances.fatoumataPaid}`
    );

    // -------------------------------------------------------------
    // PRÉPARATION DE L'ENVIRONNEMENT DE TEST ISOLÉ (Correction 6)
    // -------------------------------------------------------------
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // 1. Campagne de test isolée
      await client.query(
        `INSERT INTO campaigns (
          id, code, title, type, year, departure_date, return_date, capacity, status, created_at, updated_at
        ) VALUES ($1, $2, $3, 'HAJJ', 2027, '2027-06-01', '2027-07-01', 50, 'OUVERTE', NOW(), NOW())`,
        [testCampaignId, `TEST-CAMP-${testUid}`, `Campagne Test Hajj 2027 ${testUid}`]
      );

      // 2. Package de test
      await client.query(
        `INSERT INTO packages (
          id, campaign_id, code, name, category, price, initial_price, current_price, currency, valid_from, status, created_at, updated_at
        ) VALUES ($1, $2, $3, 'Package Test Confort', 'CONFORT', 3000000, 3000000, 3000000, 'FCFA', '2026-01-01', 'DEFINITIF', NOW(), NOW())`,
        [testPackageId, testCampaignId, `PKG-TEST-${testUid}`]
      );
      await client.query(
        `INSERT INTO package_versions (
          id, package_id, version_number, price, status, effective_from, created_at
        ) VALUES ($1, $2, 1, 3000000, 'DEFINITIF', '2026-01-01', NOW())`,
        [`ver-test-${testUid}`, testPackageId]
      );

      // 3. Clients de test
      await client.query(
        `INSERT INTO clients (id, code, first_name, last_name, passport_number, nationality, gender, phone, email, created_at)
         VALUES ($1, $2, 'Pèlerin Test', 'Un', 'TESTP001', 'Sénégalaise', 'M', '+22177000001', 'pelerin1@test.sn', NOW())`,
        [testClientId1, `TEST-CLI1-${testUid}`]
      );
      await client.query(
        `INSERT INTO clients (id, code, first_name, last_name, passport_number, nationality, gender, phone, email, created_at)
         VALUES ($1, $2, 'Pèlerin Test', 'Deux', 'TESTP002', 'Sénégalaise', 'F', '+22177000002', 'pelerin2@test.sn', NOW())`,
        [testClientId2, `TEST-CLI2-${testUid}`]
      );
      await client.query(
        `INSERT INTO clients (id, code, first_name, last_name, passport_number, nationality, gender, phone, email, created_at)
         VALUES ($1, $2, 'Pèlerin Test', 'Trois', 'TESTP003', 'Sénégalaise', 'M', '+22177000003', 'pelerin3@test.sn', NOW())`,
        [testClientId3, `TEST-CLI3-${testUid}`]
      );

      // 4. Hôtel et Chambre de capacité 2 places
      await client.query(
        `INSERT INTO hotels (id, campaign_id, name, city, address, category, check_in_date, check_out_date, created_at)
         VALUES ($1, $2, 'Hôtel Test Makkah', 'Makkah', 'Ibrahim Al Khalil', '5', '2027-06-01', '2027-06-15', NOW())`,
        [testHotelId, testCampaignId]
      );
      await client.query(
        `INSERT INTO rooms (id, hotel_id, campaign_id, room_number, room_type, capacity, current_occupancy, created_at)
         VALUES ($1, $2, $3, 'CH-TEST-101', 'DOUBLE', 2, 0, NOW())`,
        [testRoomId, testHotelId, testCampaignId]
      );

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    // -------------------------------------------------------------
    // TEST 1 : WORKFLOW D'INSCRIPTION TRANSACTIONNEL (Correction 1)
    // -------------------------------------------------------------
    console.log('\n--- TEST 1 : WORKFLOW D\'INSCRIPTION & ÉCHÉANCIER DYNAMIQUE ---');
    const ins1 = await inscriptionWorkflowService.createInscription(
      {
        clientId: testClientId1,
        campaignId: testCampaignId,
        packageId: testPackageId,
        registrationDate: '2026-10-01', // Bien avant départ 2027-06-01 (> 90j)
      },
      mockActorAgent
    );
    tempInscriptionId1 = ins1.id;

    record(
      'INSCRIPTION_WORKFLOW',
      'Création d\'inscription transactionnelle avec code GT-HJ27-XXXXXX',
      /^GT-HJ27-\d{6}$/.test(ins1.code) && ins1.appliedPrice === 3000000,
      `Code: ${ins1.code}, Prix gravé: ${ins1.appliedPrice} FCFA`
    );

    // Vérification de l'échéancier dynamique calculé
    const schedulesRes = await pool.query<{
      id: string;
      due_date: string;
      amount_due: string;
      status: string;
      comment: string;
    }>(
      `SELECT id, due_date, amount_due, status, comment FROM payment_schedules WHERE inscription_id = $1 ORDER BY due_date ASC`,
      [ins1.id]
    );

    const schList = schedulesRes.rows;
    const allBeforeDeparture = schList.every((s) => new Date(s.due_date) < new Date('2027-06-01'));
    const totalScheduleAmount = schList.reduce((acc, s) => acc + Number(s.amount_due), 0);

    record(
      'INSCRIPTION_WORKFLOW',
      'Échéancier dynamique : 3 tranches, total exact et aucune échéance >= départ (Correction 1)',
      schList.length === 3 && totalScheduleAmount === 3000000 && allBeforeDeparture,
      `Tranches: ${schList.length}, Somme: ${totalScheduleAmount} FCFA, Max date: ${schList[schList.length - 1]?.due_date}`
    );

    // Initialisation automatique du visa
    const visaRes = await pool.query<{ id: string; status: string }>(
      `SELECT id, status FROM visas WHERE inscription_id = $1`,
      [ins1.id]
    );
    record(
      'INSCRIPTION_WORKFLOW',
      'Initialisation automatique du dossier visa (NON_DEMANDE)',
      visaRes.rows.length === 1 && visaRes.rows[0].status === 'NON_DEMANDE',
      `Visa ID: ${visaRes.rows[0]?.id}`
    );

    // Test de rejet anti-doublon strict
    let duplicateRejected = false;
    try {
      await inscriptionWorkflowService.createInscription(
        {
          clientId: testClientId1,
          campaignId: testCampaignId,
          packageId: testPackageId,
        },
        mockActorAgent
      );
    } catch (err: any) {
      duplicateRejected = err.message.includes('DUPLICATE_INSCRIPTION');
    }
    record(
      'INSCRIPTION_WORKFLOW',
      'Contrôle anti-doublon : rejet immédiat d\'une double inscription active',
      duplicateRejected,
      'Rejeté avec succès'
    );

    // -------------------------------------------------------------
    // TEST 2 : WORKFLOW FINANCIER & ALLOCATION FIFO (Correction 2)
    // -------------------------------------------------------------
    console.log('\n--- TEST 2 : ENCAISSEMENT & ALLOCATION FIFO SUR ÉCHÉANCIER ---');

    // Premier paiement : 1 000 000 FCFA
    // Tranche 1 = 900 000 -> doit être soldée à 100% (PAID)
    // Tranche 2 = 1 200 000 -> doit recevoir 100 000 (PARTIAL)
    // Tranche 3 = 900 000 -> 0 (PENDING)
    const pay1 = await paymentWorkflowService.recordPayment(
      {
        clientId: testClientId1,
        inscriptionId: ins1.id,
        amount: 1000000,
        paymentMethod: 'Virement',
        reference: 'VIR-TEST-001',
      },
      mockActorAgent
    );
    tempPaymentId1 = pay1.id;

    record(
      'FINANCIAL_WORKFLOW',
      'Premier paiement de 1 000 000 FCFA validé avec reçu atomique GT-PAY27-XXXXXX',
      /^GT-PAY27-\d{6}$/.test(pay1.receiptNumber) && pay1.amount === 1000000,
      `Reçu: ${pay1.receiptNumber}`
    );

    // Vérifier les allocations enregistrées
    const allocsPay1 = await pool.query<{ payment_schedule_id: string; amount_allocated: string }>(
      `SELECT payment_schedule_id, amount_allocated FROM payment_schedule_allocations WHERE payment_id = $1 ORDER BY amount_allocated DESC`,
      [pay1.id]
    );

    const schAfterPay1 = await pool.query<{ id: string; status: string }>(
      `SELECT id, status FROM payment_schedules WHERE inscription_id = $1 ORDER BY due_date ASC`,
      [ins1.id]
    );

    const tranche1Paid = schAfterPay1.rows[0].status === 'PAID';
    const tranche2Partial = schAfterPay1.rows[1].status === 'PARTIAL';
    const tranche3Pending = schAfterPay1.rows[2].status === 'PENDING';

    record(
      'FINANCIAL_WORKFLOW',
      'Traçabilité payment_schedule_allocations : Tranche 1 PAID, Tranche 2 PARTIAL, Tranche 3 PENDING',
      allocsPay1.rows.length === 2 && tranche1Paid && tranche2Partial && tranche3Pending,
      `Allocs count: ${allocsPay1.rows.length} (900k + 100k)`
    );

    // Deuxième paiement : 1 500 000 FCFA
    // Tranche 2 (restant 1 100 000) -> soldée à 100% (PAID)
    // Tranche 3 (900 000) -> reçoit 400 000 (PARTIAL)
    const pay2 = await paymentWorkflowService.recordPayment(
      {
        clientId: testClientId1,
        inscriptionId: ins1.id,
        amount: 1500000,
        paymentMethod: 'Wave',
        reference: 'WAVE-TEST-002',
      },
      mockActorAgent
    );
    tempPaymentId2 = pay2.id;

    const schAfterPay2 = await pool.query<{ id: string; status: string }>(
      `SELECT id, status FROM payment_schedules WHERE inscription_id = $1 ORDER BY due_date ASC`,
      [ins1.id]
    );

    const tranche1StillPaid = schAfterPay2.rows[0].status === 'PAID';
    const tranche2NowPaid = schAfterPay2.rows[1].status === 'PAID';
    const tranche3NowPartial = schAfterPay2.rows[2].status === 'PARTIAL';

    record(
      'FINANCIAL_WORKFLOW',
      'Deuxième paiement 1 500 000 FCFA : Tranche 2 soldée (PAID), Tranche 3 entamée (PARTIAL)',
      tranche1StillPaid && tranche2NowPaid && tranche3NowPartial,
      `Statuts: [${schAfterPay2.rows.map((s) => s.status).join(', ')}]`
    );

    // -------------------------------------------------------------
    // TEST 3 : REVERSAL / ANNULATION SANS DEVIENETTE (Correction 2)
    // -------------------------------------------------------------
    console.log('\n--- TEST 3 : REVERSAL DE PAIEMENT & DÉ-ALLOCATION EXACTE ---');
    const cancelledPay2 = await paymentWorkflowService.cancelPayment(
      {
        paymentId: pay2.id,
        reason: 'Erreur d\'imputation de compte sur le paiement Wave 1.5M',
      },
      mockActorAdmin
    );

    record(
      'FINANCIAL_WORKFLOW',
      'Annulation du deuxième versement : statut ANNULE et création payment_reversals',
      cancelledPay2.status === 'ANNULE',
      `ID: ${cancelledPay2.id}, Statut: ${cancelledPay2.status}`
    );

    // Vérifier l'état reconstruit de l'échéancier après annulation
    const schAfterReversal = await pool.query<{ id: string; status: string }>(
      `SELECT id, status FROM payment_schedules WHERE inscription_id = $1 ORDER BY due_date ASC`,
      [ins1.id]
    );

    // Tranche 1 doit rester PAID (couverte par paiement 1)
    // Tranche 2 doit redevenir PARTIAL (100k restant du paiement 1)
    // Tranche 3 doit redevenir PENDING (0 alloué)
    const revTranche1 = schAfterReversal.rows[0].status === 'PAID';
    const revTranche2 = schAfterReversal.rows[1].status === 'PARTIAL';
    const revTranche3 = schAfterReversal.rows[2].status === 'PENDING';

    record(
      'FINANCIAL_WORKFLOW',
      'Rétablissement exact des statuts d\'échéancier après reversal (Tranche 1 PAID, 2 PARTIAL, 3 PENDING)',
      revTranche1 && revTranche2 && revTranche3,
      `Statuts restaurés: [${schAfterReversal.rows.map((s) => s.status).join(', ')}]`
    );

    // -------------------------------------------------------------
    // TEST 4 : IDEMPOTENCE MULTI-ACTEURS & FINGERPRINT (Correction 3)
    // -------------------------------------------------------------
    console.log('\n--- TEST 4 : IDEMPOTENCE AVEC EMPREINTE SHA-256 ---');
    const idempKey = `IDEMP-${crypto.randomUUID()}`;

    // Premier appel idempotent
    const idempRes1 = await paymentWorkflowService.recordPayment(
      {
        clientId: testClientId1,
        inscriptionId: ins1.id,
        amount: 250000,
        paymentMethod: 'Especes',
        reference: 'ESP-IDEMP-01',
        idempotencyKey: idempKey,
      },
      mockActorAgent
    );

    // Deuxième appel avec STRICTEMENT les mêmes paramètres et la même clé
    const idempRes2 = await paymentWorkflowService.recordPayment(
      {
        clientId: testClientId1,
        inscriptionId: ins1.id,
        amount: 250000,
        paymentMethod: 'Especes',
        reference: 'ESP-IDEMP-01',
        idempotencyKey: idempKey,
      },
      mockActorAgent
    );

    record(
      'IDEMPOTENCY',
      'Même clé + même requête : renvoi transparent du payload d\'origine sans recréer de paiement',
      idempRes1.id === idempRes2.id && idempRes1.receiptNumber === idempRes2.receiptNumber,
      `ID Reçu identique: ${idempRes1.receiptNumber}`
    );

    // Troisième appel : MÊME clé mais avec REQUÊTE MODIFIÉE (montant 350000 au lieu de 250000)
    let differentRequestRejected = false;
    try {
      await paymentWorkflowService.recordPayment(
        {
          clientId: testClientId1,
          inscriptionId: ins1.id,
          amount: 350000, // Différent !
          paymentMethod: 'Especes',
          reference: 'ESP-IDEMP-01',
          idempotencyKey: idempKey,
        },
        mockActorAgent
      );
    } catch (err: any) {
      differentRequestRejected = err.message.includes('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST');
    }

    record(
      'IDEMPOTENCY',
      'Même clé + requête modifiée : détection de conflit et rejet IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST (Correction 3)',
      differentRequestRejected,
      'Rejeté avec succès'
    );

    // -------------------------------------------------------------
    // TEST 5 : CONTRÔLE VALIDITÉ PASSEPORT CONFIGURABLE (Correction 4)
    // -------------------------------------------------------------
    console.log('\n--- TEST 5 : VALIDITÉ PASSEPORT & TESTS DE FRONTIÈRE ---');
    // Date fin campagne de test : 2027-07-01
    // Passeport 1 : expiration 2027-09-01 -> 2 mois (< 6 mois) -> Invalide
    const checkInvalid = documentService.validatePassportValidity('2027-09-01', '2027-07-01', 6);
    // Passeport 2 : expiration 2028-02-01 -> 7 mois (>= 6 mois) -> Valide
    const checkValid = documentService.validatePassportValidity('2028-02-01', '2027-07-01', 6);

    record(
      'DOCUMENT_WORKFLOW',
      'Frontière passeport : expiration à 2 mois bloquée (PASSPORT_EXPIRING_SOON), expiration à 7 mois acceptée (Correction 4)',
      !checkInvalid.isValid && checkValid.isValid,
      `Invalide: ${checkInvalid.isValid} (${checkInvalid.marginMonths}m), Valide: ${checkValid.isValid} (${checkValid.marginMonths}m)`
    );

    // Test rejet document avec motif obligatoire
    let rejectWithoutReasonFailed = false;
    try {
      await documentService.updateDocumentStatus('dummy-doc-id', 'REFUSE', '', mockActorAgent);
    } catch (err: any) {
      rejectWithoutReasonFailed = err.message.includes('Un motif de rejet est obligatoire');
    }
    record(
      'DOCUMENT_WORKFLOW',
      'Contrôle documentaire : interdiction formelle de rejeter une pièce sans motif',
      rejectWithoutReasonFailed,
      'Bloqué avec succès'
    );

    // -------------------------------------------------------------
    // TEST 6 : ATTRIBUTION CHAMBRE & VERROU ANTI-SURBOOKING
    // -------------------------------------------------------------
    console.log('\n--- TEST 6 : LOGISTIQUE HÉBERGEMENT & ANTI-SURBOOKING ---');
    // Chambre testRoomId a une capacité de 2
    // Attribution 1 -> pèlerin 1 -> OK (occupancy = 1)
    const assign1 = await logisticsWorkflowService.assignRoomPessimistic(
      {
        roomId: testRoomId,
        clientId: testClientId1,
        inscriptionId: ins1.id,
        checkInDate: '2027-06-01',
        checkOutDate: '2027-06-15',
      },
      mockActorAgent
    );

    // Attribution 2 -> pèlerin 2 -> OK (occupancy = 2)
    const assign2 = await logisticsWorkflowService.assignRoomPessimistic(
      {
        roomId: testRoomId,
        clientId: testClientId2,
        inscriptionId: ins1.id,
        checkInDate: '2027-06-01',
        checkOutDate: '2027-06-15',
      },
      mockActorAgent
    );

    record(
      'LOGISTICS_WORKFLOW',
      'Attribution normale de 2 places dans chambre double (capacité: 2)',
      !!assign1.id && !!assign2.id,
      `Assign1: ${assign1.id}, Assign2: ${assign2.id}`
    );

    // Attribution 3 -> pèlerin 3 -> Doit échouer avec ROOM_FULL_ERROR
    let surbookingRejected = false;
    try {
      await logisticsWorkflowService.assignRoomPessimistic(
        {
          roomId: testRoomId,
          clientId: testClientId3,
          inscriptionId: ins1.id,
          checkInDate: '2027-06-01',
          checkOutDate: '2027-06-15',
        },
        mockActorAgent
      );
    } catch (err: any) {
      surbookingRejected = err.message.includes('ROOM_FULL_ERROR');
    }

    record(
      'LOGISTICS_WORKFLOW',
      'Verrou pessimiste FOR UPDATE : prévention stricte du surbooking (ROOM_FULL_ERROR)',
      surbookingRejected,
      '3ème affectation bloquée avec succès'
    );

    // -------------------------------------------------------------
    // TEST 7 : CYCLE DE VIE CAMPAGNE & VERROUILLAGE CLOTUREE (Correction 5)
    // -------------------------------------------------------------
    console.log('\n--- TEST 7 : CAMPAGNE CLOTUREE & EXCEPTION AUDITÉE ---');
    // Transition vers EN_COURS puis CLOTUREE
    await campaignWorkflowService.transitionCampaignStatus(testCampaignId, 'EN_COURS', mockActorAdmin);
    await campaignWorkflowService.transitionCampaignStatus(testCampaignId, 'CLOTUREE', mockActorAdmin);

    // Bilan financier de la campagne de test
    const balance = await campaignWorkflowService.getCampaignFinancialBalance(testCampaignId);
    record(
      'CAMPAIGN_LIFECYCLE',
      'Calcul du bilan financier de clôture d\'une campagne',
      balance.totalRevenueExpected === 3000000 && balance.totalRevenueCollected > 0,
      `CA Facturé: ${balance.totalRevenueExpected}, Encaissé net: ${balance.totalRevenueCollected}, Impayés: ${balance.totalOutstandingBalance}`
    );

    // Tentative de paiement sur campagne CLOTUREE sans dérogation -> doit échouer
    let closedBlocked = false;
    try {
      await paymentWorkflowService.recordPayment(
        {
          clientId: testClientId1,
          inscriptionId: ins1.id,
          amount: 100000,
          paymentMethod: 'Especes',
        },
        mockActorAgent
      );
    } catch (err: any) {
      closedBlocked = err.message.includes('MUTATION_FORBIDDEN_ON_CLOSED_CAMPAIGN');
    }

    record(
      'CAMPAIGN_LIFECYCLE',
      'Verrouillage global : interdiction de mutation sur une campagne CLOTUREE (Correction 5)',
      closedBlocked,
      'Mutation bloquée avec succès'
    );

    // Dérogation administrative spéciale par SUPER_ADMIN avec motif
    const overridePayment = await paymentWorkflowService.recordPayment(
      {
        clientId: testClientId1,
        inscriptionId: ins1.id,
        amount: 100000,
        paymentMethod: 'Especes',
        overrideClosedCampaign: {
          allowOverride: true,
          reason: 'Régularisation comptable autorisée par la direction générale',
        },
      },
      mockActorAdmin
    );

    record(
      'CAMPAIGN_LIFECYCLE',
      'Dérogation administrative exceptionnelle auditée sur campagne CLOTUREE (Correction 5)',
      overridePayment.status === 'VALIDE',
      `Reçu dérogatoire: ${overridePayment.receiptNumber}`
    );

    // -------------------------------------------------------------
    // NETTOYAGE INTÉGRAL DE L'ENVIRONNEMENT DE TEST (Correction 6)
    // -------------------------------------------------------------
    console.log('\n--- NETTOYAGE DE L\'ENVIRONNEMENT DE TEST ISOLÉ ---');
    const cleanClient = await pool.connect();
    try {
      await cleanClient.query('BEGIN');
      await cleanClient.query(`DELETE FROM payment_schedule_allocations WHERE payment_id IN (SELECT id FROM payments WHERE inscription_id IN (SELECT id FROM inscriptions WHERE campaign_id = $1))`, [testCampaignId]);
      await cleanClient.query(`DELETE FROM payment_reversals WHERE payment_id IN (SELECT id FROM payments WHERE inscription_id IN (SELECT id FROM inscriptions WHERE campaign_id = $1))`, [testCampaignId]);
      await cleanClient.query(`DELETE FROM payments WHERE inscription_id IN (SELECT id FROM inscriptions WHERE campaign_id = $1)`, [testCampaignId]);
      await cleanClient.query(`DELETE FROM payment_schedules WHERE inscription_id IN (SELECT id FROM inscriptions WHERE campaign_id = $1)`, [testCampaignId]);
      await cleanClient.query(`DELETE FROM visas WHERE inscription_id IN (SELECT id FROM inscriptions WHERE campaign_id = $1)`, [testCampaignId]);
      await cleanClient.query(`DELETE FROM room_assignments WHERE room_id = $1`, [testRoomId]);
      await cleanClient.query(`DELETE FROM rooms WHERE id = $1`, [testRoomId]);
      await cleanClient.query(`DELETE FROM hotels WHERE id = $1`, [testHotelId]);
      await cleanClient.query(`DELETE FROM notifications WHERE recipient_client_id IN ($1, $2, $3)`, [testClientId1, testClientId2, testClientId3]);
      await cleanClient.query(`DELETE FROM audit_logs WHERE entity_id IN ($1, $2, $3, $4, $5)`, [testCampaignId, testPackageId, testClientId1, testClientId2, testClientId3]);
      await cleanClient.query(`DELETE FROM idempotency_keys WHERE key LIKE 'IDEMP-%'`);
      await cleanClient.query(`DELETE FROM inscriptions WHERE campaign_id = $1`, [testCampaignId]);
      await cleanClient.query(`DELETE FROM package_versions WHERE package_id IN (SELECT id FROM packages WHERE campaign_id = $1)`, [testCampaignId]);
      await cleanClient.query(`DELETE FROM packages WHERE campaign_id = $1`, [testCampaignId]);
      await cleanClient.query(`DELETE FROM clients WHERE id IN ($1, $2, $3)`, [testClientId1, testClientId2, testClientId3]);
      await cleanClient.query(`DELETE FROM campaigns WHERE id = $1`, [testCampaignId]);
      await cleanClient.query(`
        UPDATE business_sequences SET current_value = 6 WHERE sequence_type = 'CLIENT' AND year = 0;
        UPDATE business_sequences SET current_value = 6 WHERE sequence_type = 'INSCRIPTION_HAJJ' AND year = 2027;
        UPDATE business_sequences SET current_value = 0 WHERE sequence_type = 'INSCRIPTION_UMRAH' AND year = 2027;
        UPDATE business_sequences SET current_value = 3 WHERE sequence_type = 'PAYMENT' AND year = 2027;
        UPDATE business_sequences SET current_value = 0 WHERE sequence_type = 'EXPENSE';
      `);
      await cleanClient.query('COMMIT');
      console.log('[SUCCESS] Données de test isolées entièrement nettoyées.');
    } catch (e) {
      await cleanClient.query('ROLLBACK');
      console.error('[CLEANUP ERROR]:', e);
    } finally {
      cleanClient.release();
    }

    // -------------------------------------------------------------
    // CONTRÔLE FINAL : INVARIANTS FINANCIERS DE PRODUCTION INTACTS
    // -------------------------------------------------------------
    console.log('\n--- VÉRIFICATION FINALE DES INVARIANTS FINANCIERS HISTORIQUES ---');
    const finalFinances = await getHistoricalFinancialMetrics();
    console.log('[FINANCIAL BASELINE FINALE]:', finalFinances);

    const deltaRevenue = finalFinances.expectedRevenue - initialFinances.expectedRevenue;
    const deltaCollected = finalFinances.collectedRevenue - initialFinances.collectedRevenue;
    const deltaExpenses = finalFinances.totalExpenses - initialFinances.totalExpenses;
    const deltaFatoumata = finalFinances.fatoumataPaid - initialFinances.fatoumataPaid;

    record(
      'FINANCIAL_INVARIANTS',
      'Invariants financiers stricts après nettoyage (Écart = 0 FCFA)',
      deltaRevenue === 0 && deltaCollected === 0 && deltaExpenses === 0 && deltaFatoumata === 0,
      `Écart CA: ${deltaRevenue}, Écart Encaissé: ${deltaCollected}, Écart Dépenses: ${deltaExpenses}, Écart Fatoumata: ${deltaFatoumata}`
    );

    // Vérification database.json intact
    const dbJsonPath = path.join(process.cwd(), 'data', 'database.json');
    const jsonStats = fs.statSync(dbJsonPath);
    record(
      'LEGACY_INTEGRITY',
      'Archive data/database.json conservée strictement intacte',
      jsonStats.size === 32511,
      `Taille: ${jsonStats.size} octets`
    );
  } finally {
    await pool.end();
  }

  // -------------------------------------------------------------
  // RAPPORT FINAL
  // -------------------------------------------------------------
  console.log('\n=====================================================================');
  console.log('  RÉSUMÉ DU TEST SUITE PHASE 4.2');
  console.log('=====================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total tests : ${results.length}`);
  console.log(`Tests réussis : ${passedCount}`);
  console.log(`Tests échoués : ${failedCount}`);

  if (failedCount > 0) {
    console.error(`\n❌ [PHASE 4.2 ÉCHOUÉE] ${failedCount} test(s) en échec.`);
    process.exit(1);
  } else {
    console.log(`\n🟢 [PHASE 4.2 VALIDÉE] Tous les tests (${passedCount}/${results.length}) sont passés avec succès !`);
  }
}

runPhase42TestSuite().catch((err) => {
  console.error('[FATAL TEST ERROR]:', err);
  process.exit(1);
});
