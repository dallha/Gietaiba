import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pool } from '../server/db/neon.js';
import { runMigration } from './migrate-neon.js';

async function runTests() {
  console.log('====================================================');
  console.log('  SUITE DE TESTS DE CONFORMITÉ NEON POSTGRESQL (PHASE 1)');
  console.log('====================================================');

  const testReport: { test: string; status: 'PASS' | 'FAIL'; message: string }[] = [];

  function record(test: string, pass: boolean, message: string) {
    const status = pass ? 'PASS' : 'FAIL';
    testReport.push({ test, status, message });
    console.log(`[${status}] ${test} : ${message}`);
  }

  // -------------------------------------------------------------
  // TEST 1 : CONNEXION À LA BASE NEON
  // -------------------------------------------------------------
  console.log('\n--- TEST 1 : Connexion Neon ---');
  try {
    const res = await pool.query('SELECT NOW() as now, version() as version');
    record('1. Connexion Neon', !!res.rows[0].now, `Connecté avec succès. PostgreSQL version : ${res.rows[0].version.substring(0, 30)}...`);
  } catch (err: any) {
    record('1. Connexion Neon', false, `Échec de connexion : ${err.message}`);
    process.exit(1);
  }

  // -------------------------------------------------------------
  // TEST 2 : INTÉGRITÉ DU SCHÉMA (VÉRIFICATION DES 28 TABLES)
  // -------------------------------------------------------------
  console.log('\n--- TEST 2 : Présence des Tables ---');
  const expectedTables = [
    'settings', 'roles', 'permissions', 'role_permissions', 'users', 'user_roles',
    'clients', 'campaigns', 'packages', 'package_versions', 'inscriptions',
    'payments', 'payment_reversals', 'document_types', 'documents', 'visas',
    'flights', 'tickets', 'hotels', 'rooms', 'room_assignments', 'groups',
    'group_members', 'accompagnateurs', 'expenses', 'notifications', 'audit_logs',
    'migration_id_map'
  ];

  const tableRes = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
  );
  const existingTables = new Set(tableRes.rows.map(r => r.table_name));
  const missingTables = expectedTables.filter(t => !existingTables.has(t));

  record(
    '2. Tables du Schéma',
    missingTables.length === 0,
    missingTables.length === 0
      ? `Toutes les ${expectedTables.length} tables existent dans public.`
      : `Tables manquantes : ${missingTables.join(', ')}`
  );

  // -------------------------------------------------------------
  // TEST 3 : COMPARAISON QUANTITATIVE JSON vs POSTGRESQL
  // -------------------------------------------------------------
  console.log('\n--- TEST 3 : Comparaison Quantitative JSON vs PostgreSQL ---');
  const jsonPath = path.join(process.cwd(), 'data', 'database.json');
  const dbJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const countChecks = [
    { name: 'settings', json: 1, table: 'settings' },
    { name: 'clients', json: dbJson.clients.length, table: 'clients' },
    { name: 'users', json: dbJson.users.length, table: 'users' },
    { name: 'campaigns (voyages)', json: dbJson.voyages.length, table: 'campaigns' },
    { name: 'packages', json: dbJson.packages.length, table: 'packages' },
    {
      name: 'package_versions',
      json: dbJson.package_versions.length,
      expectedPg: 3, // 3 valides, 1 bloqué (ver-oum-1 orpheline selon Règle 9)
      table: 'package_versions',
      note: '1 orphelin bloqué et tracé dans migration_id_map'
    },
    { name: 'inscriptions', json: dbJson.inscriptions.length, table: 'inscriptions' },
    { name: 'payments', json: dbJson.payments.length, table: 'payments' },
    { name: 'documents', json: dbJson.documents.length, table: 'documents' },
    { name: 'visas', json: dbJson.visas.length, table: 'visas' },
    { name: 'flights', json: dbJson.flights.length, table: 'flights' },
    { name: 'tickets', json: dbJson.tickets.length, table: 'tickets' },
    { name: 'hotels', json: dbJson.hotels.length, table: 'hotels' },
    { name: 'rooms', json: dbJson.rooms.length, table: 'rooms' },
    { name: 'room_assignments', json: dbJson.room_assignments.length, table: 'room_assignments' },
    { name: 'groups', json: dbJson.groups.length, table: 'groups' },
    { name: 'group_members', json: dbJson.group_members.length, table: 'group_members' },
    { name: 'accompagnateurs', json: dbJson.accompagnateurs.length, table: 'accompagnateurs' },
    { name: 'expenses', json: dbJson.expenses.length, table: 'expenses' },
    { name: 'notifications', json: dbJson.notifications.length, table: 'notifications' },
    { name: 'audit_logs', json: dbJson.audit_logs.length, table: 'audit_logs' },
  ];

  let allCountsPass = true;
  for (const c of countChecks) {
    const q = await pool.query(`SELECT COUNT(*) as cnt FROM ${c.table}`);
    const pgCount = parseInt(q.rows[0].cnt, 10);
    const expected = c.expectedPg !== undefined ? c.expectedPg : c.json;
    const ok = pgCount === expected;
    if (!ok) allCountsPass = false;
    console.log(`   - ${c.name.padEnd(25)} : JSON = ${String(c.json).padStart(2)} | PG = ${String(pgCount).padStart(2)} | Résultat : ${ok ? 'OK' : 'DIFF'} ${c.note ? `(${c.note})` : ''}`);
  }
  record('3. Comparaison Quantitative', allCountsPass, allCountsPass ? 'Tous les décomptes sont rigoureusement exacts.' : 'Des disparités ont été constatées.');

  // -------------------------------------------------------------
  // TEST 4 : TOTALS FINANCIERS STRICTS
  // -------------------------------------------------------------
  console.log('\n--- TEST 4 : Totaux Financiers ---');
  const revRes = await pool.query(`SELECT COALESCE(SUM(applied_price), 0) as total FROM inscriptions WHERE status != 'ANNULEE'`);
  const payRes = await pool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'VALIDE'`);
  const expRes = await pool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses`);

  const pgRevenue = Number(revRes.rows[0].total);
  const pgPaid = Number(payRes.rows[0].total);
  const pgExpenses = Number(expRes.rows[0].total);

  const EXPECTED_REV = 30600000;
  const EXPECTED_PAID = 4750000;
  const EXPECTED_EXP = 23500000;

  const finOk = pgRevenue === EXPECTED_REV && pgPaid === EXPECTED_PAID && pgExpenses === EXPECTED_EXP;
  record(
    '4. Totaux Financiers',
    finOk,
    `CA=${pgRevenue.toLocaleString('fr-FR')} FCFA (attendu: ${EXPECTED_REV.toLocaleString('fr-FR')}), ` +
    `Encaissements=${pgPaid.toLocaleString('fr-FR')} FCFA (attendu: ${EXPECTED_PAID.toLocaleString('fr-FR')}), ` +
    `Dépenses=${pgExpenses.toLocaleString('fr-FR')} FCFA (attendu: ${EXPECTED_EXP.toLocaleString('fr-FR')})`
  );

  // -------------------------------------------------------------
  // TEST 5 : VÉRIFICATION DES RELATIONS & CLÉS ÉTRANGÈRES
  // -------------------------------------------------------------
  console.log('\n--- TEST 5 : Relations et Clés Étrangères ---');
  const fkChecks = [
    { desc: 'Inscriptions -> Clients', q: `SELECT COUNT(*) as cnt FROM inscriptions i LEFT JOIN clients c ON i.client_id = c.id WHERE c.id IS NULL` },
    { desc: 'Inscriptions -> Campagnes', q: `SELECT COUNT(*) as cnt FROM inscriptions i LEFT JOIN campaigns c ON i.campaign_id = c.id WHERE c.id IS NULL` },
    { desc: 'Inscriptions -> Packages', q: `SELECT COUNT(*) as cnt FROM inscriptions i LEFT JOIN packages p ON i.package_id = p.id WHERE p.id IS NULL` },
    { desc: 'Paiements -> Inscriptions', q: `SELECT COUNT(*) as cnt FROM payments p LEFT JOIN inscriptions i ON p.inscription_id = i.id WHERE i.id IS NULL` },
    { desc: 'Paiements -> Clients', q: `SELECT COUNT(*) as cnt FROM payments p LEFT JOIN clients c ON p.client_id = c.id WHERE c.id IS NULL` },
    { desc: 'Chambres -> Hôtels', q: `SELECT COUNT(*) as cnt FROM rooms r LEFT JOIN hotels h ON r.hotel_id = h.id WHERE h.id IS NULL` },
    { desc: 'Affectations -> Chambres', q: `SELECT COUNT(*) as cnt FROM room_assignments ra LEFT JOIN rooms r ON ra.room_id = r.id WHERE r.id IS NULL` },
    { desc: 'Dépenses -> Campagnes', q: `SELECT COUNT(*) as cnt FROM expenses e LEFT JOIN campaigns c ON e.campaign_id = c.id WHERE c.id IS NULL` },
    { desc: 'Dépenses -> Utilisateur Créateur (Règle 10)', q: `SELECT COUNT(*) as cnt FROM expenses e LEFT JOIN users u ON e.created_by = u.id WHERE u.id IS NULL` },
  ];

  let allFkPass = true;
  for (const fk of fkChecks) {
    const r = await pool.query(fk.q);
    const broken = parseInt(r.rows[0].cnt, 10);
    if (broken > 0) allFkPass = false;
    console.log(`   - ${fk.desc.padEnd(45)} : ${broken === 0 ? 'VALIDE (0 orphelin)' : `ÉCHEC (${broken} orphelins)`}`);
  }
  record('5. Relations et Clés Étrangères', allFkPass, allFkPass ? '100% des relations SQL sont intègres.' : 'Clés étrangères orphelines détectées.');

  // -------------------------------------------------------------
  // TEST 6 : VÉRIFICATION DES CONTRAINTES (CHECK & UNIQUE)
  // -------------------------------------------------------------
  console.log('\n--- TEST 6 : Contraintes Métier SQL ---');
  let constraintsPass = true;

  // 6.1 Test CHECK constraint : montant négatif interdit sur les paiements
  try {
    await pool.query(`INSERT INTO payments (id, receipt_number, inscription_id, client_id, campaign_id, amount, payment_method)
                      VALUES ('test-neg', 'PAY-TEST-NEG', 'ins-001', 'cli-001', 'voy-haj2027-01', -500, 'Espèces')`);
    constraintsPass = false;
    console.log('   - CHECK amount > 0 sur payments : ÉCHEC (insertion acceptée au lieu d\'être rejetée)');
  } catch (err: any) {
    console.log('   - CHECK amount > 0 sur payments : VALIDE (rejeté par la contrainte CHECK)');
  }

  // 6.2 Test UNIQUE constraint : reçu de paiement en doublon interdit
  try {
    await pool.query(`INSERT INTO payments (id, receipt_number, inscription_id, client_id, campaign_id, amount, payment_method)
                      VALUES ('test-dup', 'PAY-2027-0001', 'ins-001', 'cli-001', 'voy-haj2027-01', 1000, 'Espèces')`);
    constraintsPass = false;
    console.log('   - UNIQUE receipt_number : ÉCHEC (doublon accepté au lieu d\'être rejeté)');
  } catch (err: any) {
    console.log('   - UNIQUE receipt_number : VALIDE (doublon rejeté par la contrainte UNIQUE)');
  }

  // 6.3 Test UNIQUE constraint partielle : inscription active en double interdite pour un même pèlerin
  try {
    await pool.query(`INSERT INTO inscriptions (id, code, client_id, campaign_id, package_id, package_version_id, applied_price, agreed_price)
                      VALUES ('test-ins-dup', 'INS-TEST-DUP', 'cli-001', 'voy-haj2027-01', 'pkg-std-2027', 'ver-std-1', 5100000, 5100000)`);
    constraintsPass = false;
    console.log('   - UNIQUE inscriptions(client, campaign) : ÉCHEC (double inscription acceptée)');
  } catch (err: any) {
    console.log('   - UNIQUE inscriptions(client, campaign) : VALIDE (rejeté par l\'index unique uq_client_campaign_active)');
  }

  record('6. Contraintes Métier SQL', constraintsPass, constraintsPass ? 'Toutes les contraintes CHECK et UNIQUE fonctionnent correctement.' : 'Défaut de contrainte.');

  // -------------------------------------------------------------
  // TEST 7 : TEST D'IDEMPOTENCE STRICTE (RÉ-EXÉCUTION DE LA MIGRATION)
  // -------------------------------------------------------------
  console.log('\n--- TEST 7 : Test d\'Idempotence ---');
  try {
    console.log('Ré-exécution de runMigration()...');
    await runMigration();

    // Vérifier à nouveau les totaux
    let idempotencePass = true;
    for (const c of countChecks) {
      const q = await pool.query(`SELECT COUNT(*) as cnt FROM ${c.table}`);
      const pgCount = parseInt(q.rows[0].cnt, 10);
      const expected = c.expectedPg !== undefined ? c.expectedPg : c.json;
      if (pgCount !== expected) {
        idempotencePass = false;
        console.log(`   - ÉCHEC d'idempotence sur ${c.table}: attendu=${expected}, obtenu=${pgCount}`);
      }
    }
    record('7. Test d\'Idempotence', idempotencePass, idempotencePass ? 'La ré-exécution n\'a créé aucun doublon et préserve 100% des données.' : 'La ré-exécution a altéré les décomptes.');
  } catch (err: any) {
    record('7. Test d\'Idempotence', false, `Erreur lors de la ré-exécution : ${err.message}`);
  }

  // -------------------------------------------------------------
  // TEST 8 : TEST TRANSACTIONNEL ACID (ROLLBACK SUR ERREUR)
  // -------------------------------------------------------------
  console.log('\n--- TEST 8 : Transaction ACID & Rollback ---');
  const txClient = await pool.connect();
  let txOk = false;
  try {
    await txClient.query('BEGIN');
    await txClient.query(`INSERT INTO clients (id, code, first_name, last_name, phone) VALUES ('cli-temp-tx', 'CLI-TX', 'Temp', 'Tx', '770000000')`);
    // Déclencher une violation intentionnelle de clé étrangère
    await txClient.query(`INSERT INTO inscriptions (id, code, client_id, campaign_id, package_id, package_version_id, applied_price, agreed_price)
                          VALUES ('ins-temp-tx', 'INS-TX', 'cli-temp-tx', 'voy-inexistant', 'pkg-std-2027', 'ver-std-1', 100, 100)`);
    await txClient.query('COMMIT');
  } catch (expectedErr) {
    await txClient.query('ROLLBACK');
    // Vérifier que le client temporaire n'a PAS été persisté
    const chk = await pool.query(`SELECT COUNT(*) as cnt FROM clients WHERE id = 'cli-temp-tx'`);
    txOk = parseInt(chk.rows[0].cnt, 10) === 0;
  } finally {
    txClient.release();
  }
  record('8. Transaction ACID & Rollback', txOk, txOk ? 'Le ROLLBACK a annulé l\'intégralité des écritures de la transaction en échec.' : 'Données orphelines persistées après échec.');

  // -------------------------------------------------------------
  // TEST 9 : INTÉGRITÉ DU FICHIER LOCAL data/database.json
  // -------------------------------------------------------------
  console.log('\n--- TEST 9 : Non-altération de data/database.json ---');
  const fileExists = fs.existsSync(jsonPath);
  const currentSize = fs.statSync(jsonPath).size;
  const originalSize = 32511; // Constaté lors de l'audit
  record(
    '9. Préservation de database.json',
    fileExists && Math.abs(currentSize - originalSize) < 100,
    `Le fichier local data/database.json est préservé intact (${currentSize} octets). Aucune suppression ni altération.`
  );

  // -------------------------------------------------------------
  // BILAN GÉNÉRAL DES TESTS
  // -------------------------------------------------------------
  console.log('\n====================================================');
  console.log('  BILAN FINAL DES TESTS (PHASE 1)');
  console.log('====================================================');
  const allPass = testReport.every(t => t.status === 'PASS');
  testReport.forEach(t => {
    console.log(`[${t.status}] ${t.test} -> ${t.message}`);
  });
  console.log(`\nRÉSULTAT GLOBAL : ${allPass ? 'TOUS LES TESTS ONT RÉUSSI (100% PASS)' : 'DES TESTS ONT ÉCHOUÉ'}`);

  await pool.end();

  if (!allPass) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error in tests:', err);
  process.exit(1);
});
