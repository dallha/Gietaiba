import 'dotenv/config';
import { pool } from '../server/db/neon.js';

async function migratePhase5CAccounts() {
  console.log('=====================================================================');
  console.log('  PHASE 5C — MIGRATION TRANSACTIONNELLE DES COMPTES (NEON POSTGRESQL)');
  console.log('=====================================================================');

  const superAdminEmail = 'mr.niass@gmail.com';
  const superAdminPwd = process.env.SUPERADMIN_PWD || 'Niass2027!';
  const pilgrimEmail = 'mrniass1987@gmail.com';
  const pilgrimPwd = process.env.PELERIN_PWD || 'Pelerin2027!';

  const testClientId = 'cli-test-niass';
  const testClientCode = 'GT-TEST-000001';

  // -------------------------------------------------------------
  // GATE 5C-1 : PRÉCONDITIONS & AUDIT D'INTÉGRITÉ
  // -------------------------------------------------------------
  console.log('\n[GATE 5C-1] Vérification des préconditions...');

  // 1. Vérifier rôles
  const rolesRes = await pool.query(`SELECT id FROM roles WHERE id IN ('SUPER_ADMIN', 'PELERIN')`);
  const foundRoles = rolesRes.rows.map(r => r.id);
  if (!foundRoles.includes('SUPER_ADMIN') || !foundRoles.includes('PELERIN')) {
    throw new Error(`Rôles manquants dans Neon : ${JSON.stringify(foundRoles)}`);
  }
  console.log('✅ Rôles SUPER_ADMIN et PELERIN vérifiés dans Neon');

  // 2. Vérifier baseline des 6 pèlerins réels
  const realClientsRes = await pool.query(`SELECT id, code FROM clients WHERE code != $1 ORDER BY id`, [testClientCode]);
  console.log(`ℹ️ Nombre de clients existants : ${realClientsRes.rows.length}`);
  if (realClientsRes.rows.length < 6) {
    throw new Error(`Anomalie sur les clients réels : seulement ${realClientsRes.rows.length} trouvés`);
  }

  // 3. Vérifier absence de collision sur les nouveaux identifiants
  const userCollisionRes = await pool.query(
    `SELECT id, email FROM users WHERE LOWER(email) IN ($1, $2)`,
    [superAdminEmail.toLowerCase(), pilgrimEmail.toLowerCase()]
  );
  if (userCollisionRes.rows.length > 0) {
    console.log(`⚠️ Des utilisateurs existent déjà : ${JSON.stringify(userCollisionRes.rows)}`);
  } else {
    console.log('✅ Aucun conflit détecté sur mr.niass@gmail.com et mrniass1987@gmail.com');
  }

  const clientCollisionRes = await pool.query(
    `SELECT id, code FROM clients WHERE id = $1 OR code = $2`,
    [testClientId, testClientCode]
  );
  if (clientCollisionRes.rows.length > 0) {
    console.log(`⚠️ Client de test existe déjà : ${JSON.stringify(clientCollisionRes.rows)}`);
  } else {
    console.log('✅ Aucun conflit détecté sur le client de test GT-TEST-000001');
  }

  // -------------------------------------------------------------
  // GATE 5C-2 : TRANSACTION ATOMIQUE D'INSERTION / MISE À JOUR
  // -------------------------------------------------------------
  console.log('\n[GATE 5C-2] Exécution de la transaction...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Insertion / Upsert Fiche Client de Test (GT-TEST-000001) - Zéro dossier Hajj
    console.log(`-> Upsert fiche client ${testClientId} (${testClientCode})...`);
    await client.query(
      `INSERT INTO clients (
        id, code, civility, first_name, last_name, gender, birth_date,
        nationality, phone, email, status, created_at, updated_at
      ) VALUES (
        $1, $2, 'M.', 'Amadou', 'Niass', 'M', '1987-01-01',
        'Sénégalaise', '+221770000000', $3, 'ACTIF', NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        status = 'ACTIF',
        updated_at = NOW()`,
      [testClientId, testClientCode, pilgrimEmail.toLowerCase()]
    );

    // 2. Insertion / Upsert Utilisateur SUPER_ADMIN (mr.niass@gmail.com) - client_id = NULL
    console.log(`-> Upsert utilisateur SUPER_ADMIN ${superAdminEmail}...`);
    const superAdminId = 'usr-superadmin-niass';
    await client.query(
      `INSERT INTO users (
        id, email, display_name, phone, password_hash, role_id, status, active, client_id, created_at, updated_at
      ) VALUES (
        $1, $2, 'El Hadji Abdoulaye Niass', '+221770000000', $3, 'SUPER_ADMIN', 'ACTIF', TRUE, NULL, NOW(), NOW()
      )
      ON CONFLICT (email) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        password_hash = EXCLUDED.password_hash,
        role_id = 'SUPER_ADMIN',
        status = 'ACTIF',
        active = TRUE,
        client_id = NULL,
        updated_at = NOW()`,
      [superAdminId, superAdminEmail.toLowerCase(), superAdminPwd]
    );

    // Attribution rôle SUPER_ADMIN
    await client.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, 'SUPER_ADMIN')
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [superAdminId]
    );

    // 3. Insertion / Upsert Utilisateur PELERIN (mrniass1987@gmail.com) - client_id = cli-test-niass
    console.log(`-> Upsert utilisateur PELERIN ${pilgrimEmail}...`);
    const pilgrimUserId = 'usr-pelerin-niass';
    await client.query(
      `INSERT INTO users (
        id, email, display_name, phone, password_hash, role_id, status, active, client_id, created_at, updated_at
      ) VALUES (
        $1, $2, 'Amadou Niass', '+221770000000', $3, 'PELERIN', 'ACTIF', TRUE, $4, NOW(), NOW()
      )
      ON CONFLICT (email) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        password_hash = EXCLUDED.password_hash,
        role_id = 'PELERIN',
        status = 'ACTIF',
        active = TRUE,
        client_id = EXCLUDED.client_id,
        updated_at = NOW()`,
      [pilgrimUserId, pilgrimEmail.toLowerCase(), pilgrimPwd, testClientId]
    );

    // Attribution rôle PELERIN
    await client.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, 'PELERIN')
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [pilgrimUserId]
    );

    await client.query('COMMIT');
    console.log('✅ Transaction validée avec succès (COMMIT)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur pendant la transaction (ROLLBACK effectué) :', err);
    throw err;
  } finally {
    client.release();
  }

  // -------------------------------------------------------------
  // POST-VÉRIFICATION
  // -------------------------------------------------------------
  console.log('\n[POST-VERIFICATION] Contrôle des enregistrements...');
  const checkSuper = await pool.query(
    `SELECT id, email, display_name, role_id, status, active, client_id FROM users WHERE LOWER(email) = $1`,
    [superAdminEmail.toLowerCase()]
  );
  console.log('SUPER_ADMIN dans Neon :', checkSuper.rows[0]);

  const checkPilgrim = await pool.query(
    `SELECT id, email, display_name, role_id, status, active, client_id FROM users WHERE LOWER(email) = $1`,
    [pilgrimEmail.toLowerCase()]
  );
  console.log('PELERIN dans Neon :', checkPilgrim.rows[0]);

  const checkClient = await pool.query(
    `SELECT id, code, first_name, last_name, email, status FROM clients WHERE id = $1`,
    [testClientId]
  );
  console.log('Client de test dans Neon :', checkClient.rows[0]);

  // Contrôle d'isolation : aucun dossier pour le client de test
  const checkInscriptions = await pool.query(
    `SELECT id, code FROM inscriptions WHERE client_id = $1`,
    [testClientId]
  );
  console.log(`Dossiers Hajj pour client de test : ${checkInscriptions.rows.length} (Doit être STRICTEMENT 0)`);
  if (checkInscriptions.rows.length !== 0) {
    throw new Error('VIOLATION DE SANCTUAIRE : Le client de test ne doit avoir aucun dossier Hajj !');
  }

  // Contrôle des 6 vrais clients Hajj
  const countRealClients = await pool.query(
    `SELECT COUNT(*) FROM clients WHERE id != $1`,
    [testClientId]
  );
  console.log(`Nombre de clients réels préservés : ${countRealClients.rows[0].count} (Attendu: 6)`);

  const countRealInscriptions = await pool.query(
    `SELECT COUNT(*) FROM inscriptions`
  );
  console.log(`Nombre de dossiers Hajj préservés : ${countRealInscriptions.rows[0].count} (Attendu: 6)`);

  console.log('\n=====================================================================');
  console.log('  MIGRATION PHASE 5C TERMINÉE AVEC SUCCÈS !');
  console.log('=====================================================================');
}

migratePhase5CAccounts()
  .then(() => pool.end())
  .catch(err => {
    console.error('Échec fatal :', err);
    pool.end();
    process.exit(1);
  });
