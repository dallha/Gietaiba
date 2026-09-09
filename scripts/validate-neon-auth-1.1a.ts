#!/usr/bin/env tsx
/**
 * NEON-AUTH-1.1A — Validation automatisée complète
 * Vérifie tout ce qui peut l'être sans session Google réelle.
 * READ-ONLY sur les données métier.
 */
import 'dotenv/config';
import { pool } from '../server/db/neon.js';

// ── Helpers ────────────────────────────────────────────────────────────────
const PROD_URL = 'https://gietaiba.onrender.com';
let pass = 0; let fail = 0; let warn = 0;

function ok(label: string, detail = '') {
  console.log(`  ✅ PASS  ${label}${detail ? ' — ' + detail : ''}`);
  pass++;
}
function ko(label: string, detail = '') {
  console.error(`  ❌ FAIL  ${label}${detail ? ' — ' + detail : ''}`);
  fail++;
}
function wa(label: string, detail = '') {
  console.warn(`  ⚠️  WARN  ${label}${detail ? ' — ' + detail : ''}`);
  warn++;
}
function section(title: string) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`§ ${title}`);
  console.log('─'.repeat(60));
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   NEON-AUTH-1.1A — RAPPORT DE VALIDATION AUTOMATISÉ     ║');
  console.log(`║   ${new Date().toISOString()}                    ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  // ── §1 — Variables d'environnement ──────────────────────────────────────
  section('1. Configuration environnement');

  const NEON_AUTH_URL = process.env.NEON_AUTH_URL;
  const NEON_AUTH_COOKIE_SECRET = process.env.NEON_AUTH_COOKIE_SECRET;
  const DATABASE_URL = process.env.DATABASE_URL;

  if (NEON_AUTH_URL) ok('NEON_AUTH_URL défini', NEON_AUTH_URL.replace(/\/\/.*@/, '//***@'));
  else ko('NEON_AUTH_URL manquant — le middleware retournera 500');

  if (NEON_AUTH_COOKIE_SECRET) {
    if (NEON_AUTH_COOKIE_SECRET.length >= 32) ok('NEON_AUTH_COOKIE_SECRET défini', `longueur: ${NEON_AUTH_COOKIE_SECRET.length} chars`);
    else ko('NEON_AUTH_COOKIE_SECRET trop court', `longueur: ${NEON_AUTH_COOKIE_SECRET.length} (min 32)`);
  } else ko('NEON_AUTH_COOKIE_SECRET manquant — le middleware retournera 500');

  if (DATABASE_URL) ok('DATABASE_URL défini');
  else ko('DATABASE_URL manquant — aucune requête SQL possible');

  // ── §2 — Connectivité Neon Auth (endpoint public) ───────────────────────
  section('2. Connectivité Neon Auth (endpoint public)');

  if (NEON_AUTH_URL) {
    try {
      const jwksUrl = `${NEON_AUTH_URL}/.well-known/jwks.json`;
      const r = await fetch(jwksUrl, { signal: AbortSignal.timeout(8000) });
      if (r.ok) {
        const jwks = await r.json() as any;
        const keyCount = jwks?.keys?.length ?? 0;
        ok('JWKS endpoint accessible', `${keyCount} clé(s) JWKS retournée(s)`);
      } else ko('JWKS endpoint inaccessible', `HTTP ${r.status}`);
    } catch (e: any) { ko('JWKS endpoint inaccessible', e.message); }

    try {
      const sessionUrl = `${NEON_AUTH_URL}/api/auth/get-session`;
      const r = await fetch(sessionUrl, { signal: AbortSignal.timeout(8000) });
      // Sans cookie → doit retourner une réponse valide (session null ou 401/200)
      if (r.status === 200 || r.status === 401 || r.status === 400) {
        ok('Endpoint get-session répond', `HTTP ${r.status} (attendu sans cookie)`);
      } else wa('Endpoint get-session répond avec code inattendu', `HTTP ${r.status}`);
    } catch (e: any) { ko('Endpoint get-session inaccessible', e.message); }
  } else wa('Test JWKS ignoré (NEON_AUTH_URL manquant)');

  // ── §3 — Schéma neon_auth en base ───────────────────────────────────────
  section('3. Schéma neon_auth — tables et structure');

  const expectedTables = ['user', 'session', 'account', 'jwks'];
  for (const t of expectedTables) {
    try {
      const r = await pool.query(
        `SELECT COUNT(*) as n FROM neon_auth.${t}`
      );
      ok(`neon_auth.${t} accessible`, `${r.rows[0].n} ligne(s)`);
    } catch (e: any) { ko(`neon_auth.${t} inaccessible`, e.message); }
  }

  try {
    const r = await pool.query<{ email_verified: boolean }>(
      `SELECT "emailVerified" FROM neon_auth.user LIMIT 0`
    );
    ok('Colonnes camelCase neon_auth.user confirmées (emailVerified)');
  } catch (e: any) { ko('Colonnes neon_auth.user incorrectes', e.message); }

  // ── §4 — État public.users (liaison neon_auth_id) ───────────────────────
  section('4. État public.users — liaisons neon_auth_id');

  const usersResult = await pool.query<{
    id: string; role_id: string; active: boolean; status: string;
    client_id_null: boolean; neon_auth_id_null: boolean; is_test: boolean;
  }>(`
    SELECT id, role_id, active, status, is_test,
           (client_id IS NULL) AS client_id_null,
           (neon_auth_id IS NULL) AS neon_auth_id_null
    FROM public.users
  `);

  const allUsers = usersResult.rows;
  const realUsers   = allUsers.filter(u => !u.is_test);
  const testUsers   = allUsers.filter(u => u.is_test);
  const linkedUsers = allUsers.filter(u => !u.neon_auth_id_null);

  ok(`Total comptes public.users`, `${allUsers.length}`);
  ok(`Comptes réels (is_test=FALSE)`, `${realUsers.length}`);
  if (testUsers.length > 0) ok(`Comptes de test (is_test=TRUE)`, `${testUsers.length}`);
  else wa(`Aucun compte is_test=TRUE`, 'Nécessaire pour le Test 3 E2E');

  if (linkedUsers.length === 0) {
    ok('Aucun compte réel lié à neon_auth_id', 'Protection sanctuaire OK');
  } else {
    const realLinked = linkedUsers.filter(u => !u.is_test);
    if (realLinked.length > 0) ko(`${realLinked.length} compte(s) réel(s) ont un neon_auth_id`, 'Vérifier scellement non autorisé');
    else ok(`${linkedUsers.length} compte(s) test liés`, 'Comptes réels : 0 liaison');
  }

  // Vérifier les invariants financiers
  const fin = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM public.users WHERE is_test=FALSE) AS clients,
      (SELECT COUNT(*) FROM inscriptions WHERE is_test=FALSE) AS inscriptions,
      (SELECT COUNT(*) FROM payments WHERE is_test=FALSE AND status='VALIDE') AS paiements
  `);
  const f = fin.rows[0];
  console.log(`\n  📊 Invariants financiers (READ-ONLY) :`);
  console.log(`     Comptes réels  : ${f.clients} (attendu: 3+ selon contexte)`);
  console.log(`     Inscriptions   : ${f.inscriptions}`);
  console.log(`     Paiements validés : ${f.paiements}`);

  // ── §5 — Tests HTTP des 4 routes Lot 1 (sans session) ───────────────────
  section('5. Tests HTTP des 4 routes Lot 1 (sans session → attendu 401)');

  const lot1Routes = [
    '/api/auth/neon-me',
    '/api/roles',
    '/api/settings',
    '/api/dashboard/stats',
    '/api/notifications',
  ];

  for (const route of lot1Routes) {
    try {
      const r = await fetch(`${PROD_URL}${route}`, {
        signal: AbortSignal.timeout(15000),
        headers: { 'Accept': 'application/json' }
      });
      if (r.status === 401) {
        const body = await r.json().catch(() => ({})) as any;
        const code = body.code ?? body.error ?? '?';
        ok(`${route} → 401`, `code: ${code}`);
      } else if (r.status === 500) {
        const body = await r.json().catch(() => ({})) as any;
        ko(`${route} → 500 (erreur serveur)`, body.error ?? body.code ?? '');
      } else {
        ko(`${route} → HTTP ${r.status} inattendu (attendu 401)`);
      }
    } catch (e: any) {
      ko(`${route} → réseau inaccessible`, e.message);
    }
  }

  // ── §6 — Test routage SPA /neon-test ────────────────────────────────────
  section('6. Route SPA /neon-test (fallback index.html)');
  try {
    const r = await fetch(`${PROD_URL}/neon-test`, { signal: AbortSignal.timeout(10000) });
    if (r.status === 200) {
      const text = await r.text();
      if (text.includes('<html') || text.includes('<!DOCTYPE')) ok('/neon-test → index.html (SPA fallback OK)');
      else ko('/neon-test → réponse inattendue');
    } else ko(`/neon-test → HTTP ${r.status} (404 = déploiement manquant?)`);
  } catch (e: any) { ko('/neon-test inaccessible', e.message); }

  // ── §7 — Santé générale du service Render ───────────────────────────────
  section('7. Santé du service Render');
  try {
    const r = await fetch(`${PROD_URL}/api/health`, { signal: AbortSignal.timeout(10000) });
    if (r.ok) {
      const body = await r.json() as any;
      ok('/api/health', `status: ${body.status}, engine: ${body.engine}`);
    } else ko(`/api/health → HTTP ${r.status}`);
  } catch (e: any) { ko('/api/health inaccessible', e.message); }

  // ── Résumé ────────────────────────────────────────────────────────────────
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   RÉSUMÉ                                                  ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║   ✅ PASS : ${String(pass).padEnd(3)}  ❌ FAIL : ${String(fail).padEnd(3)}  ⚠️  WARN : ${String(warn).padEnd(3)}         ║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║   🔒 CE QUI NE PEUT PAS ÊTRE AUTOMATISÉ :               ║');
  console.log('║   • Test 2 : session Neon + compte Google INCONNU → 403  ║');
  console.log('║   • Test 3 : session Neon + compte Google CONNU  → 200  ║');
  console.log('║   • Vérification neon_auth.session après vrai login       ║');
  console.log('║   • Vérification neon_auth.account après vrai login       ║');
  console.log('║   → Nécessite action manuelle : /neon-test dans navigateur║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  if (fail > 0) {
    console.log(`\n🔴 ${fail} échec(s) détecté(s). Correction requise avant validation E2E.`);
    process.exit(1);
  } else {
    console.log(`\n🟢 Socle technique validé automatiquement. E2E manuel restant.`);
    process.exit(0);
  }
}

main().catch(e => {
  console.error('Erreur fatale:', e);
  process.exit(1);
});
