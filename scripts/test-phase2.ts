import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { app } from '../server.js';
import { pool } from '../server/db/neon.js';
import { Server } from 'http';

interface TestResult {
  category: string;
  name: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

const results: TestResult[] = [];

function record(category: string, name: string, pass: boolean, details: string) {
  const status = pass ? 'PASS' : 'FAIL';
  results.push({ category, name, status, details });
  console.log(`[${status}] [${category}] ${name}: ${details}`);
}

async function runPhase2Tests() {
  console.log('=====================================================================');
  console.log('  SUITE DE TESTS DE CONFORMITÉ ARCHITECTURALE & RBAC (PHASE 2)');
  console.log('=====================================================================');

  // Start temporary test server
  let server: Server;
  let baseUrl: string;

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      console.log(`Serveur de test éphémère démarré sur ${baseUrl}\n`);
      resolve();
    });
  });

  try {
    // -------------------------------------------------------------
    // BLOC 1 : SÉCURITÉ AUTHENTIFICATION & VULNÉRABILITÉ CORRIGÉE
    // -------------------------------------------------------------
    console.log('--- 1. Authentification & Correction Vulnérabilité ---');

    // 1.1 Requête sans header auth -> 401 attendu
    const resNoAuth = await fetch(`${baseUrl}/api/users`);
    record(
      'AUTH',
      'Rejet sans authentification (401)',
      resNoAuth.status === 401,
      `Status HTTP: ${resNoAuth.status} (Attendu: 401 Unauthorized)`
    );

    // 1.2 Requête avec identifiant invalide/inexistant -> 401 attendu
    const resBadUser = await fetch(`${baseUrl}/api/users`, {
      headers: { 'x-user-id': 'usr-hacker-non-existant' },
    });
    record(
      'AUTH',
      'Rejet utilisateur inconnu (401)',
      resBadUser.status === 401,
      `Status HTTP: ${resBadUser.status} (Attendu: 401 Unauthorized)`
    );

    // 1.3 Requête avec utilisateur valide (usr-admin) -> 200 OK
    const resAdmin = await fetch(`${baseUrl}/api/users`, {
      headers: { 'x-user-id': 'usr-admin' },
    });
    record(
      'AUTH',
      'Acceptation utilisateur valide (200)',
      resAdmin.status === 200,
      `Status HTTP: ${resAdmin.status} (Attendu: 200 OK)`
    );

    // -------------------------------------------------------------
    // BLOC 2 : RBAC CENTRALISÉ & MATRICE DES PERMISSIONS
    // -------------------------------------------------------------
    console.log('\n--- 2. RBAC Centralisé & Restrictions Métier ---');

    // 2.1 PELERIN ne peut PAS accéder à /api/users -> 403 attendu
    const resPilgrimUsers = await fetch(`${baseUrl}/api/users`, {
      headers: { 'x-user-id': 'usr-pelerin-saidou' },
    });
    record(
      'RBAC',
      'Pèlerin interdit d\'accès à /api/users (403)',
      resPilgrimUsers.status === 403,
      `Status HTTP: ${resPilgrimUsers.status} (Attendu: 403 Forbidden)`
    );

    // 2.2 PELERIN ne peut PAS accéder au dossier d'un autre pèlerin -> 403 attendu
    // usr-pelerin-saidou a clientId = 'cli-001'. Tentative d'accès à 'cli-002'
    const resPilgrimIsolation = await fetch(`${baseUrl}/api/pilgrim/dossier?clientId=cli-002`, {
      headers: { 'x-user-id': 'usr-pelerin-saidou' },
    });
    record(
      'RBAC',
      'Isolation stricte du dossier Pèlerin (403)',
      resPilgrimIsolation.status === 403,
      `Status HTTP: ${resPilgrimIsolation.status} (Attendu: 403 Forbidden)`
    );

    // 2.3 PELERIN accède à son propre dossier -> 200 OK
    const resPilgrimSelf = await fetch(`${baseUrl}/api/pilgrim/dossier?clientId=cli-001`, {
      headers: { 'x-user-id': 'usr-pelerin-saidou' },
    });
    record(
      'RBAC',
      'Pèlerin accède à son propre dossier (200)',
      resPilgrimSelf.status === 200,
      `Status HTTP: ${resPilgrimSelf.status} (Attendu: 200 OK)`
    );

    // 2.4 AGENT ne peut PAS supprimer de voyage -> 403 attendu
    const resAgentDeleteVoyage = await fetch(`${baseUrl}/api/voyages/voy-haj2027-01`, {
      method: 'DELETE',
      headers: { 'x-user-id': 'usr-agent' },
    });
    record(
      'RBAC',
      'Agent interdit de suppression voyage (403)',
      resAgentDeleteVoyage.status === 403,
      `Status HTTP: ${resAgentDeleteVoyage.status} (Attendu: 403 Forbidden)`
    );

    // 2.5 CAISSE peut consulter les paiements -> 200 OK
    const resCaissePayments = await fetch(`${baseUrl}/api/payments`, {
      headers: { 'x-user-id': 'usr-caisse' },
    });
    record(
      'RBAC',
      'Caisse accès aux paiements (200)',
      resCaissePayments.status === 200,
      `Status HTTP: ${resCaissePayments.status} (Attendu: 200 OK)`
    );

    // 2.6 LOGISTIQUE peut consulter les vols et chambres -> 200 OK
    const resLogFlights = await fetch(`${baseUrl}/api/flights`, {
      headers: { 'x-user-id': 'usr-logistique' },
    });
    const resLogRooms = await fetch(`${baseUrl}/api/rooms`, {
      headers: { 'x-user-id': 'usr-logistique' },
    });
    record(
      'RBAC',
      'Logistique accès vols et chambres (200)',
      resLogFlights.status === 200 && resLogRooms.status === 200,
      `Flights: ${resLogFlights.status}, Rooms: ${resLogRooms.status}`
    );

    // 2.7 DIRECTION a accès aux rapports et statistiques financières -> 200 OK
    const resDirStats = await fetch(`${baseUrl}/api/dashboard/stats`, {
      headers: { 'x-user-id': 'usr-direction' },
    });
    record(
      'RBAC',
      'Direction accès aux rapports et dashboard (200)',
      resDirStats.status === 200,
      `Status HTTP: ${resDirStats.status}`
    );

    // -------------------------------------------------------------
    // BLOC 3 : VÉRIFICATION STRICTE DES CHIFFRES FINANCIERS HISTORIQUES
    // -------------------------------------------------------------
    console.log('\n--- 3. Contrôle des Soldes et Chiffres Financiers ---');

    const revRes = await pool.query(
      `SELECT COALESCE(SUM(applied_price), 0) as total FROM inscriptions WHERE status != 'ANNULEE'`
    );
    const payRes = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'VALIDE'`
    );
    const expRes = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses`
    );

    const actualCA = Number(revRes.rows[0].total);
    const actualPay = Number(payRes.rows[0].total);
    const actualRemaining = actualCA - actualPay;
    const actualExp = Number(expRes.rows[0].total);

    const EXPECTED_CA = 30600000;
    const EXPECTED_PAY = 4750000;
    const EXPECTED_REM = 25850000;
    const EXPECTED_EXP = 23500000;

    record(
      'FINANCES',
      'Chiffre d\'affaires attendu (30 600 000 FCFA)',
      actualCA === EXPECTED_CA,
      `Actuel: ${actualCA.toLocaleString('fr-FR')} FCFA | Attendu: ${EXPECTED_CA.toLocaleString('fr-FR')} FCFA (Écart: ${actualCA - EXPECTED_CA})`
    );

    record(
      'FINANCES',
      'Encaissements validés (4 750 000 FCFA)',
      actualPay === EXPECTED_PAY,
      `Actuel: ${actualPay.toLocaleString('fr-FR')} FCFA | Attendu: ${EXPECTED_PAY.toLocaleString('fr-FR')} FCFA (Écart: ${actualPay - EXPECTED_PAY})`
    );

    record(
      'FINANCES',
      'Reste à recouvrer (25 850 000 FCFA)',
      actualRemaining === EXPECTED_REM,
      `Actuel: ${actualRemaining.toLocaleString('fr-FR')} FCFA | Attendu: ${EXPECTED_REM.toLocaleString('fr-FR')} FCFA (Écart: ${actualRemaining - EXPECTED_REM})`
    );

    record(
      'FINANCES',
      'Total des dépenses (23 500 000 FCFA)',
      actualExp === EXPECTED_EXP,
      `Actuel: ${actualExp.toLocaleString('fr-FR')} FCFA | Attendu: ${EXPECTED_EXP.toLocaleString('fr-FR')} FCFA (Écart: ${actualExp - EXPECTED_EXP})`
    );

    // -------------------------------------------------------------
    // BLOC 4 : TESTS DE NON-RÉGRESSION FONCTIONNELLE SUR SERVICES/REPOSITORIES
    // -------------------------------------------------------------
    console.log('\n--- 4. Tests Fonctionnels Métier (Services / Repositories) ---');

    // 4.1 Création d'un paiement de test, puis annulation sécurisée (payment_reversals)
    const payCreateRes = await fetch(`${baseUrl}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'usr-caisse' },
      body: JSON.stringify({
        clientId: 'cli-004',
        inscriptionId: 'ins-004',
        amount: 500000,
        paymentMethod: 'Wave',
        comment: 'Acompte test conformité Phase 2',
      }),
    });
    const createdPayment = await payCreateRes.json();
    const payCreatedOk = payCreateRes.status === 201 && createdPayment.receiptNumber?.startsWith('PAY-2027-');

    record(
      'SERVICES',
      'Création d\'encaissement avec reçu incrémental',
      payCreatedOk,
      `Reçu généré: ${createdPayment.receiptNumber || 'N/A'}, Statut: ${payCreateRes.status}`
    );

    // Annulation du paiement par la Direction
    const cancelRes = await fetch(`${baseUrl}/api/payments/${createdPayment.id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'usr-direction' },
      body: JSON.stringify({ reason: 'Test de non-régression annulation Phase 2' }),
    });
    const canceledPayment = await cancelRes.json();
    const cancelOk = cancelRes.status === 200 && canceledPayment.status === 'ANNULE';

    // Vérifier l'inscription dans payment_reversals
    const revCheck = await pool.query(
      `SELECT * FROM payment_reversals WHERE payment_id = $1`,
      [createdPayment.id]
    );
    const reversalTracked = revCheck.rows.length === 1;

    // Nettoyer l'entrée de test pour préserver les chiffres stricts
    await pool.query(`DELETE FROM payment_reversals WHERE payment_id = $1`, [createdPayment.id]);
    await pool.query(`DELETE FROM payments WHERE id = $1`, [createdPayment.id]);

    record(
      'SERVICES',
      'Annulation sécurisée & traçabilité payment_reversals',
      cancelOk && reversalTracked,
      `Statut annulé: ${canceledPayment.status}, Reversal tracé: ${reversalTracked ? 'OUI' : 'NON'}`
    );

    // 4.2 Rejet de surréservation de chambre (Anti-overbooking)
    // Chambre room-mak-401 a capacité 4 et déjà 1 occupant. Tentative d'affectation de 4 personnes supplémentaires
    const assignOverbookRes = await fetch(`${baseUrl}/api/rooms/room-mak-402/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'usr-logistique' },
      body: JSON.stringify({ clientId: 'cli-001' }),
    });
    // room-mak-402 est dans htl-001. Mais cli-001 est DÉJÀ affecté à room-mak-401 dans htl-001!
    // Doit être rejeté (double occupation interdite dans le même hôtel)
    record(
      'SERVICES',
      'Anti-double affectation dans le même hôtel',
      assignOverbookRes.status === 422,
      `Status HTTP: ${assignOverbookRes.status} (Attendu: 422 Unprocessable Entity)`
    );

    // 4.3 Modification de tarif avec motif obligatoire
    const pricePatchNoReason = await fetch(`${baseUrl}/api/inscriptions/ins-001/price`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'usr-direction' },
      body: JSON.stringify({ newPrice: 5200000, reason: '' }),
    });
    record(
      'SERVICES',
      'Rejet modification tarif sans motif justificatif',
      pricePatchNoReason.status === 400,
      `Status HTTP: ${pricePatchNoReason.status} (Attendu: 400 Bad Request)`
    );

    // 4.4 Journal d'audit actif
    const auditRes = await pool.query(`SELECT COUNT(*) as count FROM audit_logs`);
    const auditCount = parseInt(auditRes.rows[0].count, 10);
    record(
      'SERVICES',
      'Audit log infalsifiable alimenté en continu',
      auditCount >= 7,
      `Nombre d'entrées d'audit en base: ${auditCount}`
    );

    // -------------------------------------------------------------
    // BLOC 5 : PRÉSERVATION DES RESSOURCES LOCALES
    // -------------------------------------------------------------
    console.log('\n--- 5. Préservation des Données Locales ---');
    const jsonPath = path.join(process.cwd(), 'data', 'database.json');
    const dbJsonExists = fs.existsSync(jsonPath);
    const dbJsonSize = fs.statSync(jsonPath).size;

    record(
      'INTEGRITE',
      'Préservation intégrale de data/database.json',
      dbJsonExists && dbJsonSize === 32511,
      `Fichier présent: ${dbJsonExists}, Taille: ${dbJsonSize} octets (Identique à Phase 0/1)`
    );

  } finally {
    server.close();
  }

  // -------------------------------------------------------------
  // BILAN GÉNÉRAL DES TESTS PHASE 2
  // -------------------------------------------------------------
  console.log('\n=====================================================================');
  console.log('  BILAN FINAL DES TESTS PHASE 2');
  console.log('=====================================================================');

  const allPassed = results.every((r) => r.status === 'PASS');
  const passCount = results.filter((r) => r.status === 'PASS').length;
  const totalCount = results.length;

  results.forEach((r) => {
    console.log(`[${r.status}] [${r.category}] ${r.name} -> ${r.details}`);
  });

  console.log(`\nRÉSULTAT GLOBAL PHASE 2 : ${passCount}/${totalCount} TESTS PASS (${allPassed ? '100% SUCCÈS' : 'ÉCHEC'})`);

  await pool.end();

  if (!allPassed) {
    process.exit(1);
  }
}

runPhase2Tests().catch((err) => {
  console.error('Erreur critique pendant les tests Phase 2:', err);
  process.exit(1);
});
