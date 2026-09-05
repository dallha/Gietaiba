import dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function runMigration() {
  console.log('=====================================================================');
  console.log('  PHASE 4.2 — MIGRATION SCHEMA & ALLOCATIONS (NEON POSTGRESQL)');
  console.log('=====================================================================\n');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Table d'allocations de paiement sur l'échéancier (Traçabilité comptable fine)
    console.log('1. Création de la table payment_schedule_allocations...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_schedule_allocations (
        id TEXT PRIMARY KEY,
        payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
        payment_schedule_id TEXT NOT NULL REFERENCES payment_schedules(id) ON DELETE RESTRICT,
        amount_allocated NUMERIC(15, 2) NOT NULL CHECK (amount_allocated > 0),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_psa_payment ON payment_schedule_allocations(payment_id);
      CREATE INDEX IF NOT EXISTS idx_psa_schedule ON payment_schedule_allocations(payment_schedule_id);
    `);

    // 2. Table des clés d'idempotence multi-acteurs avec fingerprint
    console.log('2. Création de la table idempotency_keys...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key TEXT NOT NULL,
        actor_user_id TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        request_fingerprint TEXT NOT NULL,
        response_payload JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
        PRIMARY KEY (key, actor_user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);
    `);

    // 3. Support de motif de rejet sur documents
    console.log('3. Ajout de rejection_reason sur documents si non existant...');
    await client.query(`
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
    `);

    // 4. Assouplissement statut campagnes (support OUVERTE, CLOTUREE, etc.)
    console.log('4. Mise à jour de la contrainte de statut campaigns_status_check...');
    await client.query(`
      ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;
      ALTER TABLE campaigns ADD CONSTRAINT campaigns_status_check CHECK (
        status IN ('PLANIFIE', 'PLANIFIEE', 'OUVERT', 'OUVERTE', 'EN_COURS', 'RETOUR', 'CLOTURE', 'CLOTUREE', 'ARCHIVE', 'ARCHIVEE')
      );
    `);

    await client.query('COMMIT');
    console.log('\n[SUCCESS] Migration Phase 4.2 appliquée avec succès sur Neon PostgreSQL.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n[ERROR] Échec de la migration Phase 4.2 :', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
