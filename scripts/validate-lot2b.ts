#!/usr/bin/env tsx
import 'dotenv/config';
import { pool } from '../server/db/neon.js';

const PROD_URL = 'https://gietaiba.onrender.com';
let pass = 0; let fail = 0;

function ok(label: string, detail = '') { console.log(`  ✅ PASS  ${label}${detail ? ' — ' + detail : ''}`); pass++; }
function ko(label: string, detail = '') { console.error(`  ❌ FAIL  ${label}${detail ? ' — ' + detail : ''}`); fail++; }
function warn(label: string, detail = '') { console.warn(`  ⚠️ WARN  ${label}${detail ? ' — ' + detail : ''}`); }
function section(t: string) { console.log(`\n${'─'.repeat(60)}\n§ ${t}\n${'─'.repeat(60)}`); }

const LOT2B_ROUTES = [
  { method: 'GET',    path: '/api/flights' },
  { method: 'POST',   path: '/api/flights' },
  { method: 'GET',    path: '/api/tickets' },
  { method: 'POST',   path: '/api/tickets' },
  { method: 'GET',    path: '/api/hotels' },
  { method: 'POST',   path: '/api/hotels' },
  { method: 'GET',    path: '/api/rooms' },
  { method: 'POST',   path: '/api/rooms' },
  { method: 'POST',   path: '/api/rooms/fake-id/assign' },
  { method: 'DELETE', path: '/api/rooms/fake-id/occupants/fake-client' },
  { method: 'GET',    path: '/api/groups' },
  { method: 'POST',   path: '/api/groups' },
  { method: 'POST',   path: '/api/groups/fake-id/members' },
  { method: 'GET',    path: '/api/accompagnateurs' },
];

const PREVIOUS_ROUTES = [
  { method: 'GET', path: '/api/roles' },
  { method: 'GET', path: '/api/voyages' },
];

const UNTOUCHED_ROUTES = [
  { method: 'GET',  path: '/api/clients' },
  { method: 'GET',  path: '/api/documents' },
  { method: 'GET',  path: '/api/expenses' },
];

async function testRoute(method: string, path: string, expectedCode: string): Promise<boolean> {
  try {
    const r = await fetch(`${PROD_URL}${path}`, { method, signal: AbortSignal.timeout(12000), headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }});
    if (r.status === 401) {
      const body = await r.json().catch(() => ({})) as any;
      const code = body.code ?? '?';
      if (code === expectedCode) { ok(`${method} ${path} → 401 ${code}`); return true; } 
      else { ko(`${method} ${path} → 401 mais code inattendu`, `obtenu: ${code}, attendu: ${expectedCode}`); return false; }
    } else { ko(`${method} ${path} → HTTP ${r.status}`, `attendu: 401`); return false; }
  } catch (e: any) { ko(`${method} ${path} → réseau`, e.message); return false; }
}

async function checkInvariants(step: string) {
  section(`${step}. Invariants DB (READ-ONLY)`);
  try {
    const snap = await pool.query(`SELECT
      (SELECT COUNT(*) FROM campaigns) AS voyages,
      (SELECT COUNT(*) FROM packages)  AS packages,
      (SELECT COUNT(*) FROM inscriptions) AS inscriptions,
      (SELECT COUNT(*) FROM payments WHERE status='VALIDE') AS paiements`);
    const s = snap.rows[0];
    const EXPECTED = { voyages: '1', packages: '3', inscriptions: '6', paiements: '3' };
    for (const [k, v] of Object.entries(EXPECTED)) {
      if (s[k] === v) ok(`${k} = ${v} (inchangé)`);
      else ko(`${k} a changé`, `attendu ${v}, obtenu ${s[k]}`);
    }
  } catch (e: any) {
    warn(`Impossible de vérifier les invariants DB depuis cet environnement (Réseau/DNS Neon)`);
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   LOT 2B — TESTS AUTOMATISÉS : LOGISTIQUE                ║');
  console.log(`║   ${new Date().toISOString()}                    ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  await checkInvariants('1');

  section('2. Lot 2B : 401 NEON_SESSION_INVALID (sans session)');
  for (const { method, path } of LOT2B_ROUTES) { await testRoute(method, path, 'NEON_SESSION_INVALID'); }

  section('3. Non-régression Lots 1 & 2A');
  for (const { method, path } of PREVIOUS_ROUTES) { await testRoute(method, path, 'NEON_SESSION_INVALID'); }

  section('4. Routes hors périmètre (doivent rester sur requireAuth)');
  for (const { method, path } of UNTOUCHED_ROUTES) { await testRoute(method, path, 'AUTH_REQUIRED'); }

  await checkInvariants('5');

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   RÉSUMÉ LOT 2B                                           ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║   ✅ PASS : ${String(pass).padEnd(3)}  ❌ FAIL : ${String(fail).padEnd(3)}                              ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  process.exit(fail > 0 ? 1 : 0);
}
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
