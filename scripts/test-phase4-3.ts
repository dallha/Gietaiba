import 'dotenv/config';
import http from 'http';
import crypto from 'crypto';
import pg from 'pg';
import { app } from '../server.js';
import { pool } from '../server/db/neon.js';
import { createSignedSessionToken } from '../server/auth/token.service.js';
import { UserSession } from '../src/types.js';

interface TestResult {
  category: string;
  testNum: number;
  description: string;
  passed: boolean;
  detail: string;
}

const results: TestResult[] = [];

function record(category: string, testNum: number, description: string, passed: boolean, detail: string) {
  results.push({ category, testNum, description, passed, detail });
  const mark = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${mark} [${category}] #${testNum}: ${description} -> ${detail}`);
  if (!passed) {
    console.error(`   [CRITICAL FAILURE] Test #${testNum} failed: ${detail}`);
  }
}

async function startTestServer(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

async function runPhase43Tests() {
  console.log('=====================================================================');
  console.log('  SUITE DE TESTS PHASE 4.3 — INTÉGRATION & SÉCURITÉ HTTP RÉELLE       ');
  console.log('  Devise : Nettoyer le faux. Préserver le vrai. Bloquer l\'inconnu.   ');
  console.log('=====================================================================\n');

  const { server, baseUrl } = await startTestServer();
  console.log(`[Test Server] Express running on ${baseUrl}`);

  const testSuffix = crypto.randomUUID().slice(0, 8);

  async function cleanupEphemeral() {
    await pool.query(`
      DELETE FROM room_assignments WHERE room_id LIKE '%eph%' OR client_id LIKE '%eph%' OR inscription_id IN (SELECT id FROM inscriptions WHERE client_id LIKE '%eph%' OR campaign_id LIKE '%eph%');
      DELETE FROM rooms WHERE id LIKE '%eph%' OR hotel_id LIKE '%eph%';
      DELETE FROM hotels WHERE id LIKE '%eph%' OR campaign_id LIKE '%eph%';
      DELETE FROM payment_schedule_allocations WHERE payment_id IN (SELECT id FROM payments WHERE client_id LIKE '%eph%' OR campaign_id LIKE '%eph%' OR id LIKE '%eph%');
      DELETE FROM payment_schedules WHERE inscription_id IN (SELECT id FROM inscriptions WHERE client_id LIKE '%eph%' OR campaign_id LIKE '%eph%') OR inscription_id LIKE '%eph%';
      DELETE FROM payments WHERE client_id LIKE '%eph%' OR campaign_id LIKE '%eph%' OR id LIKE '%eph%';
      DELETE FROM idempotency_keys WHERE key LIKE '%IDEMP%';
      DELETE FROM visas WHERE inscription_id IN (SELECT id FROM inscriptions WHERE client_id LIKE '%eph%' OR campaign_id LIKE '%eph%') OR client_id LIKE '%eph%';
      DELETE FROM tickets WHERE inscription_id IN (SELECT id FROM inscriptions WHERE client_id LIKE '%eph%' OR campaign_id LIKE '%eph%') OR client_id LIKE '%eph%';
      DELETE FROM documents WHERE inscription_id IN (SELECT id FROM inscriptions WHERE client_id LIKE '%eph%' OR campaign_id LIKE '%eph%') OR client_id LIKE '%eph%';
      DELETE FROM inscriptions WHERE client_id LIKE '%eph%' OR campaign_id LIKE '%eph%';
      DELETE FROM clients WHERE id LIKE '%eph%';
      DELETE FROM campaigns WHERE id LIKE '%eph%' OR id LIKE '%closed%';
      UPDATE business_sequences SET current_value = 6 WHERE sequence_type = 'CLIENT' AND year = 0;
      UPDATE business_sequences SET current_value = 6 WHERE sequence_type = 'INSCRIPTION_HAJJ' AND year = 2027;
      UPDATE business_sequences SET current_value = 0 WHERE sequence_type = 'INSCRIPTION_UMRAH' AND year = 2027;
      UPDATE business_sequences SET current_value = 3 WHERE sequence_type = 'PAYMENT' AND year = 2027;
      UPDATE business_sequences SET current_value = 0 WHERE sequence_type = 'EXPENSE';
    `);
  }

  try {
    // Nettoyage préventif
    await cleanupEphemeral();

    // -----------------------------------------------------------------
    // BASELINE INITIALE OBSERVÉE
    // -----------------------------------------------------------------
    const initPay = await pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'VALIDE'");
    const initExp = await pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM expenses");
    const initIns = await pool.query("SELECT COALESCE(SUM(agreed_price), 0) as total FROM inscriptions WHERE status != 'ANNULEE'");

    const basePay = Number(initPay.rows[0].total);
    const baseExp = Number(initExp.rows[0].total);
    const baseCA = Number(initIns.rows[0].total);
    const baseDue = baseCA - basePay;

    console.log('[BASELINE INITIALE OBSERVÉE] :', { baseCA, basePay, baseExp, baseDue });

    record(
      'BASELINE_CHECK',
      1,
      'Vérification de la baseline officielle avant les tests HTTP (4.5M encaissés, 0 dépense)',
      basePay === 4500000 && baseExp === 0 && baseCA === 30600000 && baseDue === 26100000,
      `CA: ${baseCA}, Encaissé: ${basePay}, Dépenses: ${baseExp}, Solde: ${baseDue}`
    );

    // -----------------------------------------------------------------
    // 1. AUDIT AUTHENTIFICATION HTTP RÉELLE
    // -----------------------------------------------------------------
    console.log('\n--- 1. AUDIT AUTHENTIFICATION HTTP ---');

    // Test 2: Requête sans jeton
    const resNoToken = await fetch(`${baseUrl}/api/clients`);
    const bodyNoToken = await resNoToken.json() as any;
    record(
      'AUTH',
      2,
      'Rejet HTTP 401 strict en l\'absence de jeton Authorization',
      resNoToken.status === 401 && (bodyNoToken.error?.includes('invalide') || bodyNoToken.error?.includes('requis') || resNoToken.status === 401),
      `Status: ${resNoToken.status}`
    );

    // Test 3: Requête avec jeton falsifié (signature altérée)
    const validSuperAdminSession: UserSession = {
      id: 'usr-admin',
      email: 'admin@taiba-voyages.sn',
      role: 'SUPER_ADMIN',
      permissions: ['*'],
      displayName: 'Super Admin Test',
    };
    const validToken = createSignedSessionToken(validSuperAdminSession);
    const forgedToken = validToken.slice(0, -5) + 'XXXXX'; // Altération cryptographique

    const resForged = await fetch(`${baseUrl}/api/clients`, {
      headers: { Authorization: `Bearer ${forgedToken}` },
    });
    record(
      'AUTH',
      3,
      'Rejet HTTP 401 cryptographique sur jeton falsifié (tampered HMAC signature)',
      resForged.status === 401,
      `Status: ${resForged.status}`
    );

    // Test 4: Rejet strict sur jeton expiré
    const expiredToken = createSignedSessionToken({ id: 'usr-admin', email: 'admin@taiba-voyages.sn', role: 'SUPER_ADMIN' }, -3600);
    const resExpired = await fetch(`${baseUrl}/api/clients`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    record(
      'AUTH',
      4,
      'Rejet HTTP 401 strict sur jeton de session expiré',
      resExpired.status === 401,
      `Status: ${resExpired.status}`
    );

    // -----------------------------------------------------------------
    // 2. AUDIT RBAC HTTP RÉEL (MATRICE DES 6 RÔLES)
    // -----------------------------------------------------------------
    console.log('\n--- 2. AUDIT RBAC HTTP (6 RÔLES) ---');

    const adminToken = createSignedSessionToken({
      id: 'usr-admin',
      email: 'admin@taiba-voyages.sn',
      role: 'SUPER_ADMIN',
      permissions: ['*'],
      displayName: 'El Hadj Amadou Niang',
    });

    const agentCommercialToken = createSignedSessionToken({
      id: 'usr-agent',
      email: 'agent@taiba-voyages.sn',
      role: 'AGENT_COMMERCIAL',
      displayName: 'Ibrahima Ndiaye',
    });

    const comptableToken = createSignedSessionToken({
      id: 'usr-caisse',
      email: 'caisse@taiba-voyages.sn',
      role: 'COMPTABLE',
      displayName: 'Cheikh Tidiane Wade',
    });

    const pelerinToken = createSignedSessionToken({
      id: 'usr-pelerin-saidou',
      email: 'saidou.sow@email.sn',
      role: 'PELERIN',
      clientId: 'cli-001',
      displayName: 'Saidou Sow',
    });

    // Test 5: SUPER_ADMIN a accès aux paramètres et logs d'audit
    const resAdminAudit = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    record(
      'RBAC',
      5,
      'SUPER_ADMIN autorisé sur les routes sensibles d\'audit (/api/audit-logs)',
      resAdminAudit.status === 200,
      `Status: ${resAdminAudit.status}`
    );

    // Test 6: AGENT_COMMERCIAL interdit d'annuler une inscription (inscriptions.cancel absent)
    const resAgentCancel = await fetch(`${baseUrl}/api/inscriptions/ins-001`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${agentCommercialToken}` },
    });
    record(
      'RBAC',
      6,
      'AGENT_COMMERCIAL bloqué en HTTP 403 sur l\'annulation d\'inscription',
      resAgentCancel.status === 403,
      `Status: ${resAgentCancel.status}`
    );

    // Test 7: COMPTABLE interdit de créer une campagne de voyage
    const resComptableCamp = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${comptableToken}`,
      },
      body: JSON.stringify({ title: 'Hajj Illégal', year: 2028 }),
    });
    record(
      'RBAC',
      7,
      'COMPTABLE bloqué en HTTP 403 sur la création de campagne (/api/campaigns)',
      resComptableCamp.status === 403,
      `Status: ${resComptableCamp.status}`
    );

    // Test 8: PELERIN strictement interdit sur les routes internes de gestion (users, audit)
    const resPelerinUsers = await fetch(`${baseUrl}/api/users`, {
      headers: { Authorization: `Bearer ${pelerinToken}` },
    });
    record(
      'RBAC',
      8,
      'PELERIN strictement bloqué en HTTP 403 sur l\'annuaire utilisateurs (/api/users)',
      resPelerinUsers.status === 403,
      `Status: ${resPelerinUsers.status}`
    );

    // -----------------------------------------------------------------
    // 3. AUDIT IDOR STRICT (ISOLATION PÈLERIN)
    // -----------------------------------------------------------------
    console.log('\n--- 3. AUDIT IDOR STRICT (ISOLATION PÈLERIN) ---');

    // Test 9: Pèlerin Saidou Sow (cli-001) tente d'accéder au client Aissatou Fall (cli-002)
    const resIdorClient = await fetch(`${baseUrl}/api/clients/cli-002`, {
      headers: { Authorization: `Bearer ${pelerinToken}` },
    });
    record(
      'IDOR',
      9,
      'Tentative IDOR pèlerin sur fiche client tierce (/api/clients/cli-002) -> 403 Forbidden',
      resIdorClient.status === 403,
      `Status: ${resIdorClient.status}`
    );

    // Test 10: Pèlerin tente d'usurper le dossier pèlerin d'un autre via paramètre query
    const resIdorDossier = await fetch(`${baseUrl}/api/pilgrim/dossier?clientId=cli-003`, {
      headers: { Authorization: `Bearer ${pelerinToken}` },
    });
    record(
      'IDOR',
      10,
      'Tentative IDOR pèlerin sur dossier d\'un tiers (/api/pilgrim/dossier?clientId=cli-003) -> 403 Forbidden',
      resIdorDossier.status === 403,
      `Status: ${resIdorDossier.status}`
    );

    // Test 11: Pèlerin accède légitimement à son propre dossier (cli-001)
    const resSelfDossier = await fetch(`${baseUrl}/api/pilgrim/dossier`, {
      headers: { Authorization: `Bearer ${pelerinToken}` },
    });
    const selfDossier = await resSelfDossier.json() as any;
    record(
      'IDOR',
      11,
      'Accès légitime du pèlerin à son propre dossier reconstruit côté serveur -> 200 OK',
      resSelfDossier.status === 200 && selfDossier.client?.id === 'cli-001',
      `Client: ${selfDossier.client?.firstName} ${selfDossier.client?.lastName}`
    );

    // -----------------------------------------------------------------
    // 4. ENVIRONNEMENT ÉPHÉMÈRE DE TEST POUR IDEMPOTENCE, CONCURRENCE ET CLÔTURE
    // -----------------------------------------------------------------
    console.log('\n--- 4. AUDIT IDEMPOTENCE HTTP & CONCURRENCE SUR DONNÉES ÉPHÉMÈRES ---');

    const ephCampId = `camp-eph-${testSuffix}`;
    const ephClientId = `cli-eph-${testSuffix}`;
    const ephHotelId = `hot-eph-${testSuffix}`;
    const ephRoomId = `room-eph-${testSuffix}`;

    // Insertion des données éphémères de test
    await pool.query(`
      INSERT INTO campaigns (id, code, title, type, year, departure_date, return_date, capacity, status)
      VALUES ($1, $2, 'Campagne Éphémère Test', 'HAJJ', 2027, '2027-06-01', '2027-06-25', 100, 'OUVERTE')
    `, [ephCampId, `EPH-${testSuffix}`]);

    await pool.query(`
      INSERT INTO clients (id, code, first_name, last_name, gender, phone, status)
      VALUES ($1, $2, 'TestClient', 'Ephemeral', 'M', '+221 77 000 00 00', 'ACTIF')
    `, [ephClientId, `CLI-${testSuffix}`]);

    // Test 12: Inscription via HTTP avec Idempotency-Key
    const idempKeyIns = `IDEMP-INS-${testSuffix}`;
    const resIns1 = await fetch(`${baseUrl}/api/inscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'Idempotency-Key': idempKeyIns,
      },
      body: JSON.stringify({
        clientId: ephClientId,
        campaignId: ephCampId,
        packageId: 'pkg-std-2027',
      }),
    });
    const ins1Body = await resIns1.json() as any;
    const ephInsId = ins1Body.id;

    record(
      'IDEMPOTENCY_HTTP',
      12,
      'Création d\'inscription HTTP via inscriptionWorkflowService avec code atomique',
      resIns1.status === 201 && !!ephInsId,
      `Code: ${ins1Body.code}, Id: ${ephInsId}`
    );

    // Test 13: Rejeu transparent HTTP avec la même Idempotency-Key
    const resInsReplay = await fetch(`${baseUrl}/api/inscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'Idempotency-Key': idempKeyIns,
      },
      body: JSON.stringify({
        clientId: ephClientId,
        campaignId: ephCampId,
        packageId: 'pkg-std-2027',
      }),
    });
    const insReplayBody = await resInsReplay.json() as any;
    record(
      'IDEMPOTENCY_HTTP',
      13,
      'Rejeu HTTP même clé + même payload : renvoi transparent du résultat mis en cache',
      (resInsReplay.status === 200 || resInsReplay.status === 201) && insReplayBody.id === ephInsId,
      `ID identique: ${insReplayBody.id}`
    );

    // Test 14: Paiement HTTP avec Idempotency-Key et conflit 409 en cas de payload altéré
    const idempKeyPay = `IDEMP-PAY-${testSuffix}`;
    const resPay1 = await fetch(`${baseUrl}/api/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${comptableToken}`,
        'Idempotency-Key': idempKeyPay,
      },
      body: JSON.stringify({
        clientId: ephClientId,
        inscriptionId: ephInsId,
        amount: 500000,
        paymentMethod: 'Espèces',
        reference: 'TEST-REF-1',
      }),
    });
    const pay1Body = await resPay1.json() as any;
    record(
      'IDEMPOTENCY_HTTP',
      14,
      'Enregistrement de paiement HTTP avec ventilation atomique et reçu GT-PAY27-XXXXXX',
      resPay1.status === 201 && !!pay1Body.receiptNumber,
      `Reçu: ${pay1Body.receiptNumber}, Montant: ${pay1Body.amount}`
    );

    // Rejeu avec payload modifié sur la même clé -> 409 Conflit
    const resPayConflict = await fetch(`${baseUrl}/api/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${comptableToken}`,
        'Idempotency-Key': idempKeyPay,
      },
      body: JSON.stringify({
        clientId: ephClientId,
        inscriptionId: ephInsId,
        amount: 999999, // Montant altéré !
        paymentMethod: 'Wave',
      }),
    });
    record(
      'IDEMPOTENCY_HTTP',
      15,
      'Rejet HTTP 409 Conflict sur Idempotency-Key réutilisée avec un payload différent',
      resPayConflict.status === 409,
      `Status: ${resPayConflict.status}`
    );

    // Test 16: Concurrence anti-surbooking de chambre (SELECT FOR UPDATE)
    await pool.query(`
      INSERT INTO hotels (id, campaign_id, name, city)
      VALUES ($1, $2, 'Hôtel Test Éphémère', 'Makkah')
    `, [ephHotelId, ephCampId]);

    await pool.query(`
      INSERT INTO rooms (id, hotel_id, campaign_id, room_number, room_type, capacity, current_occupancy)
      VALUES ($1, $2, $3, 'CH-TEST-1', 'INDIVIDUELLE', 1, 0)
    `, [ephRoomId, ephHotelId, ephCampId]);

    // 2 affectations concurrentes sur 1 place
    const reqAssign1 = fetch(`${baseUrl}/api/rooms/${ephRoomId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ clientId: ephClientId, inscriptionId: ephInsId }),
    });

    const ephClient2Id = `cli-eph2-${testSuffix}`;
    await pool.query(`
      INSERT INTO clients (id, code, first_name, last_name, gender, phone, status)
      VALUES ($1, $2, 'Client2', 'Ephemeral', 'M', '+221 77 999 99 99', 'ACTIF')
    `, [ephClient2Id, `CLI2-${testSuffix}`]);

    const reqAssign2 = fetch(`${baseUrl}/api/rooms/${ephRoomId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ clientId: ephClient2Id, inscriptionId: ephInsId }),
    });

    const [resAssign1, resAssign2] = await Promise.all([reqAssign1, reqAssign2]);
    const statuses = [resAssign1.status, resAssign2.status].sort();

    record(
      'CONCURRENCY_HTTP',
      16,
      'Prévention stricte du surbooking sous concurrence HTTP : exactement 1 succès (201) et 1 rejet (422)',
      statuses[0] === 201 && statuses[1] === 422,
      `Statuts observés: [${statuses.join(', ')}]`
    );

    // -----------------------------------------------------------------
    // 5. AUDIT CAMPAGNE CLÔTURÉE
    // -----------------------------------------------------------------
    console.log('\n--- 5. AUDIT CAMPAGNE CLÔTURÉE ---');

    const closedCampId = `camp-closed-${testSuffix}`;
    await pool.query(`
      INSERT INTO campaigns (id, code, title, type, year, departure_date, return_date, capacity, status)
      VALUES ($1, $2, 'Campagne Clôturée Test', 'HAJJ', 2027, '2027-01-01', '2027-01-20', 100, 'CLOTUREE')
    `, [closedCampId, `CLOSED-${testSuffix}`]);

    // Tentative d'inscription sur campagne clôturée
    const resClosedIns = await fetch(`${baseUrl}/api/inscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        clientId: ephClientId,
        campaignId: closedCampId,
        packageId: 'pkg-std-2027',
      }),
    });
    record(
      'CAMPAIGN_LOCK',
      17,
      'Rejet HTTP 422 de toute mutation standard sur campagne CLOTUREE',
      resClosedIns.status === 422,
      `Status: ${resClosedIns.status}`
    );

    // -----------------------------------------------------------------
    // 6. NETTOYAGE INTÉGRAL DE L'ENVIRONNEMENT DE TEST ÉPHÉMÈRE
    // -----------------------------------------------------------------
    console.log('\n--- 6. NETTOYAGE DES DONNÉES ÉPHÉMÈRES DU TEST ---');
    await cleanupEphemeral();
    console.log('  ✓ Toutes les données éphémères créées pendant le test ont été supprimées.');

    // -----------------------------------------------------------------
    // 7. VÉRIFICATION FINALE DES INVARIANTS OFFICIELS POST-TEST
    // -----------------------------------------------------------------
    console.log('\n--- 7. CONTRÔLE FINAL D\'INTÉGRITÉ POST-TEST ---');
    const finalPay = await pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'VALIDE'");
    const finalExp = await pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM expenses");
    const finalIns = await pool.query("SELECT COALESCE(SUM(agreed_price), 0) as total FROM inscriptions WHERE status != 'ANNULEE'");
    const finalVisas = await pool.query("SELECT count(*) as cnt FROM visas");

    const endPay = Number(finalPay.rows[0].total);
    const endExp = Number(finalExp.rows[0].total);
    const endCA = Number(finalIns.rows[0].total);
    const endDue = endCA - endPay;
    const endVisas = Number(finalVisas.rows[0].cnt);

    record(
      'FINAL_BASELINE_INTEGRITY',
      18,
      'Préservation absolue de la baseline officielle après nettoyage (4.5M encaissés, 0 dépense, 0 visa)',
      endPay === 4500000 && endExp === 0 && endCA === 30600000 && endDue === 26100000 && endVisas === 0,
      `CA: ${endCA}, Encaissé: ${endPay}, Dépenses: ${endExp}, Solde: ${endDue}, Visas: ${endVisas}`
    );

    // Résumé
    console.log('\n=====================================================================');
    console.log('  RÉSUMÉ DU TEST SUITE PHASE 4.3');
    console.log('=====================================================================');
    const totalPassed = results.filter((r) => r.passed).length;
    const totalFailed = results.filter((r) => !r.passed).length;
    console.log(`Total tests : ${results.length}`);
    console.log(`Tests réussis : ${totalPassed}`);
    console.log(`Tests échoués : ${totalFailed}`);

    if (totalFailed > 0) {
      throw new Error(`[PHASE 4.3 FAILED] ${totalFailed} test(s) ont échoué.`);
    }

    console.log('\n🟢 [PHASE 4.3 VALIDÉE] 18/18 tests d\'intégration et de sécurité HTTP réels PASS !');
  } finally {
    try {
      await cleanupEphemeral();
    } catch (e) {
      // noop
    }
    server.close();
    await pool.end();
  }
}

runPhase43Tests().catch((err) => {
  console.error(err);
  process.exit(1);
});
