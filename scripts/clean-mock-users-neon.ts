import 'dotenv/config';
import { pool } from '../server/db/neon.js';

export async function cleanMockUsersNeon() {
  console.log('=====================================================================');
  console.log('  ASSAINISSEMENT NEON CLOUD — COMPTES FICTIFS & SANCTUAIRE FINANCIER');
  console.log('=====================================================================');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Assertions Préliminaires
    console.log('\n-> 1. Vérification stricte des préconditions métier...');
    const cheikhRes = await client.query(
      `SELECT id, email, display_name, role_id FROM users WHERE id = 'usr-gerant-cheikh-ka' AND email = 'kabaye73@gmail.com'`
    );
    if (cheikhRes.rows.length === 0) {
      throw new Error('PRECONDITION_FAIL: Le compte gérant usr-gerant-cheikh-ka (kabaye73@gmail.com) est introuvable.');
    }
    console.log('  ✅ Gérant Cheikh Ibrahima Ka confirmé comme cible de réaffectation.');

    const insRes = await client.query(`SELECT id, agent_id FROM inscriptions WHERE is_test = FALSE ORDER BY id ASC`);
    if (insRes.rows.length !== 6) {
      throw new Error(`PRECONDITION_FAIL: Attendu 6 inscriptions réelles, trouvé ${insRes.rows.length}`);
    }
    console.log(`  ✅ 6 inscriptions réelles confirmées (${insRes.rows.map(r => r.id).join(', ')})`);

    const payRes = await client.query(`SELECT id, amount, agent_id FROM payments WHERE is_test = FALSE ORDER BY id ASC`);
    if (payRes.rows.length !== 3) {
      throw new Error(`PRECONDITION_FAIL: Attendu 3 paiements réels, trouvé ${payRes.rows.length}`);
    }
    const totalAmount = payRes.rows.reduce((sum, r) => sum + parseFloat(r.amount), 0);
    if (totalAmount !== 4500000) {
      throw new Error(`PRECONDITION_FAIL: Total paiements attendu 4 500 000 FCFA, obtenu ${totalAmount}`);
    }
    console.log(`  ✅ 3 paiements réels confirmés pour un montant exact de ${totalAmount} FCFA`);

    const expRes = await client.query(`SELECT COUNT(*) as count FROM expenses`);
    if (parseInt(expRes.rows[0].count, 10) !== 0) {
      throw new Error(`PRECONDITION_FAIL: Dépenses attendues 0, obtenu ${expRes.rows[0].count}`);
    }
    console.log('  ✅ 0 dépense confirmée.');

    // 2. Réaffectation Ciblée
    console.log('\n-> 2. Réaffectation ciblée des clés étrangères vers Cheikh Ibrahima Ka...');
    const targetInsIds = ['ins-001', 'ins-002', 'ins-003', 'ins-004', 'ins-005', 'ins-006'];
    const updateInsRes = await client.query(
      `UPDATE inscriptions SET agent_id = 'usr-gerant-cheikh-ka', updated_at = NOW() WHERE id = ANY($1::text[])`,
      [targetInsIds]
    );
    console.log(`  ✅ ${updateInsRes.rowCount} inscriptions réaffectées à usr-gerant-cheikh-ka (attendu: 6)`);
    if (updateInsRes.rowCount !== 6) {
      throw new Error(`ERREUR_REAFFECTATION: Attendu 6 inscriptions mises à jour, obtenu ${updateInsRes.rowCount}`);
    }

    const targetPayIds = ['pay-001', 'pay-002', 'pay-003'];
    const updatePayRes = await client.query(
      `UPDATE payments SET agent_id = 'usr-gerant-cheikh-ka', agent_name = 'Cheikh Ibrahima Ka' WHERE id = ANY($1::text[])`,
      [targetPayIds]
    );
    console.log(`  ✅ ${updatePayRes.rowCount} paiements réaffectés à usr-gerant-cheikh-ka (attendu: 3)`);
    if (updatePayRes.rowCount !== 3) {
      throw new Error(`ERREUR_REAFFECTATION: Attendu 3 paiements mis à jour, obtenu ${updatePayRes.rowCount}`);
    }

    // 3. Suppression des Liaisons user_client_access des comptes fictifs
    console.log('\n-> 3. Suppression des liaisons dans user_client_access pour les comptes fictifs...');
    const delUcaRes = await client.query(
      `DELETE FROM user_client_access WHERE user_id = 'usr-pelerin-niass'`
    );
    console.log(`  ✅ ${delUcaRes.rowCount} liaison(s) supprimée(s) de user_client_access`);

    // 4. Suppression des Rôles dans user_roles pour les 6 comptes cibles
    console.log('\n-> 4. Suppression des rôles dans user_roles pour les 6 comptes fictifs...');
    const mockUserIds = [
      'usr-direction',
      'usr-caisse',
      'usr-agent',
      'usr-logistique',
      'usr-admin',
      'usr-pelerin-niass'
    ];
    const delRolesRes = await client.query(
      `DELETE FROM user_roles WHERE user_id = ANY($1::text[])`,
      [mockUserIds]
    );
    console.log(`  ✅ ${delRolesRes.rowCount} rôle(s) supprimé(s) de user_roles`);

    // 5. Suppression des 6 comptes fictifs dans users
    console.log('\n-> 5. Suppression des 6 comptes fictifs dans users...');
    const delUsersRes = await client.query(
      `DELETE FROM users WHERE id = ANY($1::text[])`,
      [mockUserIds]
    );
    console.log(`  ✅ ${delUsersRes.rowCount} compte(s) fictif(s) supprimé(s) de users (attendu: 6)`);
    if (delUsersRes.rowCount !== 6) {
      throw new Error(`ERREUR_SUPPRESSION: Attendu 6 comptes supprimés, obtenu ${delUsersRes.rowCount}`);
    }

    // 6. Assertions Finales Strictes (Invariants Post-Mutation)
    console.log('\n-> 6. Validation stricte des invariants post-mutation...');
    const remainingUsers = await client.query(
      `SELECT id, email, display_name, role_id, is_test FROM users ORDER BY created_at ASC`
    );
    console.log('  Comptes restants en base Neon :');
    console.table(remainingUsers.rows);

    // Vérifier qu'aucun compte fictif n'existe
    const foundFictional = remainingUsers.rows.filter(r => mockUserIds.includes(r.id));
    if (foundFictional.length > 0) {
      throw new Error(`INVARIANT_FAIL: Des comptes fictifs subsistent : ${JSON.stringify(foundFictional)}`);
    }

    // Vérifier les comptes obligatoires
    const hasAbdoulaye = remainingUsers.rows.some(
      r => r.id === 'usr-superadmin-niass' && r.email === 'mr.niass@gmail.com' && r.role_id === 'SUPER_ADMIN'
    );
    const hasCheikh = remainingUsers.rows.some(
      r => r.id === 'usr-gerant-cheikh-ka' && r.email === 'kabaye73@gmail.com' && r.role_id === 'SUPER_ADMIN'
    );
    const hasSaidou = remainingUsers.rows.some(
      r => r.id === 'usr-pelerin-saidou' && r.email === 'saidou.sow@email.sn' && r.role_id === 'PELERIN'
    );

    if (!hasAbdoulaye || !hasCheikh || !hasSaidou) {
      throw new Error('INVARIANT_FAIL: Un des comptes légitimes essentiels est manquant !');
    }

    // Contrôle inviolable du Sanctuaire
    const postClients = await client.query(`SELECT COUNT(*) as count FROM clients WHERE is_test = FALSE`);
    const postIns = await client.query(`SELECT COUNT(*) as count FROM inscriptions WHERE is_test = FALSE`);
    const postPay = await client.query(`SELECT COUNT(*) as count, SUM(amount) as total FROM payments WHERE is_test = FALSE`);
    const postExp = await client.query(`SELECT COUNT(*) as count FROM expenses`);

    const cCount = parseInt(postClients.rows[0].count, 10);
    const iCount = parseInt(postIns.rows[0].count, 10);
    const pCount = parseInt(postPay.rows[0].count, 10);
    const pTotal = parseFloat(postPay.rows[0].total);
    const eCount = parseInt(postExp.rows[0].count, 10);

    console.log(`  • Clients réels       : ${cCount} (Attendu: 6)`);
    console.log(`  • Inscriptions réelles: ${iCount} (Attendu: 6)`);
    console.log(`  • Paiements réels     : ${pCount} pour ${pTotal} FCFA (Attendu: 3 et 4 500 000 FCFA)`);
    console.log(`  • Dépenses réelles    : ${eCount} (Attendu: 0)`);

    if (cCount !== 6 || iCount !== 6 || pCount !== 3 || pTotal !== 4500000 || eCount !== 0) {
      throw new Error('SANCTUAIRE_ALTERE: Violation d\'invariant financier détectée ! ROLLBACK immédiat.');
    }

    await client.query('COMMIT');
    console.log('\n=====================================================================');
    console.log('  ✅ TRANSACTION ATOMIQUE VALIDÉE & COMMITTÉE : BASE NEON ASSAINIE');
    console.log('=====================================================================');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ ÉCHEC ASSAINISSEMENT (ROLLBACK EFFECTUÉ SANS MODIFICATION) :', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1]?.endsWith('clean-mock-users-neon.ts')) {
  cleanMockUsersNeon()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      pool.end();
      process.exit(1);
    });
}
