import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pool } from '../server/db/neon.js';

const EXPECTED_DATABASE_JSON_SHA256 = '140ab4ea75a4aba802d4c1ec47b1d3d1b0f8b0de05f0c9216489fd3b7115f473';

async function migrateJalon0() {
  console.log('=====================================================================');
  console.log('  MIGRATION JALON 0 : NORMALISATION DES MATRICULES MÉTIER            ');
  console.log('  Devise : Nettoyer le faux. Préserver le vrai. Bloquer l\'inconnu.   ');
  console.log('=====================================================================\n');

  // 1. Contrôle intégrité cryptographique SHA-256 de database.json
  const dbJsonPath = path.join(process.cwd(), 'data', 'database.json');
  const dbJsonContent = fs.readFileSync(dbJsonPath);
  const actualHash = crypto.createHash('sha256').update(dbJsonContent).digest('hex');
  if (actualHash !== EXPECTED_DATABASE_JSON_SHA256) {
    throw new Error(`[SHA256 INTEGRITY ERROR] data/database.json altéré ! Attendu: ${EXPECTED_DATABASE_JSON_SHA256}, Observé: ${actualHash}`);
  }
  console.log(`[CONTRÔLE SHA-256] data/database.json certifié intact : ${actualHash} (${dbJsonContent.length} octets)`);

  const client = await pool.connect();
  try {
    // 2. Création et consultation de la table schema_migrations (Garde-fou Idempotence)
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_name TEXT PRIMARY KEY,
        executed_at TIMESTAMPTZ DEFAULT NOW(),
        status TEXT NOT NULL,
        details JSONB
      )
    `);

    const migCheck = await client.query(
      `SELECT * FROM schema_migrations WHERE migration_name = 'MIGRATION_MATRICULES_JALON_0'`
    );
    if (migCheck.rows.length > 0 && migCheck.rows[0].status === 'SUCCESS') {
      console.log('\n[IDEMPOTENCE] ✅ Migration MIGRATION_MATRICULES_JALON_0 déjà appliquée avec succès le ' + migCheck.rows[0].executed_at);
      console.log('[IDEMPOTENCE] Aucun compteur consommé, aucun UUID modifié, aucun matricule ré-altéré. Sortie propre.\n');
      return;
    }

    // 3. Démarrage de la transaction ACID unique
    await client.query('BEGIN');
    console.log('[TRANSACTION] Début de la transaction de migration...');

    // 4. Contrôle strict de l'état préalable avant modification (Interdiction de modification silencieuse)
    console.log('[PRE-CHECK] Vérification de l\'état exact avant migration...');

    const expectedClients: Record<string, string> = {
      'cli-001': 'GIE-T0001',
      'cli-002': 'GIE-T0002',
      'cli-003': 'GIE-T0003',
      'cli-004': 'GIE-T0004',
      'cli-005': 'GIE-T0005',
      'cli-006': 'GIE-T0006',
    };

    const clientsRes = await client.query<{ id: string; code: string; first_name: string; last_name: string }>(
      `SELECT id, code, first_name, last_name FROM clients ORDER BY id`
    );

    if (clientsRes.rows.length !== 6) {
      throw new Error(`[PRE-CHECK FAIL] Nombre de clients incorrect: ${clientsRes.rows.length} (attendu: 6). ROLLBACK.`);
    }

    for (const c of clientsRes.rows) {
      const expCode = expectedClients[c.id];
      if (c.code !== expCode) {
        throw new Error(`[PRE-CHECK FAIL] Client ${c.id} (${c.first_name} ${c.last_name}) a le code ${c.code} au lieu de ${expCode}. STOP + ROLLBACK.`);
      }
    }
    console.log('  ✓ 6/6 clients vérifiés avec leurs codes initiaux (GIE-T0001 à GIE-T0006)');

    const expectedInscriptions: Record<string, string> = {
      'ins-001': 'INS-2027-001',
      'ins-002': 'INS-2027-002',
      'ins-003': 'INS-2027-003',
      'ins-004': 'INS-2027-004',
      'ins-005': 'INS-2027-005',
      'ins-006': 'INS-2027-006',
    };

    const insRes = await client.query<{ id: string; code: string; client_id: string }>(
      `SELECT id, code, client_id FROM inscriptions ORDER BY id`
    );

    if (insRes.rows.length !== 6) {
      throw new Error(`[PRE-CHECK FAIL] Nombre d'inscriptions incorrect: ${insRes.rows.length} (attendu: 6). ROLLBACK.`);
    }

    for (const i of insRes.rows) {
      const expCode = expectedInscriptions[i.id];
      if (i.code !== expCode) {
        throw new Error(`[PRE-CHECK FAIL] Inscription ${i.id} a le code ${i.code} au lieu de ${expCode}. STOP + ROLLBACK.`);
      }
    }
    console.log('  ✓ 6/6 inscriptions vérifiées avec leurs codes initiaux (INS-2027-001 à INS-2027-006)');

    const expectedPayments: Record<string, { receipt: string; amount: number }> = {
      'pay-001': { receipt: 'PAY-2027-0001', amount: 250000 },
      'pay-002': { receipt: 'PAY-2027-0002', amount: 250000 },
      'pay-003': { receipt: 'PAY-2027-0003', amount: 4000000 },
    };

    const payRes = await client.query<{ id: string; receipt_number: string; amount: string; client_id: string }>(
      `SELECT id, receipt_number, amount, client_id FROM payments WHERE status = 'VALIDE' ORDER BY id`
    );

    if (payRes.rows.length !== 3) {
      throw new Error(`[PRE-CHECK FAIL] Nombre de versements réels incorrect: ${payRes.rows.length} (attendu: 3). ROLLBACK.`);
    }

    for (const p of payRes.rows) {
      const exp = expectedPayments[p.id];
      if (!exp || p.receipt_number !== exp.receipt || Number(p.amount) !== exp.amount) {
        throw new Error(`[PRE-CHECK FAIL] Paiement ${p.id} divergent (Reçu: ${p.receipt_number}, Montant: ${p.amount}). STOP + ROLLBACK.`);
      }
    }
    console.log('  ✓ 3/3 versements vérifiés avec leurs reçus initiaux (PAY-2027-0001 à PAY-2027-0003)');

    // 5. Application des nouveaux matricules métier Jalon 0
    console.log('\n[APPLICATION] Normalisation des matricules...');

    // Clients GT-000001 à GT-000006
    await client.query(`UPDATE clients SET code = 'GT-000001', updated_at = NOW() WHERE id = 'cli-001'`);
    await client.query(`UPDATE clients SET code = 'GT-000002', updated_at = NOW() WHERE id = 'cli-002'`);
    await client.query(`UPDATE clients SET code = 'GT-000003', updated_at = NOW() WHERE id = 'cli-003'`);
    await client.query(`UPDATE clients SET code = 'GT-000004', updated_at = NOW() WHERE id = 'cli-004'`);
    await client.query(`UPDATE clients SET code = 'GT-000005', updated_at = NOW() WHERE id = 'cli-005'`);
    await client.query(`UPDATE clients SET code = 'GT-000006', updated_at = NOW() WHERE id = 'cli-006'`);
    console.log('  ✓ Clients normalisés vers GT-000001 à GT-000006');

    // Inscriptions Hajj GT-HJ27-000001 à GT-HJ27-000006
    await client.query(`UPDATE inscriptions SET code = 'GT-HJ27-000001', updated_at = NOW() WHERE id = 'ins-001'`);
    await client.query(`UPDATE inscriptions SET code = 'GT-HJ27-000002', updated_at = NOW() WHERE id = 'ins-002'`);
    await client.query(`UPDATE inscriptions SET code = 'GT-HJ27-000003', updated_at = NOW() WHERE id = 'ins-003'`);
    await client.query(`UPDATE inscriptions SET code = 'GT-HJ27-000004', updated_at = NOW() WHERE id = 'ins-004'`);
    await client.query(`UPDATE inscriptions SET code = 'GT-HJ27-000005', updated_at = NOW() WHERE id = 'ins-005'`);
    await client.query(`UPDATE inscriptions SET code = 'GT-HJ27-000006', updated_at = NOW() WHERE id = 'ins-006'`);
    console.log('  ✓ Inscriptions Hajj 2027 normalisées vers GT-HJ27-000001 à GT-HJ27-000006');

    // Paiements GT-PAY27-000001 à GT-PAY27-000003
    await client.query(`UPDATE payments SET receipt_number = 'GT-PAY27-000001' WHERE id = 'pay-001'`);
    await client.query(`UPDATE payments SET receipt_number = 'GT-PAY27-000002' WHERE id = 'pay-002'`);
    await client.query(`UPDATE payments SET receipt_number = 'GT-PAY27-000003' WHERE id = 'pay-003'`);
    console.log('  ✓ Paiements normalisés vers GT-PAY27-000001 à GT-PAY27-000003');

    // 6. Mise à jour atomique des séquences PostgreSQL (Séparation stricte Hajj / Umrah)
    console.log('\n[SÉQUENCES] Réalignement des séquences business_sequences...');
    await client.query(`
      INSERT INTO business_sequences (sequence_type, year, current_value, updated_at)
      VALUES ('CLIENT', 0, 6, NOW())
      ON CONFLICT (sequence_type, year) DO UPDATE SET current_value = 6, updated_at = NOW();

      INSERT INTO business_sequences (sequence_type, year, current_value, updated_at)
      VALUES ('INSCRIPTION_HAJJ', 2027, 6, NOW())
      ON CONFLICT (sequence_type, year) DO UPDATE SET current_value = 6, updated_at = NOW();

      INSERT INTO business_sequences (sequence_type, year, current_value, updated_at)
      VALUES ('INSCRIPTION_UMRAH', 2027, 0, NOW())
      ON CONFLICT (sequence_type, year) DO UPDATE SET current_value = 0, updated_at = NOW();

      INSERT INTO business_sequences (sequence_type, year, current_value, updated_at)
      VALUES ('PAYMENT', 2027, 3, NOW())
      ON CONFLICT (sequence_type, year) DO UPDATE SET current_value = 3, updated_at = NOW();

      INSERT INTO business_sequences (sequence_type, year, current_value, updated_at)
      VALUES ('EXPENSE', 2027, 0, NOW())
      ON CONFLICT (sequence_type, year) DO UPDATE SET current_value = 0, updated_at = NOW();

      INSERT INTO business_sequences (sequence_type, year, current_value, updated_at)
      VALUES ('EXPENSE', 2026, 0, NOW())
      ON CONFLICT (sequence_type, year) DO UPDATE SET current_value = 0, updated_at = NOW();
    `);
    console.log('  ✓ Séquences atomiques configurées : CLIENT=6, INSCRIPTION_HAJJ(2027)=6, INSCRIPTION_UMRAH(2027)=0, PAYMENT(2027)=3, EXPENSE=0');

    // 7. Contrôle d'unicité globale inter-tables (Point 3 de l'audit)
    console.log('\n[CONTRÔLE UNICITÉ GLOBALE] Vérification des collisions inter-domaines...');
    const collisionCheck = await client.query(`
      SELECT code, COUNT(*) as occurrences
      FROM (
        SELECT code FROM clients
        UNION ALL
        SELECT code FROM inscriptions
        UNION ALL
        SELECT receipt_number AS code FROM payments
        UNION ALL
        SELECT code FROM expenses WHERE code IS NOT NULL
      ) x
      GROUP BY code
      HAVING COUNT(*) > 1;
    `);

    if (collisionCheck.rows.length > 0) {
      throw new Error(`[COLLISION DÉTECTÉE] Des matricules entrent en collision: ${JSON.stringify(collisionCheck.rows)}. ROLLBACK.`);
    }
    console.log('  ✓ 0 collision globale détectée entre clients, inscriptions, paiements et dépenses.');

    // 8. Contrôle des invariants financiers stricts
    console.log('\n[CONTRÔLE FINANCIER] Vérification de la baseline officielle...');
    const caRes = await client.query(`SELECT COALESCE(SUM(agreed_price), 0) as ca FROM inscriptions WHERE status != 'ANNULEE'`);
    const paySumRes = await client.query(`SELECT COALESCE(SUM(amount), 0) as paid FROM payments WHERE status = 'VALIDE'`);
    const expRes = await client.query(`SELECT COALESCE(SUM(amount), 0) as exp FROM expenses`);

    const ca = Number(caRes.rows[0].ca);
    const paid = Number(paySumRes.rows[0].paid);
    const exp = Number(expRes.rows[0].exp);
    const due = ca - paid;

    if (ca !== 30600000 || paid !== 4500000 || exp !== 0 || due !== 26100000) {
      throw new Error(`[BASELINE CORROMPUE] CA: ${ca}, Encaissé: ${paid}, Dépenses: ${exp}, Solde: ${due}. ROLLBACK.`);
    }
    console.log(`  ✓ Baseline financière strictement intacte : CA=${ca}, Encaissé=${paid}, Dépenses=${exp}, Solde=${due}`);

    // 9. Enregistrement dans schema_migrations et audit_logs
    await client.query(`
      INSERT INTO schema_migrations (migration_name, executed_at, status, details)
      VALUES ($1, NOW(), 'SUCCESS', $2)
    `, [
      'MIGRATION_MATRICULES_JALON_0',
      JSON.stringify({
        migratedClients: 6,
        migratedInscriptionsHajj: 6,
        migratedPayments: 3,
        databaseJsonSha256: actualHash,
        invariants: { ca, paid, exp, due },
      }),
    ]);

    await client.query(`
      INSERT INTO audit_logs (id, actor_user_id, actor_user_name, action, entity_type, entity_id, new_value)
      VALUES ($1, 'usr-admin', 'Super Admin (Système)', 'MIGRATION_MATRICULES_JALON_0', 'SYSTEM', 'MIGRATION_JALON_0', $2)
    `, [
      crypto.randomUUID(),
      JSON.stringify({
        summary: 'Normalisation officielle des matricules métier GT-*',
        clientPattern: 'GT-XXXXXX',
        hajjPattern: 'GT-HJ27-XXXXXX',
        umrahPattern: 'GT-UM27-XXXXXX',
        paymentPattern: 'GT-PAY27-XXXXXX',
        expensePattern: 'GT-EXP<YY>-XXXXXX',
      }),
    ]);

    // 10. Validation finale de la transaction
    await client.query('COMMIT');
    console.log('\n🟢 [COMMIT SUCCÈS] Migration Jalon 0 validée et enregistrée avec succès.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n🔴 [ROLLBACK] Erreur durant la migration. Base rétablie à son état antérieur :', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateJalon0().catch((err) => {
  console.error(err);
  process.exit(1);
});
