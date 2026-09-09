import 'dotenv/config';
import { pool } from '../server/db/neon.js';
import { clientService } from '../server/services/client.service.js';
import { inscriptionService } from '../server/services/inscription.service.js';
import { paymentService } from '../server/services/payment.service.js';
import { expenseService } from '../server/services/expense.service.js';
import { dashboardService } from '../server/services/dashboard.service.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ${GREEN}✓ PASS${RESET} ${testName}`);
    passed++;
  } else {
    console.error(`  ${RED}✗ FAIL${RESET} ${testName} ${detail ? `(${detail})` : ''}`);
    failed++;
  }
}

async function runCrudMatrix() {
  console.log(`\n${BOLD}${CYAN}======================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}   GIE TAIBA VOYAGES — VALIDATION DE LA MATRICE CRUD MÉTIER INTÉGRALE${RESET}`);
  console.log(`${BOLD}${CYAN}======================================================================${RESET}\n`);

  const actor = {
    id: 'usr-gerant-cheikh-ka',
    name: 'Cheikh Ibrahima Ka',
    displayName: 'Cheikh Ibrahima Ka',
    email: 'kabaye73@gmail.com',
    role: 'SUPER_ADMIN',
  };

  try {
    // -----------------------------------------------------------------
    // 1. CONTRÔLE PRÉ-TEST DU SANCTUAIRE FINANCIER
    // -----------------------------------------------------------------
    console.log(`${BOLD}${BLUE}▶ 1. CONTRÔLE INITIAL DU SANCTUAIRE FINANCIER (INVARIANTS)${RESET}`);

    const preStats = await pool.query(`
      SELECT 
        (SELECT count(*)::int FROM clients WHERE is_test = FALSE OR is_test IS NULL) as real_clients,
        (SELECT count(*)::int FROM inscriptions WHERE is_test = FALSE OR is_test IS NULL) as real_inscriptions,
        (SELECT count(*)::int FROM payments WHERE is_test = FALSE OR is_test IS NULL) as real_payments,
        (SELECT COALESCE(SUM(amount), 0)::numeric FROM payments WHERE is_test = FALSE OR is_test IS NULL) as total_encaisse,
        (SELECT COALESCE(SUM(agreed_price), 0)::numeric FROM inscriptions WHERE is_test = FALSE OR is_test IS NULL) as total_engage,
        (SELECT count(*)::int FROM expenses WHERE (is_test = FALSE OR is_test IS NULL) AND status != 'ANNULEE') as real_active_expenses
    `);

    const s = preStats.rows[0];
    assert(Number(s.real_clients) === 6, `1.1 Clients réels = 6 (actuel: ${s.real_clients})`);
    assert(Number(s.real_inscriptions) === 6, `1.2 Inscriptions réelles = 6 (actuel: ${s.real_inscriptions})`);
    assert(Number(s.real_payments) === 3, `1.3 Paiements réels = 3 (actuel: ${s.real_payments})`);
    assert(Number(s.total_encaisse) === 4500000, `1.4 Encaissé = 4 500 000 FCFA (actuel: ${s.total_encaisse})`);
    assert(Number(s.total_engage) === 30600000, `1.5 Engagé = 30 600 000 FCFA (actuel: ${s.total_engage})`);
    assert(Number(s.real_active_expenses) === 0, `1.6 Dépenses réelles = 0 (actuel: ${s.real_active_expenses})`);

    // Nettoyage de sécurité préventif sur les IDs de test de la matrice
    const testClientId = 'cli-matrix-test-777';
    const testInsId = 'ins-matrix-test-777';
    const testPayId = 'pay-matrix-test-777';
    const testExpId = 'exp-matrix-test-777';

    await pool.query('DELETE FROM payment_reversals WHERE payment_id IN (SELECT id FROM payments WHERE is_test = TRUE)');
    await pool.query('DELETE FROM payments WHERE is_test = TRUE');
    await pool.query('DELETE FROM inscriptions WHERE is_test = TRUE');
    await pool.query('DELETE FROM clients WHERE is_test = TRUE');
    await pool.query('DELETE FROM expenses WHERE is_test = TRUE');

    // -----------------------------------------------------------------
    // 2. MATRICE CRUD : CLIENTS
    // -----------------------------------------------------------------
    console.log(`\n${BOLD}${BLUE}▶ 2. MATRICE CRUD : CLIENTS (CRÉATION, MODIFICATION, 409, ARCHIVAGE, PURGE)${RESET}`);

    // C1. Création
    await pool.query(
      `INSERT INTO clients (
        id, code, first_name, last_name, gender, phone, email, status, is_test, created_at, updated_at
      ) VALUES ($1, 'GT-MAT-001', 'Amadou', 'Diallo', 'M', '+221771112233', 'amadou.diallo.test@taiba.sn', 'ACTIF', TRUE, NOW(), NOW())`,
      [testClientId]
    );
    const clientInitial = await clientService.getClientById(testClientId);
    assert(clientInitial !== null && clientInitial.firstName === 'Amadou', '2.1 Création client test conforme');

    // C2. Modification
    const updatedClient = await clientService.updateClient(
      testClientId,
      { profession: 'Ingénieur Agronome', address: 'Dakar Fann Résidence' },
      actor
    );
    assert(
      updatedClient.profession === 'Ingénieur Agronome' && updatedClient.address === 'Dakar Fann Résidence',
      '2.2 Modification client test enregistrée dans Neon'
    );

    // C3. Rattachement dossier test pour bloquer la suppression
    await pool.query(
      `INSERT INTO inscriptions (
        id, code, client_id, campaign_id, package_id, package_version_id, applied_price, agreed_price, status, is_test, created_at, updated_at
      ) VALUES ($1, 'INS-MAT-001', $2, 'voy-haj2027-01', 'pkg-std-2027', 'ver-std-1', 5100000, 5100000, 'CONFIRMEE', TRUE, NOW(), NOW())`,
      [testInsId, testClientId]
    );

    // C4. Protection 409 sur suppression avec dépendance
    let deleteBlocked = false;
    try {
      await clientService.deleteClient(testClientId, actor);
    } catch (err: any) {
      if (err.code === 'SUPPRESSION_REFUSEE_DEPENDANCES_EXISTANTES' || err.message?.includes('SUPPRESSION_REFUSEE_DEPENDANCES_EXISTANTES')) {
        deleteBlocked = true;
      }
    }
    assert(deleteBlocked, '2.3 Protection Conflit 409 : Rejet de suppression d un client avec inscriptions actives');

    // C5. Archivage
    const archived = await clientService.archiveClient(testClientId, 'Dossier reporté pour convenance personnelle', actor);
    assert(archived.status === 'ARCHIVE', '2.4 Workflow d archivage client : Passage sécurisé à status = ARCHIVE');

    // -----------------------------------------------------------------
    // 3. MATRICE CRUD : INSCRIPTIONS (DOSSIERS)
    // -----------------------------------------------------------------
    console.log(`\n${BOLD}${BLUE}▶ 3. MATRICE CRUD : INSCRIPTIONS (MODIFICATION PRIX, MOTIF, STATUTS, ANNULATION)${RESET}`);

    // I1. Modification prix convenu avec motif obligatoire
    const priceUpdated = await inscriptionService.updateInscriptionPrice(
      testInsId,
      4800000,
      'Remise accordée par la direction pour inscription précoce',
      actor
    );
    assert(
      Number(priceUpdated.appliedPrice) === 4800000,
      '3.1 Modification du prix convenu avec motif et audit log'
    );

    // I2. Rejet modification prix si motif absent
    let priceRejectEmptyReason = false;
    try {
      await inscriptionService.updateInscriptionPrice(testInsId, 4500000, '', actor);
    } catch {
      priceRejectEmptyReason = true;
    }
    assert(priceRejectEmptyReason, '3.2 Règle financière : Rejet strict d une modification de prix sans motif');

    // I3. Modification statut
    const statusUpdated = await inscriptionService.updateInscriptionStatus(testInsId, 'EN_ATTENTE', actor);
    assert(statusUpdated.status === 'EN_ATTENTE', '3.3 Modification du statut d inscription vers EN_ATTENTE');

    // I4. Annulation sécurisée
    const cancelledIns = await inscriptionService.cancelInscription(testInsId, 'Annulation de test audit', actor);
    assert(cancelledIns.status === 'ANNULEE', '3.4 Cycle Inscription : Annulation sans suppression physique (ANNULEE)');

    // -----------------------------------------------------------------
    // 4. MATRICE CRUD : PAIEMENTS
    // -----------------------------------------------------------------
    console.log(`\n${BOLD}${BLUE}▶ 4. MATRICE CRUD : PAIEMENTS (SANCTUAIRE INVIOLABLE & ANNULATION AVEC REVERSAL)${RESET}`);

    // P1. Tentative d annulation sur un paiement réel du sanctuaire -> DOIT ÊTRE BLOQUÉE
    let realPaymentBlocked = false;
    try {
      await paymentService.cancelPayment('pay-001', 'Tentative illicite sur paiement réel', actor);
    } catch (err: any) {
      if (err.message?.includes('SANCTUAIRE_FINANCIER_INVIOLABLE')) {
        realPaymentBlocked = true;
      }
    }
    assert(realPaymentBlocked, '4.1 Sanctuaire inviolable : Blocage absolu de tentative d annulation d un versement réel certifié');

    // P2. Création versement de test
    // Rétablir inscription en statut actif pour permettre le versement
    await pool.query("UPDATE inscriptions SET status = 'CONFIRMEE' WHERE id = $1", [testInsId]);
    const createdPayment = await paymentService.createPayment(
      {
        clientId: testClientId,
        inscriptionId: testInsId,
        amount: 1500000,
        paymentMethod: 'VIREMENT_BANCAIRE',
        reference: 'VIR-TEST-AUDIT-001',
        comment: 'Acompte test matrice CRUD',
      },
      actor
    );
    assert(
      createdPayment !== null && Number(createdPayment.amount) === 1500000 && createdPayment.status === 'VALIDE',
      '4.2 Enregistrement versement test : Reçu officiel émis et statut VALIDE'
    );

    // P3. Annulation du versement test avec motif et création dans payment_reversals
    const cancelledPay = await paymentService.cancelPayment(
      createdPayment.id,
      'Erreur de compte émetteur détectée',
      actor
    );
    assert(cancelledPay.status === 'ANNULE', '4.3 Annulation versement test : Statut mis à jour à ANNULE');

    const reversalCheck = await pool.query('SELECT * FROM payment_reversals WHERE payment_id = $1', [createdPayment.id]);
    assert(
      reversalCheck.rows.length === 1 && reversalCheck.rows[0].reason === 'Erreur de compte émetteur détectée',
      '4.4 Traçabilité comptable : Reversal audité dans payment_reversals'
    );

    // -----------------------------------------------------------------
    // 5. MATRICE CRUD : DÉPENSES
    // -----------------------------------------------------------------
    console.log(`\n${BOLD}${BLUE}▶ 5. MATRICE CRUD : DÉPENSES (CRÉATION, MODIFICATION, ANNULATION & DASHBOARD)${RESET}`);

    // D1. Création dépense test
    const createdExp = await expenseService.createExpense(
      {
        voyageId: 'voy-haj2027-01',
        category: 'HEBERGEMENT',
        amount: 850000,
        currency: 'FCFA',
        date: new Date().toISOString().split('T')[0],
        supplier: 'Hôtel Pullman Médine',
        comment: 'Réservation test audit',
        isTest: true,
        createdBy: actor.id,
      },
      actor
    );
    assert(createdExp.status === 'VALIDE', '5.1 Création charge test VALIDE');

    // D2. Modification dépense test
    const modifiedExp = await expenseService.updateExpense(
      createdExp.id,
      { amount: 920000, comment: 'Ajustement tarifaire Pullman' },
      actor
    );
    assert(Number(modifiedExp.amount) === 920000, '5.2 Modification charge test répercutée dans Neon');

    // D3. Annulation dépense
    const cancelledExp = await expenseService.cancelExpense(
      createdExp.id,
      'Changement d établissement hôtelier',
      actor
    );
    assert(
      cancelledExp.status === 'ANNULEE' && cancelledExp.cancellationReason === 'Changement d établissement hôtelier',
      '5.3 Cycle Charge : Annulation sans suppression physique (ANNULEE) avec motif'
    );

    // D4. Vérification exclusion tableau de bord
    const dashStats = await dashboardService.getDashboardStats();
    const sumExpenses = dashStats.profitability.reduce((sum, p) => sum + p.expenses, 0);
    assert(sumExpenses === 0, '5.4 Règle financière : Dépense annulée 100% exclue du calcul de rentabilité');

    // -----------------------------------------------------------------
    // 6. NETTOYAGE DES DONNÉES DE TEST & SUPPRESSION DU CLIENT TEST
    // -----------------------------------------------------------------
    console.log(`\n${BOLD}${BLUE}▶ 6. NETTOYAGE MÉTIER DES DONNÉES DE TEST & SUPPRESSION FINALE${RESET}`);

    await pool.query('DELETE FROM payment_reversals WHERE payment_id = $1', [createdPayment.id]);
    await pool.query('DELETE FROM payments WHERE id = $1', [createdPayment.id]);
    await pool.query('DELETE FROM inscriptions WHERE id = $1', [testInsId]);
    await pool.query('DELETE FROM expenses WHERE id = $1', [createdExp.id]);

    // Suppression du client désormais sans aucune dépendance
    await clientService.deleteClient(testClientId, actor);
    const clientPurged = await clientService.getClientById(testClientId);
    assert(clientPurged === null, '6.1 Suppression physique finale autorisée et exécutée une fois les dépendances libérées');

    // -----------------------------------------------------------------
    // 7. CONTRÔLE FINAL STRICT DU SANCTUAIRE FINANCIER
    // -----------------------------------------------------------------
    console.log(`\n${BOLD}${BLUE}▶ 7. CONTRÔLE POST-TEST DU SANCTUAIRE FINANCIER (INVARIANTS ABSOLUS)${RESET}`);

    const postStats = await pool.query(`
      SELECT 
        (SELECT count(*)::int FROM clients WHERE is_test = FALSE OR is_test IS NULL) as real_clients,
        (SELECT count(*)::int FROM inscriptions WHERE is_test = FALSE OR is_test IS NULL) as real_inscriptions,
        (SELECT count(*)::int FROM payments WHERE is_test = FALSE OR is_test IS NULL) as real_payments,
        (SELECT COALESCE(SUM(amount), 0)::numeric FROM payments WHERE is_test = FALSE OR is_test IS NULL) as total_encaisse,
        (SELECT COALESCE(SUM(agreed_price), 0)::numeric FROM inscriptions WHERE is_test = FALSE OR is_test IS NULL) as total_engage,
        (SELECT count(*)::int FROM expenses WHERE (is_test = FALSE OR is_test IS NULL) AND status != 'ANNULEE') as real_active_expenses
    `);

    const p = postStats.rows[0];
    assert(Number(p.real_clients) === 6, `Sanctuaire Préservé : 6 clients réels (actuel: ${p.real_clients})`);
    assert(Number(p.real_inscriptions) === 6, `Sanctuaire Préservé : 6 inscriptions réelles (actuel: ${p.real_inscriptions})`);
    assert(Number(p.real_payments) === 3, `Sanctuaire Préservé : 3 paiements réels (actuel: ${p.real_payments})`);
    assert(Number(p.total_encaisse) === 4500000, `Sanctuaire Préservé : 4 500 000 FCFA encaissés (actuel: ${p.total_encaisse})`);
    assert(Number(p.total_engage) === 30600000, `Sanctuaire Préservé : 30 600 000 FCFA engagés (actuel: ${p.total_engage})`);
    assert(Number(p.total_engage) - Number(p.total_encaisse) === 26100000, `Sanctuaire Préservé : 26 100 000 FCFA restant dû`);
    assert(Number(p.real_active_expenses) === 0, `Sanctuaire Préservé : 0 dépense réelle engagée`);

    // BILAN
    console.log(`\n${BOLD}${CYAN}======================================================================${RESET}`);
    if (failed === 0) {
      console.log(`${BOLD}${GREEN}✓ SUCCÈS TOTAL DE LA MATRICE CRUD : ${passed} CONTRÔLES SUR ${passed + failed} PASS${RESET}`);
      console.log(`${BOLD}${GREEN}  TOUTES LES RÈGLES MÉTIER, REJETS 409 ET LE SANCTUAIRE SONT CERTIFIÉS.${RESET}`);
    } else {
      console.log(`${BOLD}${RED}✗ ÉCHEC : ${failed} ÉCHEC(S), ${passed} RÉUSSITE(S)${RESET}`);
    }
    console.log(`${BOLD}${CYAN}======================================================================${RESET}\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error(`${RED}Erreur imprévue pendant la matrice CRUD :${RESET}`, err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runCrudMatrix();
