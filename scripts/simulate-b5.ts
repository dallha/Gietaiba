import 'dotenv/config';
import { pool } from '../server/db/neon.js';
import express from 'express';
import http from 'http';

async function runSimulation() {
  console.log("======================================================");
  console.log("🚀 SIMULATION E2E DU JALON B5 (SANS NAVIGATEUR)");
  console.log("======================================================\n");

  let neonServer: http.Server | null = null;
  let gieServer: http.Server | null = null;

  try {
    console.log("🛠️  1. Préparation des données de test PostgreSQL...");
    
    await pool.query(`
        INSERT INTO public.users (id, email, password_hash, role_id, display_name, phone, is_test)
        VALUES ('usr-test-123', 'test_user@gie.com', 'fake', 'PELERIN', 'Test User', '000', TRUE)
        ON CONFLICT (email) DO NOTHING
    `);

    await pool.query(`DELETE FROM neon_auth.user WHERE email IN ('inconnu@test.com', 'test_user@gie.com')`);
    await pool.query(`UPDATE public.users SET neon_auth_id = NULL WHERE email = 'test_user@gie.com'`);
    
    const now = new Date();
    const resA = await pool.query(`
        INSERT INTO neon_auth.user (id, email, name, "emailVerified", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), 'inconnu@test.com', 'Inconnu', true, $1, $1) RETURNING id
    `, [now]);
    const resB = await pool.query(`
        INSERT INTO neon_auth.user (id, email, name, "emailVerified", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), 'test_user@gie.com', 'Test', true, $1, $1) RETURNING id
    `, [now]);

    const neonUuidA = resA.rows[0].id;
    const neonUuidB = resB.rows[0].id;

    console.log("✅  Données injectées.\n");

    console.log("🌐  2. Démarrage des serveurs (Mock Neon Auth + GIE TAIBA Bridge)...");
    
    const neonApp = express();
    neonApp.get('/api/auth/get-session', (req, res) => {
        const cookie = req.headers.cookie || '';
        if (cookie.includes('cas_a')) return res.json({ user: { id: neonUuidA, email: 'inconnu@test.com' } });
        if (cookie.includes('cas_b')) return res.json({ user: { id: neonUuidB, email: 'test_user@gie.com' } });
        return res.status(401).json({ error: "No session" });
    });
    neonServer = neonApp.listen(9999);
    
    const gieApp = express();
    process.env.NEON_AUTH_URL = 'http://localhost:9999';
    
    gieApp.get('/api/auth/neon-me', async (req, res) => {
      try {
        const neonAuthUrl = process.env.NEON_AUTH_URL;
        const cookieHeader = req.headers.cookie || '';
        const authRes = await fetch(`${neonAuthUrl}/api/auth/get-session`, { headers: { cookie: cookieHeader } });
        if (!authRes.ok) { res.status(401).json({ error: "Pas de session" }); return; }
        
        const data = await authRes.json();
        const neonUser = data.user;
        
        let gieUserRow = null;
        let mappedBy = null;
    
        const resId = await pool.query(`SELECT id, role_id, is_test FROM users WHERE neon_auth_id = $1 LIMIT 1`, [neonUser.id]);
        if (resId.rows.length > 0) {
          gieUserRow = resId.rows[0];
          mappedBy = 'neon_auth_id';
        } else {
          const resEmail = await pool.query(`SELECT id, role_id, is_test FROM users WHERE LOWER(email) = $1 LIMIT 1`, [neonUser.email.toLowerCase()]);
          if (resEmail.rows.length > 0) {
            gieUserRow = resEmail.rows[0];
            mappedBy = 'email';
            if (gieUserRow.is_test) {
              await pool.query(`UPDATE users SET neon_auth_id = $1 WHERE id = $2`, [neonUser.id, gieUserRow.id]);
              mappedBy = 'email_and_sealed';
            }
          }
        }
    
        if (!gieUserRow) {
          res.status(403).json({ authenticated: true, neonAuthId: neonUser.id, email: neonUser.email, error: "Compte GIE TAIBA introuvable. Accès refusé." });
          return;
        }
        res.json({ authenticated: true, neonAuthId: neonUser.id, email: neonUser.email, mappedBy, gieUser: { id: gieUserRow.id, role: gieUserRow.role_id, isTest: gieUserRow.is_test } });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });
    gieServer = gieApp.listen(3000);

    console.log("✅  Serveurs prêts.\n");

    console.log("🧪  3. EXÉCUTION DU CAS A : Google Inconnu");
    const testA = await fetch('http://localhost:3000/api/auth/neon-me', { headers: { cookie: 'cas_a' } });
    console.log(`HTTP Status: ${testA.status}`);
    console.log(`Response:`, await testA.json());

    console.log("\n🧪  4. EXÉCUTION DU CAS B : Google Test Connu");
    const testB = await fetch('http://localhost:3000/api/auth/neon-me', { headers: { cookie: 'cas_b' } });
    console.log(`HTTP Status: ${testB.status}`);
    console.log(`Response:`, await testB.json());
    
    console.log("\n🧪  5. RÉ-EXÉCUTION DU CAS B (Vérification du scellement ID)");
    const testB2 = await fetch('http://localhost:3000/api/auth/neon-me', { headers: { cookie: 'cas_b' } });
    console.log(`Response (mappedBy attendu: neon_auth_id):`, await testB2.json());

  } catch (error) {
    console.error("Erreur durant la simulation:", error);
  } finally {
    if (neonServer) neonServer.close();
    if (gieServer) gieServer.close();
  }
}

runSimulation();
