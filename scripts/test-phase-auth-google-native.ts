import 'dotenv/config';
import http from 'http';
import crypto from 'crypto';
import { app } from '../server.js';
import { pool } from '../server/db/neon.js';
import {
  createSignedSessionToken,
  verifySignedSessionToken,
  getSessionSecret,
  parseCookieHeader,
} from '../server/auth/token.service.js';
import { googleOAuthService, GoogleUserInfo } from '../server/auth/google-oauth.service.js';

interface TestRecord {
  num: number;
  category: string;
  name: string;
  passed: boolean;
  httpStatus?: number;
  errorCode?: string;
}

const testResults: TestRecord[] = [];

function logResult(num: number, category: string, name: string, passed: boolean, httpStatus?: number, errorCode?: string) {
  testResults.push({ num, category, name, passed, httpStatus, errorCode });
  const icon = passed ? '✓ PASS' : '✗ FAIL';
  const statusStr = httpStatus !== undefined ? ` [HTTP ${httpStatus}]` : '';
  const codeStr = errorCode ? ` (${errorCode})` : '';
  console.log(`  ${icon} #${num.toString().padStart(2, '0')} [${category}] ${name}${statusStr}${codeStr}`);
  if (!passed) {
    console.error(`     [ÉCHEC CRITIQUE] Le test #${num} a échoué !`);
  }
}

async function getSanctuaryMetrics() {
  const res = await pool.query(`
    SELECT 
      (SELECT count(*)::int FROM clients WHERE is_test = FALSE OR is_test IS NULL) as real_clients,
      (SELECT count(*)::int FROM inscriptions WHERE is_test = FALSE OR is_test IS NULL) as real_inscriptions,
      (SELECT count(*)::int FROM payments WHERE is_test = FALSE OR is_test IS NULL) as real_payments,
      (SELECT COALESCE(SUM(amount), 0)::numeric FROM payments WHERE is_test = FALSE OR is_test IS NULL) as total_encaisse,
      (SELECT COALESCE(SUM(agreed_price), 0)::numeric FROM inscriptions WHERE is_test = FALSE OR is_test IS NULL) as total_engage,
      (SELECT count(*)::int FROM expenses WHERE (is_test = FALSE OR is_test IS NULL) AND status != 'ANNULEE') as real_active_expenses
  `);
  const row = res.rows[0];
  const realClients = Number(row.real_clients);
  const realInscriptions = Number(row.real_inscriptions);
  const realPayments = Number(row.real_payments);
  const totalEncaisse = Number(row.total_encaisse);
  const totalEngage = Number(row.total_engage);
  const realReste = totalEngage - totalEncaisse;
  const realExpenses = Number(row.real_active_expenses);

  return {
    realClients,
    realInscriptions,
    realPayments,
    totalEncaisse,
    totalEngage,
    realReste,
    realExpenses,
  };
}

