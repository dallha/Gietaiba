#!/usr/bin/env tsx
/**
 * NEON-AUTH — Lot 2A : Tests automatisés Voyages & Packages
 * Vérifie 401 sur toutes les routes migrées sans session.
 * READ-ONLY absolu — aucune mutation.
 */
import 'dotenv/config';
import { pool } from '../server/db/neon.js';

const PROD_URL = 'https://gietaiba.onrender.com';
let pass = 0; let fail = 0;

function ok(label: string, detail = '') {
  console.log(`  ✅ PASS  ${label}${detail ? ' — ' + detail : ''}`);
  pass++;
}
function ko(label: string, detail = '') {
  console.error(`  ❌ FAIL  ${label}${detail ? ' — ' + detail : ''}`);
  fail++;
}
function section(t: string) {
  console.log(`\n${'─'.repeat(60)}\n§ ${t}\n${'─'.repeat(60)}`);
}

// Routes migrées Lot 2A (méthode → path)
const LOT2A_ROUTES = [
  { method: 'GET',    path: '/api/voyages' },
  { method: 'GET',    path: '/api/campaigns' },
  { method: 'POST',   path: '/api/voyages' },
  { method: 'PUT',    path: '/api/voyages/fake-id' },
  { method: 'DELETE', path: '/api/voyages/fake-id' },
  { method: 'GET',    path: '/api/packages' },
  { method: 'POST',   path: '/api/packages' },
  { method: 'PUT',    path: '/api/packages/fake-id' },
  { method: 'DELETE', path: '/api/packages/fake-id' },
  { method: 'POST',   path: '/api/packages/fake-id/new-price-version' },
];

// Routes Lot 1 — ne doivent PAS avoir régressé
const LOT1_ROUTES = [
  { method: 'GET', path: '/api/roles' },
  { method: 'GET', path: '/api/settings' },
  { method: 'GET', path: '/api/dashboard/stats' },
  { method: 'GET', path: '/api/notifications' },
];

// Routes hors périmètre — doivent retourner 401 avec l'ANCIEN code AUTH_REQUIRED
const UNTOUCHED_ROUTES = [
  { method: 'GET',  path: '/api/clients' },
  { method: 'GET',  path: '/api/flights' },
  { method: 'GET',  path: '/api/documents' },
];

async function testRoute(method: string, path: string, expectedCode: string): Promise<boolean> {
  try {
    const r = await fetch(`${PROD_URL}${path}`, {
      method,
      signal: AbortSignal.timeout(12000),
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    });
    if (r.status === 401) {
      const body = await r.json().catch(() => ({})) as any;
      const code = body.code ?? '?';
      if (code === expectedCode) {
        ok(`${method} ${path} → 401 ${code}`);
        return true;
      } else {
        ko(`${method} ${path} → 401 mais code inattendu`, `obtenu: ${code}, attendu: ${expectedCode}`);
        return false;
      }
    } else {
      ko(`${method} ${path} → HTTP ${r.status}`, `attendu: 401`);
      return false;
    }
  } catch (e: any) {
    ko(`${method} ${path} → réseau`, e.message);
    return false;
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   LOT 2A — TESTS AUTOMATISÉS : VOYAGES & PACKAGES        ║');
  console.log(`║   ${new Date().toISOString()}                    ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  // §1 — Snapshot invariants avant
  section('1. Invariants DB (READ-ONLY)');
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

  // §2 — Lot 2A : toutes les routes doivent retourner 401 NEON_SESSION_INVALID
  section('2. Lot 2A : 401 NEON_SESSION_INVALID (sans session)');
  for (const { method, path } of LOT2A_ROUTES) {
    await testRoute(method, path, 'NEON_SESSION_INVALID');
  }

  // §3 — Régression Lot 1 : doit rester NEON_SESSION_INVALID
  section('3. Non-régression Lot 1');
  for (const { method, path } of LOT1_ROUTES) {
    await testRoute(method, path, 'NEON_SESSION_INVALID');
  }

  // §4 — Routes hors périmètre : doivent rester AUTH_REQUIRED (ancien système)
  section('4. Routes hors périmètre (doivent rester sur requireAuth)');
  for (const { method, path } of UNTOUCHED_ROUTES) {
    await testRoute(method, path, 'AUTH_REQUIRED');
  }

  // §5 — Snapshot invariants après
  section('5. Invariants DB après tests (READ-ONLY)');
  const snapAfter = await pool.query(`SELECT
    (SELECT COUNT(*) FROM campaigns) AS voyages,
    (SELECT COUNT(*) FROM packages)  AS packages,
    (SELECT COUNT(*) FROM inscriptions) AS inscriptions,
    (SELECT COUNT(*) FROM payments WHERE status='VALIDE') AS paiements`);
  const sa = snapAfter.rows[0];
  for (const [k, v] of Object.entries(EXPECTED)) {
    if (sa[k] === v) ok(`${k} = ${v} (toujours inchangé)`);
    else ko(`MUTATION DÉTECTÉE sur ${k}`, `attendu ${v}, obtenu ${sa[k]}`);
  }

  // Résumé
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   RÉSUMÉ LOT 2A                                           ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║   ✅ PASS : ${String(pass).padEnd(3)}  ❌ FAIL : ${String(fail).padEnd(3)}                              ║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║   🔒 Non automatisable (nécessite session Neon réelle) :  ║');
  console.log('║   • POST /api/voyages → 403 (rôle insuffisant)            ║');
  console.log('║   • POST /api/voyages → 201 (SUPER_ADMIN + session Neon)  ║');
  console.log('║   • Vérifier actorUserName dans audit_logs après mutation  ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  if (fail > 0) {
    console.log(`\n🔴 ${fail} FAIL(s). Rollback disponible : s/requireNeonAuth/requireAuth/ sur les 9 lignes voyages/packages`);
    process.exit(1);
  } else {
    console.log('\n🟢 LOT 2A PASS — Prêt pour git push.');
    process.exit(0);
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
