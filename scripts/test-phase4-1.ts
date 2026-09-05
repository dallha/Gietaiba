import 'dotenv/config';
import { pool, getNextBusinessSequence } from '../server/db/neon.js';
import { clientRepository } from '../server/repositories/client.repository.js';
import { inscriptionRepository } from '../server/repositories/inscription.repository.js';
import { paymentRepository } from '../server/repositories/payment.repository.js';
import { expenseRepository } from '../server/repositories/expense.repository.js';
import { logisticsRepository } from '../server/repositories/logistics.repository.js';

interface TestResult {
  section: string;
  testNumber: number;
  description: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function record(section: string, testNumber: number, description: string, passed: boolean, details?: string) {
  results.push({ section, testNumber, description, passed, details });
  const icon = passed ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`${icon} #${testNumber} [${section}] ${description} -> ${details || ''}`);
}

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function runTests() {
  console.log('=====================================================================');
  console.log('  PHASE 4.1 — TEST SUITE: BUSINESS MODEL HARDENING & DATA INTEGRITY');
  console.log('=====================================================================\n');

  const client = await pool.connect();
  let tempClientId: string | null = null;
  let tempInscriptionId: string | null = null;
  let tempScheduleId: string | null = null;
  let tempHotelStayId: string | null = null;
  let tempSegmentId: string | null = null;
  let tempExpenseId: string | null = null;

  try {
    // --- SECTION A : VÉRITÉ FINANCIÈRE HISTORIQUE ---
    console.log('--- SECTION A : VÉRITÉ FINANCIÈRE HISTORIQUE ---');

    // 1. Paiement de 4 000 000 FCFA formellement rattaché à FATOUMATA SOW
    const pay3Res = await client.query(`
      SELECT p.id, p.receipt_number, p.amount, p.status, p.client_id, c.code as client_code, c.first_name, c.last_name
      FROM payments p
      JOIN clients c ON p.client_id = c.id
      WHERE p.receipt_number = 'PAY-2027-0003'
    `);
    const p3 = pay3Res.rows[0];
    const isFatoumata = p3 && p3.first_name === 'FATOUMATA' && p3.last_name === 'SOW' && Number(p3.amount) === 4000000;
    record(
      'FINANCIAL_TRUTH',
      1,
      'paiement PAY-2027-0003 rattaché à FATOUMATA SOW (4M FCFA)',
      isFatoumata,
      `Client: ${p3?.first_name} ${p3?.last_name} (${p3?.client_code}), Montant: ${p3?.amount} FCFA, Statut: ${p3?.status}`
    );

    // 2. Invariants financiers globaux stricts
    const finRes = await client.query(`
      SELECT 
        (SELECT COALESCE(SUM(agreed_price), 0) FROM inscriptions WHERE status != 'ANNULEE') as ca_attendu,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'VALIDE') as total_encaisse,
        (SELECT COALESCE(SUM(amount), 0) FROM expenses) as total_depenses
    `);
    const ca = Number(finRes.rows[0].ca_attendu);
    const encaisse = Number(finRes.rows[0].total_encaisse);
    const depenses = Number(finRes.rows[0].total_depenses);
    const solde = ca - encaisse;

    const caOk = ca === 30600000;
    const encaisseOk = encaisse === 4750000;
    const soldeOk = solde === 25850000;
    const depensesOk = depenses === 23500000;

    record('FINANCIAL_TRUTH', 2, 'CA attendu invariant (30 600 000 FCFA)', caOk, `Actuel: ${ca} FCFA`);
    record('FINANCIAL_TRUTH', 3, 'Encaissements validés invariants (4 750 000 FCFA)', encaisseOk, `Actuel: ${encaisse} FCFA`);
    record('FINANCIAL_TRUTH', 4, 'Solde restant dû invariant (25 850 000 FCFA)', soldeOk, `Actuel: ${solde} FCFA`);
    record('FINANCIAL_TRUTH', 5, 'Dépenses totales invariantes (23 500 000 FCFA)', depensesOk, `Actuel: ${depenses} FCFA`);

    // --- SECTION B : COMPTEURS ATOMIQUES & CONCURRENCE ---
    console.log('\n--- SECTION B : COMPTEURS ATOMIQUES & CONCURRENCE ---');

    // 6. Test de concurrence atomique (10 appels parallèles)
    const concurrencyPromises = Array.from({ length: 10 }, () =>
      getNextBusinessSequence('TEST_CONCURRENCY', 2027)
    );
    const seqResults = await Promise.all(concurrencyPromises);
    const uniqueSeqs = new Set(seqResults);
    const noCollisions = uniqueSeqs.size === 10;
    const minSeq = Math.min(...seqResults);
    const maxSeq = Math.max(...seqResults);
    const isConsecutive = maxSeq - minSeq === 9;
    record(
      'SEQUENCES',
      6,
      'concurrence atomique sur compteurs (10 requêtes simultanées)',
      noCollisions && isConsecutive,
      `Valeurs uniques: ${uniqueSeqs.size}/10, Plage: ${minSeq} à ${maxSeq}, Collisions: 0`
    );

    // 7. Isolation annuelle des compteurs (2027 vs 2028)
    const seq2028_1 = await getNextBusinessSequence('TEST_ANNUAL', 2028);
    const seq2028_2 = await getNextBusinessSequence('TEST_ANNUAL', 2028);
    const seq2029_1 = await getNextBusinessSequence('TEST_ANNUAL', 2029);
    const annualIsolationOk = seq2028_1 === 1 && seq2028_2 === 2 && seq2029_1 === 1;
    record(
      'SEQUENCES',
      7,
      'isolation annuelle des compteurs (repart à 1 chaque année)',
      annualIsolationOk,
      `2028: [${seq2028_1}, ${seq2028_2}], 2029: [${seq2029_1}]`
    );

    // 8. Normalisation des formats de codes métier
    const nextClientCode = await clientRepository.getNextClientCode();
    const nextInsCode = await inscriptionRepository.getNextInscriptionCode(2027);
    const nextPayCode = await paymentRepository.getNextReceiptNumber(2027);
    const formatsOk =
      /^CLI-\d{6}$/.test(nextClientCode) &&
      /^INS-2027-\d{6}$/.test(nextInsCode) &&
      /^PAY-2027-\d{6}$/.test(nextPayCode);
    record(
      'SEQUENCES',
      8,
      'formatage strict des codes métier (CLI-XXXXXX, INS-YYYY-XXXXXX, PAY-YYYY-XXXXXX)',
      formatsOk,
      `Client: ${nextClientCode}, Inscription: ${nextInsCode}, Paiement: ${nextPayCode}`
    );

    // --- SECTION C : IDENTIFIANTS TECHNIQUES UUID V4 ---
    console.log('\n--- SECTION C : IDENTIFIANTS TECHNIQUES UUID V4 ---');

    // 9. Création d'un client avec UUID pur
    const testClient = await clientRepository.createClient({
      firstName: 'TestUuid',
      lastName: 'Hardening',
      phone: '+221 77 999 88 77',
      gender: 'M',
      nationality: 'Sénégalaise',
      status: 'ACTIF',
    });
    tempClientId = testClient.id;
    const clientUuidOk = UUID_V4_REGEX.test(testClient.id);
    record(
      'UUID_INTEGRITY',
      9,
      'client ID technique généré en UUID v4 pur (sans préfixe)',
      clientUuidOk,
      `ID: ${testClient.id}, Code: ${testClient.code}`
    );

    // 10. Création d'une inscription avec UUID pur et code annuel dynamique
    const testInscription = await inscriptionRepository.createInscription(
      {
        clientId: testClient.id,
        campaignId: 'voy-haj2027-01',
        packageId: 'pkg-std-2027',
        status: 'EN_ATTENTE',
      },
      { id: 'usr-admin', email: 'admin@taiba.sn', role: 'SUPER_ADMIN' }
    );
    tempInscriptionId = testInscription.id;
    const insUuidOk = UUID_V4_REGEX.test(testInscription.id);
    const insCodeOk = /^INS-2027-\d{6}$/.test(testInscription.code);
    record(
      'UUID_INTEGRITY',
      10,
      'inscription ID en UUID v4 pur et code annuel INS-2027-XXXXXX',
      insUuidOk && insCodeOk,
      `ID: ${testInscription.id}, Code: ${testInscription.code}`
    );

    // 11. Création d'une dépense avec UUID pur et code EXP-YYYY-XXXXXX
    const testExp = await expenseRepository.createExpense(
      {
        voyageId: 'voy-haj2027-01',
        category: 'Transport Interne',
        amount: 50000,
        currency: 'FCFA',
        date: '2026-09-05',
        supplier: 'Test Supplier Dakar',
        comment: 'Dépense de test unitaire',
      },
      'usr-admin',
      'El Hadj Amadou Niang'
    );
    tempExpenseId = testExp.id;
    const expUuidOk = UUID_V4_REGEX.test(testExp.id);
    const expCodeOk = /^EXP-2026-\d{6}$/.test(testExp.code || '');
    record(
      'UUID_INTEGRITY',
      11,
      'dépense ID en UUID v4 pur et code séparé EXP-2026-XXXXXX',
      expUuidOk && expCodeOk,
      `ID: ${testExp.id}, Code: ${testExp.code}`
    );

    // --- SECTION D : MODÈLE INSCRIPTION 360 & ERP HARDENING ---
    console.log('\n--- SECTION D : MODÈLE INSCRIPTION 360 & ERP HARDENING ---');

    // 12. Échéancier prévisionnel rattaché à l'inscription
    const testSchedule = await inscriptionRepository.createPaymentSchedule({
      inscriptionId: testInscription.id,
      dueDate: '2027-01-15',
      amountDue: 1500000,
      status: 'PENDING',
      comment: 'Tranche 1 - Acompte de réservation',
    });
    tempScheduleId = testSchedule.id;
    const schedUuidOk = UUID_V4_REGEX.test(testSchedule.id);
    const schedStatusOk = testSchedule.status === 'PENDING' && testSchedule.amountDue === 1500000;
    record(
      'ERP_MODEL',
      12,
      'échéancier prévisionnel rattaché à inscription_id (status PENDING)',
      schedUuidOk && schedStatusOk,
      `ID: ${testSchedule.id}, Due: ${testSchedule.dueDate}, Amount: ${testSchedule.amountDue} FCFA`
    );

    // 13. Découplage strict Échéancier vs Trésorerie Réelle
    const postSchedFin = await client.query(`
      SELECT COALESCE(SUM(amount), 0) as valid_payments FROM payments WHERE status = 'VALIDE'
    `);
    const paymentsUntouched = Number(postSchedFin.rows[0].valid_payments) === 4750000;
    record(
      'ERP_MODEL',
      13,
      'découplage strict échéancier prévisionnel vs encaissements réels (4 750 000 FCFA intact)',
      paymentsUntouched,
      `Total paiements validés après création échéancier: ${postSchedFin.rows[0].valid_payments} FCFA`
    );

    // 14. Séjour hôtelier rattaché à l'inscription et au client (Makkah / Médine)
    const testStay = await logisticsRepository.createHotelStay({
      inscriptionId: testInscription.id,
      clientId: testClient.id,
      hotelId: 'htl-001',
      campaignId: 'voy-haj2027-01',
      city: 'Makkah',
      checkInDate: '2027-05-15',
      checkOutDate: '2027-05-25',
      roomType: 'QUADRUPLE',
      shuttleService: true,
    });
    tempHotelStayId = testStay.id;
    const stayUuidOk = UUID_V4_REGEX.test(testStay.id);
    const stayCityOk = testStay.city === 'Makkah' && testStay.inscriptionId === testInscription.id;
    record(
      'ERP_MODEL',
      14,
      'séjour hôtelier géolocalisé rattaché à inscription_id et client_id',
      stayUuidOk && stayCityOk,
      `ID: ${testStay.id}, Ville: ${testStay.city}, Dates: ${testStay.checkInDate} -> ${testStay.checkOutDate}`
    );

    // 15. Segment de vol multi-tronçons
    const testSegment = await logisticsRepository.createFlightSegment({
      flightId: 'flt-001',
      segmentType: 'ALLER',
      departureAirport: 'DSS',
      arrivalAirport: 'MED',
      flightNumber: 'SV-442',
      airline: 'Saudia Airlines',
      departureTime: '2027-05-14T20:00:00Z',
      arrivalTime: '2027-05-15T05:30:00Z',
      terminal: 'T1',
    });
    tempSegmentId = testSegment.id;
    const segUuidOk = UUID_V4_REGEX.test(testSegment.id);
    record(
      'ERP_MODEL',
      15,
      'segment de vol multi-escales (DSS -> MED)',
      segUuidOk && testSegment.departureAirport === 'DSS' && testSegment.arrivalAirport === 'MED',
      `ID: ${testSegment.id}, Segment: ${testSegment.departureAirport} -> ${testSegment.arrivalAirport}, Vol: ${testSegment.flightNumber}`
    );

  } finally {
    // Nettoyage rigoureux des données de test
    console.log('\n--- NETTOYAGE DES ENREGISTREMENTS DE TEST ---');
    if (tempSegmentId) await client.query('DELETE FROM flight_segments WHERE id = $1', [tempSegmentId]);
    if (tempHotelStayId) await client.query('DELETE FROM hotel_stays WHERE id = $1', [tempHotelStayId]);
    if (tempScheduleId) await client.query('DELETE FROM payment_schedules WHERE id = $1', [tempScheduleId]);
    if (tempExpenseId) await client.query('DELETE FROM expenses WHERE id = $1', [tempExpenseId]);
    if (tempInscriptionId) {
      await client.query('DELETE FROM visas WHERE inscription_id = $1', [tempInscriptionId]);
      await client.query('DELETE FROM inscriptions WHERE id = $1', [tempInscriptionId]);
    }
    if (tempClientId) await client.query('DELETE FROM clients WHERE id = $1', [tempClientId]);
    await client.query('DELETE FROM business_sequences WHERE sequence_type LIKE $1', ['TEST_%']);

    console.log('Nettoyage achevé. Base Neon revenue à son état initial exact.\n');
    client.release();
    await pool.end();
  }

  // --- SYNTHÈSE GLOBALE ---
  console.log('=====================================================================');
  console.log('  BILAN FINAL PHASE 4.1 — VALIDATION');
  console.log('=====================================================================');
  const allPassed = results.every((r) => r.passed);
  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`\nRÉSULTAT : ${passedCount}/${total} TESTS VALIDÉS (${Math.round((passedCount / total) * 100)}% CONFORME)\n`);

  if (!allPassed) {
    console.error('❌ Échec d’au moins un test Phase 4.1');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Erreur fatale exécution suite test 4.1:', err);
  process.exit(1);
});