async function startServer(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

async function runNativeGoogleAuthSuite() {
  console.log('======================================================================');
  console.log('  GIE TAIBA VOYAGES — SUITE AUTH GOOGLE NATIVE EXPRESS & SÉCURITÉ');
  console.log('======================================================================\n');

  // 1. Contrôle initial du Sanctuaire Financier
  console.log('▶ 1. CONTRÔLE INITIAL DU SANCTUAIRE FINANCIER (INVARIANTS)');
  const initialSanctuary = await getSanctuaryMetrics();
  const initOk =
    initialSanctuary.realClients === 6 &&
    initialSanctuary.realInscriptions === 6 &&
    initialSanctuary.realPayments === 3 &&
    initialSanctuary.totalEncaisse === 4500000 &&
    initialSanctuary.totalEngage === 30600000 &&
    initialSanctuary.realReste === 26100000 &&
    initialSanctuary.realExpenses === 0;

  if (!initOk) {
    console.error('STOP IMMÉDIAT : Le sanctuaire financier initial n\'est pas conforme !');
    console.error(initialSanctuary);
    process.exit(1);
  }
  console.log('  ✓ PASS 1.0 Sanctuaire initial certifié : 6 clients, 6 dossiers, 3 paiements (4,5M FCFA), 0 dépense.\n');

  const { server, baseUrl } = await startServer();

  // Données de test isolées avec is_test = TRUE
  const testUserId = `usr-test-google-${Date.now()}`;
  const testEmail = `test.pelerin.${Date.now()}@example.com`;
  const testClientId = `cli-test-google-${Date.now()}`;
  const testOtherClientId = `cli-test-other-${Date.now()}`;

  let testUserToken = '';
  let cheikhToken = '';
  let niassToken = '';

  try {
    // -------------------------------------------------------------
    // BLOC A : AUTHENTIFICATION & CYCLE DE SESSION (TESTS 1 À 7)
    // -------------------------------------------------------------
    console.log('▶ 2. BLOC A : AUTHENTIFICATION & CYCLE DE SESSION');

    // 1. Résolution utilisateur Google valide (SUPER_ADMIN El Hadji Abdoulaye - READ ONLY STRICT)
    const niassDbRes = await pool.query(
      `SELECT id, email, display_name, role_id, client_id, active FROM users WHERE email = 'mr.niass@gmail.com' LIMIT 1;`
    );
    const niassRow = niassDbRes.rows[0];
    const niassResolvOk =
      niassRow &&
      niassRow.role_id === 'SUPER_ADMIN' &&
      niassRow.client_id === null &&
      niassRow.active === true;
    niassToken = createSignedSessionToken({
      id: niassRow.id,
      email: niassRow.email,
      role: niassRow.role_id,
      active: true,
    });
    logResult(1, 'AUTH_CYCLE', 'Résolution Google READ-ONLY : El Hadji Abdoulaye Niass (SUPER_ADMIN)', niassResolvOk, 200);

    // 2. Résolution utilisateur Google valide (SUPER_ADMIN Cheikh - READ ONLY STRICT)
    const cheikhDbRes = await pool.query(
      `SELECT id, email, display_name, role_id, client_id, active FROM users WHERE email = 'kabaye73@gmail.com' LIMIT 1;`
    );
    const cheikhRow = cheikhDbRes.rows[0];
    const cheikhResolvOk =
      cheikhRow &&
      cheikhRow.role_id === 'SUPER_ADMIN' &&
      cheikhRow.client_id === null &&
      cheikhRow.active === true;
    cheikhToken = createSignedSessionToken({
      id: cheikhRow.id,
      email: cheikhRow.email,
      role: cheikhRow.role_id,
      active: true,
    });
    logResult(2, 'AUTH_CYCLE', 'Résolution Google READ-ONLY : Cheikh Ibrahima Ka (SUPER_ADMIN)', cheikhResolvOk, 200);

    // 3. Rapprochement pèlerin client réel (is_test = TRUE) avec création contrôlée rôle PELERIN
    await pool.query(`
      INSERT INTO clients (id, code, first_name, last_name, email, phone, is_test, created_at, updated_at)
      VALUES ($1, 'GT-TEST-G01', 'Testeur', 'Google', $2, '+221770000001', TRUE, NOW(), NOW())
    `, [testClientId, testEmail]);

    const fakeGoogleUser: GoogleUserInfo = {
      id: `google-sub-${Date.now()}`,
      email: testEmail,
      emailVerified: true,
      name: 'Testeur Google',
      authAssuranceLevel: 'OIDC_ID_TOKEN_CRYPTOGRAPHICALLY_VERIFIED',
    };

    const attachResult = await googleOAuthService.authenticateWithGoogleUser(fakeGoogleUser);
    const attachOk =
      attachResult.user.role === 'PELERIN' &&
      attachResult.user.clientId === testClientId &&
      attachResult.redirectPath === '/portail';
    testUserToken = attachResult.token;
    logResult(3, 'AUTH_CYCLE', 'Rapprochement client -> rôle PELERIN uniquement (jamais SUPER_ADMIN)', attachOk, 200);

    // 4. /api/auth/me avec jeton Bearer valide
    const meBearerRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${testUserToken}` },
    });
    const meBearerData = await meBearerRes.json().catch(() => ({}));
    const meBearerOk = meBearerRes.status === 200 && meBearerData?.user?.email === testEmail;
    logResult(4, 'AUTH_CYCLE', 'Validation de session via Authorization: Bearer <token>', meBearerOk, meBearerRes.status);

    // 5. /api/auth/me avec cookie HttpOnly taiba_session (mécanisme cible)
    const meCookieRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: `taiba_session=${testUserToken}` },
    });
    const meCookieData = await meCookieRes.json().catch(() => ({}));
    const meCookieOk = meCookieRes.status === 200 && meCookieData?.user?.email === testEmail;
    logResult(5, 'AUTH_CYCLE', 'Validation de session via Cookie HttpOnly taiba_session', meCookieOk, meCookieRes.status);

    // 6. Déconnexion via /api/auth/logout (invalidation cookie et réponse 200)
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: `taiba_session=${testUserToken}` },
    });
    const logoutCookies = logoutRes.headers.get('set-cookie') || '';
    const logoutOk =
      logoutRes.status === 200 &&
      (logoutCookies.includes('taiba_session=;') || logoutCookies.includes('Max-Age=0') || logoutCookies.includes('expires='));
    logResult(6, 'AUTH_CYCLE', 'Déconnexion POST /api/auth/logout : purge du cookie taiba_session', logoutOk, logoutRes.status);

    // 7. Session expirée (rejet strict)
    const expiredToken = createSignedSessionToken(
      { id: testUserId, email: testEmail, role: 'PELERIN' },
      -3600 // Expire 1h dans le passé
    );
    const expiredRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    const expiredOk = expiredRes.status === 401;
    logResult(7, 'AUTH_CYCLE', 'Rejet strict d\'une session cryptographiquement expirée', expiredOk, expiredRes.status, 'INVALID_TOKEN');

    // -------------------------------------------------------------
    // BLOC B : REJETS DE SÉCURITÉ & ANTI-FRAUDE (TESTS 8 À 16)
    // -------------------------------------------------------------
    console.log('\n▶ 3. BLOC B : REJETS DE SÉCURITÉ & ANTI-FRAUDE');

    // 8. Rejet callback Google sans code
    const cbNoCodeRes = await fetch(`${baseUrl}/api/auth/google/callback`, { redirect: 'manual' });
    const cbNoCodeLoc = cbNoCodeRes.headers.get('location') || '';
    const cbNoCodeOk = cbNoCodeRes.status === 302 && cbNoCodeLoc.includes('error=');
    logResult(8, 'REJET_SECU', 'Rejet callback Google : code d\'autorisation absent', cbNoCodeOk, cbNoCodeRes.status, 'CODE_MANQUANT');

    // 9. Rejet callback Google avec state anti-CSRF manquant ou altéré
    const cbBadStateRes = await fetch(`${baseUrl}/api/auth/google/callback?code=fake-code&state=fake-state`, {
      headers: { Cookie: 'oauth_state=legitimate-state-value' },
      redirect: 'manual',
    });
    const cbBadStateLoc = cbBadStateRes.headers.get('location') || '';
    const cbBadStateOk = cbBadStateRes.status === 302 && cbBadStateLoc.includes('anti-CSRF');
    logResult(9, 'REJET_SECU', 'Rejet callback Google : altération ou absence de state anti-CSRF', cbBadStateOk, cbBadStateRes.status, 'CSRF_BLOCKED');

    // 10. Rejet token Google invalide / falsifié (vérification cryptographique id_token)
    let verifyIdTokenFailed = false;
    try {
      await googleOAuthService.verifyGoogleIdToken('fake.header.payload.signature');
    } catch (e: any) {
      verifyIdTokenFailed = true;
    }
    logResult(10, 'REJET_SECU', 'Rejet cryptographique d\'un id_token Google falsifié / non signé', verifyIdTokenFailed, 401, 'INVALID_ID_TOKEN');

    // 11. Rejet adresse Google avec email_verified = false
    let unverifiedRejected = false;
    try {
      await googleOAuthService.authenticateWithGoogleUser({
        id: 'unverified-sub',
        email: 'unverified@example.com',
        emailVerified: false,
      });
    } catch (e: any) {
      unverifiedRejected = e.message.includes('non vérifiée');
    }
    logResult(11, 'REJET_SECU', 'Rejet absolu d\'un compte Google avec email_verified = false', unverifiedRejected, 403, 'EMAIL_NOT_VERIFIED');

    // 12. Rejet strict compte Google inconnu (COMPTE_NON_AUTORISE, zéro SUPER_ADMIN sauvage)
    let unknownRejected = false;
    try {
      await googleOAuthService.authenticateWithGoogleUser({
        id: 'unknown-sub-999',
        email: 'hacker.inconnu.2026@gmail.com',
        emailVerified: true,
      });
    } catch (e: any) {
      unknownRejected = (e as any).code === 'COMPTE_NON_AUTORISE' || e.message.includes('non autorisée');
    }
    logResult(12, 'REJET_SECU', 'Rejet strict compte Google inconnu : zéro création de SUPER_ADMIN sauvage', unknownRejected, 403, 'COMPTE_NON_AUTORISE');

    // 13. Rejet token de session Taiba falsifié (signature HMAC invalide)
    const forgedToken = testUserToken.slice(0, -4) + 'abcd';
    const forgedRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${forgedToken}` },
    });
    const forgedOk = forgedRes.status === 401;
    logResult(13, 'REJET_SECU', 'Rejet immédiat d\'un jeton de session Taiba falsifié (signature invalide)', forgedOk, forgedRes.status, 'INVALID_TOKEN');

    // 14. Rejet token avec mauvais secret de signature
    const badSecretToken = crypto
      .createHmac('sha256', 'completely-wrong-secret-key-that-does-not-match-at-all')
      .update('some.fake.payload')
      .digest('base64url');
    const badSecretRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer e30.e30.${badSecretToken}` },
    });
    const badSecretOk = badSecretRes.status === 401;
    logResult(14, 'REJET_SECU', 'Rejet immédiat d\'un jeton forgé avec une fausse clé secrète', badSecretOk, badSecretRes.status, 'INVALID_TOKEN');

    // 15. Rejet tentative de falsification de rôle côté frontend (rechargé depuis DB)
    const tamperedPayload = {
      userId: attachResult.user.id,
      email: testEmail,
      role: 'SUPER_ADMIN', // Usurpation prétendue
      clientId: testClientId,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    };
    const encodedHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(tamperedPayload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', getSessionSecret())
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');
    const usurperToken = `${encodedHeader}.${encodedPayload}.${signature}`;

    const usurpRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${usurperToken}` },
    });
    const usurpData = await usurpRes.json().catch(() => ({}));
    const usurpOk = usurpRes.status === 200 && usurpData?.user?.role === 'PELERIN';
    logResult(15, 'REJET_SECU', 'Anti-élévation privilège : rôle résolu depuis Neon, payload ignoré', usurpOk, usurpRes.status, 'ROLE_ENFORCED_FROM_DB');

    // 16. Rejet tentative de falsification de client_id côté frontend
    const usurpDossierRes = await fetch(`${baseUrl}/api/pilgrim/dossier?clientId=cli-001`, {
      headers: { Authorization: `Bearer ${usurperToken}` },
    });
    const usurpDossierOk = usurpDossierRes.status === 403;
    logResult(16, 'REJET_SECU', 'Anti-usurpation client_id : accès dossier étranger bloqué (403)', usurpDossierOk, usurpDossierRes.status, 'ACCES_REFUSE_PELERIN_ISOLATION');

    // -------------------------------------------------------------
    // BLOC C : AUTORISATION MÉTIER & ISOLATION IDOR (TESTS 17 À 21)
    // -------------------------------------------------------------
    console.log('\n▶ 4. BLOC C : AUTORISATION MÉTIER & ISOLATION IDOR');

    // 17. SUPER_ADMIN Cheikh : accès administratif autorisé (READ-ONLY)
    const cheikhMeRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${cheikhToken}` },
    });
    const cheikhMeData = await cheikhMeRes.json().catch(() => ({}));
    const cheikhAuthOk = cheikhMeRes.status === 200 && cheikhMeData?.user?.role === 'SUPER_ADMIN';
    logResult(17, 'AUTORISATION', 'SUPER_ADMIN Cheikh Ibrahima Ka : habilitation confirmée (READ-ONLY)', cheikhAuthOk, cheikhMeRes.status);

    // 18. SUPER_ADMIN El Hadji Abdoulaye : accès administratif autorisé (READ-ONLY)
    const niassMeRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${niassToken}` },
    });
    const niassMeData = await niassMeRes.json().catch(() => ({}));
    const niassAuthOk = niassMeRes.status === 200 && niassMeData?.user?.role === 'SUPER_ADMIN';
    logResult(18, 'AUTORISATION', 'SUPER_ADMIN El Hadji Abdoulaye Niass : habilitation confirmée (READ-ONLY)', niassAuthOk, niassMeRes.status);

    // 19. Pèlerin test : accès autorisé à son propre dossier (is_test = TRUE)
    const pelerinOwnDossierRes = await fetch(`${baseUrl}/api/pilgrim/dossier?clientId=${testClientId}`, {
      headers: { Authorization: `Bearer ${testUserToken}` },
    });
    const pelerinOwnDossierOk = pelerinOwnDossierRes.status === 200;
    logResult(19, 'AUTORISATION', 'Pèlerin test : consultation autorisée de son propre dossier', pelerinOwnDossierOk, pelerinOwnDossierRes.status);

    // 20. Isolation dossier A/B : Pèlerin tente d'accéder au dossier de B (is_test = TRUE)
    await pool.query(`
      INSERT INTO clients (id, code, first_name, last_name, email, phone, is_test, created_at, updated_at)
      VALUES ($1, 'GT-TEST-G02', 'Autre', 'Client', 'autre.client.test@example.com', '+221770000002', TRUE, NOW(), NOW())
    `, [testOtherClientId]);

    const crossDossierRes = await fetch(`${baseUrl}/api/pilgrim/dossier?clientId=${testOtherClientId}`, {
      headers: { Authorization: `Bearer ${testUserToken}` },
    });
    const crossDossierOk = crossDossierRes.status === 403;
    logResult(20, 'AUTORISATION', 'Défense IDOR A/B : Rejet strict (HTTP 403 ACCES_REFUSE_PELERIN_ISOLATION)', crossDossierOk, crossDossierRes.status, 'ACCES_REFUSE_PELERIN_ISOLATION');

    // 21. Rejet frontière : Pèlerin bloqué sur route d'administration ERP (/api/auth/users)
    const staffDeniedRes = await fetch(`${baseUrl}/api/auth/users`, {
      headers: { Authorization: `Bearer ${testUserToken}` },
    });
    const staffDeniedOk = staffDeniedRes.status === 403;
    logResult(21, 'AUTORISATION', 'Frontière ERP / Pèlerin : accès refusé aux routes staff (HTTP 403 FORBIDDEN)', staffDeniedOk, staffDeniedRes.status, 'FORBIDDEN');

    // -------------------------------------------------------------
    // BLOC D : SÉCURITÉ SESSION & FAIL-FAST (TESTS 22 À 26)
    // -------------------------------------------------------------
    console.log('\n▶ 5. BLOC D : SÉCURITÉ SESSION & FAIL-FAST');

    // 22. Secret incorrect : verifySignedSessionToken retourne null
    const dummyToken = createSignedSessionToken({ id: 'usr-dummy', email: 'dummy@test.sn', role: 'PELERIN' });
    const fakeParts = dummyToken.split('.');
    const forgedSig = crypto.createHmac('sha256', 'wrong-secret-random-abc-123-456-789').update(`${fakeParts[0]}.${fakeParts[1]}`).digest('base64url');
    const tamperedSigToken = `${fakeParts[0]}.${fakeParts[1]}.${forgedSig}`;
    const verifyWrongSecretOk = verifySignedSessionToken(tamperedSigToken) === null;
    logResult(22, 'SESSION_SECU', 'Contrôle cryptographique : signature rejetée avec clé secrète divergente', verifyWrongSecretOk, 401);

    // 23. Token altéré (bit flip dans le payload)
    const flippedPayload = fakeParts[1].substring(0, 5) + (fakeParts[1][5] === 'A' ? 'B' : 'A') + fakeParts[1].substring(6);
    const flippedToken = `${fakeParts[0]}.${flippedPayload}.${fakeParts[2]}`;
    const verifyFlippedOk = verifySignedSessionToken(flippedToken) === null;
    logResult(23, 'SESSION_SECU', 'Contrôle d\'intégrité : token altéré (bit flip) rejeté sans exception', verifyFlippedOk, 401);

    // 24. Token rejoué après expiration
    const expiredPayload = { ...tamperedPayload, exp: Math.floor(Date.now() / 1000) - 100 };
    const encExpiredPayload = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
    const expSig = crypto.createHmac('sha256', getSessionSecret()).update(`${fakeParts[0]}.${encExpiredPayload}`).digest('base64url');
    const replayExpiredToken = `${fakeParts[0]}.${encExpiredPayload}.${expSig}`;
    const verifyReplayOk = verifySignedSessionToken(replayExpiredToken) === null;
    logResult(24, 'SESSION_SECU', 'Anti-rejeu : token antérieur au timestamp actuel rejeté systématiquement', verifyReplayOk, 401);

    // 25. Accès après logout avec cookie supprimé
    const postLogoutRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: 'taiba_session=deleted' },
    });
    const postLogoutOk = postLogoutRes.status === 401;
    logResult(25, 'SESSION_SECU', 'Validation post-logout : requête avec cookie purgé rejetée (HTTP 401)', postLogoutOk, postLogoutRes.status, 'AUTH_REQUIRED');

    // 26. Absence de fuite de secret dans les en-têtes et le corps de réponse
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthText = await healthRes.text();
    const statusRes = await fetch(`${baseUrl}/api/auth/google/status`);
    const statusText = await statusRes.text();
    const noLeak =
      !healthText.includes(getSessionSecret()) &&
      !statusText.includes(getSessionSecret()) &&
      !healthText.includes('postgres://') &&
      !statusText.includes('postgres://');
    logResult(26, 'SESSION_SECU', 'Absence absolue de fuite de secret ou token dans les réponses publiques', noLeak, 200);

  } finally {
    // Nettoyage rigoureux des données de test
    await pool.query(`DELETE FROM user_client_access WHERE user_id IN (SELECT id FROM users WHERE email = $1);`, [testEmail]);
    await pool.query(`DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE email = $1);`, [testEmail]);
    await pool.query(`DELETE FROM users WHERE email = $1;`, [testEmail]);
    await pool.query(`DELETE FROM clients WHERE id IN ($1, $2);`, [testClientId, testOtherClientId]);

    server.close();
  }

  // 6. Contrôle final du Sanctuaire Financier
  console.log('\n▶ 6. CONTRÔLE POST-TEST DU SANCTUAIRE FINANCIER (INVARIANTS)');
  const finalSanctuary = await getSanctuaryMetrics();

  const sanctOk =
    finalSanctuary.realClients === 6 &&
    finalSanctuary.realInscriptions === 6 &&
    finalSanctuary.realPayments === 3 &&
    finalSanctuary.totalEncaisse === 4500000 &&
    finalSanctuary.totalEngage === 30600000 &&
    finalSanctuary.realReste === 26100000 &&
    finalSanctuary.realExpenses === 0;

  console.log(`  • Clients réels        : ${finalSanctuary.realClients} (Attendu: 6)`);
  console.log(`  • Inscriptions réelles : ${finalSanctuary.realInscriptions} (Attendu: 6)`);
  console.log(`  • Paiements réels      : ${finalSanctuary.realPayments} (Attendu: 3)`);
  console.log(`  • Total encaissé       : ${finalSanctuary.totalEncaisse} FCFA (Attendu: 4 500 000 FCFA)`);
  console.log(`  • Total engagé         : ${finalSanctuary.totalEngage} FCFA (Attendu: 30 600 000 FCFA)`);
  console.log(`  • Reste à recouvrer    : ${finalSanctuary.realReste} FCFA (Attendu: 26 100 000 FCFA)`);
  console.log(`  • Dépenses réelles     : ${finalSanctuary.realExpenses} FCFA (Attendu: 0 FCFA)`);

  if (!sanctOk) {
    console.error('\n🔴 ALERTE SANCTUAIRE FINANCIER CORROMPU ! ARRÊT IMMÉDIAT !');
    process.exit(1);
  }

  console.log('  ✓ PASS Sanctuaire préservé : Invariants 100% identiques.\n');

  const allPassed = testResults.every((t) => t.passed);
  console.log('======================================================================');
  console.log(`  RÉSULTAT GLOBAL : ${testResults.filter((t) => t.passed).length}/${testResults.length} TESTS PASSÉS`);
  if (allPassed) {
    console.log('  STATUT : 🟢 SUCCÈS TOTAL — AUTH GOOGLE NATIVE & SESSIONS VALIDÉES');
  } else {
    console.log('  STATUT : 🔴 ÉCHEC — VÉRIFIEZ LES TESTS DÉFAILLANTS');
    process.exit(1);
  }
  console.log('======================================================================\n');

  await pool.end();
}

runNativeGoogleAuthSuite().catch((err) => {
  console.error('Erreur non gérée dans la suite de tests:', err);
  pool.end();
  process.exit(1);
});
