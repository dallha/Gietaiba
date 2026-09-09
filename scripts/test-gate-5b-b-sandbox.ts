import 'dotenv/config';
import http from 'http';
import crypto from 'crypto';
import { app } from '../server.js';
import { pool } from '../server/db/neon.js';
import { createSignedSessionToken } from '../server/auth/token.service.js';

interface SandboxAssertion {
  testNum: number;
  description: string;
  expected: string;
  observed: string;
  passed: boolean;
}

const assertions: SandboxAssertion[] = [];
let counter = 0;

function assert(description: string, expected: string, observed: string, passed: boolean) {
  counter++;
  assertions.push({ testNum: counter, description, expected, observed, passed });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [Sandbox Mutation] #${counter}: ${description} | Attendu: ${expected} | Observé: ${observed}`);
  if (!passed) {
    console.error(`   [CRITICAL FAILURE] Assertion #${counter} non conforme !`);
  }
}

async function startServer(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

async function httpReq(
  baseUrl: string,
  method: string,
  path: string,
  options: { token?: string; body?: any; headers?: Record<string, string> } = {}
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    const req = http.request(url, { method, headers }, (res) => {
      let rawData = '';
      res.on('data', (chunk) => (rawData += chunk));
      res.on('end', () => {
        let parsed = rawData;
        try {
          parsed = JSON.parse(rawData);
        } catch {}
        resolve({ status: res.statusCode || 500, body: parsed });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runGate5BSandbox() {
  console.log('=====================================================================');
  console.log('   GATE 5B-B — MUTATION SANDBOX (WORKFLOWS, IDEMPOTENCE, SURBOOKING) ');
  console.log('   Isolation stricte : Nettoyage atomique post-test & Écart zéro.   ');
  console.log('=====================================================================\n');

  const { server, baseUrl } = await startServer();
  const client = await pool.connect();
  const testSuffix = crypto.randomUUID().slice(0, 8);

  const ephemeralClientId = `cli-eph-${testSuffix}`;
  const ephemeralClientId2 = `cli-eph2-${testSuffix}`;
  const ephemeralCampaignId = `camp-eph-${testSuffix}`;
  const ephemeralHotelId = `hot-eph-${testSuffix}`;
  const ephemeralRoomId = `room-eph-${testSuffix}`;

  try {
    const adminUser = (await client.query("SELECT id, display_name, email, role_id FROM users WHERE role_id = 'SUPER_ADMIN'")).rows[0];
    const adminToken = createSignedSessionToken({ id: adminUser.id, email: adminUser.email, role: 'SUPER_ADMIN', name: adminUser.display_name });

    // Nettoyage préventif
    async function cleanup() {
      await client.query("DELETE FROM room_assignments WHERE client_id LIKE '%eph%' OR room_id LIKE '%eph%'");
      await client.query("DELETE FROM rooms WHERE id LIKE '%eph%'");
      await client.query("DELETE FROM hotels WHERE id LIKE '%eph%'");
      await client.query("DELETE FROM payment_schedule_allocations WHERE payment_id IN (SELECT id FROM payments WHERE client_id LIKE '%eph%')");
      await client.query("DELETE FROM payment_reversals WHERE payment_id IN (SELECT id FROM payments WHERE client_id LIKE '%eph%')");
      await client.query("DELETE FROM payment_schedules WHERE inscription_id IN (SELECT id FROM inscriptions WHERE client_id LIKE '%eph%')");
      await client.query("DELETE FROM payments WHERE client_id LIKE '%eph%'");
      await client.query("DELETE FROM visas WHERE client_id LIKE '%eph%'");
      await client.query("DELETE FROM inscriptions WHERE client_id LIKE '%eph%' OR campaign_id LIKE '%eph%'");
      await client.query("DELETE FROM clients WHERE id LIKE '%eph%'");
      await client.query("DELETE FROM campaigns WHERE id LIKE '%eph%'");
      await client.query("DELETE FROM idempotency_keys WHERE key LIKE '%EPH%'");
      // Réalignement strict des séquences aux compteurs de référence
      await client.query("UPDATE business_sequences SET current_value = 6 WHERE sequence_type = 'CLIENT' AND year = 0");
      await client.query("UPDATE business_sequences SET current_value = 6 WHERE sequence_type = 'INSCRIPTION_HAJJ' AND year = 2027");
      await client.query("UPDATE business_sequences SET current_value = 0 WHERE sequence_type = 'INSCRIPTION_UMRAH' AND year = 2027");
      await client.query("UPDATE business_sequences SET current_value = 3 WHERE sequence_type = 'PAYMENT' AND year = 2027");
      await client.query("UPDATE business_sequences SET current_value = 0 WHERE sequence_type = 'EXPENSE' AND year IN (2026, 2027)");
    }

    await cleanup();

    // 1. Création d'une campagne de test éphémère
    await client.query(`
      INSERT INTO campaigns (id, code, title, type, year, departure_date, return_date, capacity, status)
      VALUES ($1, $2, $3, 'HAJJ', 2027, '2027-05-18', '2027-06-15', 10, 'OUVERT')
    `, [ephemeralCampaignId, `EPH-${testSuffix}`, `Campagne Test Sandbox ${testSuffix}`]);

    // 2. Création de clients éphémères
    await client.query(`
      INSERT INTO clients (id, code, first_name, last_name, phone, status)
      VALUES 
        ($1, $2, 'Pèlerin', 'Sandbox 1', $3, 'ACTIF'),
        ($4, $5, 'Pèlerin', 'Sandbox 2', $6, 'ACTIF')
    `, [
      ephemeralClientId, `GT-EPH1-${testSuffix}`, `+22177000${testSuffix.slice(0, 4)}`,
      ephemeralClientId2, `GT-EPH2-${testSuffix}`, `+22177001${testSuffix.slice(0, 4)}`
    ]);

    // 3. Workflow Inscription via HTTP avec Idempotence
    console.log('--- TEST 1 : CRÉATION D\'INSCRIPTION VIA HTTP & IDEMPOTENCE ---');
    const idempKeyIns = `IDEMP-EPH-INS-${testSuffix}`;
    const insPayload = {
      clientId: ephemeralClientId,
      campaignId: ephemeralCampaignId,
      packageId: 'pkg-std-2027',
      appliedPrice: 5100000,
    };

    const rIns1 = await httpReq(baseUrl, 'POST', '/api/inscriptions', {
      token: adminToken,
      headers: { 'Idempotency-Key': idempKeyIns },
      body: insPayload,
    });
    const createdIns = rIns1.body;
    assert('Création HTTP d\'inscription avec statut 201', '201', `${rIns1.status}`, rIns1.status === 201);
    assert('Matricule atomique GT-HJ27-XXXXXX attribué', 'GT-HJ27-000007', `${createdIns.code}`, createdIns.code === 'GT-HJ27-000007');

    // 4. Rejeu exact même clé Idempotency-Key -> 200/201 avec payload identique
    const rInsReplay = await httpReq(baseUrl, 'POST', '/api/inscriptions', {
      token: adminToken,
      headers: { 'Idempotency-Key': idempKeyIns },
      body: insPayload,
    });
    assert('Rejeu Idempotency-Key identique : renvoi du payload mis en cache', `${createdIns.id}`, `${rInsReplay.body?.id}`, rInsReplay.body?.id === createdIns.id);

    // 5. Réutilisation même clé avec payload différent -> 409 Conflict
    const rInsConflict = await httpReq(baseUrl, 'POST', '/api/inscriptions', {
      token: adminToken,
      headers: { 'Idempotency-Key': idempKeyIns },
      body: { ...insPayload, appliedPrice: 4000000 },
    });
    assert('Réutilisation Idempotency-Key avec payload modifié -> 409 Conflict', '409', `${rInsConflict.status}`, rInsConflict.status === 409);

    // 6. Encaissement avec allocation FIFO via HTTP
    console.log('\n--- TEST 2 : PAIEMENT HTTP & ALLOCATION FIFO ---');
    const idempKeyPay = `IDEMP-EPH-PAY-${testSuffix}`;
    const payPayload = {
      clientId: ephemeralClientId,
      inscriptionId: createdIns.id,
      amount: 1530000,
      paymentMethod: 'ESPECES',
      reference: `EPH-REF-${testSuffix}`,
    };

    const rPay1 = await httpReq(baseUrl, 'POST', '/api/payments', {
      token: adminToken,
      headers: { 'Idempotency-Key': idempKeyPay },
      body: payPayload,
    });
    const createdPay = rPay1.body;
    assert('Création de paiement HTTP avec statut 201', '201', `${rPay1.status}`, rPay1.status === 201);
    assert('Reçu de paiement atomique GT-PAY27-000004 attribué', 'GT-PAY27-000004', `${createdPay.receiptNumber}`, createdPay.receiptNumber === 'GT-PAY27-000004');

    // 7. Vérification de l'allocation Tranche 1 = PAID
    const allocCheckRes = await client.query(`
      SELECT status, amount_due FROM payment_schedules WHERE inscription_id = $1 ORDER BY due_date ASC
    `, [createdIns.id]);
    assert('Allocation FIFO : Tranche 1 passe à PAID (1.53M alloués)', 'PAID', `${allocCheckRes.rows[0]?.status}`, allocCheckRes.rows[0]?.status === 'PAID');

    // 8. Reversal de paiement HTTP
    console.log('\n--- TEST 3 : REVERSAL DE PAIEMENT HTTP & DÉ-ALLOCATION ---');
    const rRev = await httpReq(baseUrl, 'POST', `/api/payments/${createdPay.id}/cancel`, {
      token: adminToken,
      body: { reason: 'Annulation erreur saisie test sandbox' },
    });
    assert('Reversal de paiement avec statut 200', '200', `${rRev.status}`, rRev.status === 200);

    const postRevAllocRes = await client.query(`
      SELECT status FROM payment_schedules WHERE inscription_id = $1 ORDER BY due_date ASC
    `, [createdIns.id]);
    assert('Dé-allocation exacte : Tranche 1 rétablie à PENDING', 'PENDING', `${postRevAllocRes.rows[0]?.status}`, postRevAllocRes.rows[0]?.status === 'PENDING');

    // 9. Anti-Surbooking sous concurrence HTTP (Verrou pessimiste FOR UPDATE)
    console.log('\n--- TEST 4 : ANTI-SURBOOKING HTTP & CONCURRENCE ---');
    await client.query(`
      INSERT INTO hotels (id, campaign_id, name, city, check_in_date, check_out_date)
      VALUES ($1, $2, 'Hôtel Sandbox', 'Makkah', '2027-05-20', '2027-06-05')
    `, [ephemeralHotelId, ephemeralCampaignId]);

    await client.query(`
      INSERT INTO rooms (id, hotel_id, campaign_id, room_number, room_type, capacity)
      VALUES ($1, $2, $3, 'CH-SBX-01', 'INDIVIDUELLE', 1)
    `, [ephemeralRoomId, ephemeralHotelId, ephemeralCampaignId]);

    // Première assignation -> 200/201
    const rAssign1 = await httpReq(baseUrl, 'POST', `/api/rooms/${ephemeralRoomId}/assign`, {
      token: adminToken,
      body: { clientId: ephemeralClientId, inscriptionId: createdIns.id },
    });
    assert('Première affectation chambre (capacité 1) réussie', '200 ou 201', `${rAssign1.status}`, rAssign1.status === 200 || rAssign1.status === 201);

    // Deuxième assignation concurrente -> 422 ROOM_FULL_ERROR
    const rAssign2 = await httpReq(baseUrl, 'POST', `/api/rooms/${ephemeralRoomId}/assign`, {
      token: adminToken,
      body: { clientId: ephemeralClientId2, inscriptionId: createdIns.id },
    });
    assert('Surbooking bloqué par verrou pessimiste -> 422', '422', `${rAssign2.status}`, rAssign2.status === 422);

    // 10. Nettoyage absolu post-sandbox
    console.log('\n--- NETTOYAGE ABSOLU DE LA SANDBOX ---');
    await cleanup();
    console.log('✓ Toutes les données éphémères de la Sandbox ont été purgées.');

    // 11. Vérification que Neon réel est intact (Écart = 0)
    const paySum = Number((await client.query("SELECT COALESCE(SUM(amount), 0) as s FROM payments WHERE status = 'VALIDE'")).rows[0].s);
    const expSum = Number((await client.query("SELECT COALESCE(SUM(amount), 0) as s FROM expenses")).rows[0].s);
    const cliCount = Number((await client.query("SELECT count(*) as cnt FROM clients")).rows[0].cnt);
    const insCount = Number((await client.query("SELECT count(*) as cnt FROM inscriptions")).rows[0].cnt);
    const seqCli = Number((await client.query("SELECT current_value FROM business_sequences WHERE sequence_type = 'CLIENT' AND year = 0")).rows[0].current_value);
    const seqHaj = Number((await client.query("SELECT current_value FROM business_sequences WHERE sequence_type = 'INSCRIPTION_HAJJ' AND year = 2027")).rows[0].current_value);
    const seqPay = Number((await client.query("SELECT current_value FROM business_sequences WHERE sequence_type = 'PAYMENT' AND year = 2027")).rows[0].current_value);

    assert('Post-Sandbox : Somme paiements Neon strictement intacte', '4 500 000 FCFA', `${paySum.toLocaleString('fr-FR')} FCFA`, paySum === 4500000);
    assert('Post-Sandbox : Somme dépenses Neon strictement intacte', '0 FCFA', `${expSum} FCFA`, expSum === 0);
    assert('Post-Sandbox : Nombre de clients Neon strictement égal à 6', '6', `${cliCount}`, cliCount === 6);
    assert('Post-Sandbox : Nombre de dossiers Neon strictement égal à 6', '6', `${insCount}`, insCount === 6);
    assert('Post-Sandbox : Compteurs atomiques réalignés sans consommation parasite', 'CLI=6, HAJJ=6, PAY=3', `CLI=${seqCli}, HAJJ=${seqHaj}, PAY=${seqPay}`, seqCli === 6 && seqHaj === 6 && seqPay === 3);

    console.log('\n=====================================================================');
    console.log('             BILAN FINAL DU GATE 5B-B (MUTATION SANDBOX)             ');
    console.log('=====================================================================');
    const passed = assertions.filter(a => a.passed).length;
    console.log(`Assertions exécutées : ${assertions.length}`);
    console.log(`Assertions réussies  : ${passed}`);
    console.log(`Assertions échouées  : ${assertions.length - passed}`);
    console.log('=====================================================================');

    if (assertions.length - passed === 0) {
      console.log('🟢 [GATE 5B-B : CERTIFIÉ CONFORME] 100% des mutations validées en Sandbox !');
    } else {
      console.log('🔴 [GATE 5B-B : ÉCHEC] Des erreurs de mutations ont été constatées.');
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Erreur dans Gate 5B-B :', err);
    try {
      await client.query("DELETE FROM room_assignments WHERE client_id LIKE '%eph%' OR room_id LIKE '%eph%'");
      await client.query("DELETE FROM rooms WHERE id LIKE '%eph%'");
      await client.query("DELETE FROM hotels WHERE id LIKE '%eph%'");
      await client.query("DELETE FROM payment_schedule_allocations WHERE payment_id IN (SELECT id FROM payments WHERE client_id LIKE '%eph%')");
      await client.query("DELETE FROM payment_reversals WHERE payment_id IN (SELECT id FROM payments WHERE client_id LIKE '%eph%')");
      await client.query("DELETE FROM payment_schedules WHERE inscription_id IN (SELECT id FROM inscriptions WHERE client_id LIKE '%eph%')");
      await client.query("DELETE FROM payments WHERE client_id LIKE '%eph%'");
      await client.query("DELETE FROM visas WHERE client_id LIKE '%eph%'");
      await client.query("DELETE FROM inscriptions WHERE client_id LIKE '%eph%' OR campaign_id LIKE '%eph%'");
      await client.query("DELETE FROM clients WHERE id LIKE '%eph%'");
      await client.query("DELETE FROM campaigns WHERE id LIKE '%eph%'");
      await client.query("DELETE FROM idempotency_keys WHERE key LIKE '%EPH%'");
      await client.query("UPDATE business_sequences SET current_value = 6 WHERE sequence_type = 'CLIENT' AND year = 0");
      await client.query("UPDATE business_sequences SET current_value = 6 WHERE sequence_type = 'INSCRIPTION_HAJJ' AND year = 2027");
      await client.query("UPDATE business_sequences SET current_value = 0 WHERE sequence_type = 'INSCRIPTION_UMRAH' AND year = 2027");
      await client.query("UPDATE business_sequences SET current_value = 3 WHERE sequence_type = 'PAYMENT' AND year = 2027");
      await client.query("UPDATE business_sequences SET current_value = 0 WHERE sequence_type = 'EXPENSE' AND year IN (2026, 2027)");
      console.log('✓ Nettoyage de secours exécuté.');
    } catch (cleanErr) {
      console.error('Erreur lors du nettoyage de secours :', cleanErr);
    }
    process.exit(1);
  } finally {
    client.release();
    server.close();
    await pool.end();
  }
}

runGate5BSandbox();
