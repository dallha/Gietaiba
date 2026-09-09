import 'dotenv/config';
import { pool } from '../server/db/neon.js';

async function verifyB5() {
  console.log("======================================================");
  console.log("🔍 VÉRIFICATION POST-POC NEON-AUTH (ÉTAPE B5)");
  console.log("======================================================\n");

  try {
    // 1. Identités créées dans Neon Auth
    const neonUsers = await pool.query(`SELECT id, email, name, "emailVerified" FROM neon_auth.user`);
    console.log(`[1] Identités (neon_auth.user) : ${neonUsers.rowCount}`);
    if (neonUsers.rowCount > 0) console.table(neonUsers.rows);

    // 2. Fournisseurs OAuth liés (Google)
    const neonAccounts = await pool.query(`SELECT id, "userId", "providerId", "accountId" FROM neon_auth.account`);
    console.log(`\n[2] Fournisseurs liés (neon_auth.account) : ${neonAccounts.rowCount}`);
    if (neonAccounts.rowCount > 0) console.table(neonAccounts.rows.map(a => ({ ...a, accountId: a.accountId.substring(0, 10) + '...' })));

    // 3. Sessions actives dans Neon Auth
    const neonSessions = await pool.query(`SELECT id, "userId", token, "ipAddress" FROM neon_auth.session`);
    console.log(`\n[3] Sessions actives (neon_auth.session) : ${neonSessions.rowCount}`);
    if (neonSessions.rowCount > 0) console.table(neonSessions.rows.map(s => ({ ...s, token: s.token.substring(0, 10) + '...' })));

    // 4. Comptes Google Inconnus (Identité OK, Autorisation GIE REFUSÉE)
    const orphanedUsers = await pool.query(`
      SELECT nu.id as neon_id, nu.email as neon_email 
      FROM neon_auth.user nu 
      LEFT JOIN public.users u ON nu.id = u.neon_auth_id 
      WHERE u.id IS NULL
    `);
    console.log(`\n[4] Rejets GIE TAIBA (Identités Neon sans accès public.users) : ${orphanedUsers.rowCount}`);
    if (orphanedUsers.rowCount > 0) console.table(orphanedUsers.rows);

    // 5. Liaison avec public.users (Les succès)
    const linkedUsers = await pool.query(`
      SELECT u.id as gie_id, u.email as gie_email, u.neon_auth_id, u.role_id, u.is_test,
             nu.id as neon_id
      FROM public.users u
      JOIN neon_auth.user nu ON u.neon_auth_id = nu.id
    `);
    console.log(`\n[5] Liaisons GIE TAIBA réussies (public.users.neon_auth_id) : ${linkedUsers.rowCount}`);
    if (linkedUsers.rowCount > 0) console.table(linkedUsers.rows);

    // 6. Vérification de sécurité (Aucune pollution des données réelles)
    const compromisedRealUsers = await pool.query(`
      SELECT id, email, is_test FROM public.users 
      WHERE neon_auth_id IS NOT NULL AND is_test = FALSE
    `);
    
    console.log(`\n[6] Contrôle de sécurité (Comptes réels impactés) : ${compromisedRealUsers.rowCount}`);
    if (compromisedRealUsers.rowCount && compromisedRealUsers.rowCount > 0) {
      console.error("🚨 ALERTE : DES COMPTES NON-TEST ONT REÇU UN MAPPING NEON !");
      console.table(compromisedRealUsers.rows);
    } else {
      console.log("✅ SUCCÈS : Le périmètre du sanctuaire financier et des comptes réels est intact.");
    }

  } catch (error) {
    console.error("Erreur lors de la vérification :", error);
  } finally {
    process.exit(0);
  }
}

verifyB5();
