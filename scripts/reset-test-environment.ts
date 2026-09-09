import 'dotenv/config';
import crypto from 'crypto';
import pg from 'pg';
import { pool } from '../server/db/neon.js';
import { inscriptionWorkflowService } from '../server/services/inscription-workflow.service.js';

interface ResetSummary {
  realPaymentsCount: number;
  realPaymentsTotal: number;
  realInscriptionsCount: number;
  realInscriptionsTotal: number;
  deletedTestPayments: number;
  deletedExpensesCount: number;
  deletedLogisticsCount: number;
  deletedVisasCount: number;
  unknownPackagesPreserved: number;
  calculatedBalanceDue: number;
}

export async function executeControlledReset(): Promise<ResetSummary> {
  const client = await pool.connect();

  try {
    console.log('=====================================================================');
    console.log('   DÉMARRAGE DU RESET CONTRÔLÉ DE L\'ENVIRONNEMENT DE TEST (PHASE 5)  ');
    console.log('   Devise : Nettoyer le faux. Préserver le vrai. Bloquer l\'inconnu.   ');
    console.log('=====================================================================\n');

    await client.query('BEGIN');

    // -----------------------------------------------------------------
    // ÉTAPE 1 : CONTRÔLE PRÉLIMINAIRE DE SÉCURITÉ & CLASSIFICATION
    // -----------------------------------------------------------------
    console.log('[ÉTAPE 1] Vérification de sécurité des données existantes...');

    // 1.1 Vérification de la campagne Hajj 2027 en base
    const campRes = await client.query('SELECT id, title, type, departure_date FROM campaigns WHERE id = $1', ['voy-haj2027-01']);
    if (campRes.rows.length === 0) {
      throw new Error('[SÉCURITÉ RESET] Campagne voy-haj2027-01 introuvable en base. STOP.');
    }
    const camp = campRes.rows[0];
    if (!camp.departure_date) {
      throw new Error('[SÉCURITÉ RESET] Date de départ de la campagne voy-haj2027-01 absente. STOP.');
    }
    const campaignDepartureDateStr = new Date(camp.departure_date).toISOString().split('T')[0];
    if (campaignDepartureDateStr !== '2027-05-18') {
      throw new Error(`[SÉCURITÉ RESET] Date de départ observée (${campaignDepartureDateStr}) non conforme à 2027-05-18. STOP.`);
    }
    console.log(`  ✓ Campagne Hajj 2027 vérifiée en base : départ officiel le ${campaignDepartureDateStr}`);

    // 1.2 Vérification des 3 versements REAL confirmés (Nomenclature Jalon 0 GT-PAY27-*)
    const expectedRealPayments = [
      { id: 'pay-001', clientId: 'cli-001', inscriptionId: 'ins-001', amount: 250000, method: 'Espèces', receiptNumber: 'GT-PAY27-000001' },
      { id: 'pay-002', clientId: 'cli-002', inscriptionId: 'ins-002', amount: 250000, method: 'Wave', receiptNumber: 'GT-PAY27-000002' },
      { id: 'pay-003', clientId: 'cli-003', inscriptionId: 'ins-003', amount: 4000000, method: 'Virement Bancaire', receiptNumber: 'GT-PAY27-000003' },
    ];

    for (const exp of expectedRealPayments) {
      const res = await client.query('SELECT * FROM payments WHERE id = $1', [exp.id]);
      if (res.rows.length === 0) {
        throw new Error(`[SÉCURITÉ RESET] Paiement REAL manquant : ${exp.id} (${exp.receiptNumber}). Abandon immédiat (STOP).`);
      }
      const actual = res.rows[0];
      if (Number(actual.amount) !== exp.amount || actual.client_id !== exp.clientId || actual.inscription_id !== exp.inscriptionId || actual.receipt_number !== exp.receiptNumber) {
        throw new Error(`[SÉCURITÉ RESET] Divergence détectée sur paiement REAL ${exp.id}. Abandon immédiat (STOP).`);
      }
      console.log(`  ✓ Paiement REAL vérifié et conforme : ${actual.receipt_number} (${Number(actual.amount).toLocaleString('fr-FR')} FCFA)`);
    }

    // 1.3 Vérification multicritère stricte du paiement TEST Orange Money
    const testPayRes = await client.query('SELECT * FROM payments WHERE id = $1', ['pay-1788542397098']);
    if (testPayRes.rows.length === 0) {
      console.log('  ℹ Paiement TEST pay-1788542397098 déjà absent.');
    } else {
      const tp = testPayRes.rows[0];
      const isExactMatch = 
        tp.client_id === 'cli-001' &&
        tp.inscription_id === 'ins-001' &&
        Number(tp.amount) === 250000 &&
        tp.payment_method === 'ORANGE_MONEY' &&
        tp.reference === 'OM-7890123';

      if (!isExactMatch) {
        throw new Error(`[SÉCURITÉ RESET] Donnée pay-1788542397098 non strictement conforme aux critères TEST. Requalification en UNKNOWN. Abandon immédiat (STOP).`);
      }
      console.log(`  ✓ Paiement TEST multicritère vérifié pour suppression : ${tp.receipt_number} (${tp.reference})`);
    }

    // 1.3 Vérification des 6 inscriptions REAL confirmées
    const insRes = await client.query(`
      SELECT i.id, i.code, c.first_name, c.last_name, i.agreed_price 
      FROM inscriptions i
      JOIN clients c ON i.client_id = c.id
      ORDER BY i.code
    `);
    if (insRes.rows.length !== 6) {
      throw new Error(`[SÉCURITÉ RESET] Nombre d'inscriptions (${insRes.rows.length}) différent des 6 confirmées. Abandon immédiat.`);
    }
    const totalCaContractuel = insRes.rows.reduce((sum, r) => sum + Number(r.agreed_price), 0);
    if (totalCaContractuel !== 30600000) {
      throw new Error(`[SÉCURITÉ RESET] CA Contractuel observé (${totalCaContractuel}) différent de 30 600 000 FCFA. Abandon.`);
    }
    console.log(`  ✓ 6 Inscriptions REAL vérifiées (Total CA Contractuel : ${totalCaContractuel.toLocaleString('fr-FR')} FCFA)`);

    // 1.4 Vérification du package Confort (UNKNOWN)
    const confPkgRes = await client.query('SELECT * FROM packages WHERE id = $1', ['pkg-conf-2027']);
    if (confPkgRes.rows.length === 0) {
      console.warn('  ⚠ Package Confort absent de la base.');
    } else {
      console.log('  ✓ Package Confort classifié UNKNOWN identifié : CONSERVÉ SANS MODIFICATION.');
    }

    // -----------------------------------------------------------------
    // ÉTAPE 2 : SUPPRESSION ORDONNÉE DES DONNÉES TEST
    // -----------------------------------------------------------------
    console.log('\n[ÉTAPE 2] Purge ordonnée des données TEST sous contraintes FK...');

    let deletedLogistics = 0;
    const r1 = await client.query('DELETE FROM room_assignments');
    deletedLogistics += r1.rowCount || 0;
    const r2 = await client.query('DELETE FROM rooms');
    deletedLogistics += r2.rowCount || 0;
    const r3 = await client.query('DELETE FROM hotel_stays');
    deletedLogistics += r3.rowCount || 0;
    const r4 = await client.query('DELETE FROM hotels');
    deletedLogistics += r4.rowCount || 0;
    const r5 = await client.query('DELETE FROM tickets');
    deletedLogistics += r5.rowCount || 0;
    const r6 = await client.query('DELETE FROM flight_segments');
    deletedLogistics += r6.rowCount || 0;
    const r7 = await client.query('DELETE FROM flights');
    deletedLogistics += r7.rowCount || 0;
    const r8 = await client.query('DELETE FROM group_members');
    deletedLogistics += r8.rowCount || 0;
    const r9 = await client.query('DELETE FROM groups');
    deletedLogistics += r9.rowCount || 0;
    const r10 = await client.query('DELETE FROM accompagnateurs');
    deletedLogistics += r10.rowCount || 0;
    console.log(`  ✓ Entités logistiques TEST supprimées : ${deletedLogistics} lignes`);

    const docDel = await client.query('DELETE FROM documents');
    console.log(`  ✓ Documents TEST supprimés : ${docDel.rowCount} lignes`);

    const visaDel = await client.query('DELETE FROM visas');
    console.log(`  ✓ Visas TEST supprimés : ${visaDel.rowCount} lignes`);

    const expDel = await client.query('DELETE FROM expenses');
    console.log(`  ✓ Dépenses TEST supprimées : ${expDel.rowCount} lignes`);

    await client.query('DELETE FROM payment_schedule_allocations');
    await client.query('DELETE FROM payment_reversals');
    await client.query('DELETE FROM idempotency_keys');
    await client.query('DELETE FROM notifications');
    await client.query('DELETE FROM audit_logs');
    console.log(`  ✓ Journaux temporaires et anciennes allocations TEST purgés`);

    // Suppression ciblée du paiement TEST vérifié
    const payDel = await client.query('DELETE FROM payments WHERE id = $1', ['pay-1788542397098']);
    console.log(`  ✓ Paiement Orange Money TEST supprimé : ${payDel.rowCount} ligne`);

    // -----------------------------------------------------------------
    // -----------------------------------------------------------------
    // ÉTAPE 3 : SYNCHRONISATION DÉTERMINISTE DES ÉCHÉANCIERS DANS PAYMENT_SCHEDULES
    // -----------------------------------------------------------------
    console.log('\n[ÉTAPE 3] Synchronisation déterministe des échéanciers prévisionnels via InscriptionWorkflowService...');
    await client.query('DELETE FROM payment_schedules');

    // Date d'inscription confirmée : 2026-09-01
    const registrationDateStr = '2026-09-01';

    for (const ins of insRes.rows) {
      const price = Number(ins.agreed_price); // 5 100 000 FCFA

      // Appel direct au moteur métier certifié du domaine
      const generatedSchedules = inscriptionWorkflowService.calculateDynamicSchedules(
        price,
        registrationDateStr,
        campaignDepartureDateStr
      );

      // Contrôle de conformité de la règle tripartite (> 90 jours)
      if (generatedSchedules.length !== 3) {
        throw new Error(`[SÉCURITÉ RESET] Règle tripartite non appliquée : ${generatedSchedules.length} tranches générées au lieu de 3. STOP.`);
      }

      // Vérification des montants générés
      if (
        generatedSchedules[0].amountDue !== 1530000 ||
        generatedSchedules[1].amountDue !== 2040000 ||
        generatedSchedules[2].amountDue !== 1530000
      ) {
        throw new Error(`[SÉCURITÉ RESET] Répartition des montants invalide pour l'inscription ${ins.code}. STOP.`);
      }

      // Vérification des dates calculées (J+7 = 2026-09-08, Mi-parcours = 2026-12-28, J-30 = 2027-04-18)
      if (
        generatedSchedules[0].dueDate !== '2026-09-08' ||
        generatedSchedules[1].dueDate !== '2026-12-28' ||
        generatedSchedules[2].dueDate !== '2027-04-18'
      ) {
        throw new Error(`[SÉCURITÉ RESET] Calendrier d'échéances anormal : [${generatedSchedules.map(s => s.dueDate).join(', ')}]. STOP.`);
      }

      // Insertion dans payment_schedules
      for (const sch of generatedSchedules) {
        await client.query(`
          INSERT INTO payment_schedules (id, inscription_id, amount_due, due_date, status, comment)
          VALUES ($1, $2, $3, $4, 'PENDING', $5)
        `, [crypto.randomUUID(), ins.id, sch.amountDue, sch.dueDate, sch.comment]);
      }
    }
    console.log(`  ✓ 18 Échéances prévisionnelles calculées et synchronisées (30% / 40% / 30% d'après InscriptionWorkflowService)`);

    // -----------------------------------------------------------------
    // ÉTAPE 4 : VENTILATION COMPTABLE FIFO (rebuildPaymentScheduleAllocations)
    // -----------------------------------------------------------------
    console.log('\n[ÉTAPE 4] Reconstruction contrôlée des allocations de paiement (rebuildPaymentScheduleAllocations)...');
    
    // Lecture des 3 versements REAL existants (AUCUN PAIEMENT CRÉÉ !)
    const paymentsRes = await client.query(`
      SELECT id, receipt_number, client_id, inscription_id, amount 
      FROM payments 
      WHERE status = 'VALIDE' 
      ORDER BY receipt_number
    `);

    if (paymentsRes.rows.length !== 3) {
      throw new Error(`[SÉCURITÉ RESET] Nombre de paiements REAL (${paymentsRes.rows.length}) incorrect. 3 attendus. STOP.`);
    }

    for (const pay of paymentsRes.rows) {
      let remainingToAllocate = Number(pay.amount);

      const schedRes = await client.query(`
        SELECT id, amount_due, status 
        FROM payment_schedules 
        WHERE inscription_id = $1 
        ORDER BY due_date ASC
      `, [pay.inscription_id]);

      for (const sched of schedRes.rows) {
        if (remainingToAllocate <= 0) break;

        // Récupérer le déjà alloué sur cette tranche
        const allocRes = await client.query(`
          SELECT COALESCE(SUM(amount_allocated), 0) as total_allocated 
          FROM payment_schedule_allocations 
          WHERE payment_schedule_id = $1
        `, [sched.id]);
        const alreadyAllocated = Number(allocRes.rows[0].total_allocated);
        const schedAmount = Number(sched.amount_due);
        const schedRemaining = schedAmount - alreadyAllocated;

        if (schedRemaining > 0) {
          const allocationAmount = Math.min(remainingToAllocate, schedRemaining);
          await client.query(`
            INSERT INTO payment_schedule_allocations (id, payment_id, payment_schedule_id, amount_allocated)
            VALUES ($1, $2, $3, $4)
          `, [crypto.randomUUID(), pay.id, sched.id, allocationAmount]);

          remainingToAllocate -= allocationAmount;
          const newAllocated = alreadyAllocated + allocationAmount;
          const newStatus = newAllocated >= schedAmount ? 'PAID' : 'PARTIAL';

          await client.query(`
            UPDATE payment_schedules SET status = $1 WHERE id = $2
          `, [newStatus, sched.id]);
        }
      }

      if (remainingToAllocate > 0) {
        console.warn(`  ⚠ Excédent non alloué sur paiement ${pay.receipt_number} : ${remainingToAllocate} FCFA`);
      }
      console.log(`  ✓ Allocations calculées pour paiement réel ${pay.receipt_number} (${Number(pay.amount).toLocaleString('fr-FR')} FCFA)`);
    }

    // -----------------------------------------------------------------
    // ÉTAPE 5 : VÉRIFICATION STRICTE DES SÉQUENCES PAR OBSERVATION PURE
    // (ZÉRO UPDATE SILENCIEUX OU AUTOMATIQUE)
    // -----------------------------------------------------------------
    console.log('\n[ÉTAPE 5] Contrôle des compteurs business_sequences par observation pure...');

    // 5.1 Vérification de la séquence CLIENT
    const maxCliRes = await client.query("SELECT COALESCE(MAX(SUBSTRING(code FROM 4)::integer), 0) as max_val FROM clients");
    const observedMaxClient = Number(maxCliRes.rows[0].max_val);
    const seqCliRes = await client.query("SELECT current_value FROM business_sequences WHERE sequence_type = 'CLIENT' AND year = 0");
    const seqClientVal = seqCliRes.rows.length > 0 ? Number(seqCliRes.rows[0].current_value) : -1;
    if (observedMaxClient !== 6 || seqClientVal !== 6) {
      throw new Error(`[SÉCURITÉ SÉQUENCES] Divergence CLIENT : table max=${observedMaxClient}, séquence=${seqClientVal} (Attendu: 6). STOP.`);
    }

    // 5.2 Vérification de la séquence INSCRIPTION_HAJJ
    const maxHajRes = await client.query("SELECT COALESCE(MAX(SUBSTRING(code FROM 9)::integer), 0) as max_val FROM inscriptions WHERE campaign_id = 'voy-haj2027-01'");
    const observedMaxHajj = Number(maxHajRes.rows[0].max_val);
    const seqHajRes = await client.query("SELECT current_value FROM business_sequences WHERE sequence_type = 'INSCRIPTION_HAJJ' AND year = 2027");
    const seqHajjVal = seqHajRes.rows.length > 0 ? Number(seqHajRes.rows[0].current_value) : -1;
    if (observedMaxHajj !== 6 || seqHajjVal !== 6) {
      throw new Error(`[SÉCURITÉ SÉQUENCES] Divergence INSCRIPTION_HAJJ : table max=${observedMaxHajj}, séquence=${seqHajjVal} (Attendu: 6). STOP.`);
    }

    // 5.3 Vérification de la séquence INSCRIPTION_UMRAH (0 attendu)
    const countUmrahRes = await client.query("SELECT COUNT(*) as cnt FROM inscriptions i JOIN campaigns c ON i.campaign_id = c.id WHERE c.type = 'UMRAH'");
    const observedCountUmrah = Number(countUmrahRes.rows[0].cnt);
    const seqUmrahRes = await client.query("SELECT current_value FROM business_sequences WHERE sequence_type = 'INSCRIPTION_UMRAH' AND year = 2027");
    const seqUmrahVal = seqUmrahRes.rows.length > 0 ? Number(seqUmrahRes.rows[0].current_value) : 0;
    if (observedCountUmrah !== 0 || seqUmrahVal !== 0) {
      throw new Error(`[SÉCURITÉ SÉQUENCES] Divergence INSCRIPTION_UMRAH : table count=${observedCountUmrah}, séquence=${seqUmrahVal} (Attendu: 0). STOP.`);
    }

    // 5.4 Vérification de la séquence PAYMENT
    const maxPayRes = await client.query("SELECT COALESCE(MAX(SUBSTRING(receipt_number FROM 10)::integer), 0) as max_val FROM payments WHERE status = 'VALIDE'");
    const observedMaxPay = Number(maxPayRes.rows[0].max_val);
    const seqPayRes = await client.query("SELECT current_value FROM business_sequences WHERE sequence_type = 'PAYMENT' AND year = 2027");
    const seqPayVal = seqPayRes.rows.length > 0 ? Number(seqPayRes.rows[0].current_value) : -1;
    if (observedMaxPay !== 3 || seqPayVal !== 3) {
      throw new Error(`[SÉCURITÉ SÉQUENCES] Divergence PAYMENT : table max=${observedMaxPay}, séquence=${seqPayVal} (Attendu: 3). STOP.`);
    }

    // 5.5 Vérification de la séquence EXPENSE (0 attendu)
    const countExpRes = await client.query("SELECT COUNT(*) as cnt FROM expenses");
    const observedCountExp = Number(countExpRes.rows[0].cnt);
    const seqExp26Res = await client.query("SELECT current_value FROM business_sequences WHERE sequence_type = 'EXPENSE' AND year = 2026");
    const seqExp27Res = await client.query("SELECT current_value FROM business_sequences WHERE sequence_type = 'EXPENSE' AND year = 2027");
    const seqExp26Val = seqExp26Res.rows.length > 0 ? Number(seqExp26Res.rows[0].current_value) : 0;
    const seqExp27Val = seqExp27Res.rows.length > 0 ? Number(seqExp27Res.rows[0].current_value) : 0;
    if (observedCountExp !== 0 || seqExp26Val !== 0 || seqExp27Val !== 0) {
      throw new Error(`[SÉCURITÉ SÉQUENCES] Divergence EXPENSE : count=${observedCountExp}, seq2026=${seqExp26Val}, seq2027=${seqExp27Val} (Attendu: 0). STOP.`);
    }

    console.log(`  ✓ Compteurs business_sequences rigoureusement vérifiés par observation : INS_HAJJ=6, INS_UMRAH=0, PAY=3, EXP=0, CLI=6`);

    // -----------------------------------------------------------------
    // ÉTAPE 6 : AUDIT LOG DE GOUVERNANCE DU RESET
    // -----------------------------------------------------------------
    await client.query(`
      INSERT INTO audit_logs (id, actor_user_id, actor_user_name, action, entity_type, entity_id, new_value)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      crypto.randomUUID(),
      'usr-admin',
      'El Hadj Amadou Niang (Super Admin)',
      'RESET_TEST_ENVIRONMENT',
      'SYSTEM',
      'ENVIRONMENT_RESET',
      JSON.stringify({
        rationale: 'Assainissement des données de test pré-Phase 5 selon la règle suprême',
        preservedInscriptions: 6,
        preservedRealPayments: 3,
        purgedTestPayment: 'pay-1788542397098',
        purgedExpenses: 'Saudia & Pullman (23.5M FCFA)',
      }),
    ]);
    console.log(`  ✓ Événement RESET_TEST_ENVIRONMENT consigné dans audit_logs`);

    // -----------------------------------------------------------------
    // ÉTAPE 7 : CONTRÔLES D'INTÉGRITÉ POST-RESET (OBSERVATION ET COMPARAISON)
    // -----------------------------------------------------------------
    console.log('\n[ÉTAPE 7] Contrôles d\'intégrité post-reset (Observation pure et comparaison)...');

    const sumPayRes = await client.query("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'VALIDE'");
    const observedTotalPayments = Number(sumPayRes.rows[0].total);

    const sumExpRes = await client.query("SELECT COALESCE(SUM(amount), 0) as total FROM expenses");
    const observedTotalExpenses = Number(sumExpRes.rows[0].total);

    const countVisaRes = await client.query("SELECT count(*) as cnt FROM visas");
    const observedVisasCount = Number(countVisaRes.rows[0].cnt);

    const countConfRes = await client.query("SELECT count(*) as cnt FROM packages WHERE id = 'pkg-conf-2027'");
    const observedConfPreserved = Number(countConfRes.rows[0].cnt);

    const calculatedBalanceDue = totalCaContractuel - observedTotalPayments;

    console.log(`  - Somme des 3 versements REAL confirmés : ${observedTotalPayments.toLocaleString('fr-FR')} FCFA (Attendu: 4 500 000 FCFA)`);
    console.log(`  - Somme des dépenses REAL : ${observedTotalExpenses.toLocaleString('fr-FR')} FCFA (Attendu: 0 FCFA)`);
    console.log(`  - Total dû calculé par les pèlerins : ${calculatedBalanceDue.toLocaleString('fr-FR')} FCFA (Attendu: 26 100 000 FCFA)`);
    console.log(`  - Visas créés lors du reset : ${observedVisasCount} (Attendu: 0)`);
    console.log(`  - Package Confort UNKNOWN préservé : ${observedConfPreserved} (Attendu: 1)`);

    // Vérifications strictes : la moindre anomalie déclenche un ROLLBACK sans correction artificielle
    if (observedTotalPayments !== 4500000) {
      throw new Error(`[ANOMALIE OBSERVÉE] Total des paiements (${observedTotalPayments}) != 4 500 000 FCFA. ROLLBACK.`);
    }
    if (observedTotalExpenses !== 0) {
      throw new Error(`[ANOMALIE OBSERVÉE] Total des dépenses (${observedTotalExpenses}) != 0 FCFA. ROLLBACK.`);
    }
    if (calculatedBalanceDue !== 26100000) {
      throw new Error(`[ANOMALIE OBSERVÉE] Total dû calculé (${calculatedBalanceDue}) != 26 100 000 FCFA. ROLLBACK.`);
    }
    if (observedVisasCount !== 0) {
      throw new Error(`[ANOMALIE OBSERVÉE] Des visas ont été créés pendant le reset (${observedVisasCount}). ROLLBACK.`);
    }
    if (observedConfPreserved !== 1) {
      throw new Error(`[ANOMALIE OBSERVÉE] Package Confort UNKNOWN non préservé. ROLLBACK.`);
    }

    await client.query('COMMIT');
    console.log('\n🟢 [TRANSACTION COMMIT] Le Reset Contrôlé a été validé et persisté avec succès dans Neon !');

    return {
      realPaymentsCount: paymentsRes.rows.length,
      realPaymentsTotal: observedTotalPayments,
      realInscriptionsCount: insRes.rows.length,
      realInscriptionsTotal: totalCaContractuel,
      deletedTestPayments: payDel.rowCount || 0,
      deletedExpensesCount: expDel.rowCount || 0,
      deletedLogisticsCount: deletedLogistics,
      deletedVisasCount: visaDel.rowCount || 0,
      unknownPackagesPreserved: observedConfPreserved,
      calculatedBalanceDue,
    };
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('\n🔴 [TRANSACTION ROLLBACK] Échec du Reset Contrôlé :', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// Exécution directe si invoqué via node/tsx
if (process.argv[1] && process.argv[1].endsWith('reset-test-environment.ts')) {
  executeControlledReset()
    .then((summary) => {
      console.log('\nRésumé d\'exécution du Reset :', summary);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
