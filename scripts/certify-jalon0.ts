import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pool } from '../server/db/neon.js';
import {
  formatBusinessYear,
  formatClientCode,
  formatInscriptionCode,
  formatPaymentReceiptNumber,
  formatExpenseCode,
} from '../server/utils/business-format.js';

const EXPECTED_DATABASE_JSON_SHA256 = '140ab4ea75a4aba802d4c1ec47b1d3d1b0f8b0de05f0c9216489fd3b7115f473';

interface AuditCheck {
  item: string;
  countOrRatio: string;
  status: 'PASS' | 'FAIL' | 'PRESERVED';
  detail: string;
}

async function certifyJalon0() {
  const checks: AuditCheck[] = [];
  const client = await pool.connect();

  try {
    console.log('=====================================================================');
    console.log('  AUDIT INDÉPENDANT EN LECTURE SEULE — CERTIFICATION DU JALON 0      ');
    console.log('  Devise : Nettoyer le faux. Préserver le vrai. Bloquer l\'inconnu.   ');
    console.log('=====================================================================\n');

    // 1. Clients (6/6 GT-000001 à GT-000006)
    const clientsRes = await client.query<{
      id: string;
      code: string;
      first_name: string;
      last_name: string;
      phone: string;
      passport_number: string | null;
      email: string | null;
    }>(`SELECT id, code, first_name, last_name, phone, passport_number, email FROM clients ORDER BY id`);

    const expectedClientCodes = [
      'GT-000001',
      'GT-000002',
      'GT-000003',
      'GT-000004',
      'GT-000005',
      'GT-000006',
    ];

    let clientsOk = clientsRes.rows.length === 6;
    let clientsPiiFree = true;

    for (let i = 0; i < clientsRes.rows.length; i++) {
      const c = clientsRes.rows[i];
      if (c.code !== expectedClientCodes[i]) clientsOk = false;

      // Contrôle anti-PII strict
      const codeUpper = c.code.toUpperCase();
      if (
        (c.first_name && codeUpper.includes(c.first_name.trim().toUpperCase())) ||
        (c.last_name && codeUpper.includes(c.last_name.trim().toUpperCase())) ||
        (c.phone && codeUpper.includes(c.phone.replace(/\D/g, ''))) ||
        (c.passport_number && codeUpper.includes(c.passport_number.trim().toUpperCase()))
      ) {
        clientsPiiFree = false;
      }
    }

    checks.push({
      item: 'Clients',
      countOrRatio: `${clientsRes.rows.length}/6`,
      status: clientsOk ? 'PASS' : 'FAIL',
      detail: clientsRes.rows.map(r => `${r.id} -> ${r.code}`).join(', '),
    });

    // 2. Inscriptions Hajj (6/6 GT-HJ27-000001 à GT-HJ27-000006)
    const insHajjRes = await client.query<{
      id: string;
      code: string;
      client_id: string;
      campaign_id: string;
      package_id: string;
      agreed_price: string;
    }>(`
      SELECT i.id, i.code, i.client_id, i.campaign_id, i.package_id, i.agreed_price 
      FROM inscriptions i
      JOIN campaigns c ON i.campaign_id = c.id
      WHERE c.type = 'HAJJ' AND i.status != 'ANNULEE'
      ORDER BY i.id
    `);

    const expectedHajjCodes = [
      'GT-HJ27-000001',
      'GT-HJ27-000002',
      'GT-HJ27-000003',
      'GT-HJ27-000004',
      'GT-HJ27-000005',
      'GT-HJ27-000006',
    ];

    let hajjOk = insHajjRes.rows.length === 6;
    for (let i = 0; i < insHajjRes.rows.length; i++) {
      if (insHajjRes.rows[i].code !== expectedHajjCodes[i]) hajjOk = false;
    }

    checks.push({
      item: 'Hajj',
      countOrRatio: `${insHajjRes.rows.length}/6`,
      status: hajjOk ? 'PASS' : 'FAIL',
      detail: insHajjRes.rows.map(r => `${r.id} -> ${r.code}`).join(', '),
    });

    // 3. Inscriptions Umrah (0/0)
    const insUmrahRes = await client.query(`
      SELECT i.id, i.code 
      FROM inscriptions i
      JOIN campaigns c ON i.campaign_id = c.id
      WHERE c.type IN ('UMRAH', 'OUMRAH') AND i.status != 'ANNULEE'
    `);
    const umrahOk = insUmrahRes.rows.length === 0;

    checks.push({
      item: 'Umrah',
      countOrRatio: `${insUmrahRes.rows.length}/0`,
      status: umrahOk ? 'PASS' : 'FAIL',
      detail: '0 dossier Umrah en base (conforme)',
    });

    // 4. Paiements (3/3 GT-PAY27-000001 à GT-PAY27-000003)
    const payRes = await client.query<{
      id: string;
      receipt_number: string;
      amount: string;
      client_id: string;
      inscription_id: string;
    }>(`SELECT id, receipt_number, amount, client_id, inscription_id FROM payments WHERE status = 'VALIDE' ORDER BY id`);

    const expectedPayCodes = [
      'GT-PAY27-000001',
      'GT-PAY27-000002',
      'GT-PAY27-000003',
    ];

    let payOk = payRes.rows.length === 3;
    for (let i = 0; i < payRes.rows.length; i++) {
      if (payRes.rows[i].receipt_number !== expectedPayCodes[i]) payOk = false;
    }

    checks.push({
      item: 'Paiements',
      countOrRatio: `${payRes.rows.length}/3`,
      status: payOk ? 'PASS' : 'FAIL',
      detail: payRes.rows.map(r => `${r.id} -> ${r.receipt_number} (${Number(r.amount).toLocaleString('fr-FR')} FCFA)`).join(', '),
    });

    // 5. UUIDs techniques préservés (15/15)
    const expectedClientUuids = ['cli-001', 'cli-002', 'cli-003', 'cli-004', 'cli-005', 'cli-006'];
    const expectedInsUuids = ['ins-001', 'ins-002', 'ins-003', 'ins-004', 'ins-005', 'ins-006'];
    const expectedPayUuids = ['pay-001', 'pay-002', 'pay-003'];

    const actualClientUuids = clientsRes.rows.map(r => r.id);
    const actualInsUuids = insHajjRes.rows.map(r => r.id);
    const actualPayUuids = payRes.rows.map(r => r.id);

    let uuidsPreservedCount = 0;
    expectedClientUuids.forEach(id => { if (actualClientUuids.includes(id)) uuidsPreservedCount++; });
    expectedInsUuids.forEach(id => { if (actualInsUuids.includes(id)) uuidsPreservedCount++; });
    expectedPayUuids.forEach(id => { if (actualPayUuids.includes(id)) uuidsPreservedCount++; });

    checks.push({
      item: 'UUID préservés',
      countOrRatio: `${uuidsPreservedCount}/15`,
      status: uuidsPreservedCount === 15 ? 'PASS' : 'FAIL',
      detail: 'Tous les IDs techniques initiaux sont strictement préservés sans altération',
    });

    // 6. Montants préservés (100%)
    const pay1 = payRes.rows.find(p => p.id === 'pay-001');
    const pay2 = payRes.rows.find(p => p.id === 'pay-002');
    const pay3 = payRes.rows.find(p => p.id === 'pay-003');

    const amountsOk =
      Number(pay1?.amount) === 250000 &&
      Number(pay2?.amount) === 250000 &&
      Number(pay3?.amount) === 4000000 &&
      insHajjRes.rows.every(i => Number(i.agreed_price) === 5100000);

    checks.push({
      item: 'Montants préservés',
      countOrRatio: '100%',
      status: amountsOk ? 'PASS' : 'FAIL',
      detail: 'Saidou (250k), Aissatou (250k), Fatoumata (4M), Snapshots (5.1M)',
    });

    // 7. Références préservées (100%)
    let refsOk = true;
    for (const ins of insHajjRes.rows) {
      if (!actualClientUuids.includes(ins.client_id)) refsOk = false;
    }
    for (const p of payRes.rows) {
      if (!actualClientUuids.includes(p.client_id) || !actualInsUuids.includes(p.inscription_id)) refsOk = false;
    }

    checks.push({
      item: 'Références préservées',
      countOrRatio: '100%',
      status: refsOk ? 'PASS' : 'FAIL',
      detail: 'Clés étrangères client_id et inscription_id intègres',
    });

    // 8. Unicité globale (collisions inter-domaines)
    const collisionRes = await client.query(`
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

    const unicityOk = collisionRes.rows.length === 0;
    checks.push({
      item: 'Unicité globale',
      countOrRatio: unicityOk ? 'PASS' : 'FAIL',
      status: unicityOk ? 'PASS' : 'FAIL',
      detail: '0 collision détectée entre clients, dossiers, paiements et dépenses',
    });

    // 9. Aucune PII
    checks.push({
      item: 'Aucune PII',
      countOrRatio: clientsPiiFree ? 'PASS' : 'FAIL',
      status: clientsPiiFree ? 'PASS' : 'FAIL',
      detail: 'Tous les matricules sont strictement séquentiels et anonymes',
    });

    // 10. Séquences atomiques dans business_sequences
    const seqsRes = await client.query<{ sequence_type: string; year: number; current_value: number }>(`
      SELECT sequence_type, year, current_value FROM business_sequences
    `);

    const seqMap = new Map<string, number>();
    seqsRes.rows.forEach(r => seqMap.set(`${r.sequence_type}_${r.year}`, Number(r.current_value)));

    const seqCli = seqMap.get('CLIENT_0');
    const seqHajj = seqMap.get('INSCRIPTION_HAJJ_2027');
    const seqUmrah = seqMap.get('INSCRIPTION_UMRAH_2027');
    const seqPay = seqMap.get('PAYMENT_2027');
    const seqExp27 = seqMap.get('EXPENSE_2027');

    const sequencesOk =
      seqCli === 6 &&
      seqHajj === 6 &&
      (seqUmrah === 0 || seqUmrah === undefined) &&
      seqPay === 3;

    checks.push({
      item: 'Séquences atomiques',
      countOrRatio: sequencesOk ? 'PASS' : 'FAIL',
      status: sequencesOk ? 'PASS' : 'FAIL',
      detail: `CLIENT_0=${seqCli}, INSCRIPTION_HAJJ_2027=${seqHajj}, INSCRIPTION_UMRAH_2027=${seqUmrah ?? 0}, PAYMENT_2027=${seqPay}`,
    });

    // 11. Prochains matricules calculés sans altérer les compteurs
    const nextClientCode = formatClientCode((seqCli ?? 6) + 1);
    const nextHajjCode = formatInscriptionCode('HAJJ', 2027, (seqHajj ?? 6) + 1);
    const nextUmrahCode = formatInscriptionCode('UMRAH', 2027, (seqUmrah ?? 0) + 1);
    const nextPayCode = formatPaymentReceiptNumber(2027, (seqPay ?? 3) + 1);
    const nextExpCode = formatExpenseCode(2027, (seqExp27 ?? 0) + 1);

    const nextCodesOk =
      nextClientCode === 'GT-000007' &&
      nextHajjCode === 'GT-HJ27-000007' &&
      nextUmrahCode === 'GT-UM27-000001' &&
      nextPayCode === 'GT-PAY27-000004' &&
      nextExpCode === 'GT-EXP27-000001';

    checks.push({
      item: 'Prochains matricules',
      countOrRatio: nextCodesOk ? 'PASS' : 'FAIL',
      status: nextCodesOk ? 'PASS' : 'FAIL',
      detail: `CLI:${nextClientCode}, HAJJ:${nextHajjCode}, UMRAH:${nextUmrahCode}, PAY:${nextPayCode}, EXP:${nextExpCode}`,
    });

    // 12. Baseline financière
    const totalCARes = await client.query(`SELECT COALESCE(SUM(agreed_price), 0) as ca FROM inscriptions WHERE status != 'ANNULEE'`);
    const totalPayRes = await client.query(`SELECT COALESCE(SUM(amount), 0) as paid FROM payments WHERE status = 'VALIDE'`);
    const totalExpRes = await client.query(`SELECT COALESCE(SUM(amount), 0) as exp FROM expenses`);

    const obsCA = Number(totalCARes.rows[0].ca);
    const obsPaid = Number(totalPayRes.rows[0].paid);
    const obsExp = Number(totalExpRes.rows[0].exp);
    const obsDue = obsCA - obsPaid;

    const baselineOk = obsCA === 30600000 && obsPaid === 4500000 && obsExp === 0 && obsDue === 26100000;

    checks.push({
      item: 'Baseline financière',
      countOrRatio: baselineOk ? 'PASS' : 'FAIL',
      status: baselineOk ? 'PASS' : 'FAIL',
      detail: `CA: ${obsCA}, Encaissé: ${obsPaid}, Dépenses: ${obsExp}, Solde: ${obsDue}`,
    });

    // 13. Visas (0)
    const visasRes = await client.query(`SELECT COUNT(*) as count FROM visas`);
    const visasCount = Number(visasRes.rows[0].count);
    const visasOk = visasCount === 0;

    checks.push({
      item: 'Visas',
      countOrRatio: `${visasCount}`,
      status: visasOk ? 'PASS' : 'FAIL',
      detail: '0 visa de test en base (règle suprême respectée)',
    });

    // 14. Confort UNKNOWN PRESERVED
    const pkgConfRes = await client.query(`SELECT id, code, price FROM packages WHERE id = 'pkg-conf-2027'`);
    const confPreserved = pkgConfRes.rows.length === 1 && Number(pkgConfRes.rows[0].price) === 5500000;

    checks.push({
      item: 'Confort',
      countOrRatio: 'UNKNOWN',
      status: confPreserved ? 'PRESERVED' : 'FAIL',
      detail: 'Package Confort (5 500 000 FCFA) strictement préservé sans altération',
    });

    // 15. database.json SHA-256
    const dbPath = path.join(process.cwd(), 'data', 'database.json');
    const dbBuf = fs.readFileSync(dbPath);
    const dbSha256 = crypto.createHash('sha256').update(dbBuf).digest('hex');
    const shaOk = dbSha256 === EXPECTED_DATABASE_JSON_SHA256;

    checks.push({
      item: 'database.json SHA-256',
      countOrRatio: shaOk ? 'PASS' : 'FAIL',
      status: shaOk ? 'PASS' : 'FAIL',
      detail: `${dbSha256} (${dbBuf.length} octets)`,
    });

    // 16. Migration idempotente (schema_migrations)
    const migRes = await client.query(`SELECT * FROM schema_migrations WHERE migration_name = 'MIGRATION_MATRICULES_JALON_0'`);
    const migOk = migRes.rows.length === 1 && migRes.rows[0].status === 'SUCCESS';

    checks.push({
      item: 'Migration idempotente',
      countOrRatio: migOk ? 'PASS' : 'FAIL',
      status: migOk ? 'PASS' : 'FAIL',
      detail: 'Consigné dans schema_migrations avec horodatage et audit log',
    });

    // Bilan global d'audit
    const allPassed = checks.every(c => c.status === 'PASS' || c.status === 'PRESERVED');

    console.log('\n--- DÉTAIL DES CONTRÔLES ---');
    checks.forEach(c => {
      console.log(`[${c.status}] ${c.item.padEnd(25)} : ${c.detail}`);
    });

    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║       GIE TAIBA VOYAGES — JALON 0                      ║');
    console.log('║       CERTIFICATION OFFICIELLE DES MATRICULES          ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log(`║ Clients                         6/6    ${clientsOk ? 'PASS' : 'FAIL'}     ║`);
    console.log(`║ Hajj                            6/6    ${hajjOk ? 'PASS' : 'FAIL'}     ║`);
    console.log(`║ Umrah                           0/0    ${umrahOk ? 'PASS' : 'FAIL'}     ║`);
    console.log(`║ Paiements                       3/3    ${payOk ? 'PASS' : 'FAIL'}     ║`);
    console.log(`║ UUID préservés                 15/15   ${uuidsPreservedCount === 15 ? 'PASS' : 'FAIL'}     ║`);
    console.log(`║ Montants préservés              100%   ${amountsOk ? 'PASS' : 'FAIL'}     ║`);
    console.log(`║ Références préservées           100%   ${refsOk ? 'PASS' : 'FAIL'}     ║`);
    console.log(`║ Unicité globale                 ${unicityOk ? 'PASS' : 'FAIL'}            ║`);
    console.log(`║ Aucune PII                      ${clientsPiiFree ? 'PASS' : 'FAIL'}            ║`);
    console.log(`║ Séquences atomiques             ${sequencesOk ? 'PASS' : 'FAIL'}            ║`);
    console.log(`║ Prochains matricules            ${nextCodesOk ? 'PASS' : 'FAIL'}            ║`);
    console.log(`║ Baseline financière             ${baselineOk ? 'PASS' : 'FAIL'}            ║`);
    console.log(`║ Visas                             0    ${visasOk ? 'PASS' : 'FAIL'}     ║`);
    console.log(`║ Confort                       UNKNOWN  ${confPreserved ? 'PRESERVED' : 'FAIL'}║`);
    console.log(`║ database.json SHA-256            ${shaOk ? 'PASS' : 'FAIL'}            ║`);
    console.log(`║ Migration idempotente            ${migOk ? 'PASS' : 'FAIL'}            ║`);
    console.log('╠════════════════════════════════════════════════════════╣');
    if (allPassed) {
      console.log('║              JALON 0 : CERTIFIÉ                        ║');
    } else {
      console.log('║            JALON 0 : NON CERTIFIÉ                      ║');
    }
    console.log('╚════════════════════════════════════════════════════════╝\n');

    if (!allPassed) {
      throw new Error('[JALON 0 ÉCHEC] Des contrôles de certification ont échoué.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

certifyJalon0().catch(err => {
  console.error(err);
  process.exit(1);
});
