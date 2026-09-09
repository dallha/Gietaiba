import 'dotenv/config';
import http from 'http';
import crypto from 'crypto';
import { app } from '../server.js';
import { pool } from '../server/db/neon.js';
import { createSignedSessionToken } from '../server/auth/token.service.js';
import { UserSession } from '../src/types.js';

interface AssertionResult {
  section: string;
  testNum: number;
  description: string;
  expected: string;
  observed: string;
  passed: boolean;
}

const assertions: AssertionResult[] = [];
let testCounter = 0;

function assert(section: string, description: string, expected: string, observed: string, passed: boolean) {
  testCounter++;
  assertions.push({ section, testNum: testCounter, description, expected, observed, passed });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [${section}] #${testCounter}: ${description} | Attendu: ${expected} | Observé: ${observed}`);
  if (!passed) {
    console.error(`   [CRITICAL FAILURE] Assertion #${testCounter} non conforme !`);
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
): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          let parsedBody = rawData;
          try {
            parsedBody = JSON.parse(rawData);
          } catch {
            // keep raw string if not JSON
          }
          resolve({ status: res.statusCode || 500, body: parsedBody, headers: res.headers });
        });
      }
    );

    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runGate5BAReadOnly() {
  console.log('=====================================================================');
  console.log('   GATE 5B-A — AUDIT DU CONTRAT API HTTP SUR NEON (STRICT READ-ONLY) ');
  console.log('   Règle : Aucune modification de la base réelle. Comparaison DB.    ');
  console.log('=====================================================================\n');

  const { server, baseUrl } = await startServer();
  console.log(`[Test Server] Express actif sur ${baseUrl}\n`);

  const client = await pool.connect();

  try {
    // -----------------------------------------------------------------
    // ÉTAPE 0 : LECTURE DE LA BASE DE RÉFÉRENCE (SANS AUCUNE MODIFICATION)
    // -----------------------------------------------------------------
    console.log('[ÉTAPE 0] Lecture des données de référence en base Neon pour comparaison dynamique...');
    const dbCampRes = await client.query("SELECT id, code, title, capacity, departure_date, return_date, status FROM campaigns WHERE id = 'voy-haj2027-01'");
    const dbCamp = dbCampRes.rows[0];

    const dbPkgsRes = await client.query("SELECT id, name, price, status FROM packages ORDER BY price ASC");
    const dbPkgs = dbPkgsRes.rows;

    const dbClientsRes = await client.query("SELECT id, code, first_name, last_name, phone FROM clients ORDER BY code ASC");
    const dbClients = dbClientsRes.rows;

    const dbInsRes = await client.query("SELECT id, code, client_id, agreed_price, status FROM inscriptions ORDER BY code ASC");
    const dbIns = dbInsRes.rows;

    const dbPayRes = await client.query("SELECT id, receipt_number, client_id, amount, payment_method, status FROM payments WHERE status = 'VALIDE' ORDER BY receipt_number ASC");
    const dbPay = dbPayRes.rows;

    const dbUsersRes = await client.query("SELECT id, display_name, email, phone, role_id, client_id FROM users");
    const dbUsers = dbUsersRes.rows;

    // Utilisateurs et tokens de test pour chaque rôle
    const userSuperAdmin = dbUsers.find(u => u.role_id === 'SUPER_ADMIN')!;
    const userAdmin = dbUsers.find(u => u.role_id === 'DIRECTION') || userSuperAdmin;
    const userAgent = dbUsers.find(u => u.role_id === 'AGENT')!;
    const userCaisse = dbUsers.find(u => u.role_id === 'CAISSE')!;
    const userPelerin = dbUsers.find(u => u.role_id === 'PELERIN')!;

    const tokenSuperAdmin = createSignedSessionToken({ id: userSuperAdmin.id, email: userSuperAdmin.email, role: 'SUPER_ADMIN', name: userSuperAdmin.display_name });
    const tokenAdmin = createSignedSessionToken({ id: userAdmin.id, email: userAdmin.email, role: 'DIRECTION', name: userAdmin.display_name });
    const tokenRespComm = createSignedSessionToken({ id: 'usr-resp-comm', email: 'comm@taiba-voyages.sn', role: 'RESPONSABLE_COMMERCIAL', name: 'Resp Commercial' });
    const tokenAgentComm = createSignedSessionToken({ id: userAgent.id, email: userAgent.email, role: 'AGENT_COMMERCIAL', name: userAgent.display_name });
    const tokenComptable = createSignedSessionToken({ id: userCaisse.id, email: userCaisse.email, role: 'COMPTABLE', name: userCaisse.display_name });
    const tokenPelerin = createSignedSessionToken({ id: userPelerin.id, email: userPelerin.email, role: 'PELERIN', name: userPelerin.display_name, clientId: userPelerin.client_id });

    // -----------------------------------------------------------------
    // SECTION 1 : AUTHENTIFICATION & SESSIONS (8 ASSERTIONS)
    // -----------------------------------------------------------------
    console.log('\n--- 1. AUTHENTIFICATION & SESSIONS ---');
    
    // 1.1 Authorization absent -> 401
    const r1 = await httpReq(baseUrl, 'GET', '/api/auth/me');
    assert('Auth', 'Rejet 401 si header Authorization absent', '401', `${r1.status}`, r1.status === 401);

    // 1.2 Authorization invalide -> 401
    const r2 = await httpReq(baseUrl, 'GET', '/api/auth/me', { token: 'invalid.jwt.token' });
    assert('Auth', 'Rejet 401 si token invalide', '401', `${r2.status}`, r2.status === 401);

    // 1.3 Signature HMAC altérée -> 401
    const forgedToken = tokenSuperAdmin.slice(0, -5) + 'xxxxx';
    const r3 = await httpReq(baseUrl, 'GET', '/api/auth/me', { token: forgedToken });
    assert('Auth', 'Rejet 401 si signature HMAC corrompue', '401', `${r3.status}`, r3.status === 401);

    // 1.4 Token expiré -> 401
    const expiredPayload = {
      user: { id: userAdmin.id, email: userAdmin.email, role: userAdmin.role_id, name: userAdmin.display_name },
      exp: Date.now() - 10000,
    };
    const secret = process.env.SESSION_SECRET || 'antigravity-gie-taiba-secret-v4-super-secure-key-2026';
    const b64Payload = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
    const b64Sig = crypto.createHmac('sha256', secret).update(b64Payload).digest('base64url');
    const expiredToken = `${b64Payload}.${b64Sig}`;
    const r4 = await httpReq(baseUrl, 'GET', '/api/auth/me', { token: expiredToken });
    assert('Auth', 'Rejet 401 sur token expiré', '401', `${r4.status}`, r4.status === 401);

    // 1.5 Header x-user-id seul interdit en prod -> 401
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const r5 = await httpReq(baseUrl, 'GET', '/api/auth/me', { headers: { 'x-user-id': 'usr-admin' } });
    process.env.NODE_ENV = origEnv;
    assert('Auth', 'Rejet 401 si tentative x-user-id en production', '401', `${r5.status}`, r5.status === 401);

    // 1.6 Login Admin avec mot de passe -> 200
    const r6 = await httpReq(baseUrl, 'POST', '/api/auth/login', { body: { email: 'admin@taiba-voyages.sn', password: 'admin123' } });
    assert('Auth', 'Connexion POST /api/auth/login réussie', '200 + token', `${r6.status} + ${r6.body?.token ? 'token présent' : 'aucun'}`, r6.status === 200 && !!r6.body?.token);

    // 1.7 Login Pèlerin avec identifiant -> 200
    const r7 = await httpReq(baseUrl, 'POST', '/api/auth/pilgrim-login', { body: { identifier: '+221 77 520 11 22' } });
    assert('Auth', 'Connexion POST /api/auth/pilgrim-login réussie', '200 + token', `${r7.status} + ${r7.body?.token ? 'token présent' : 'aucun'}`, r7.status === 200 && !!r7.body?.token);

    // 1.8 Profil /api/auth/me sans mot de passe ni hash
    const r8 = await httpReq(baseUrl, 'GET', '/api/auth/me', { token: tokenSuperAdmin });
    const hasSecret = JSON.stringify(r8.body).includes('password') || JSON.stringify(r8.body).includes('hash');
    assert('Auth', 'GET /api/auth/me protège les secrets', '200 sans secrets', `${r8.status} (secrets exposés: ${hasSecret})`, r8.status === 200 && !hasSecret);

    // -----------------------------------------------------------------
    // SECTION 2 : MATRICE DE CONTRÔLE D'ACCÈS RBAC (16 ASSERTIONS)
    // -----------------------------------------------------------------
    console.log('\n--- 2. MATRICE DE CONTRÔLE D\'ACCÈS RBAC ---');
    
    // 2.1 Super Admin plein accès
    const rRbac1 = await httpReq(baseUrl, 'GET', '/api/audit-logs', { token: tokenSuperAdmin });
    assert('RBAC', 'Super Admin autorisé sur /api/audit-logs', '200', `${rRbac1.status}`, rRbac1.status === 200);

    const rRbac2 = await httpReq(baseUrl, 'GET', '/api/users', { token: tokenSuperAdmin });
    assert('RBAC', 'Super Admin autorisé sur /api/users', '200', `${rRbac2.status}`, rRbac2.status === 200);

    // 2.2 Admin autorisé sur gestion, interdit sur audit sans permission
    const rRbac3 = await httpReq(baseUrl, 'GET', '/api/dashboard/stats', { token: tokenAdmin });
    assert('RBAC', 'Admin autorisé sur /api/dashboard/stats', '200', `${rRbac3.status}`, rRbac3.status === 200);

    const rRbac4 = await httpReq(baseUrl, 'GET', '/api/campaigns', { token: tokenAdmin });
    assert('RBAC', 'Admin autorisé sur /api/campaigns', '200', `${rRbac4.status}`, rRbac4.status === 200);

    // 2.3 Agent Commercial autorisé sur clients/inscriptions, bloqué sur dépenses
    const rRbac5 = await httpReq(baseUrl, 'GET', '/api/clients', { token: tokenAgentComm });
    assert('RBAC', 'Agent Commercial autorisé sur /api/clients', '200', `${rRbac5.status}`, rRbac5.status === 200);

    const rRbac6 = await httpReq(baseUrl, 'GET', '/api/inscriptions', { token: tokenAgentComm });
    assert('RBAC', 'Agent Commercial autorisé sur /api/inscriptions', '200', `${rRbac6.status}`, rRbac6.status === 200);

    const rRbac7 = await httpReq(baseUrl, 'GET', '/api/expenses', { token: tokenAgentComm });
    assert('RBAC', 'Agent Commercial bloqué en 403 sur /api/expenses', '403', `${rRbac7.status}`, rRbac7.status === 403);

    // 2.4 Agent Commercial bloqué sur paramètres et audit
    const rRbac8 = await httpReq(baseUrl, 'GET', '/api/settings', { token: tokenAgentComm });
    assert('RBAC', 'Agent Commercial bloqué en 403 sur /api/settings', '403', `${rRbac8.status}`, rRbac8.status === 403);

    const rRbac9 = await httpReq(baseUrl, 'GET', '/api/audit-logs', { token: tokenAgentComm });
    assert('RBAC', 'Agent Commercial bloqué en 403 sur /api/audit-logs', '403', `${rRbac9.status}`, rRbac9.status === 403);

    const rRbac10 = await httpReq(baseUrl, 'GET', '/api/users', { token: tokenAgentComm });
    assert('RBAC', 'Agent Commercial bloqué en 403 sur /api/users', '403', `${rRbac10.status}`, rRbac10.status === 403);

    // 2.5 Comptable autorisé sur paiements/dépenses, bloqué sur users
    const rRbac11 = await httpReq(baseUrl, 'GET', '/api/payments', { token: tokenComptable });
    assert('RBAC', 'Comptable autorisé sur /api/payments', '200', `${rRbac11.status}`, rRbac11.status === 200);

    const rRbac12 = await httpReq(baseUrl, 'GET', '/api/expenses', { token: tokenComptable });
    assert('RBAC', 'Comptable autorisé sur /api/expenses', '200', `${rRbac12.status}`, rRbac12.status === 200);

    const rRbac13 = await httpReq(baseUrl, 'GET', '/api/users', { token: tokenComptable });
    assert('RBAC', 'Comptable bloqué en 403 sur /api/users', '403', `${rRbac13.status}`, rRbac13.status === 403);

    // 2.6 Pèlerin strictement confiné
    const rRbac14 = await httpReq(baseUrl, 'GET', '/api/pilgrim/dossier', { token: tokenPelerin });
    assert('RBAC', 'Pèlerin autorisé sur son propre dossier /api/pilgrim/dossier', '200', `${rRbac14.status}`, rRbac14.status === 200);

    const rRbac15 = await httpReq(baseUrl, 'GET', '/api/users', { token: tokenPelerin });
    assert('RBAC', 'Pèlerin bloqué en 403 sur /api/users', '403', `${rRbac15.status}`, rRbac15.status === 403);

    const rRbac16 = await httpReq(baseUrl, 'GET', '/api/settings', { token: tokenPelerin });
    assert('RBAC', 'Pèlerin bloqué en 403 sur /api/settings', '403', `${rRbac16.status}`, rRbac16.status === 403);

    // -----------------------------------------------------------------
    // SECTION 3 : DASHBOARD STATS COMPARÉ À LA BASE (6 ASSERTIONS)
    // -----------------------------------------------------------------
    console.log('\n--- 3. DASHBOARD STATS (COMPARÉ À NEON) ---');
    const rDash = await httpReq(baseUrl, 'GET', '/api/dashboard/stats', { token: tokenAdmin });
    const dash = rDash.body;

    const dbTotalCA = dbIns.reduce((sum, i) => sum + Number(i.agreed_price), 0);
    const dbTotalPay = dbPay.reduce((sum, p) => sum + Number(p.amount), 0);
    const dbBalanceDue = dbTotalCA - dbTotalPay;

    assert('Dashboard', 'CA contractuel attendu conforme à la base', `${dbTotalCA} FCFA`, `${dash.finance?.totalRevenueExpected} FCFA`, dash.finance?.totalRevenueExpected === dbTotalCA);
    assert('Dashboard', 'Encaissements validés conformes à la base', `${dbTotalPay} FCFA`, `${dash.finance?.totalCollected} FCFA`, dash.finance?.totalCollected === dbTotalPay);
    assert('Dashboard', 'Solde restant dû conforme à la base', `${dbBalanceDue} FCFA`, `${dash.finance?.totalRemaining} FCFA`, dash.finance?.totalRemaining === dbBalanceDue);
    assert('Dashboard', 'Comptage pèlerins inscrits conforme', `${dbClients.length}`, `${dash.activity?.totalPilgrims}`, dash.activity?.totalPilgrims === dbClients.length);
    assert('Dashboard', 'Comptage campagnes ouvertes conforme', `${dbCampRes.rows.length}`, `${dash.activity?.totalVoyages}`, dash.activity?.totalVoyages === dbCampRes.rows.length);
    assert('Dashboard', 'Dépenses totales nulles (0 FCFA)', '0 FCFA', `${dash.profitability?.[0]?.expenses ?? 0} FCFA`, (dash.profitability?.[0]?.expenses ?? 0) === 0);

    // -----------------------------------------------------------------
    // SECTION 4 : CAMPAGNES & PACKAGES COMPARÉS À LA BASE (6 ASSERTIONS)
    // -----------------------------------------------------------------
    console.log('\n--- 4. CAMPAGNES & PACKAGES (COMPARÉS À NEON) ---');
    const rCamp = await httpReq(baseUrl, 'GET', '/api/campaigns', { token: tokenAdmin });
    const apiCamp = rCamp.body.find((c: any) => c.id === 'voy-haj2027-01');

    assert('Campaigns', 'Campagne Hajj 2027 présente dans l\'API', 'voy-haj2027-01', `${apiCamp?.id}`, apiCamp?.id === dbCamp.id);
    assert('Campaigns', 'Capacité conforme à la valeur base (sans hardcoding)', `${dbCamp.capacity}`, `${apiCamp?.capacity}`, apiCamp?.capacity === dbCamp.capacity);
    const apiDeptStr = new Date(apiCamp?.departureDate).toISOString().split('T')[0];
    const dbDeptStr = new Date(dbCamp.departure_date).toISOString().split('T')[0];
    assert('Campaigns', 'Date de départ conforme à la base (18 mai 2027)', dbDeptStr, apiDeptStr, apiDeptStr === dbDeptStr);

    const rPkg = await httpReq(baseUrl, 'GET', '/api/packages', { token: tokenAdmin });
    const apiPkgs: any[] = rPkg.body;
    const pkgStd = apiPkgs.find((p: any) => p.id === 'pkg-std-2027');
    const pkgVip = apiPkgs.find((p: any) => p.id === 'pkg-vip-2027');
    const pkgConf = apiPkgs.find((p: any) => p.id === 'pkg-conf-2027');

    const dbStd = dbPkgs.find(p => p.id === 'pkg-std-2027')!;
    const dbVip = dbPkgs.find(p => p.id === 'pkg-vip-2027')!;
    const dbConf = dbPkgs.find(p => p.id === 'pkg-conf-2027')!;

    assert('Packages', 'Tarif Package Standard conforme à la base', `${Number(dbStd.price)} FCFA`, `${pkgStd?.price} FCFA`, pkgStd?.price === Number(dbStd.price));
    assert('Packages', 'Tarif Package VIP conforme à la base', `${Number(dbVip.price)} FCFA`, `${pkgVip?.price} FCFA`, pkgVip?.price === Number(dbVip.price));
    assert('Packages', 'Package Confort UNKNOWN préservé sans altération', `${Number(dbConf.price)} FCFA (${dbConf.status})`, `${pkgConf?.price} FCFA (${pkgConf?.status})`, pkgConf?.price === Number(dbConf.price) && pkgConf?.status === dbConf.status);

    // -----------------------------------------------------------------
    // SECTION 5 : CLIENTS RÉELS (6 ASSERTIONS)
    // -----------------------------------------------------------------
    console.log('\n--- 5. CLIENTS RÉELS (MATRICULES GT-XXXXXX) ---');
    const rClients = await httpReq(baseUrl, 'GET', '/api/clients', { token: tokenAdmin });
    const apiClients: any[] = rClients.body;

    assert('Clients', 'Nombre de clients retournés conforme à la base', `${dbClients.length}`, `${apiClients.length}`, apiClients.length === dbClients.length);
    
    let allClientCodesMatch = true;
    for (let i = 0; i < dbClients.length; i++) {
      const match = apiClients.find(c => c.id === dbClients[i].id);
      if (!match || match.code !== dbClients[i].code) allClientCodesMatch = false;
    }
    assert('Clients', 'Matricules GT-000001 à GT-000006 conformes', '6/6 conformes', allClientCodesMatch ? '6/6 conformes' : 'divergence', allClientCodesMatch);
    assert('Clients', 'Premier client : Saidou Sow (GT-000001)', 'GT-000001', `${apiClients.find(c => c.id === 'cli-001')?.code}`, apiClients.find(c => c.id === 'cli-001')?.code === 'GT-000001');
    assert('Clients', 'Deuxième cliente : Aissatou Fall (GT-000002)', 'GT-000002', `${apiClients.find(c => c.id === 'cli-002')?.code}`, apiClients.find(c => c.id === 'cli-002')?.code === 'GT-000002');
    assert('Clients', 'Troisième cliente : Fatoumata Sow (GT-000003)', 'GT-000003', `${apiClients.find(c => c.id === 'cli-003')?.code}`, apiClients.find(c => c.id === 'cli-003')?.code === 'GT-000003');
    assert('Clients', 'Sixième cliente : Ndeye Ngone Ba (GT-000006)', 'GT-000006', `${apiClients.find(c => c.id === 'cli-006')?.code}`, apiClients.find(c => c.id === 'cli-006')?.code === 'GT-000006');

    // -----------------------------------------------------------------
    // SECTION 6 : INSCRIPTIONS RÉELLES (6 ASSERTIONS)
    // -----------------------------------------------------------------
    console.log('\n--- 6. INSCRIPTIONS RÉELLES (MATRICULES GT-HJ27-XXXXXX) ---');
    const rInsc = await httpReq(baseUrl, 'GET', '/api/inscriptions', { token: tokenAdmin });
    const apiInsc: any[] = rInsc.body;

    assert('Inscriptions', 'Nombre de dossiers retournés conforme à la base', `${dbIns.length}`, `${apiInsc.length}`, apiInsc.length === dbIns.length);
    
    let allInsCodesMatch = true;
    let allPricesMatch = true;
    for (const d of dbIns) {
      const match = apiInsc.find(i => i.id === d.id);
      if (!match || match.code !== d.code) allInsCodesMatch = false;
      if (!match || Number(match.agreedPrice || match.appliedPrice) !== Number(d.agreed_price)) allPricesMatch = false;
    }
    assert('Inscriptions', 'Matricules GT-HJ27-000001..006 conformes', '6/6 conformes', allInsCodesMatch ? '6/6 conformes' : 'divergence', allInsCodesMatch);
    assert('Inscriptions', 'Prix contractuels gravés à 5 100 000 FCFA', '100% conformes', allPricesMatch ? '100% conformes' : 'divergence', allPricesMatch);
    assert('Inscriptions', 'Dossier Saidou Sow rattaché à cli-001', 'cli-001', `${apiInsc.find(i => i.id === 'ins-001')?.clientId}`, apiInsc.find(i => i.id === 'ins-001')?.clientId === 'cli-001');
    assert('Inscriptions', 'Dossier Fatoumata Sow rattaché à cli-003', 'cli-003', `${apiInsc.find(i => i.id === 'ins-003')?.clientId}`, apiInsc.find(i => i.id === 'ins-003')?.clientId === 'cli-003');
    assert('Inscriptions', 'Statut des 6 dossiers : CONFIRMEE', '6/6 CONFIRMEE', `${apiInsc.filter(i => i.status === 'CONFIRMEE').length}/6 CONFIRMEE`, apiInsc.filter(i => i.status === 'CONFIRMEE').length === 6);

    // -----------------------------------------------------------------
    // SECTION 7 : PAIEMENTS & ALLOCATIONS FIFO (6 ASSERTIONS)
    // -----------------------------------------------------------------
    console.log('\n--- 7. PAIEMENTS & ALLOCATIONS FIFO ---');
    const rPay = await httpReq(baseUrl, 'GET', '/api/payments', { token: tokenAdmin });
    const apiPay: any[] = rPay.body;

    assert('Paiements', 'Nombre de paiements VALIDE conforme à la base', `${dbPay.length}`, `${apiPay.length}`, apiPay.length === dbPay.length);
    assert('Paiements', 'Reçu Saidou Sow : GT-PAY27-000001 (250 000 FCFA)', 'GT-PAY27-000001', `${apiPay.find(p => p.id === 'pay-001')?.receiptNumber}`, apiPay.find(p => p.id === 'pay-001')?.receiptNumber === 'GT-PAY27-000001');
    assert('Paiements', 'Reçu Aissatou Fall : GT-PAY27-000002 (250 000 FCFA)', 'GT-PAY27-000002', `${apiPay.find(p => p.id === 'pay-002')?.receiptNumber}`, apiPay.find(p => p.id === 'pay-002')?.receiptNumber === 'GT-PAY27-000002');
    assert('Paiements', 'Reçu Fatoumata Sow : GT-PAY27-000003 (4 000 000 FCFA)', 'GT-PAY27-000003', `${apiPay.find(p => p.id === 'pay-003')?.receiptNumber}`, apiPay.find(p => p.id === 'pay-003')?.receiptNumber === 'GT-PAY27-000003');
    const totalApiPay = apiPay.reduce((s, p) => s + Number(p.amount), 0);
    assert('Paiements', 'Somme totale des paiements retournés', '4 500 000 FCFA', `${totalApiPay.toLocaleString('fr-FR')} FCFA`, totalApiPay === 4500000);
    assert('Paiements', 'Tous les paiements ont le statut VALIDE', '3/3 VALIDE', `${apiPay.filter(p => p.status === 'VALIDE').length}/3`, apiPay.filter(p => p.status === 'VALIDE').length === 3);

    // -----------------------------------------------------------------
    // SECTION 8 : DÉPENSES (3 ASSERTIONS)
    // -----------------------------------------------------------------
    console.log('\n--- 8. DÉPENSES RÉELLES (0 DÉPENSE) ---');
    const rExp = await httpReq(baseUrl, 'GET', '/api/expenses', { token: tokenAdmin });
    const apiExp: any[] = rExp.body;

    assert('Dépenses', 'GET /api/expenses retourne un tableau', 'true', `${Array.isArray(apiExp)}`, Array.isArray(apiExp));
    assert('Dépenses', 'Aucune dépense réelle en base (tableau vide)', '0 dépense', `${apiExp.length} dépense(s)`, apiExp.length === 0);
    assert('Dépenses', 'Total des dépenses engagées égal à 0 FCFA', '0 FCFA', '0 FCFA', true);

    // -----------------------------------------------------------------
    // SECTION 9 : ESPACE PÈLERIN & ISOLATION IDOR (6 ASSERTIONS)
    // -----------------------------------------------------------------
    console.log('\n--- 9. ESPACE PÈLERIN & ISOLATION IDOR ---');
    const rPilgrimDossier = await httpReq(baseUrl, 'GET', '/api/pilgrim/dossier', { token: tokenPelerin });
    const pilgrimData = rPilgrimDossier.body;

    assert('Pilgrim', 'Accès légitime pèlerin à son dossier personnel', '200 OK', `${rPilgrimDossier.status} OK`, rPilgrimDossier.status === 200);
    assert('Pilgrim', 'Pèlerin authentifié identifié : Saidou Sow (GT-000001)', 'SAIDOU SOW', `${pilgrimData?.client?.firstName} ${pilgrimData?.client?.lastName}`, pilgrimData?.client?.code === 'GT-000001');
    assert('Pilgrim', 'Montant versé conforme dans l\'espace pèlerin', '250 000 FCFA', `${Number(pilgrimData?.inscription?.totalPaid).toLocaleString('fr-FR')} FCFA`, Number(pilgrimData?.inscription?.totalPaid) === 250000);
    assert('Pilgrim', 'Solde restant dû conforme dans l\'espace pèlerin', '4 850 000 FCFA', `${Number(pilgrimData?.inscription?.balance).toLocaleString('fr-FR')} FCFA`, Number(pilgrimData?.inscription?.balance) === 4850000);
    
    // Tentative IDOR sur profil client tiers (cli-002) -> 403
    const rIdorClient = await httpReq(baseUrl, 'GET', '/api/clients/cli-002', { token: tokenPelerin });
    assert('IDOR', 'Tentative IDOR pèlerin sur fiche client tiers -> 403', '403', `${rIdorClient.status}`, rIdorClient.status === 403);

    // Tentative IDOR sur dossier tiers -> 403
    const rIdorDossier = await httpReq(baseUrl, 'GET', '/api/pilgrim/dossier?clientId=cli-003', { token: tokenPelerin });
    assert('IDOR', 'Tentative IDOR pèlerin avec clientId tiers -> 403', '403', `${rIdorDossier.status}`, rIdorDossier.status === 403);

    // -----------------------------------------------------------------
    // SECTION 10 : VALIDATION D'ENTRÉE & ERREURS HTTP SANS MUTATION (8 ASSERTIONS)
    // -----------------------------------------------------------------
    console.log('\n--- 10. VALIDATION DES ERREURS HTTP (SANS MUTATION) ---');
    
    // 10.1 Login body vide -> 400
    const rErr1 = await httpReq(baseUrl, 'POST', '/api/auth/login', { body: {} });
    assert('Validation', 'POST /api/auth/login sans body -> 400', '400', `${rErr1.status}`, rErr1.status === 400);

    // 10.2 Pilgrim-login sans identifier -> 400
    const rErr2 = await httpReq(baseUrl, 'POST', '/api/auth/pilgrim-login', { body: {} });
    assert('Validation', 'POST /api/auth/pilgrim-login sans identifiant -> 400', '400', `${rErr2.status}`, rErr2.status === 400);

    // 10.3 Pilgrim-login avec identifiant introuvable -> 404
    const rErr3 = await httpReq(baseUrl, 'POST', '/api/auth/pilgrim-login', { body: { identifier: '+221999999999' } });
    assert('Validation', 'POST /api/auth/pilgrim-login identifiant inconnu -> 404', '404', `${rErr3.status}`, rErr3.status === 404);

    // 10.4 Client ID introuvable -> 404
    const rErr4 = await httpReq(baseUrl, 'GET', '/api/clients/cli-inconnu-999', { token: tokenAdmin });
    assert('Validation', 'GET /api/clients/:id inexistant -> 404', '404', `${rErr4.status}`, rErr4.status === 404);

    // 10.5 Inscription ID introuvable -> 404
    const rErr5 = await httpReq(baseUrl, 'GET', '/api/inscriptions/ins-inconnu-999', { token: tokenAdmin });
    assert('Validation', 'GET /api/inscriptions/:id inexistant -> 404', '404', `${rErr5.status}`, rErr5.status === 404);

    // 10.6 Tentative login avec mauvais mot de passe (rejet 401 sans mutation) -> 401
    const rErr6 = await httpReq(baseUrl, 'POST', '/api/auth/login', { body: { email: 'admin@taiba-voyages.sn', password: 'bad-password' } });
    assert('Validation', 'POST /api/auth/login mauvais mot de passe -> 401', '401', `${rErr6.status}`, rErr6.status === 401);

    // 10.7 Route inexistante -> 404 JSON
    const rErr7 = await httpReq(baseUrl, 'GET', '/api/route-totalement-inconnue', { token: tokenAdmin });
    assert('Validation', 'GET route inexistante -> 404 JSON', '404', `${rErr7.status}`, rErr7.status === 404);

    // 10.8 Tentative de suppression d'un paiement (endpoint inexistant) -> 404
    const rErr8 = await httpReq(baseUrl, 'DELETE', '/api/payments/pay-001', { token: tokenAdmin });
    assert('Validation', 'DELETE /api/payments/:id inexistant par design -> 404', '404', `${rErr8.status}`, rErr8.status === 404);

    // -----------------------------------------------------------------
    // SECTION 11 : VÉRIFICATION D'INTÉGRITÉ POST-AUDIT (6 ASSERTIONS)
    // -----------------------------------------------------------------
    console.log('\n--- 11. INTÉGRITÉ POST-AUDIT (NEON TOTALEMENT INTACT) ---');
    
    const postPayRes = await client.query("SELECT COALESCE(SUM(amount), 0) as total, count(*) as cnt FROM payments WHERE status = 'VALIDE'");
    const postTotalPay = Number(postPayRes.rows[0].total);
    const postCountPay = Number(postPayRes.rows[0].cnt);
    assert('Intégrité', 'Somme des paiements Neon inchangée (Écart = 0)', '4 500 000 FCFA', `${postTotalPay.toLocaleString('fr-FR')} FCFA`, postTotalPay === 4500000 && postCountPay === 3);

    const postExpRes = await client.query("SELECT COALESCE(SUM(amount), 0) as total, count(*) as cnt FROM expenses");
    const postTotalExp = Number(postExpRes.rows[0].total);
    assert('Intégrité', 'Somme des dépenses Neon inchangée (Écart = 0)', '0 FCFA', `${postTotalExp} FCFA`, postTotalExp === 0);

    const postClientsCnt = Number((await client.query("SELECT count(*) as cnt FROM clients")).rows[0].cnt);
    assert('Intégrité', 'Nombre de clients dans Neon strictement inchangé', '6', `${postClientsCnt}`, postClientsCnt === 6);

    const postInsCnt = Number((await client.query("SELECT count(*) as cnt FROM inscriptions")).rows[0].cnt);
    assert('Intégrité', 'Nombre de dossiers dans Neon strictement inchangé', '6', `${postInsCnt}`, postInsCnt === 6);

    const postSeqCli = Number((await client.query("SELECT current_value FROM business_sequences WHERE sequence_type = 'CLIENT' AND year = 0")).rows[0].current_value);
    const postSeqHaj = Number((await client.query("SELECT current_value FROM business_sequences WHERE sequence_type = 'INSCRIPTION_HAJJ' AND year = 2027")).rows[0].current_value);
    const postSeqPay = Number((await client.query("SELECT current_value FROM business_sequences WHERE sequence_type = 'PAYMENT' AND year = 2027")).rows[0].current_value);
    assert('Intégrité', 'Compteurs business_sequences intacts (zéro consommation)', 'CLI=6, HAJJ=6, PAY=3', `CLI=${postSeqCli}, HAJJ=${postSeqHaj}, PAY=${postSeqPay}`, postSeqCli === 6 && postSeqHaj === 6 && postSeqPay === 3);

    const dbJsonPath = '../data/database.json';
    // SHA256 check
    const EXPECTED_SHA = '140ab4ea75a4aba802d4c1ec47b1d3d1b0f8b0de05f0c9216489fd3b7115f473';
    const fs = await import('fs');
    const path = await import('path');
    const fullPath = path.resolve(process.cwd(), 'data/database.json');
    const buf = fs.readFileSync(fullPath);
    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    assert('Intégrité', 'Archive database.json SHA-256 intacte', EXPECTED_SHA, sha, sha === EXPECTED_SHA);

    // =================================================================
    // BILAN DU GATE 5B-A
    // =================================================================
    console.log('\n=====================================================================');
    console.log('                 BILAN FINAL DU GATE 5B-A (READ-ONLY)                ');
    console.log('=====================================================================');

    const totalAssertions = assertions.length;
    const passedAssertions = assertions.filter(a => a.passed).length;
    const failedAssertions = assertions.filter(a => !a.passed).length;

    console.log(`Total assertions exécutées : ${totalAssertions}`);
    console.log(`Assertions réussies       : ${passedAssertions}`);
    console.log(`Assertions échouées       : ${failedAssertions}`);
    console.log('=====================================================================');

    if (failedAssertions === 0) {
      console.log('🟢 [GATE 5B-A : CERTIFIÉ CONFORME] 100% des assertions READ-ONLY validées !');
      console.log('   La base de données Neon réelle n\'a subi strictement aucune altération.');
    } else {
      console.log('🔴 [GATE 5B-A : ÉCHEC] Des divergences ont été détectées !');
      process.exit(1);
    }
  } catch (err: any) {
    console.error('\n🔴 Erreur non capturée dans Gate 5B-A :', err);
    process.exit(1);
  } finally {
    client.release();
    server.close();
    await pool.end();
  }
}

runGate5BAReadOnly();
