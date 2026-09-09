import 'dotenv/config';
import { pool } from '../server/db/neon.js';

export async function runMultiClientMigration() {
  console.log('=====================================================================');
  console.log('  PHASE 5D.1 — MIGRATION TABLE D\'HABILITATION MULTI-CLIENT');
  console.log('=====================================================================');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Création idempotente de la table user_client_access
    console.log('-> 1. Création de la table user_client_access...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_client_access (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        relationship_type TEXT NOT NULL DEFAULT 'TITULAIRE' 
          CHECK (relationship_type IN ('TITULAIRE', 'TUTEUR_FAMILLE', 'PAYEUR_TIERS', 'GESTIONNAIRE')),
        can_view BOOLEAN NOT NULL DEFAULT TRUE,
        can_pay BOOLEAN NOT NULL DEFAULT TRUE,
        can_upload_docs BOOLEAN NOT NULL DEFAULT TRUE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_user_client UNIQUE (user_id, client_id)
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_uca_user ON user_client_access(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_uca_client ON user_client_access(client_id);`);

    // 2. Initialisation des accès pour les utilisateurs existants ayant un client_id
    console.log('-> 2. Initialisation rétrocompatible des accès existants...');
    const usersWithClient = await client.query(`
      SELECT id, client_id FROM users WHERE client_id IS NOT NULL;
    `);

    for (const row of usersWithClient.rows) {
      await client.query(
        `INSERT INTO user_client_access (id, user_id, client_id, relationship_type, can_view, can_pay, can_upload_docs, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, 'TITULAIRE', TRUE, TRUE, TRUE, TRUE, NOW(), NOW())
         ON CONFLICT (user_id, client_id) DO NOTHING`,
        [`uca-${row.id}-${row.client_id}`, row.id, row.client_id]
      );
    }

    // 3. Contrôle du sanctuaire des données réelles
    console.log('-> 3. Contrôle de non-régression du sanctuaire financier...');
    const realClientsRes = await client.query(`SELECT COUNT(*) as count FROM clients WHERE is_test = FALSE;`);
    const realInsRes = await client.query(`SELECT COUNT(*) as count FROM inscriptions WHERE is_test = FALSE;`);
    const realPayRes = await client.query(`SELECT COUNT(*) as count, SUM(amount) as total FROM payments WHERE is_test = FALSE;`);

    const clientCount = parseInt(realClientsRes.rows[0].count, 10);
    const insCount = parseInt(realInsRes.rows[0].count, 10);
    const payCount = parseInt(realPayRes.rows[0].count, 10);
    const totalAmount = parseFloat(realPayRes.rows[0].total);

    console.log(`Clients réels : ${clientCount} (Attendu: 6)`);
    console.log(`Dossiers réels : ${insCount} (Attendu: 6)`);
    console.log(`Paiements réels : ${payCount} pour ${totalAmount} FCFA (Attendu: 3 et 4 500 000 FCFA)`);

    if (clientCount !== 6 || insCount !== 6 || payCount !== 3 || totalAmount !== 4500000) {
      throw new Error(`Sanctuaire financier violé ! Rollback immédiat.`);
    }

    await client.query('COMMIT');
    console.log('✅ GATE 5D-1 RÉUSSI : Schéma DB créé et vérifié avec succès.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Échec Jalon 5D-1 (ROLLBACK) :', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1]?.endsWith('migrate-phase5d-multi-client.ts')) {
  runMultiClientMigration()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      pool.end();
      process.exit(1);
    });
}
