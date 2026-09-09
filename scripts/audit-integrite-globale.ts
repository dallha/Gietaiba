import 'dotenv/config';
import { pool } from '../server/db/neon.js';
import { clientService } from '../server/services/client.service.js';
import { expenseService } from '../server/services/expense.service.js';
import { dashboardService } from '../server/services/dashboard.service.js';
import { googleOAuthService, GoogleUserInfo } from '../server/auth/google-oauth.service.js';
import { verifySignedSessionToken } from '../server/auth/token.service.js';
import fs from 'fs';
import path from 'path';

// ANSI colors for clean audit reporting
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ${GREEN}✓ PASS${RESET} ${testName}`);
    passCount++;
  } else {
    console.error(`  ${RED}✗ FAIL${RESET} ${testName} ${detail ? `(${detail})` : ''}`);
    failCount++;
  }
}

async function runAudit() {
  console.log(`\n${BOLD}${CYAN}======================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}   GIE TAIBA VOYAGES — AUDIT GLOBAL D'INTÉGRITÉ OPÉRATIONNELLE${RESET}`);
  console.log(`${BOLD}${CYAN}======================================================================${RESET}\n`);

  // Acteur de test : Gérant officiel SUPER_ADMIN
  const actor = {
    id: 'usr-gerant-cheikh-ka',
    name: 'Cheikh Ibrahima Ka',
    displayName: 'Cheikh Ibrahima Ka',
    email: 'kabaye73@gmail.com',
    role: 'SUPER_ADMIN',
  };

  try {
    // -----------------------------------------------------------------
    // NIVEAU A : VÉRIFICATIONS READ-ONLY
    // -----------------------------------------------------------------
    console.log(`${BOLD}${BLUE}▶ NIVEAU A : VÉRIFICATIONS STRUCTURELLES & SANCTUAIRE (READ-ONLY)${RESET}`);

    // A1. Connexion et version PostgreSQL Neon
    const versionRes = await pool.query('SELECT version();');
    assert(
      versionRes.rows.length > 0 && versionRes.rows[0].version.includes('PostgreSQL'),
      'A1. Connectivité Neon Cloud opérationnelle',
      versionRes.rows[0]?.version
    );

    // A2. Structure des tables (minimum 35 tables de production)
    const tablesRes = await pool.query(
      `SELECT count(*)::int as count FROM information_schema.tables WHERE table_schema = 'public'`
    );
    assert(
      tablesRes.rows[0].count >= 35,
      `A2. Schéma PostgreSQL complet (${tablesRes.rows[0].count} tables détectées)`
    );

    // A3. Sanctuaire Financier Réel Intouchable
    const sanctuaryStats = await pool.query(`
      SELECT 
        (SELECT count(*)::int FROM clients WHERE is_test = FALSE OR is_test IS NULL) as real_clients,
        (SELECT count(*)::int FROM inscriptions WHERE is_test = FALSE OR is_test IS NULL) as real_inscriptions,
        (SELECT count(*)::int FROM payments WHERE is_test = FALSE OR is_test IS NULL) as real_payments,
        (SELECT COALESCE(SUM(amount), 0)::numeric FROM payments WHERE is_test = FALSE OR is_test IS NULL) as total_encaisse,
        (SELECT COALESCE(SUM(agreed_price), 0)::numeric FROM inscriptions WHERE is_test = FALSE OR is_test IS NULL) as total_engage,
        (SELECT count(*)::int FROM expenses WHERE (is_test = FALSE OR is_test IS NULL) AND status != 'ANNULEE') as real_active_expenses
    `);

    const stats = sanctuaryStats.rows[0];
    const realClients = Number(stats.real_clients);
    const realInscriptions = Number(stats.real_inscriptions);
    const realPayments = Number(stats.real_payments);
    const totalEncaisse = Number(stats.total_encaisse);
    const totalEngage = Number(stats.total_engage);
    const soldeRestant = totalEngage - totalEncaisse;
    const realExpenses = Number(stats.real_active_expenses);

    assert(realClients === 6, `A3.1 Clients réels = 6 (actuel: ${realClients})`);
    assert(realInscriptions === 6, `A3.2 Inscriptions réelles = 6 (actuel: ${realInscriptions})`);
    assert(realPayments === 3, `A3.3 Paiements réels = 3 (actuel: ${realPayments})`);
    assert(totalEncaisse === 4500000, `A3.4 Total encaissé = 4 500 000 FCFA (actuel: ${totalEncaisse} FCFA)`);
    assert(totalEngage === 30600000, `A3.5 Total engagé = 30 600 000 FCFA (actuel: ${totalEngage} FCFA)`);
    assert(soldeRestant === 26100000, `A3.6 Solde restant dû = 26 100 000 FCFA (actuel: ${soldeRestant} FCFA)`);
    assert(realExpenses === 0, `A3.7 Dépenses réelles actives = 0 (actuel: ${realExpenses})`);

    // A4. Intégrité RBAC des comptes institutionnels
    const abdoulRes = await pool.query(
      `SELECT id, email, display_name, role_id, client_id, active, status FROM users WHERE LOWER(email) = 'mr.niass@gmail.com'`
    );
    assert(
      abdoulRes.rows.length === 1 &&
      abdoulRes.rows[0].display_name === 'El Hadji Abdoulaye Niass' &&
      abdoulRes.rows[0].role_id === 'SUPER_ADMIN' &&
      abdoulRes.rows[0].client_id === null &&
      abdoulRes.rows[0].active === true,
      'A4.1 Créateur de la plateforme : El Hadji Abdoulaye Niass (SUPER_ADMIN, client_id=NULL)'
    );

    const cheikhRes = await pool.query(
      `SELECT id, email, display_name, role_id, client_id, active, status FROM users WHERE LOWER(email) = 'kabaye73@gmail.com'`
    );
    assert(
      cheikhRes.rows.length === 1 &&
      cheikhRes.rows[0].display_name === 'Cheikh Ibrahima Ka' &&
      cheikhRes.rows[0].role_id === 'SUPER_ADMIN' &&
      cheikhRes.rows[0].client_id === null &&
      cheikhRes.rows[0].active === true,
      'A4.2 Gérant de GIE Taiba Voyages : Cheikh Ibrahima Ka (SUPER_ADMIN, client_id=NULL)'
    );

    // A5. Éradication totale de idMigration.ts
    const idMigrationPath = path.join(process.cwd(), 'src/utils/idMigration.ts');
    assert(!fs.existsSync(idMigrationPath), 'A5.1 src/utils/idMigration.ts est définitivement éradiqué');

    // A6. Unification du rôle PELERIN
    const rolesRes = await pool.query(`SELECT id, name FROM roles WHERE id = 'PELERIN'`);
    assert(rolesRes.rows.length === 1, 'A6.1 Rôle unifié PELERIN présent dans la table roles');

    // -----------------------------------------------------------------
    // NIVEAU B : MUTATIONS CONTRÔLÉES & SANDBOXÉES (is_test = TRUE)
    // -----------------------------------------------------------------
    console.log(`\n${BOLD}${BLUE}▶ NIVEAU B : MUTATIONS SÉCURISÉES, CRUD & CONFLITS 409 (is_test = TRUE)${RESET}`);

    const testClientId = 'cli-test-audit-integrity-888';
    const testInscriptionId = 'ins-test-audit-integrity-888';
    const testExpenseId = 'exp-test-audit-integrity-888';

    // Nettoyage préalable au cas où des restes de test subsisteraient
    await pool.query('DELETE FROM payments WHERE is_test = TRUE AND client_id = $1', [testClientId]);
    await pool.query('DELETE FROM inscriptions WHERE is_test = TRUE AND client_id = $1', [testClientId]);
    await pool.query('DELETE FROM clients WHERE is_test = TRUE AND id = $1', [testClientId]);
    await pool.query('DELETE FROM expenses WHERE is_test = TRUE AND id = $1', [testExpenseId]);

    // B1. Cycle Client Test + Protection Conflit 409
    // B1.1 Création
    await pool.query(
      `INSERT INTO clients (
        id, code, first_name, last_name, gender, phone, email, status, is_test, created_at, updated_at
      ) VALUES ($1, 'GT-TEST-888', 'Moussa', 'Testeur', 'M', '+221770000000', 'moussa.test@taiba.sn', 'ACTIF', TRUE, NOW(), NOW())`,
      [testClientId]
    );
    const createdClient = await clientService.getClientById(testClientId);
    assert(createdClient !== null && createdClient.firstName === 'Moussa', 'B1.1 Client de test créé avec succès (is_test = TRUE)');

    // B1.2 Rattachement d une inscription dépendante
    await pool.query(
      `INSERT INTO inscriptions (
        id, code, client_id, campaign_id, package_id, package_version_id, applied_price, agreed_price, status, is_test, created_at, updated_at
      ) VALUES ($1, 'INS-TEST-888', $2, 'voy-haj2027-01', 'pkg-std-2027', 'ver-std-1', 5100000, 5100000, 'CONFIRMEE', TRUE, NOW(), NOW())`,
      [testInscriptionId, testClientId]
    );

    // B1.3 Tentative de suppression directe -> DOIT déclencher SUPPRESSION_REFUSEE_DEPENDANCES_EXISTANTES (HTTP 409)
    let rejected409 = false;
    try {
      await clientService.deleteClient(testClientId, actor);
    } catch (e: any) {
      if (
        e.code === 'SUPPRESSION_REFUSEE_DEPENDANCES_EXISTANTES' ||
        e.message?.includes('SUPPRESSION_REFUSEE_DEPENDANCES_EXISTANTES')
      ) {
        rejected409 = true;
      }
    }
    assert(rejected409, 'B1.3 Protection 409 : Suppression rejetée avec succès en raison d inscriptions existantes');

    // B1.4 Archivage sécurisé du client
    const archived = await clientService.archiveClient(testClientId, "Archivage automatique pour test d'intégrité", actor);
    assert(archived.status === 'ARCHIVE', 'B1.4 Workflow d archivage : Client basculé avec succès à status = ARCHIVE');

    // Nettoyage de l inscription et du client de test
    await pool.query('DELETE FROM inscriptions WHERE id = $1', [testInscriptionId]);
    await clientService.deleteClient(testClientId, actor);
    const clientAfterDelete = await clientService.getClientById(testClientId);
    assert(clientAfterDelete === null, 'B1.5 Client de test nettoyé proprement après suppression de ses dépendances');

    // B2. Cycle Dépense Test (VALIDE -> ANNULEE)
    // B2.1 Création dépense test VALIDE
    const createdExpense = await expenseService.createExpense(
      {
        voyageId: 'voy-haj2027-01',
        category: 'LOGISTIQUE',
        amount: 750000,
        currency: 'FCFA',
        date: new Date().toISOString().split('T')[0],
        supplier: 'Fournisseur Test Audit',
        comment: 'Achat test kits pèlerins audit',
        isTest: true,
        createdBy: actor.id,
      },
      actor
    );
    assert(createdExpense !== null && createdExpense.status === 'VALIDE', 'B2.1 Dépense test VALIDE créée avec succès');

    // B2.2 Annulation avec motif et traçabilité
    const cancelledExpense = await expenseService.cancelExpense(
      createdExpense.id,
      "Erreur de saisie détectée lors de l'audit",
      actor
    );
    assert(
      cancelledExpense.status === 'ANNULEE' &&
      cancelledExpense.cancellationReason === "Erreur de saisie détectée lors de l'audit" &&
      cancelledExpense.cancelledBy === actor.id,
      'B2.2 Cycle Dépense : Transition VALIDE -> ANNULEE réussie avec motif et auteur'
    );

    // B2.3 Vérification d exclusion dans les rapports financiers
    const dashboardStats = await dashboardService.getDashboardStats();
    const totalCampagneExpenses = dashboardStats.profitability.reduce((sum, p) => sum + p.expenses, 0);
    assert(
      totalCampagneExpenses === 0,
      `B2.3 Intégrité financière : Dépenses annulées rigoureusement exclues du calcul de rentabilité (totalCampagneExpenses: ${totalCampagneExpenses} FCFA)`
    );

    // Nettoyage dépense test
    await pool.query('DELETE FROM expenses WHERE id = $1', [createdExpense.id]);

    // B3. Simulation Google OAuth 2.0 / Résolution Neon Cloud
    // B3.1 Utilisateur existant (Cheikh Ibrahima Ka)
    const cheikhGoogleUser: GoogleUserInfo = {
      id: 'google-sub-cheikh-ka-test',
      email: 'kabaye73@gmail.com',
      emailVerified: true,
      name: 'Cheikh Ibrahima Ka',
    };
    const cheikhAuth = await googleOAuthService.authenticateWithGoogleUser(cheikhGoogleUser);
    const verifiedCheikhToken = verifySignedSessionToken(cheikhAuth.token);
    assert(
      cheikhAuth.user.role === 'SUPER_ADMIN' &&
      cheikhAuth.redirectPath === '/erp' &&
      verifiedCheikhToken !== null &&
      verifiedCheikhToken.email === 'kabaye73@gmail.com',
      'B3.1 Google OAuth : Résolution immédiate SUPER_ADMIN pour kabaye73@gmail.com (jeton HMAC-SHA256 valide)'
    );

    // B3.2 Utilisateur existant (El Hadji Abdoulaye Niass)
    const niassGoogleUser: GoogleUserInfo = {
      id: 'google-sub-niass-test',
      email: 'mr.niass@gmail.com',
      emailVerified: true,
      name: 'El Hadji Abdoulaye Niass',
    };
    const niassAuth = await googleOAuthService.authenticateWithGoogleUser(niassGoogleUser);
    const verifiedNiassToken = verifySignedSessionToken(niassAuth.token);
    assert(
      niassAuth.user.role === 'SUPER_ADMIN' &&
      niassAuth.redirectPath === '/erp' &&
      verifiedNiassToken !== null &&
      verifiedNiassToken.email === 'mr.niass@gmail.com',
      'B3.2 Google OAuth : Résolution immédiate SUPER_ADMIN pour mr.niass@gmail.com (jeton HMAC-SHA256 valide)'
    );

    // B3.3 Utilisateur Google Inconnu -> Rejet strict (COMPTE_NON_AUTORISE)
    const hackerGoogleUser: GoogleUserInfo = {
      id: 'google-sub-unknown-attacker',
      email: 'inconnu-hacker@example.com',
      emailVerified: true,
      name: 'Tentative Inconnue',
    };
    let blockedUnknown = false;
    try {
      await googleOAuthService.authenticateWithGoogleUser(hackerGoogleUser);
    } catch (err: any) {
      if (err.code === 'COMPTE_NON_AUTORISE' || err.message?.includes('pas autorisée')) {
        blockedUnknown = true;
      }
    }
    assert(blockedUnknown, 'B3.3 Google OAuth : Rejet strict (COMPTE_NON_AUTORISE) pour un compte Google inconnu');

    // B3.4 Vérification du log de sécurité dans audit_logs
    const auditRejectLog = await pool.query(
      `SELECT * FROM audit_logs WHERE action = 'AUTH_GOOGLE_REJECTED' AND entity_id = 'inconnu-hacker@example.com' LIMIT 1`
    );
    assert(auditRejectLog.rows.length > 0, 'B3.4 Sécurité : Tentative non autorisée consignée dans audit_logs');

    // Nettoyer le log de test
    await pool.query(`DELETE FROM audit_logs WHERE entity_id = 'inconnu-hacker@example.com'`);

    // -----------------------------------------------------------------
    // CONTRÔLE FINAL DU SANCTUAIRE FINANCIER
    // -----------------------------------------------------------------
    console.log(`\n${BOLD}${BLUE}▶ CONTRÔLE FINAL DU SANCTUAIRE FINANCIER (INVARIANTS APRÈS MUTATIONS)${RESET}`);

    const finalStatsRes = await pool.query(`
      SELECT 
        (SELECT count(*)::int FROM clients WHERE is_test = FALSE OR is_test IS NULL) as real_clients,
        (SELECT count(*)::int FROM inscriptions WHERE is_test = FALSE OR is_test IS NULL) as real_inscriptions,
        (SELECT count(*)::int FROM payments WHERE is_test = FALSE OR is_test IS NULL) as real_payments,
        (SELECT COALESCE(SUM(amount), 0)::numeric FROM payments WHERE is_test = FALSE OR is_test IS NULL) as total_encaisse,
        (SELECT COALESCE(SUM(agreed_price), 0)::numeric FROM inscriptions WHERE is_test = FALSE OR is_test IS NULL) as total_engage,
        (SELECT count(*)::int FROM expenses WHERE (is_test = FALSE OR is_test IS NULL) AND status != 'ANNULEE') as real_active_expenses
    `);

    const finalStats = finalStatsRes.rows[0];
    const finalRealClients = Number(finalStats.real_clients);
    const finalRealInscriptions = Number(finalStats.real_inscriptions);
    const finalRealPayments = Number(finalStats.real_payments);
    const finalTotalEncaisse = Number(finalStats.total_encaisse);
    const finalTotalEngage = Number(finalStats.total_engage);
    const finalSoldeRestant = finalTotalEngage - finalTotalEncaisse;
    const finalRealExpenses = Number(finalStats.real_active_expenses);

    assert(finalRealClients === realClients, `Sanctuaire Préservé : Clients réels = ${finalRealClients}`);
    assert(finalRealInscriptions === realInscriptions, `Sanctuaire Préservé : Inscriptions réelles = ${finalRealInscriptions}`);
    assert(finalRealPayments === realPayments, `Sanctuaire Préservé : Paiements réels = ${finalRealPayments}`);
    assert(finalTotalEncaisse === totalEncaisse, `Sanctuaire Préservé : Total encaissé = ${finalTotalEncaisse} FCFA`);
    assert(finalTotalEngage === totalEngage, `Sanctuaire Préservé : Total engagé = ${finalTotalEngage} FCFA`);
    assert(finalSoldeRestant === soldeRestant, `Sanctuaire Préservé : Solde restant = ${finalSoldeRestant} FCFA`);
    assert(finalRealExpenses === realExpenses, `Sanctuaire Préservé : Dépenses réelles actives = ${finalRealExpenses}`);

    // BILAN
    console.log(`\n${BOLD}${CYAN}======================================================================${RESET}`);
    if (failCount === 0) {
      console.log(`${BOLD}${GREEN}✓ SUCCÈS TOTAL DE L'AUDIT : ${passCount} TESTS VALIDÉS SUR ${passCount + failCount}${RESET}`);
      console.log(`${BOLD}${GREEN}  TOUS LES CRITÈRES DE FIABILITÉ, CRUD ET AUTH GOOGLE SONT CONFORMES.${RESET}`);
    } else {
      console.log(`${BOLD}${RED}✗ ÉCHEC DE L'AUDIT : ${failCount} ÉCHEC(S), ${passCount} RÉUSSITE(S)${RESET}`);
    }
    console.log(`${BOLD}${CYAN}======================================================================${RESET}\n`);

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (globalErr) {
    console.error(`${RED}Erreur inattendue pendant l'audit :${RESET}`, globalErr);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runAudit();
