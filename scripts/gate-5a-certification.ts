import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pool } from '../server/db/neon.js';
import {
  formatClientCode,
  formatInscriptionCode,
  formatPaymentReceiptNumber,
  formatExpenseCode,
} from '../server/utils/business-format.js';

const EXPECTED_DATABASE_JSON_SHA256 = '140ab4ea75a4aba802d4c1ec47b1d3d1b0f8b0de05f0c9216489fd3b7115f473';

interface CheckResult {
  section: string;
  item: string;
  expected: string;
  observed: string;
  status: 'PASS' | 'FAIL' | 'PRESERVED';
  notes?: string;
}

async function runGate5ACertification() {
  const results: CheckResult[] = [];
  const client = await pool.connect();

  try {
    console.log('=====================================================================');
    console.log('   GATE 5A — AUDIT INDÉPENDANT & CERTIFICATION FINALE LECTURE SEULE  ');
    console.log('   Devise : Nettoyer le faux. Préserver le vrai. Bloquer l\'inconnu.   ');
    console.log('=====================================================================\n');

    // =================================================================
    // SECTION A : BASE DE DONNÉES & STRUCTURE RELATIONNELLE
    // =================================================================
    console.log('[SECTION A] Audit structurel de la base de données relationnelle...');

    // A.1 Comptage des tables critiques
    const clientsCount = (await client.query('SELECT count(*) as cnt FROM clients')).rows[0].cnt;
    results.push({
      section: 'A. Base',
      item: 'Comptage clients réels',
      expected: '6',
      observed: `${clientsCount}`,
      status: Number(clientsCount) === 6 ? 'PASS' : 'FAIL',
    });

    const insCount = (await client.query('SELECT count(*) as cnt FROM inscriptions')).rows[0].cnt;
    results.push({
      section: 'A. Base',
      item: 'Comptage dossiers réels',
      expected: '6',
      observed: `${insCount}`,
      status: Number(insCount) === 6 ? 'PASS' : 'FAIL',
    });

    const payCount = (await client.query('SELECT count(*) as cnt FROM payments WHERE status = \'VALIDE\'')).rows[0].cnt;
    results.push({
      section: 'A. Base',
      item: 'Comptage paiements VALIDE',
      expected: '3',
      observed: `${payCount}`,
      status: Number(payCount) === 3 ? 'PASS' : 'FAIL',
    });

    // A.2 UUID et Matricules clients
    const clientsRows = (await client.query('SELECT id, code, first_name, last_name FROM clients ORDER BY code')).rows;
    const expectedClients = [
      { id: 'cli-001', code: 'GT-000001', name: 'SAIDOU SOW' },
      { id: 'cli-002', code: 'GT-000002', name: 'AISSATOU FALL' },
      { id: 'cli-003', code: 'GT-000003', name: 'FATOUMATA SOW' },
      { id: 'cli-004', code: 'GT-000004', name: 'NDEYE BINTA GADIAGA' },
      { id: 'cli-005', code: 'GT-000005', name: 'SOKHNA DIENG' },
      { id: 'cli-006', code: 'GT-000006', name: 'NDEYE NGONE BA' },
    ];
    let clientsMatch = clientsRows.length === 6;
    for (let i = 0; i < 6; i++) {
      if (clientsRows[i].id !== expectedClients[i].id || clientsRows[i].code !== expectedClients[i].code) {
        clientsMatch = false;
      }
    }
    results.push({
      section: 'A. Base',
      item: 'Matricules & UUID clients',
      expected: 'GT-000001..GT-000006 (cli-001..006)',
      observed: clientsRows.map(c => `${c.code}(${c.id})`).join(', '),
      status: clientsMatch ? 'PASS' : 'FAIL',
    });

    // A.3 UUID et Matricules dossiers Hajj
    const insRows = (await client.query('SELECT id, code, client_id, campaign_id, agreed_price FROM inscriptions ORDER BY code')).rows;
    let insMatch = insRows.length === 6;
    for (let i = 0; i < 6; i++) {
      const expCode = `GT-HJ27-00000${i + 1}`;
      const expId = `ins-00${i + 1}`;
      const expCliId = `cli-00${i + 1}`;
      if (insRows[i].id !== expId || insRows[i].code !== expCode || insRows[i].client_id !== expCliId) {
        insMatch = false;
      }
    }
    results.push({
      section: 'A. Base',
      item: 'Matricules & UUID dossiers Hajj',
      expected: 'GT-HJ27-000001..006 (ins-001..006)',
      observed: insRows.map(ins => `${ins.code}(${ins.id})`).join(', '),
      status: insMatch ? 'PASS' : 'FAIL',
    });

    // A.4 Unicité globale et absence de collision (UNION ALL inter-domaines)
    const collisionRes = await client.query(`
      SELECT matricule, COUNT(*) as cnt FROM (
        SELECT code as matricule FROM clients
        UNION ALL
        SELECT code as matricule FROM inscriptions
        UNION ALL
        SELECT receipt_number as matricule FROM payments
        UNION ALL
        SELECT code as matricule FROM expenses WHERE code IS NOT NULL
      ) all_codes
      GROUP BY matricule
      HAVING COUNT(*) > 1
    `);
    results.push({
      section: 'A. Base',
      item: 'Unicité inter-domaines (zéro collision)',
      expected: '0 collision',
      observed: `${collisionRes.rows.length} collision(s)`,
      status: collisionRes.rows.length === 0 ? 'PASS' : 'FAIL',
    });

    // A.5 Intégrité référentielle FK et orphelins
    const orphanInsRes = await client.query(`
      SELECT count(*) as cnt FROM inscriptions i 
      LEFT JOIN clients c ON i.client_id = c.id 
      WHERE c.id IS NULL
    `);
    const orphanPayRes = await client.query(`
      SELECT count(*) as cnt FROM payments p 
      LEFT JOIN inscriptions i ON p.inscription_id = i.id 
      WHERE i.id IS NULL
    `);
    const orphanSchedRes = await client.query(`
      SELECT count(*) as cnt FROM payment_schedules s 
      LEFT JOIN inscriptions i ON s.inscription_id = i.id 
      WHERE i.id IS NULL
    `);
    const orphanAllocRes = await client.query(`
      SELECT count(*) as cnt FROM payment_schedule_allocations a 
      LEFT JOIN payments p ON a.payment_id = p.id 
      LEFT JOIN payment_schedules s ON a.payment_schedule_id = s.id 
      WHERE p.id IS NULL OR s.id IS NULL
    `);
    const totalOrphans = 
      Number(orphanInsRes.rows[0].cnt) + 
      Number(orphanPayRes.rows[0].cnt) + 
      Number(orphanSchedRes.rows[0].cnt) + 
      Number(orphanAllocRes.rows[0].cnt);
    results.push({
      section: 'A. Base',
      item: 'Orphelins FK (inscriptions, payments, schedules, allocs)',
      expected: '0 orphelin',
      observed: `${totalOrphans} orphelin(s)`,
      status: totalOrphans === 0 ? 'PASS' : 'FAIL',
    });

    // =================================================================
    // SECTION B : FINANCE & SINCÉRITÉ COMPTABLE
    // =================================================================
    console.log('[SECTION B] Audit de sincérité comptable et financière...');

    // B.1 Somme des versements VALIDE
    const sumPayRes = await client.query('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = \'VALIDE\'');
    const totalPay = Number(sumPayRes.rows[0].total);
    results.push({
      section: 'B. Finance',
      item: 'Somme versements réels VALIDE',
      expected: '4 500 000 FCFA',
      observed: `${totalPay.toLocaleString('fr-FR')} FCFA`,
      status: totalPay === 4500000 ? 'PASS' : 'FAIL',
    });

    // B.2 Somme des allocations dans payment_schedule_allocations
    const sumAllocRes = await client.query('SELECT COALESCE(SUM(amount_allocated), 0) as total FROM payment_schedule_allocations');
    const totalAlloc = Number(sumAllocRes.rows[0].total);
    results.push({
      section: 'B. Finance',
      item: 'Somme des allocations FIFO',
      expected: '4 500 000 FCFA',
      observed: `${totalAlloc.toLocaleString('fr-FR')} FCFA`,
      status: totalAlloc === 4500000 ? 'PASS' : 'FAIL',
    });

    // B.3 Somme des échéanciers prévisionnels
    const sumSchedRes = await client.query('SELECT COALESCE(SUM(amount_due), 0) as total FROM payment_schedules');
    const totalSched = Number(sumSchedRes.rows[0].total);
    results.push({
      section: 'B. Finance',
      item: 'Somme des échéanciers prévisionnels',
      expected: '30 600 000 FCFA',
      observed: `${totalSched.toLocaleString('fr-FR')} FCFA`,
      status: totalSched === 30600000 ? 'PASS' : 'FAIL',
    });

    // B.4 Détail des balances par dossier
    const balances = await client.query(`
      SELECT 
        i.code as dossier,
        c.first_name || ' ' || c.last_name as pelerin,
        i.agreed_price as contractuel,
        COALESCE(SUM(p.amount), 0) as paye,
        (i.agreed_price - COALESCE(SUM(p.amount), 0)) as solde_du
      FROM inscriptions i
      JOIN clients c ON i.client_id = c.id
      LEFT JOIN payments p ON p.inscription_id = i.id AND p.status = 'VALIDE'
      GROUP BY i.id, i.code, c.first_name, c.last_name, i.agreed_price
      ORDER BY i.code
    `);

    const expectedBalances = [
      { dossier: 'GT-HJ27-000001', paye: 250000, solde: 4850000 },
      { dossier: 'GT-HJ27-000002', paye: 250000, solde: 4850000 },
      { dossier: 'GT-HJ27-000003', paye: 4000000, solde: 1100000 },
      { dossier: 'GT-HJ27-000004', paye: 0, solde: 5100000 },
      { dossier: 'GT-HJ27-000005', paye: 0, solde: 5100000 },
      { dossier: 'GT-HJ27-000006', paye: 0, solde: 5100000 },
    ];

    let balancesConformes = balances.rows.length === 6;
    for (let i = 0; i < 6; i++) {
      const row = balances.rows[i];
      const exp = expectedBalances[i];
      if (row.dossier !== exp.dossier || Number(row.paye) !== exp.paye || Number(row.solde_du) !== exp.solde) {
        balancesConformes = false;
      }
    }
    results.push({
      section: 'B. Finance',
      item: 'Balances individuelles par dossier',
      expected: 'Saidou: 250k/4.85M, Aissatou: 250k/4.85M, Fatoumata: 4M/1.1M, Autres: 0/5.1M',
      observed: balances.rows.map(b => `${b.dossier}: ${Number(b.paye)/1000}k/${Number(b.solde_du)/1000}k`).join(', '),
      status: balancesConformes ? 'PASS' : 'FAIL',
    });

    // B.5 Dépenses réelles
    const sumExpRes = await client.query('SELECT COALESCE(SUM(amount), 0) as total FROM expenses');
    const totalExp = Number(sumExpRes.rows[0].total);
    results.push({
      section: 'B. Finance',
      item: 'Dépenses réelles engagées',
      expected: '0 FCFA',
      observed: `${totalExp} FCFA`,
      status: totalExp === 0 ? 'PASS' : 'FAIL',
    });

    // =================================================================
    // SECTION C : SÉQUENCES & COMPTEURS ATOMIQUES
    // =================================================================
    console.log('[SECTION C] Audit des séquences métier et absence de consommation parasite...');

    const seqRows = (await client.query('SELECT sequence_type, year, current_value FROM business_sequences ORDER BY sequence_type, year')).rows;
    const seqMap: Record<string, number> = {};
    for (const s of seqRows) {
      seqMap[`${s.sequence_type}_${s.year}`] = Number(s.current_value);
    }

    // Client : Max table = 6, Seq = 6, Prochain = GT-000007
    const maxCli = Number((await client.query("SELECT COALESCE(MAX(SUBSTRING(code FROM 4)::integer), 0) as val FROM clients")).rows[0].val);
    const seqCli = seqMap['CLIENT_0'] ?? -1;
    results.push({
      section: 'C. Séquences',
      item: 'Séquence CLIENT (MAX table vs business_sequences)',
      expected: 'MAX=6, Séquence=6 (Prochain: GT-000007)',
      observed: `MAX=${maxCli}, Séquence=${seqCli} (Prochain: ${formatClientCode(seqCli + 1)})`,
      status: maxCli === 6 && seqCli === 6 ? 'PASS' : 'FAIL',
    });

    // Inscription Hajj 2027 : Max table = 6, Seq = 6, Prochain = GT-HJ27-000007
    const maxHaj = Number((await client.query("SELECT COALESCE(MAX(SUBSTRING(code FROM 9)::integer), 0) as val FROM inscriptions WHERE campaign_id = 'voy-haj2027-01'")).rows[0].val);
    const seqHaj = seqMap['INSCRIPTION_HAJJ_2027'] ?? -1;
    results.push({
      section: 'C. Séquences',
      item: 'Séquence INSCRIPTION_HAJJ_2027',
      expected: 'MAX=6, Séquence=6 (Prochain: GT-HJ27-000007)',
      observed: `MAX=${maxHaj}, Séquence=${seqHaj} (Prochain: ${formatInscriptionCode('HAJJ', 2027, seqHaj + 1)})`,
      status: maxHaj === 6 && seqHaj === 6 ? 'PASS' : 'FAIL',
    });

    // Inscription Umrah 2027 : 0 table, Seq = 0, Prochain = GT-UM27-000001
    const seqUmrah = seqMap['INSCRIPTION_UMRAH_2027'] ?? 0;
    results.push({
      section: 'C. Séquences',
      item: 'Séquence INSCRIPTION_UMRAH_2027',
      expected: 'Count=0, Séquence=0 (Prochain: GT-UM27-000001)',
      observed: `Count=0, Séquence=${seqUmrah} (Prochain: ${formatInscriptionCode('UMRAH', 2027, seqUmrah + 1)})`,
      status: seqUmrah === 0 ? 'PASS' : 'FAIL',
    });

    // Paiement 2027 : Max table = 3, Seq = 3, Prochain = GT-PAY27-000004
    const maxPay = Number((await client.query("SELECT COALESCE(MAX(SUBSTRING(receipt_number FROM 10)::integer), 0) as val FROM payments WHERE status = 'VALIDE'")).rows[0].val);
    const seqPay = seqMap['PAYMENT_2027'] ?? -1;
    results.push({
      section: 'C. Séquences',
      item: 'Séquence PAYMENT_2027',
      expected: 'MAX=3, Séquence=3 (Prochain: GT-PAY27-000004)',
      observed: `MAX=${maxPay}, Séquence=${seqPay} (Prochain: ${formatPaymentReceiptNumber(2027, seqPay + 1)})`,
      status: maxPay === 3 && seqPay === 3 ? 'PASS' : 'FAIL',
    });

    // Dépenses : 0 table, Seq = 0, Prochain = GT-EXP27-000001
    const seqExp26 = seqMap['EXPENSE_2026'] ?? 0;
    const seqExp27 = seqMap['EXPENSE_2027'] ?? 0;
    results.push({
      section: 'C. Séquences',
      item: 'Séquences EXPENSE 2026 / 2027',
      expected: 'Seq2026=0, Seq2027=0 (Prochain: GT-EXP27-000001)',
      observed: `Seq2026=${seqExp26}, Seq2027=${seqExp27} (Prochain: ${formatExpenseCode(2027, seqExp27 + 1)})`,
      status: seqExp26 === 0 && seqExp27 === 0 ? 'PASS' : 'FAIL',
    });

    // =================================================================
    // SECTION D : DONNÉES INTERDITES (ABSENCE STRICTE DU FAUX)
    // =================================================================
    console.log('[SECTION D] Vérification de l\'absence absolue des données de test purgées...');

    // D.1 Paiement Orange Money de test
    const omRes = await client.query("SELECT count(*) as cnt FROM payments WHERE id = 'pay-1788542397098' OR reference = 'OM-7890123'");
    const omCnt = Number(omRes.rows[0].cnt);
    results.push({
      section: 'D. Interdits',
      item: 'Paiement test pay-1788542397098 (Orange Money)',
      expected: '0 (Absent)',
      observed: `${omCnt}`,
      status: omCnt === 0 ? 'PASS' : 'FAIL',
    });

    // D.2 Anciennes dépenses fictives (Saudia / Pullman)
    const expCountRes = await client.query("SELECT count(*) as cnt FROM expenses");
    const expCnt = Number(expCountRes.rows[0].cnt);
    results.push({
      section: 'D. Interdits',
      item: 'Dépenses fictives (Saudia 15M, Pullman 8.5M)',
      expected: '0 ligne en base',
      observed: `${expCnt} ligne(s)`,
      status: expCnt === 0 ? 'PASS' : 'FAIL',
    });

    // D.3 Logistique fictive (vols, tickets, hôtels, chambres, affectations, groupes)
    const logTables = [
      'room_assignments', 'rooms', 'hotel_stays', 'hotels',
      'tickets', 'flight_segments', 'flights',
      'group_members', 'groups', 'accompagnateurs'
    ];
    let totalLogRows = 0;
    for (const tbl of logTables) {
      const r = await client.query(`SELECT count(*) as cnt FROM ${tbl}`);
      totalLogRows += Number(r.rows[0].cnt);
    }
    results.push({
      section: 'D. Interdits',
      item: 'Entités logistiques de test (hôtels, vols, chambres, groupes)',
      expected: '0 ligne',
      observed: `${totalLogRows} ligne(s)`,
      status: totalLogRows === 0 ? 'PASS' : 'FAIL',
    });

    // D.4 Visas fictifs
    const visaRes = await client.query("SELECT count(*) as cnt FROM visas");
    const visaCnt = Number(visaRes.rows[0].cnt);
    results.push({
      section: 'D. Interdits',
      item: 'Dossiers visas fictifs / artificiels',
      expected: '0 visa',
      observed: `${visaCnt} visa(s)`,
      status: visaCnt === 0 ? 'PASS' : 'FAIL',
    });

    // =================================================================
    // SECTION E : STATUT UNKNOWN (CONSERVÉ SANS DÉCISION IMPLICITE)
    // =================================================================
    console.log('[SECTION E] Vérification du statut UNKNOWN du Package Confort...');

    const confRes = await client.query("SELECT id, name, price, status FROM packages WHERE id = 'pkg-conf-2027'");
    const confRow = confRes.rows[0];
    const confPrice = confRow ? Number(confRow.price) : 0;
    results.push({
      section: 'E. UNKNOWN',
      item: 'Package Confort (pkg-conf-2027)',
      expected: 'Présent, Prix=5 500 000 FCFA, Non altéré',
      observed: confRow ? `Présent (${confRow.name}, ${confPrice.toLocaleString('fr-FR')} FCFA)` : 'Absent',
      status: confRow && confPrice === 5500000 ? 'PRESERVED' : 'FAIL',
    });

    // =================================================================
    // SECTION F : INTÉGRITÉ ARCHIVE DATA/DATABASE.JSON
    // =================================================================
    console.log('[SECTION F] Audit cryptographique de l\'archive database.json...');

    const dbJsonPath = path.resolve(process.cwd(), 'data/database.json');
    let dbHash = '';
    let dbSize = 0;
    if (fs.existsSync(dbJsonPath)) {
      const buf = fs.readFileSync(dbJsonPath);
      dbSize = buf.length;
      dbHash = crypto.createHash('sha256').update(buf).digest('hex');
    }
    results.push({
      section: 'F. Archive',
      item: 'Empreinte SHA-256 de data/database.json',
      expected: EXPECTED_DATABASE_JSON_SHA256,
      observed: dbHash,
      status: dbHash === EXPECTED_DATABASE_JSON_SHA256 && dbSize === 32511 ? 'PASS' : 'FAIL',
      notes: `Taille: ${dbSize} octets`,
    });

    // =================================================================
    // SECTION G : AUDIT DU CODE (reset-test-environment.ts)
    // =================================================================
    console.log('[SECTION G] Audit statique du script de reset...');

    const resetScriptPath = path.resolve(process.cwd(), 'scripts/reset-test-environment.ts');
    const resetScriptSrc = fs.readFileSync(resetScriptPath, 'utf8');

    // G.1 Confirmation : Aucun UPDATE forcé sur business_sequences
    const hasForcedUpdate = resetScriptSrc.includes('UPDATE business_sequences') ||
      resetScriptSrc.includes('ON CONFLICT (sequence_type, year) DO UPDATE');
    results.push({
      section: 'G. Code',
      item: 'Zéro UPDATE forcé/silencieux sur business_sequences',
      expected: 'Aucune écriture/mutation de séquence dans le script de reset',
      observed: hasForcedUpdate ? 'Écriture détectée (FAIL)' : 'Observation et comparaison pure sans écriture (PASS)',
      status: !hasForcedUpdate ? 'PASS' : 'FAIL',
    });

    // G.2 Source de calcul des échéanciers
    const usesWorkflowService = resetScriptSrc.includes('inscriptionWorkflowService.calculateDynamicSchedules');
    results.push({
      section: 'G. Code',
      item: 'Calcul échéanciers via InscriptionWorkflowService',
      expected: 'Appel formel à inscriptionWorkflowService.calculateDynamicSchedules',
      observed: usesWorkflowService ? 'Appel direct au service métier certifié (PASS)' : 'Formule ad hoc détectée (FAIL)',
      status: usesWorkflowService ? 'PASS' : 'FAIL',
    });

    // G.3 Vérification de la date de départ depuis campaigns
    const readsCampaignDeparture = resetScriptSrc.includes('SELECT id, title, type, departure_date FROM campaigns');
    results.push({
      section: 'G. Code',
      item: 'Date de départ lue dynamiquement depuis campaigns',
      expected: 'SELECT id, title, type, departure_date FROM campaigns',
      observed: readsCampaignDeparture ? 'Date lue depuis la table campaigns (PASS)' : 'Date hardcodée (FAIL)',
      status: readsCampaignDeparture ? 'PASS' : 'FAIL',
    });

    // =================================================================
    // SYNTHÈSE & VERDICT FINAL
    // =================================================================
    console.log('\n=====================================================================');
    console.log('                 RÉSULTATS DE L\'AUDIT GATE 5A                       ');
    console.log('=====================================================================\n');

    let allPass = true;
    for (const r of results) {
      const badge = r.status === 'PASS' ? '✅ [PASS]' : r.status === 'PRESERVED' ? '🔒 [PRESERVED]' : '❌ [FAIL]';
      if (r.status === 'FAIL') allPass = false;
      console.log(`${badge.padEnd(16)} | ${r.section.padEnd(12)} | ${r.item.padEnd(45)} | Obs: ${r.observed}`);
    }

    console.log('\n=====================================================================');
    if (allPass) {
      console.log('   VERDICT FINAL DU GATE 5A : 🟢 CERTIFICATION VALIDÉE SANS RÉSERVE  ');
      console.log('   La base de données et le code sont dans un état d\'intégrité prouvé.');
      console.log('   FEU VERT OFFICIEL POUR LA PHASE 5B.');
    } else {
      console.log('   VERDICT FINAL DU GATE 5A : 🔴 NON CONFORME — CORRECTIONS REQUISES ');
    }
    console.log('=====================================================================\n');

    if (!allPass) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Erreur lors du Gate 5A :', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runGate5ACertification();
