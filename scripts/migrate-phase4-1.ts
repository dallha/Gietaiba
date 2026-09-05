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
  console.log('  PHASE 4.1 — MIGRATION SCHEMA & SÉQUENCES ATOMIQUES (NEON POSTGRESQL)');
  console.log('=====================================================================\n');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Table des compteurs atomiques annuels
    console.log('1. Création de la table business_sequences...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS business_sequences (
        sequence_type TEXT NOT NULL,
        year INT NOT NULL DEFAULT 0,
        current_value INT NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (sequence_type, year)
      );
    `);

    // 2. Fonction SQL atomique get_next_business_sequence
    console.log('2. Création de la fonction get_next_business_sequence...');
    await client.query(`
      CREATE OR REPLACE FUNCTION get_next_business_sequence(p_type TEXT, p_year INT DEFAULT 0)
      RETURNS INT AS $$
      DECLARE
        v_next INT;
      BEGIN
        INSERT INTO business_sequences (sequence_type, year, current_value, updated_at)
        VALUES (p_type, p_year, 1, NOW())
        ON CONFLICT (sequence_type, year)
        DO UPDATE SET current_value = business_sequences.current_value + 1, updated_at = NOW()
        RETURNING current_value INTO v_next;
        
        RETURN v_next;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 3. Initialisation dynamique et idempotente des compteurs au MAX existant
    console.log('3. Initialisation dynamique des compteurs au MAX existant...');
    await client.query(`
      DO $$
      DECLARE
        max_cli INT;
        max_ins_2027 INT;
        max_pay_2027 INT;
        max_exp_2026 INT;
      BEGIN
        -- CLIENT (continu global, year = 0)
        SELECT COALESCE(MAX(SUBSTRING(code FROM '[0-9]+$')::INT), 0) INTO max_cli FROM clients;
        INSERT INTO business_sequences (sequence_type, year, current_value)
        VALUES ('CLIENT', 0, max_cli)
        ON CONFLICT (sequence_type, year) 
        DO UPDATE SET current_value = GREATEST(business_sequences.current_value, EXCLUDED.current_value);

        -- INSCRIPTION (annuel 2027)
        SELECT COALESCE(MAX(SUBSTRING(code FROM '[0-9]+$')::INT), 0) INTO max_ins_2027 
        FROM inscriptions WHERE code LIKE 'INS-2027-%';
        INSERT INTO business_sequences (sequence_type, year, current_value)
        VALUES ('INSCRIPTION', 2027, max_ins_2027)
        ON CONFLICT (sequence_type, year) 
        DO UPDATE SET current_value = GREATEST(business_sequences.current_value, EXCLUDED.current_value);

        -- PAYMENT (annuel 2027)
        SELECT COALESCE(MAX(SUBSTRING(receipt_number FROM '[0-9]+$')::INT), 0) INTO max_pay_2027 
        FROM payments WHERE receipt_number LIKE 'PAY-2027-%';
        INSERT INTO business_sequences (sequence_type, year, current_value)
        VALUES ('PAYMENT', 2027, max_pay_2027)
        ON CONFLICT (sequence_type, year) 
        DO UPDATE SET current_value = GREATEST(business_sequences.current_value, EXCLUDED.current_value);

        -- EXPENSE (annuel 2026)
        SELECT COALESCE(MAX(SUBSTRING(id FROM '[0-9]+$')::INT), 0) INTO max_exp_2026 
        FROM expenses;
        INSERT INTO business_sequences (sequence_type, year, current_value)
        VALUES ('EXPENSE', 2026, max_exp_2026)
        ON CONFLICT (sequence_type, year) 
        DO UPDATE SET current_value = GREATEST(business_sequences.current_value, EXCLUDED.current_value);
      END $$;
    `);

    // 4. Ajout de la colonne code sur expenses et rétro-remplissage propre
    console.log('4. Ajout de expenses.code et remplissage des codes historiques...');
    await client.query(`
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS code TEXT UNIQUE;
      UPDATE expenses SET code = 'EXP-2026-000001' WHERE id = 'exp-001' AND code IS NULL;
      UPDATE expenses SET code = 'EXP-2026-000002' WHERE id = 'exp-002' AND code IS NULL;
    `);

    // 5. Table payment_schedules (Échéancier prévisionnel)
    console.log('5. Création de payment_schedules...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_schedules (
        id TEXT PRIMARY KEY,
        inscription_id TEXT NOT NULL REFERENCES inscriptions(id) ON DELETE RESTRICT,
        due_date DATE NOT NULL,
        amount_due NUMERIC(15, 2) NOT NULL CHECK (amount_due > 0),
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED')),
        comment TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_payment_schedules_inscription ON payment_schedules(inscription_id);
    `);

    // 6. Table hotel_stays (Séjours pèlerins géolocalisés Makkah/Médine)
    console.log('6. Création de hotel_stays...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hotel_stays (
        id TEXT PRIMARY KEY,
        inscription_id TEXT NOT NULL REFERENCES inscriptions(id) ON DELETE RESTRICT,
        client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
        hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
        campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
        package_id TEXT REFERENCES packages(id) ON DELETE SET NULL,
        city TEXT NOT NULL CHECK (city IN ('Makkah', 'Médine', 'Djeddah')),
        check_in_date DATE NOT NULL,
        check_out_date DATE NOT NULL,
        room_type TEXT NOT NULL,
        room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
        shuttle_service BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_hotel_stays_inscription ON hotel_stays(inscription_id);
      CREATE INDEX IF NOT EXISTS idx_hotel_stays_client ON hotel_stays(client_id);
    `);

    // 7. Table flight_segments (Segments de vols multi-escales)
    console.log('7. Création de flight_segments...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS flight_segments (
        id TEXT PRIMARY KEY,
        flight_id TEXT NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
        segment_type TEXT NOT NULL CHECK (segment_type IN ('ALLER', 'RETOUR', 'TRANSIT', 'INTERNE')),
        departure_airport TEXT NOT NULL,
        arrival_airport TEXT NOT NULL,
        flight_number TEXT NOT NULL,
        airline TEXT NOT NULL,
        departure_time TIMESTAMPTZ NOT NULL,
        arrival_time TIMESTAMPTZ NOT NULL,
        terminal TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_flight_segments_flight ON flight_segments(flight_id);
    `);

    await client.query('COMMIT');
    console.log('\n✅ [SUCCÈS] Migration Phase 4.1 appliquée avec succès dans Neon PostgreSQL.');

    // Affichage de contrôle
    const seqs = await client.query('SELECT * FROM business_sequences ORDER BY sequence_type, year');
    console.log('\nÉtat des compteurs après initialisation dynamique :');
    console.table(seqs.rows);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ [ERREUR] Échec de la migration Phase 4.1:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
