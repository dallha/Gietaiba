#!/usr/bin/env tsx
import 'dotenv/config';
import { pool } from '../server/db/neon.js';

const email = process.argv[2];
const neonId = process.argv[3];

if (!email || !neonId) {
  console.error("Usage: npx tsx scripts/link-identity.ts <email_gie_taiba> <neon_auth_id>");
  process.exit(1);
}

async function main() {
  try {
    const res = await pool.query(
      `UPDATE public.users SET neon_auth_id = $1 WHERE email = $2 RETURNING id, email, role_id`,
      [neonId, email]
    );
    if (res.rows.length === 0) {
      console.error(`❌ Aucun utilisateur trouvé avec l'email: ${email}`);
    } else {
      console.log(`✅ Identité liée avec succès !`);
      console.log(res.rows[0]);
    }
  } catch (e: any) {
    console.error("Erreur:", e.message);
  } finally {
    process.exit(0);
  }
}
main();
