import 'dotenv/config';
import { pool } from '../server/db/neon.js';

async function runDataHygieneMigration() {
  console.log('=====================================================================');
  console.log('  PHASE 5C.1 — MIGRATION DATA HYGIENE (ISOLATION DONNÉES TEST/RÉEL)');
  console.log('=====================================================================');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Ajouter les colonnes is_test de manière idempotente
    console.log('-> Ajout des colonnes is_test...');
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;`);
    await client.query(`ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;`);
    await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;`);

    // 2. Marquer les données de test existantes
    console.log('-> Marquage des entités de test...');
    const clientTestRes = await client.query(
      `UPDATE clients SET is_test = TRUE WHERE id = 'cli-test-niass' OR code LIKE '%TEST%' RETURNING id, code;`
    );
    console.log(`Clients marqués is_test=TRUE : ${clientTestRes.rowCount}`, clientTestRes.rows);

    const userTestRes = await client.query(
      `UPDATE users SET is_test = TRUE WHERE id = 'usr-pelerin-niass' OR LOWER(email) = 'mrniass1987@gmail.com' RETURNING id, email;`
    );
    console.log(`Users marqués is_test=TRUE : ${userTestRes.rowCount}`, userTestRes.rows);

    const insTestRes = await client.query(
      `UPDATE inscriptions SET is_test = TRUE WHERE client_id = 'cli-test-niass' OR code LIKE '%TEST%' RETURNING id, code;`
    );
    console.log(`Inscriptions marquées is_test=TRUE : ${insTestRes.rowCount}`);

    const payTestRes = await client.query(
      `UPDATE payments SET is_test = TRUE WHERE client_id = 'cli-test-niass' RETURNING id;`
    );
    console.log(`Paiements marqués is_test=TRUE : ${payTestRes.rowCount}`);

    // 3. Contrôle de sanctuaire : Les données réelles doivent STRICTEMENT être is_test = FALSE
    console.log('\n-> Contrôle de sanctuaire des données réelles...');
    const realClientsRes = await client.query(`SELECT id, code, is_test FROM clients WHERE is_test = FALSE ORDER BY id;`);
    console.log(`Clients réels (is_test = FALSE) : ${realClientsRes.rowCount} (Attendu: 6)`);
    if (realClientsRes.rowCount !== 6) {
      throw new Error(`Sanctuaire violé : ${realClientsRes.rowCount} clients réels trouvés au lieu de 6.`);
    }

    const realInsRes = await client.query(`SELECT id, code, is_test FROM inscriptions WHERE is_test = FALSE ORDER BY id;`);
    console.log(`Dossiers Hajj réels (is_test = FALSE) : ${realInsRes.rowCount} (Attendu: 6)`);
    if (realInsRes.rowCount !== 6) {
      throw new Error(`Sanctuaire violé : ${realInsRes.rowCount} inscriptions réelles trouvées au lieu de 6.`);
    }

    const realPayRes = await client.query(`SELECT COUNT(*) as count, SUM(amount) as total FROM payments WHERE is_test = FALSE;`);
    const count = parseInt(realPayRes.rows[0].count, 10);
    const total = parseFloat(realPayRes.rows[0].total);
    console.log(`Paiements réels : ${count} pour un total de ${total} FCFA (Attendu: 3 et 4 500 000 FCFA)`);
    if (count !== 3 || total !== 4500000) {
      throw new Error(`Sanctuaire financier violé : count=${count}, total=${total}`);
    }

    await client.query('COMMIT');
    console.log('\n✅ MIGRATION DATA HYGIENE VALIDÉE ET VALIDÉE DANS NEON (COMMIT)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur lors de la migration Data Hygiene (ROLLBACK) :', err);
    throw err;
  } finally {
    client.release();
  }
}

runDataHygieneMigration()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Échec fatal :', err);
    pool.end();
    process.exit(1);
  });
