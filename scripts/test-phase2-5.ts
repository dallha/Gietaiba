import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { app } from '../server.js';
import { pool } from '../server/db/neon.js';
import { createSignedSessionToken } from '../server/auth/token.service.js';
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

async function runSecurityGateTests() {
  console.log('=====================================================================');
  console.log('  PHASE 2.5 — SECURITY & SOURCE-OF-TRUTH GATE TEST SUITE');
  console.log('=====================================================================');

  let server: Server;
  let baseUrl: string;

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      console.log(`Serveur de test de sécurité démarré sur ${baseUrl}\n`);
      resolve();
    });
  });

  try {
    // -----------------------------------------------------------------
    // 1. REJET STRICT DE x-user-id EN PRODUCTION
    // -----------------------------------------------------------------
    console.log('--- 1. Contrôle Strict de l\'En-tête x-user-id en Production ---');
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const resProdXUser = await fetch(`${baseUrl}/api/users`, {
      headers: { 'x-user-id': 'usr-admin' },
    });
    const prodXUserRejected = resProdXUser.status === 401;
    const bodyProdXUser = await resProdXUser.json();

    record(
      'SECURITY_PROD',
      'Rejet absolu de x-user-id en production (401)',
      prodXUserRejected && bodyProdXUser.code === 'DEV_HEADER_FORBIDDEN_IN_PROD',
      `Status HTTP: ${resProdXUser.status}, Code: ${bodyProdXUser.code}`
    );

    // Rétablir NODE_ENV
    if (originalEnv !== undefined) {
      process.env.NODE_ENV = originalEnv;
    } else {
      delete process.env.NODE_ENV;
    }

    // -----------------------------------------------------------------
    // 2. AUTHENTIFICATION CRYPTOGRAPHIQUE PAR JETON SIGNÉ (HMAC-SHA256)
    // -----------------------------------------------------------------
    console.log('\n--- 2. Authentification Cryptographique par Jeton Signé ---');

    // 2.1 Génération d'un jeton valide pour usr-admin
    const validToken = createSignedSessionToken({
      id: 'usr-admin',
      email: 'admin@taiba-voyages.sn',
      role: 'SUPER_ADMIN',
    });

    const resValidBearer = await fetch(`${baseUrl}/api/users`, {
      headers: { 'Authorization': `Bearer ${validToken}` },
    });
    record(
      'CRYPTO_AUTH',
      'Authentification réussie avec jeton cryptographique valide (200)',
      resValidBearer.status === 200,
      `Status HTTP: ${resValidBearer.status} (Production Mode)`
    );

    // 2.2 Rejet d'un jeton cryptographiquement falsifié / altéré
    const forgedToken = validToken.substring(0, validToken.length - 8) + 'FAKE1234';
    const resForgedBearer = await fetch(`${baseUrl}/api/users`, {
      headers: { 'Authorization': `Bearer ${forgedToken}` },
    });
    const bodyForged = await resForgedBearer.json();
    record(
      'CRYPTO_AUTH',
      'Rejet immédiat d\'un jeton altéré ou contrefait (401)',
      resForgedBearer.status === 401 && bodyForged.code === 'INVALID_TOKEN',
      `Status HTTP: ${resForgedBearer.status}, Code: ${bodyForged.code}`
    );

    // 2.3 Rejet d'un jeton expiré
    const expiredToken = createSignedSessionToken(
      { id: 'usr-admin', email: 'admin@taiba-voyages.sn', role: 'SUPER_ADMIN' },
      -3600 // Expiré il y a 1 heure
    );
    const resExpired = await fetch(`${baseUrl}/api/users`, {
      headers: { 'Authorization': `Bearer ${expiredToken}` },
    });
    record(
      'CRYPTO_AUTH',
      'Rejet d\'un jeton cryptographique expiré (401)',
      resExpired.status === 401,
      `Status HTTP: ${resExpired.status}`
    );


    // -----------------------------------------------------------------
    // 3. CODE D'ERREUR 401 VS 403 (AUTHENTIFICATION VS AUTORISATION)
    // -----------------------------------------------------------------
    console.log('\n--- 3. Distinction Stricte 401 (Non Authentifié) vs 403 (Non Autorisé) ---');

    // 401: Requête anonyme sur ressource protégée
    const resAnon = await fetch(`${baseUrl}/api/clients`);
    record(
      'AUTH_VS_PERM',
      'Non authentifié retourne 401 Unauthorized',
      resAnon.status === 401,
      `Status: ${resAnon.status}`
    );

    // 403: Utilisateur authentifié mais rôle insuffisant (ex: PELERIN tente de voir /api/users)
    const pelerinToken = createSignedSessionToken({
      id: 'usr-pelerin-saidou',
      email: 'saidou.sow@email.com',
      role: 'PELERIN',
      clientId: 'cli-001',
    });
    const resForbidden = await fetch(`${baseUrl}/api/users`, {
      headers: { 'Authorization': `Bearer ${pelerinToken}` },
    });
    record(
      'AUTH_VS_PERM',
      'Authentifié mais permission manquante retourne 403 Forbidden',
      resForbidden.status === 403,
      `Status: ${resForbidden.status}`
    );

    // -----------------------------------------------------------------
    // 4. PROTECTION FINANCIÈRE ABSOLUE & IMPOSSIBILITÉ DE SUPPRESSION PHYSIQUE
    // -----------------------------------------------------------------
    console.log('\n--- 4. Intégrité Financière & Interdiction Suppression Physique ---');

    // 4.1 Vérifier qu'aucune route DELETE n'existe sur /api/payments/:id -> 404 attendu
    const resDeletePayment = await fetch(`${baseUrl}/api/payments/pay-001`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${validToken}` },
    });
    record(
      'FINANCES',
      'Interdiction absolue de suppression physique de paiement (Route DELETE absente -> 404)',
      resDeletePayment.status === 404,
      `Status HTTP: ${resDeletePayment.status} (Aucun endpoint destructif exposé)`
    );

    // -----------------------------------------------------------------
    // 5. ANNULATION MÉTIER NON-DESTRUCTIVE DES INSCRIPTIONS (RULE 10)
    // -----------------------------------------------------------------
    console.log('\n--- 5. Annulation Non-Destructive des Inscriptions ---');

    // Créer un client temporaire dédié au test pour éviter la règle anti-doublon
    const tempClientRes = await fetch(`${baseUrl}/api/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${validToken}` },
      body: JSON.stringify({
        firstName: 'Abdoulaye',
        lastName: 'DialloTest',
        phone: '+221 77 000 99 88',
        gender: 'M',
        nationality: 'Sénégalaise',
        address: 'Dakar Fann',
        city: 'Dakar',
      }),
    });
    const tempClient = await tempClientRes.json();

    // Créer une inscription temporaire
    const newInsRes = await fetch(`${baseUrl}/api/inscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${validToken}` },
      body: JSON.stringify({
        clientId: tempClient.id,
        campaignId: 'voy-haj2027-01',
        packageId: 'pkg-std-2027',
      }),
    });

    // Annuler l'inscription via DELETE /api/inscriptions/:id (doit passer à statut ANNULEE, pas supprimer la ligne)
    const insCreated = await newInsRes.json();
    const cancelInsRes = await fetch(`${baseUrl}/api/inscriptions/${insCreated.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${validToken}` },
      body: JSON.stringify({ reason: 'Désistement volontaire pèlerin' }),
    });
    const cancelBody = await cancelInsRes.json();

    // Vérifier en base PostgreSQL que la ligne existe toujours avec status = 'ANNULEE'
    const checkDbIns = await pool.query(
      `SELECT status FROM inscriptions WHERE id = $1`,
      [insCreated.id]
    );
    const softCancelled = checkDbIns.rows.length === 1 && checkDbIns.rows[0].status === 'ANNULEE';

    // Nettoyer les entrées de test pour garder les chiffres d'origine
    await pool.query(`DELETE FROM visas WHERE inscription_id = $1`, [insCreated.id]);
    await pool.query(`DELETE FROM inscriptions WHERE id = $1`, [insCreated.id]);
    await pool.query(`DELETE FROM clients WHERE id = $1`, [tempClient.id]);

    record(
      'NON_DESTRUCTIF',
      'Annulation de dossier avec conservation d\'historique (Soft-Cancel)',
      softCancelled && cancelBody.success === true,
      `Statut en base: ${checkDbIns.rows[0]?.status || 'N/A'}, Réponse API: ${cancelBody.message}`
    );

    // -----------------------------------------------------------------
    // 6. CHIFFRES FINANCIERS STRICTS INCHANGÉS
    // -----------------------------------------------------------------
    console.log('\n--- 6. Conformité Totaux Financiers PostgreSQL Neon ---');

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
    const actualRem = actualCA - actualPay;
    const actualExp = Number(expRes.rows[0].total);

    record('FINANCES', 'Chiffre d\'affaires (30 600 000 FCFA)', actualCA === 30600000, `Actuel: ${actualCA}`);
    record('FINANCES', 'Encaissements validés (4 750 000 FCFA)', actualPay === 4750000, `Actuel: ${actualPay}`);
    record('FINANCES', 'Reste à recouvrer (25 850 000 FCFA)', actualRem === 25850000, `Actuel: ${actualRem}`);
    record('FINANCES', 'Dépenses totales (23 500 000 FCFA)', actualExp === 23500000, `Actuel: ${actualExp}`);

    // -----------------------------------------------------------------
    // 7. INTÉGRITÉ DE data/database.json
    // -----------------------------------------------------------------
    console.log('\n--- 7. Non-altération de data/database.json ---');
    const jsonPath = path.join(process.cwd(), 'data', 'database.json');
    const dbSize = fs.statSync(jsonPath).size;
    record(
      'INTEGRITE',
      'data/database.json intact (32 511 octets)',
      dbSize === 32511,
      `Taille constatée: ${dbSize} octets`
    );

  } finally {
    server.close();
  }

  // -----------------------------------------------------------------
  // BILAN GÉNÉRAL PHASE 2.5
  // -----------------------------------------------------------------
  console.log('\n=====================================================================');
  console.log('  BILAN FINAL PHASE 2.5 — SECURITY & SOURCE-OF-TRUTH GATE');
  console.log('=====================================================================');

  const allPassed = results.every((r) => r.status === 'PASS');
  const passCount = results.filter((r) => r.status === 'PASS').length;
  const totalCount = results.length;

  results.forEach((r) => {
    console.log(`[${r.status}] [${r.category}] ${r.name} -> ${r.details}`);
  });

  console.log(`\nRÉSULTAT GLOBAL PHASE 2.5 : ${passCount}/${totalCount} TESTS PASS (${allPassed ? '100% CONFORME' : 'NON CONFORME'})`);

  await pool.end();

  if (!allPassed) {
    process.exit(1);
  }
}

runSecurityGateTests().catch((err) => {
  console.error('Erreur critique pendant la suite de sécurité Phase 2.5:', err);
  process.exit(1);
});
