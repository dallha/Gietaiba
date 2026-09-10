import 'dotenv/config';
import { pool } from '../server/db/neon.js';
import { userRepository } from '../server/repositories/user.repository.js';
import { pilgrimService } from '../server/services/pilgrim.service.js';
import { clientRepository } from '../server/repositories/client.repository.js';
import { UserSession } from '../src/types.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${name}`);
    failed++;
  }
}

async function runTests() {
  console.log('=====================================================================');
  console.log('  SUITE DE TESTS PHASE 5D : MULTI-CLIENT, TUTEURS & SÉCURITÉ IDOR');
  console.log('=====================================================================');

  try {
    // -------------------------------------------------------------
    // TEST 3: Éradication des comptes fictifs (mrniass1987@gmail.com)
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Éradication du compte fictif Amadou Niass ---');
    const niassDb = await pool.query(`SELECT id FROM users WHERE id = 'usr-pelerin-niass' OR email = 'mrniass1987@gmail.com'`);
    assert(niassDb.rows.length === 0, 'usr-pelerin-niass totalement supprimé de la table users');

    const fakeSession: UserSession = {
      id: 'usr-unauthorized-test',
      email: 'unauth@test.sn',
      role: 'PELERIN',
      clientId: 'cli-nonexistent',
      active: true,
    };
    let niassIdorBlocked = false;
    try {
      await pilgrimService.getPilgrimDossier('cli-001', fakeSession);
    } catch (err: any) {
      if (err.message === 'ACCES_REFUSE_PELERIN_ISOLATION') {
        niassIdorBlocked = true;
      }
    }
    assert(niassIdorBlocked, 'IDOR bloqué : utilisateur non-autorisé ne peut PAS accéder au dossier réel cli-001');

    // -------------------------------------------------------------
    // TEST 4: Modèle Tuteur Multi-Clients (1 Compte -> N Clients)
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Modèle Tuteur Multi-Clients ---');
    const tuteurId = 'usr-test-tuteur-famille';
    const parent1Id = 'cli-test-parent1';
    const parent2Id = 'cli-test-parent2';

    // Nettoyage préalable au cas où
    await pool.query(`DELETE FROM user_client_access WHERE user_id = $1`, [tuteurId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [tuteurId]);
    await pool.query(`DELETE FROM clients WHERE id IN ($1, $2)`, [parent1Id, parent2Id]);

    // Création du compte tuteur (sans client_id direct)
    await pool.query(`
      INSERT INTO users (id, email, display_name, phone, password_hash, role_id, status, active, client_id, is_test)
      VALUES ($1, 'tuteur.test@taiba.sn', 'Moustapha Diop (Tuteur)', '770001122', 'tuteur123', 'PELERIN', 'ACTIF', TRUE, NULL, TRUE)
    `, [tuteurId]);

    // Création de deux clients sous tutelle
    await pool.query(`
      INSERT INTO clients (id, code, first_name, last_name, gender, phone, status, is_test)
      VALUES 
        ($1, 'GT-TEST-PAR1', 'IBRAHIMA', 'DIOP', 'M', '771112233', 'ACTIF', TRUE),
        ($2, 'GT-TEST-PAR2', 'MARIAMA', 'SARR', 'F', '772223344', 'ACTIF', TRUE)
    `, [parent1Id, parent2Id]);

    // Habilitation N:N via user_client_access
    await userRepository.grantClientAccess({
      userId: tuteurId,
      clientId: parent1Id,
      relationshipType: 'TUTEUR_FAMILLE',
      canView: true,
      canPay: true,
      canUploadDocs: true,
    });

    await userRepository.grantClientAccess({
      userId: tuteurId,
      clientId: parent2Id,
      relationshipType: 'TUTEUR_FAMILLE',
      canView: true,
      canPay: true,
      canUploadDocs: false, // Restriction volontaire pour test de granularité
    });

    const tuteurSession: UserSession = {
      id: tuteurId,
      email: 'tuteur.test@taiba.sn',
      role: 'PELERIN',
      displayName: 'Moustapha Diop (Tuteur)',
      active: true,
    };

    // Test de résolution multi-clients
    const accessibleClients = await userRepository.getUserAccessibleClients(tuteurId);
    assert(accessibleClients.length === 2, 'Tuteur a accès à exactement 2 clients');
    assert(accessibleClients.some(c => c.id === parent1Id), 'Tuteur a accès au client 1 (Père)');
    assert(accessibleClients.some(c => c.id === parent2Id), 'Tuteur a accès au client 2 (Mère)');

    // Test d'accès aux dossiers des deux parents
    const dossierP1 = await pilgrimService.getPilgrimDossier(parent1Id, tuteurSession);
    assert(dossierP1.client.id === parent1Id, 'Tuteur consulte avec succès le dossier du Parent 1');

    const dossierP2 = await pilgrimService.getPilgrimDossier(parent2Id, tuteurSession);
    assert(dossierP2.client.id === parent2Id, 'Tuteur consulte avec succès le dossier du Parent 2');

    // Test de permission granulaire (canUploadDocs)
    const canUploadP1 = await userRepository.hasAccessToClient(tuteurId, parent1Id, 'canUploadDocs');
    assert(canUploadP1 === true, 'Permission canUploadDocs accordée sur Parent 1');

    const canUploadP2 = await userRepository.hasAccessToClient(tuteurId, parent2Id, 'canUploadDocs');
    assert(canUploadP2 === false, 'Permission canUploadDocs correctement refusée sur Parent 2');

    // Test IDOR Tuteur vers un client non affilié (cli-001)
    let tuteurIdorBlocked = false;
    try {
      await pilgrimService.getPilgrimDossier('cli-001', tuteurSession);
    } catch (err: any) {
      if (err.message === 'ACCES_REFUSE_PELERIN_ISOLATION') {
        tuteurIdorBlocked = true;
      }
    }
    assert(tuteurIdorBlocked, 'IDOR bloqué : Le tuteur ne peut PAS accéder au client réel cli-001');

    // -------------------------------------------------------------
    // TEST 5: Révocation d'accès
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Révocation d\'accès ---');
    await userRepository.revokeClientAccess(tuteurId, parent2Id);
    let revokedBlocked = false;
    try {
      await pilgrimService.getPilgrimDossier(parent2Id, tuteurSession);
    } catch (err: any) {
      if (err.message === 'ACCES_REFUSE_PELERIN_ISOLATION') {
        revokedBlocked = true;
      }
    }
    assert(revokedBlocked, 'Accès au Parent 2 bloqué immédiatement après révocation');

    // Nettoyage des données de test du tuteur
    await pool.query(`DELETE FROM user_client_access WHERE user_id = $1`, [tuteurId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [tuteurId]);
    await pool.query(`DELETE FROM clients WHERE id IN ($1, $2)`, [parent1Id, parent2Id]);

    // -------------------------------------------------------------
    // TEST 6: Contrôle Sanctuaire des Données Réelles
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Contrôle Absolu du Sanctuaire Financier ---');
    const realClients = await pool.query(`SELECT COUNT(*) as c FROM clients WHERE is_test = FALSE`);
    const realIns = await pool.query(`SELECT COUNT(*) as c FROM inscriptions WHERE is_test = FALSE`);
    const realPay = await pool.query(`SELECT COUNT(*) as c, SUM(amount) as s FROM payments WHERE is_test = FALSE`);
    const realExp = await pool.query(`SELECT COUNT(*) as c FROM expenses`);

    const cCount = parseInt(realClients.rows[0].c, 10);
    const iCount = parseInt(realIns.rows[0].c, 10);
    const pCount = parseInt(realPay.rows[0].c, 10);
    const pSum = parseFloat(realPay.rows[0].s);
    const expCount = parseInt(realExp.rows[0].c, 10);

    assert(cCount === 6, `Exactement 6 clients réels (${cCount})`);
    assert(iCount === 6, `Exactement 6 inscriptions réelles (${iCount})`);
    assert(pCount === 3, `Exactement 3 paiements réels (${pCount})`);
    assert(pSum === 4500000, `Exactement 4 500 000 FCFA encaissés (${pSum})`);
    assert(expCount === 0, `Exactement 0 FCFA de dépenses (${expCount})`);

    console.log('\n=====================================================================');
    console.log(`RÉSULTATS DE LA SUITE : ${passed} PASS, ${failed} FAIL`);
    console.log('=====================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

runTests().catch((err) => {
  console.error('Erreur inattendue dans la suite de tests :', err);
  pool.end();
  process.exit(1);
});
