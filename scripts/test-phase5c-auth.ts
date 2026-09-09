import 'dotenv/config';
import http from 'http';
import { app } from '../server.js';
import { pool } from '../server/db/neon.js';

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

async function requestJson(url: string, options: { method?: string; headers?: Record<string, string>; body?: any } = {}) {
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data, headers: res.headers };
}

async function runPhase5CTests() {
  console.log('=====================================================================');
  console.log('  SUITE DE TESTS PHASE 5C — VALIDATION AUTH NODE + NEON & RETRAIT FIREBASE');
  console.log('=====================================================================');

  const { server, baseUrl } = await startTestServer();
  console.log(`Serveur de test démarré sur ${baseUrl}\n`);

  const superAdminEmail = 'mr.niass@gmail.com';
  const superAdminPwd = process.env.SUPERADMIN_PWD || 'Niass2027!';
  const pilgrimEmail = 'mrniass1987@gmail.com';
  const pilgrimPwd = process.env.PELERIN_PWD || 'Pelerin2027!';

  let superAdminToken = '';
  let pilgrimToken = '';

  try {
    // -------------------------------------------------------------
    // TEST 1 : Health check Neon
    // -------------------------------------------------------------
    const health = await requestJson(`${baseUrl}/api/health`);
    record('INFRA', 1, 'Health check public', health.status === 200 && health.data.engine === 'PostgreSQL Neon', `status=${health.status}`);

    // -------------------------------------------------------------
    // TEST 2 : Authentification Super Admin mr.niass@gmail.com
    // -------------------------------------------------------------
    const loginSuper = await requestJson(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      body: { email: superAdminEmail, password: superAdminPwd }
    });
    const superOk = loginSuper.status === 200 && !!loginSuper.data.token && loginSuper.data.user?.role === 'SUPER_ADMIN';
    superAdminToken = loginSuper.data.token || '';
    record('AUTH_SUPERADMIN', 2, 'Connexion Super Admin mr.niass@gmail.com', superOk, `status=${loginSuper.status}, role=${loginSuper.data?.user?.role}`);

    // -------------------------------------------------------------
    // TEST 3 : Accès Espace Super Admin protégé (Dashboard stats)
    // -------------------------------------------------------------
    const statsRes = await requestJson(`${baseUrl}/api/dashboard/stats`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const totalPilgrimsVal = statsRes.data?.activity?.totalPilgrims ?? statsRes.data?.totalPilgrims;
    record('AUTH_SUPERADMIN', 3, 'Accès Dashboard stats avec jeton Super Admin', statsRes.status === 200 && totalPilgrimsVal !== undefined, `status=${statsRes.status}, totalPilgrims=${totalPilgrimsVal}`);

    // -------------------------------------------------------------
    // TEST 4 : Accès Liste Utilisateurs (users.read)
    // -------------------------------------------------------------
    const usersRes = await requestJson(`${baseUrl}/api/auth/users`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const hasNiass = Array.isArray(usersRes.data) && usersRes.data.some((u: any) => u.email === superAdminEmail);
    record('AUTH_SUPERADMIN', 4, 'Consultation /api/auth/users avec jeton Super Admin', usersRes.status === 200 && hasNiass, `status=${usersRes.status}, usersCount=${usersRes.data?.length}`);

    // -------------------------------------------------------------
    // TEST 5 : Authentification Pèlerin mrniass1987@gmail.com par Email
    // -------------------------------------------------------------
    const loginPilgrim = await requestJson(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      body: { email: pilgrimEmail, password: pilgrimPwd }
    });
    const pilgrimOk = loginPilgrim.status === 200 && !!loginPilgrim.data.token && loginPilgrim.data.user?.role === 'PELERIN';
    pilgrimToken = loginPilgrim.data.token || '';
    record('AUTH_PELERIN', 5, 'Connexion Pèlerin par Email/Mot de passe', pilgrimOk, `status=${loginPilgrim.status}, role=${loginPilgrim.data?.user?.role}, clientId=${loginPilgrim.data?.user?.clientId}`);

    // -------------------------------------------------------------
    // TEST 6 : Authentification Rapide Pèlerin par Matricule GT-TEST-000001
    // -------------------------------------------------------------
    const quickLogin = await requestJson(`${baseUrl}/api/auth/pilgrim-login`, {
      method: 'POST',
      body: { identifier: 'GT-TEST-000001' }
    });
    record('AUTH_PELERIN', 6, 'Connexion Rapide Pèlerin via Code GT-TEST-000001', quickLogin.status === 200 && !!quickLogin.data.token && quickLogin.data.client?.code === 'GT-TEST-000001', `status=${quickLogin.status}, code=${quickLogin.data?.client?.code}`);

    // -------------------------------------------------------------
    // TEST 7 : Consultation Dossier Pèlerin (GET /api/pilgrim/dossier)
    // -------------------------------------------------------------
    const dossierRes = await requestJson(`${baseUrl}/api/pilgrim/dossier`, {
      headers: { Authorization: `Bearer ${pilgrimToken}` }
    });
    const dossierOk = dossierRes.status === 200 && dossierRes.data.client?.code === 'GT-TEST-000001' && Array.isArray(dossierRes.data.inscriptions) && dossierRes.data.inscriptions.length === 0;
    record('PORTAIL_PELERIN', 7, 'Consultation Dossier Pèlerin Personnel', dossierOk, `status=${dossierRes.status}, client=${dossierRes.data?.client?.firstName} ${dossierRes.data?.client?.lastName}, dossiers=${dossierRes.data?.inscriptions?.length}`);

    // -------------------------------------------------------------
    // TEST 8 : Défense IDOR (Pèlerin tente d'accéder au dossier cli-001)
    // -------------------------------------------------------------
    const idorRes = await requestJson(`${baseUrl}/api/pilgrim/dossier?clientId=cli-001`, {
      headers: { Authorization: `Bearer ${pilgrimToken}` }
    });
    record('SECURITE_IDOR', 8, 'Défense IDOR : Pèlerin tente accès dossier cli-001', idorRes.status === 403, `status=${idorRes.status} (Attendu: 403)`);

    // -------------------------------------------------------------
    // TEST 9 : Défense Frontière Espace : Pèlerin tente /api/auth/users
    // -------------------------------------------------------------
    const staffDeniedRes = await requestJson(`${baseUrl}/api/auth/users`, {
      headers: { Authorization: `Bearer ${pilgrimToken}` }
    });
    record('SECURITE_RBAC', 9, 'Défense Frontière : Pèlerin bloqué sur /api/auth/users', staffDeniedRes.status === 403, `status=${staffDeniedRes.status} (Attendu: 403)`);

    // -------------------------------------------------------------
    // TEST 10 : Défense Frontière Espace : Pèlerin tente /api/dashboard/stats
    // -------------------------------------------------------------
    const statsDeniedRes = await requestJson(`${baseUrl}/api/dashboard/stats`, {
      headers: { Authorization: `Bearer ${pilgrimToken}` }
    });
    record('SECURITE_RBAC', 10, 'Défense Frontière : Pèlerin bloqué sur /api/dashboard/stats', statsDeniedRes.status === 403, `status=${statsDeniedRes.status} (Attendu: 403)`);

    // -------------------------------------------------------------
    // TEST 11 : Envoi et lecture de Notifications via REST Neon
    // -------------------------------------------------------------
    const notifRes = await requestJson(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    record('NOTIFICATIONS', 11, 'Consultation /api/notifications', notifRes.status === 200 && Array.isArray(notifRes.data), `status=${notifRes.status}, count=${notifRes.data?.length}`);

    // -------------------------------------------------------------
    // GATE 5C-4 : SANCTUAIRE & INVARIANCE DES DONNÉES RÉELLES
    // -------------------------------------------------------------
    console.log('\n[GATE 5C-4] Contrôle de non-régression et sanctuaire...');
    const clientCountRes = await pool.query(`SELECT COUNT(*) FROM clients WHERE code != 'GT-TEST-000001'`);
    const realClientsCount = parseInt(clientCountRes.rows[0].count, 10);
    record('SANCTUAIRE', 12, 'Invariance des 6 clients Hajj réels', realClientsCount === 6, `count=${realClientsCount} (Attendu: 6)`);

    const insCountRes = await pool.query(`SELECT COUNT(*) FROM inscriptions`);
    const realInsCount = parseInt(insCountRes.rows[0].count, 10);
    record('SANCTUAIRE', 13, 'Invariance des 6 dossiers Hajj réels', realInsCount === 6, `count=${realInsCount} (Attendu: 6)`);

    const payRes = await pool.query(`SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM payments`);
    const payCount = parseInt(payRes.rows[0].count, 10);
    const payTotal = parseFloat(payRes.rows[0].total);
    record('SANCTUAIRE', 14, 'Invariance des versements encaissés (3 paiements = 4 500 000 FCFA)', payCount === 3 && payTotal === 4500000, `count=${payCount}, total=${payTotal}`);

    const expRes = await pool.query(`SELECT COUNT(*) FROM expenses`);
    const expCount = parseInt(expRes.rows[0].count, 10);
    record('SANCTUAIRE', 15, 'Invariance des dépenses (0 dépense)', expCount === 0, `count=${expCount} (Attendu: 0)`);

    // Contrôle isolation client test
    const testClientInsRes = await pool.query(`SELECT COUNT(*) FROM inscriptions WHERE client_id = 'cli-test-niass'`);
    const testInsCount = parseInt(testClientInsRes.rows[0].count, 10);
    record('SANCTUAIRE', 16, 'Zéro dossier Hajj pour le client de test', testInsCount === 0, `count=${testInsCount} (Attendu: 0)`);

  } finally {
    await new Promise((resolve) => server.close(resolve));
    console.log('\nServeur de test arrêté.');
  }

  const allPassed = results.every((r) => r.passed);
  console.log('\n=====================================================================');
  console.log(`  BILAN GLOBAL PHASE 5C : ${results.filter(r => r.passed).length}/${results.length} TESTS PASSÉS`);
  console.log(`  STATUT FINAL : ${allPassed ? '🟢 100% SUCCÈS (PRET POUR SUPPRESSION FIREBASE)' : '🔴 ÉCHEC'}`);
  console.log('=====================================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

runPhase5CTests()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Échec fatal de la suite de tests :', err);
    pool.end();
    process.exit(1);
  });
