#!/usr/bin/env tsx
import 'dotenv/config';
import { pool } from '../server/db/neon.js';
import fs from 'fs';

const PROD_URL = 'https://gietaiba.onrender.com';
let pass = 0; let fail = 0;

function ok(label: string, detail = '') { console.log(`  ✅ PASS  ${label}${detail ? ' — ' + detail : ''}`); pass++; }
function ko(label: string, detail = '') { console.error(`  ❌ FAIL  ${label}${detail ? ' — ' + detail : ''}`); fail++; }
function warn(label: string, detail = '') { console.warn(`  ⚠️ WARN  ${label}${detail ? ' — ' + detail : ''}`); }
function section(t: string) { console.log(`\n${'─'.repeat(70)}\n§ ${t}\n${'─'.repeat(70)}`); }

const ROUTES = [
  { method: 'GET',    path: '/api/inscriptions' },
  { method: 'POST',   path: '/api/inscriptions' },
  { method: 'PATCH',  path: '/api/inscriptions/fake-id/price' },
  { method: 'PUT',    path: '/api/inscriptions/fake-id/status' },
  { method: 'DELETE', path: '/api/inscriptions/fake-id' },
];

async function testRoute(method: string, path: string, expectedCode: string): Promise<boolean> {
  try {
    const r = await fetch(`${PROD_URL}${path}`, { method, signal: AbortSignal.timeout(12000), headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }});
    if (r.status === 401) {
      const body = await r.json().catch(() => ({})) as any;
      const code = body.code ?? '?';
      if (code === expectedCode) { ok(`${method} ${path} → 401 ${code}`); return true; } 
      else { ko(`${method} ${path} → 401 inattendu`, `obtenu: ${code}, attendu: ${expectedCode}`); return false; }
    } else { ko(`${method} ${path} → HTTP ${r.status}`, `attendu: 401`); return false; }
  } catch (e: any) { ko(`${method} ${path} → réseau`, e.message); return false; }
}

async function checkInvariants(step: string) {
  section(`${step}. Vérification des Invariants (READ-ONLY)`);
  try {
    const snap = await pool.query(`SELECT
      (SELECT COUNT(*) FROM inscriptions) AS total_inscriptions,
      (SELECT COUNT(*) FROM inscriptions WHERE status = 'VALIDE') AS valide_inscriptions,
      (SELECT COUNT(*) FROM payments WHERE status = 'VALIDE') AS valide_paiements,
      (SELECT COUNT(*) FROM payment_schedules) AS total_schedules`);
    const s = snap.rows[0];
    const EXPECTED = { total_inscriptions: '6', valide_inscriptions: '4', valide_paiements: '3', total_schedules: '12' };
    for (const [k, v] of Object.entries(EXPECTED)) {
      if (s[k] === v) ok(`Invariant ${k} = ${v} (inchangé)`);
      else ko(`Invariant ${k} a changé`, `attendu ${v}, obtenu ${s[k]}`);
    }
  } catch (e: any) {
    warn(`Impossible de vérifier les invariants DB depuis cet environnement`);
  }
}

function verifyStaticProtections() {
  section('2. Vérification Statique des Protections (Code Source)');
  const serverCode = fs.readFileSync('./server.ts', 'utf-8');
  const routes = [
    "app.get('/api/inscriptions', requireNeonAuth, requirePermission('inscriptions.read')",
    "app.post('/api/inscriptions', requireNeonAuth, requirePermission('inscriptions.create')",
    "app.patch('/api/inscriptions/:id/price', requireNeonAuth, requirePermission('inscriptions.update')",
    "app.put('/api/inscriptions/:id/status', requireNeonAuth, requirePermission('inscriptions.update')",
    "app.delete('/api/inscriptions/:id', requireNeonAuth, requirePermission('inscriptions.cancel')"
  ];
  
  routes.forEach(route => {
    if (serverCode.includes(route)) {
      ok(`Protection OK`, route.substring(0, 60) + '...');
    } else {
      ko(`Protection manquante ou altérée`, route);
    }
  });

  const workflowCode = fs.readFileSync('./server/services/inscription-workflow.service.ts', 'utf-8');
  if (workflowCode.includes('FOR UPDATE')) ok('Transaction Locking', 'SELECT ... FOR UPDATE toujours présent'); else ko('Transaction Locking altéré');
  if (workflowCode.includes('actor.id')) ok('Traçabilité', 'actor.id toujours utilisé pour l\'audit'); else ko('Traçabilité altérée');
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║   LOT 4B-1 — VALIDATION MIGRATION INSCRIPTIONS                         ║');
  console.log(`║   ${new Date().toISOString()}                                          ║`);
  console.log('╚════════════════════════════════════════════════════════════════════════╝');

  await checkInvariants('1');
  
  verifyStaticProtections();

  section('3. Validation Réseau (401 NEON_SESSION_INVALID attendu sans cookie)');
  for (const { method, path } of ROUTES) { await testRoute(method, path, 'NEON_SESSION_INVALID'); }

  await checkInvariants('4');

  console.log('\n╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║   RÉSUMÉ LOT 4B-1                                                      ║');
  console.log('╠════════════════════════════════════════════════════════════════════════╣');
  console.log(`║   ✅ PASS : ${String(pass).padEnd(3)}  ❌ FAIL : ${String(fail).padEnd(3)}                                            ║`);
  console.log('╚════════════════════════════════════════════════════════════════════════╝');
  process.exit(fail > 0 ? 1 : 0);
}
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
