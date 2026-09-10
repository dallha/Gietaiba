import 'dotenv/config';
import { randomUUID } from 'crypto';
import { pool } from '../server/db/neon.js';

export async function onboardGerant() {
  console.log('=====================================================================');
  console.log('  ONBOARDING CONTRÔLÉ DU GÉRANT : CHEIKH IBRAHIMA KA (SUPER_ADMIN)');
  console.log('=====================================================================');

  // 1. Contrôle strict du mot de passe fourni au runtime (ZÉRO fallback)
  const password = process.env.GERANT_PWD;
  if (!password || password.trim().length === 0) {
    throw new Error('GERANT_PWD est obligatoire — onboarding interrompu.');
  }

  const gerantData = {
    id: 'usr-gerant-cheikh-ka',
    email: 'kabaye73@gmail.com',
    displayName: 'Cheikh Ibrahima Ka',
    phone: '+221772927777',
    roleId: 'SUPER_ADMIN',
    status: 'ACTIF',
    active: true,
    clientId: null,
    isTest: false,
  };

  const client = await pool.connect();
  try {
    console.log('\n-> 1. Vérification préalable renforcée des préconditions...');

    // A. Vérification existence par ID
    const existingId = await client.query(`SELECT id, email FROM users WHERE id = $1`, [gerantData.id]);
    if (existingId.rows.length > 0) {
      throw new Error(`COLLISION_ID : Un utilisateur avec l'ID ${gerantData.id} existe déjà (${existingId.rows[0].email}).`);
    }

    // B. Vérification existence par Email
    const existingEmail = await client.query(
      `SELECT id, email, display_name FROM users WHERE LOWER(email) = LOWER($1)`,
      [gerantData.email]
    );
    if (existingEmail.rows.length > 0) {
      throw new Error(`COLLISION_EMAIL : L'email ${gerantData.email} est déjà utilisé par ${existingEmail.rows[0].id}.`);
    }

    // C. Vérification existence par Téléphone (normalisé)
    const cleanPhone = gerantData.phone.replace(/[\s+-]/g, '');
    const existingPhone = await client.query(
      `SELECT id, email, phone FROM users WHERE regexp_replace(phone, '[\\s+-]', '', 'g') LIKE $1`,
      [`%${cleanPhone.slice(-9)}%`]
    );
    if (existingPhone.rows.length > 0) {
      throw new Error(`COLLISION_PHONE : Le téléphone ${gerantData.phone} est déjà enregistré (${existingPhone.rows[0].id} - ${existingPhone.rows[0].email}).`);
    }

    console.log('  ✅ Aucune collision détectée. Vacance du compte confirmée.');

    // 2. Démarrage de la Transaction Atomique
    console.log('\n-> 2. Exécution transactionnelle de l\'onboarding...');
    await client.query('BEGIN');

    // A. Insertion dans USERS
    await client.query(
      `INSERT INTO users (
        id, email, display_name, phone, password_hash, role_id, status, active, client_id, is_test, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
      [
        gerantData.id,
        gerantData.email.toLowerCase().trim(),
        gerantData.displayName,
        gerantData.phone,
        password,
        gerantData.roleId,
        gerantData.status,
        gerantData.active,
        gerantData.clientId,
        gerantData.isTest,
      ]
    );
    console.log(`  ✅ Compte inséré dans USERS (id: ${gerantData.id})`);

    // B. Insertion dans USER_ROLES
    await client.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT (user_id, role_id) DO NOTHING`,
      [gerantData.id, gerantData.roleId]
    );
    console.log(`  ✅ Rôle ${gerantData.roleId} rattaché dans USER_ROLES`);

    // C. Enregistrement dans AUDIT_LOGS
    const logId = `log-${randomUUID()}`;
    await client.query(
      `INSERT INTO audit_logs (
        id, actor_user_id, actor_user_name, action, entity_type, entity_id, new_value, reason, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        logId,
        'usr-superadmin-niass',
        'El Hadji Abdoulaye Niass (Créateur Plateforme)',
        'GERANT_ONBOARDING',
        'USER',
        gerantData.id,
        JSON.stringify({
          id: gerantData.id,
          email: gerantData.email,
          displayName: gerantData.displayName,
          phone: gerantData.phone,
          role: gerantData.roleId,
          clientId: null,
          isTest: false,
        }),
        'Initialisation contrôlée du gérant de GIE Taiba Voyages (Décision Gouvernance Phase 5D)',
      ]
    );
    console.log(`  ✅ Traçabilité enregistrée dans AUDIT_LOGS (${logId})`);

    // 3. Contrôle Strict d'Inviolabilité du Sanctuaire
    console.log('\n-> 3. Assertion stricte du sanctuaire financier et des données réelles...');
    const realClientsRes = await client.query(`SELECT COUNT(*) as count FROM clients WHERE is_test = FALSE;`);
    const realInsRes = await client.query(`SELECT COUNT(*) as count FROM inscriptions WHERE is_test = FALSE;`);
    const realPayRes = await client.query(`SELECT COUNT(*) as count, SUM(amount) as total FROM payments WHERE is_test = FALSE;`);
    const realExpRes = await client.query(`SELECT COUNT(*) as count FROM expenses;`);

    const clientCount = parseInt(realClientsRes.rows[0].count, 10);
    const insCount = parseInt(realInsRes.rows[0].count, 10);
    const payCount = parseInt(realPayRes.rows[0].count, 10);
    const totalAmount = parseFloat(realPayRes.rows[0].total);
    const expCount = parseInt(realExpRes.rows[0].count, 10);

    console.log(`  • Clients réels       : ${clientCount} (Attendu: 6)`);
    console.log(`  • Inscriptions réelles: ${insCount} (Attendu: 6)`);
    console.log(`  • Paiements réels     : ${payCount} pour ${totalAmount} FCFA (Attendu: 3 et 4 500 000 FCFA)`);
    console.log(`  • Dépenses réelles    : ${expCount} FCFA (Attendu: 0)`);

    if (clientCount !== 6 || insCount !== 6 || payCount !== 3 || totalAmount !== 4500000 || expCount !== 0) {
      throw new Error('VIOLATION_SANCTUAIRE : Les données réelles ont été altérées ! Rollback immédiat.');
    }

    await client.query('COMMIT');
    console.log('\n✅ TRANSACTION VALIDÉE ET COMMITTÉE AVEC SUCCÈS.');

    console.log('\n=====================================================================');
    console.log('  🏆 ONBOARDING RÉUSSI : Cheikh Ibrahima Ka est SUPER_ADMIN');
    console.log('=====================================================================');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ ÉCHEC ONBOARDING (ROLLBACK EFFECTUÉ) :', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1]?.endsWith('onboard-gerant-cheikh-ka.ts')) {
  onboardGerant()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      pool.end();
      process.exit(1);
    });
}
