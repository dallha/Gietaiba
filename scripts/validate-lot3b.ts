#!/usr/bin/env tsx
import 'dotenv/config';

const PROD_URL = 'https://gietaiba.onrender.com';
let pass = 0; let fail = 0;

function ok(label: string, detail = '') { console.log(`  ✅ PASS  ${label}${detail ? ' — ' + detail : ''}`); pass++; }
function ko(label: string, detail = '') { console.error(`  ❌ FAIL  ${label}${detail ? ' — ' + detail : ''}`); fail++; }
function section(t: string) { console.log(`\n${'─'.repeat(60)}\n§ ${t}\n${'─'.repeat(60)}`); }

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

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   LOT 3B — TESTS AUTOMATISÉS : BRIDGE /api/auth/me       ║');
  console.log(`║   ${new Date().toISOString()}                    ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  section('1. Vérification du Bridge (sans session active)');
  await testRoute('GET', '/api/auth/me', 'NEON_SESSION_INVALID');

  section('2. Routes Financières Intactes (Sanctuaire)');
  await testRoute('GET', '/api/inscriptions', 'AUTH_REQUIRED');
  await testRoute('GET', '/api/payments', 'AUTH_REQUIRED');
  await testRoute('GET', '/api/expenses', 'AUTH_REQUIRED');
  await testRoute('POST', '/api/pilgrim/payments', 'AUTH_REQUIRED');

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   RÉSUMÉ LOT 3B                                           ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║   ✅ PASS : ${String(pass).padEnd(3)}  ❌ FAIL : ${String(fail).padEnd(3)}                              ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  process.exit(fail > 0 ? 1 : 0);
}
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
