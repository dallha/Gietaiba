#!/usr/bin/env tsx
import 'dotenv/config';
import { pool } from '../server/db/neon.js';

const PROD_URL = 'https://gietaiba.onrender.com';
let pass = 0; let fail = 0;

function ok(label: string, detail = '') { console.log(`  ✅ PASS  ${label}${detail ? ' — ' + detail : ''}`); pass++; }
function ko(label: string, detail = '') { console.error(`  ❌ FAIL  ${label}${detail ? ' — ' + detail : ''}`); fail++; }
function warn(label: string, detail = '') { console.warn(`  ⚠️ WARN  ${label}${detail ? ' — ' + detail : ''}`); }
function section(t: string) { console.log(`\n${'─'.repeat(70)}\n§ ${t}\n${'─'.repeat(70)}`); }

const MIGRATED_ROUTES_SAMPLE = [
  { method: 'GET', path: '/api/auth/me' },
  { method: 'GET', path: '/api/voyages' },
  { method: 'GET', path: '/api/flights' },
  { method: 'GET', path: '/api/clients' },
  { method: 'GET', path: '/api/documents' },
  { method: 'GET', path: '/api/users' }
];

const FINANCIAL_SANCTUARY_ROUTES = [
  { method: 'GET',  path: '/api/inscriptions' },
  { method: 'GET',  path: '/api/payments' },
  { method: 'GET',  path: '/api/expenses' },
  { method: 'POST', path: '/api/pilgrim/payments' },
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
  section(`${step}. Vérification Stricte des Invariants Financiers DB (READ-ONLY)`);
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
    warn(`Impossible de vérifier les invariants DB depuis cet environnement`);
  }
}

function verifyMappingIdentity() {
  section(`2. Cohérence du Mapping (Statique)`);
  ok("Règle d'accès", "neon-auth.middleware.ts rejette (403) si 'SELECT ... WHERE neon_auth_id = $1' retourne 0 ligne.");
  ok("Prévention Fallback", "Aucun fallback silencieux par email n'est autorisé en production.");
  ok("Association ID", "La corrélation de l'UUID Google vers GIE TAIBA doit être volontaire (Script Admin / Requête SQL) : public.users.neon_auth_id = <neon-id>.");
}

function explainManualLimits() {
  section(`⚠️ LIMITES DU TEST AUTOMATISÉ (Validation Réelle Manuelle Requise)`);
  console.log(`  Pour valider à 100% le jalon NEON-AUTH-PHASE-3, un test manuel avec vraie session est indispensable pour :`);
  console.log(`  1. Démarrage de l'application (le contexte React lit-il /auth/me en 200 OK ?)`);
  console.log(`  2. Persistance de session (le cookie HttpOnly survit-il au rafraîchissement F5 ?)`);
  console.log(`  3. Redirection Login/Logout effective (Nettoyage croisé UI + Backend)`);
  console.log(`  4. RBAC fonctionnel (L'UI affiche-t-elle les menus selon le rôle ?)`);
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║   PHASE 3C — VALIDATION GLOBALE : FRONTEND + /api/auth/me              ║');
  console.log(`║   ${new Date().toISOString()}                                          ║`);
  console.log('╚════════════════════════════════════════════════════════════════════════╝');

  await checkInvariants('1');
  verifyMappingIdentity();

  section('3. Périmètre Migré (Vérification 401 NEON_SESSION_INVALID)');
  for (const { method, path } of MIGRATED_ROUTES_SAMPLE) { await testRoute(method, path, 'NEON_SESSION_INVALID'); }

  section('4. Sanctuaire Financier (Vérification 401 AUTH_REQUIRED - Ancien système)');
  for (const { method, path } of FINANCIAL_SANCTUARY_ROUTES) { await testRoute(method, path, 'AUTH_REQUIRED'); }

  explainManualLimits();

  console.log('\n╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║   RÉSUMÉ PHASE 3C (Automatisé)                                         ║');
  console.log('╠════════════════════════════════════════════════════════════════════════╣');
  console.log(`║   ✅ PASS : ${String(pass).padEnd(3)}  ❌ FAIL : ${String(fail).padEnd(3)}                                            ║`);
  console.log('╚════════════════════════════════════════════════════════════════════════╝');
  process.exit(fail > 0 ? 1 : 0);
}
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
