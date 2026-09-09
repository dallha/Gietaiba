/**
 * ============================================================================
 * @deprecated LEGACY JSON DATABASE MANAGER — PHASE 3 ARCHIVAL STATUS
 * ============================================================================
 * THIS MODULE IS COMPLETELY DEPRECATED AND DISCONNECTED FROM RUNTIME OPERATION.
 * 
 * UNIQUE SOURCE OF TRUTH: Neon PostgreSQL via server/repositories/ & server/services/
 * 
 * DO NOT IMPORT OR USE DatabaseManager IN ANY ROUTES, SERVICES, OR REPOSITORIES.
 * KEPT STRICTLY AS HISTORICAL CODE REFERENCE. PRESERVED IN NON-OPERATIONAL STATE.
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import {
  AgencySettings,
  Client,
  Voyage,
  VoyagePackage,
  PackageVersion,
  Inscription,
  Payment,
  PilgrimDocument,
  Visa,
  Flight,
  Ticket,
  Hotel,
  Room,
  RoomAssignment,
  Group,
  GroupMember,
  Accompagnateur,
  Expense,
  
  AuditLog,
  UserSession,
  DashboardStats,
} from '../src/types.js';

interface DatabaseSchema {
  settings: AgencySettings;
  users: (UserSession & { passwordHash: string })[];
  clients: Client[];
  voyages: Voyage[];
  packages: VoyagePackage[];
  package_versions: PackageVersion[];
  inscriptions: Inscription[];
  payments: Payment[];
  documents: PilgrimDocument[];
  visas: Visa[];
  flights: Flight[];
  tickets: Ticket[];
  hotels: Hotel[];
  rooms: Room[];
  room_assignments: RoomAssignment[];
  groups: Group[];
  group_members: GroupMember[];
  accompagnateurs: Accompagnateur[];
  expenses: Expense[];
  notifications: any[];
  audit_logs: AuditLog[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'database.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Initial state and default seed
function getInitialSeed(): DatabaseSchema {
  const now = new Date().toISOString();

  const settings: AgencySettings = {
    id: 'setting-1',
    agencyName: 'GIE TAIBA VOYAGES',
    subtitle: 'Agence Agréée Hajj & Oumrah — Sénégal / Arabie Saoudite',
    logoUrl: '/logo.png',
    currency: 'FCFA',
    defaultCurrency: 'FCFA',
    phone: '+221 33 824 55 00 / +221 77 638 90 90',
    email: 'contact@taiba-voyages.sn',
    address: 'Avenue Cheikh Anta Diop, Immeuble Taiba, Dakar, Sénégal',
    city: 'Dakar',
    country: 'Sénégal',
    rcNumber: 'SN.DKR.2014.B.1820',
    licenseNumber: 'LIC-HAJJ-SN-2027-048',
    taxId: 'NINEA-002849182',
    ninea: '005421882 2V3',
    receiptFooterTerms: 'Tout versement effectué fait l’objet d’un reçu officiel infalsifiable. Ce reçu tient lieu de pièce justificative pour la confirmation de l’inscription au pèlerinage.',
    bankDetails: {
      bankName: 'Banque Islamique du Sénégal (BIS)',
      iban: 'SN08 SN01 2010 0123 4567 8901 2345',
      bic: 'BISDSNDX',
    },
    mobileMoneyNumbers: {
      wave: '+221 77 500 20 20',
      orangeMoney: '+221 78 400 30 30',
    },
    recoveryUrgentThresholdDays: 15,
    recoveryHighBalanceAmount: 2000000,
    defaultRequiredDocumentTypes: [
      'Passeport',
      'Visa',
      'Certificat Vaccination',
      'Billet Avion',
      'Photo Identité',
    ],
    paymentMethods: [
      'Espèces',
      'Wave',
      'Orange Money',
      'Virement Bancaire',
      'Chèque',
      'Carte Bancaire',
    ],
    expenseCategories: [
      'Billets Avion',
      'Hôtels Makkah',
      'Hôtels Médine',
      'Transports Bus',
      'Frais Visas Nusuk',
      'Restauration',
      'Assurance',
      'Logistique & Guides',
      'Communication & Marketing',
      'Administration',
    ],
    cities: ['Makkah', 'Médine', 'Djeddah', 'Dakar'],
  };

  const users: (UserSession & { passwordHash: string })[] = [
    {
      id: 'usr-superadmin-niass',
      email: 'mr.niass@gmail.com',
      displayName: 'El Hadji Abdoulaye Niass',
      role: 'SUPER_ADMIN',
      phone: '+221 77 000 00 00',
      passwordHash: 'niass123',
    },
    {
      id: 'usr-gerant-cheikh-ka',
      email: 'kabaye73@gmail.com',
      displayName: 'Cheikh Ibrahima Ka',
      role: 'SUPER_ADMIN',
      phone: '+221 77 292 77 77',
      passwordHash: 'ka123',
    },
    {
      id: 'usr-pelerin-saidou',
      email: 'saidou.sow@email.sn',
      displayName: 'SAIDOU SOW',
      role: 'PELERIN',
      clientId: 'cli-001',
      phone: '+221 77 520 11 22',
      passwordHash: 'pelerin123',
    },
  ];

  const voyages: Voyage[] = [
    {
      id: 'voy-haj2027-01',
      code: 'HAJ2027-01',
      title: 'Hajj 2027 — Vol Direct Dakar / Médine',
      type: 'HAJJ',
      year: 2027,
      departureDate: '2027-05-18',
      returnDate: '2027-06-15',
      capacity: 120,
      status: 'OUVERT',
      description: 'Campagne officielle Hajj 2027 encadrée par GIE TAIBA VOYAGES avec hôtels à proximité des Lieux Saints.',
      logisticsNotes: 'Vols affrétés Saudia / Air Sénégal au départ de l’AIBD.',
      responsable: 'Cheikh Ibrahima Ka (Gérant Taiba Voyages)',
      responsablePhone: '+221 77 292 77 77',
      volsSummary: 'Air Sénégal / Saudia (Vols Directs AIBD - JED/MED)',
      hotelsSummary: 'Al Kiswah Towers (Makkah) & Emaar Elite (Médine)',
      createdAt: now,
    },
    {
      id: 'voy-oum2027-ram',
      code: 'OUM2027-RAM',
      title: 'Oumrah Ramadan 2027 — Les 10 Derniers Jours',
      type: 'OUMRAH',
      year: 2027,
      departureDate: '2027-03-25',
      returnDate: '2027-04-09',
      capacity: 60,
      status: 'OUVERT',
      description: 'Séjour spirituel exceptionnel pour les nuits impaires de Ramadan.',
      logisticsNotes: 'Pullman Zamzam Makkah & Anwar Al Madinah.',
      responsable: 'Cheikh Ibrahima Ka (Gérant Taiba Voyages)',
      responsablePhone: '+221 77 292 77 77',
      volsSummary: 'Ethiopian Airlines (Dakar - Addis - Djeddah)',
      hotelsSummary: 'Pullman Zamzam 5★ (Makkah) & Anwar Al Madinah 5★',
      createdAt: now,
    },
  ];

  const packages: VoyagePackage[] = [
    {
      id: 'pkg-std-2027',
      voyageId: 'voy-haj2027-01',
      code: 'PKG-HAJ27-STD',
      name: 'Standard',
      category: 'STANDARD',
      description: 'Chambres quadruples, hôtels 4 étoiles avec navette continue 24h/24 et encadrement spirituel complet.',
      price: 5100000,
      initialPrice: 5100000,
      currentPrice: 5100000,
      currency: 'FCFA',
      capacity: 80,
      roomType: 'QUADRUPLE',
      hotelMakkah: 'Al Kiswah Towers (Navettes 24h/24)',
      hotelMedina: 'Emaar Elite (250m Haram)',
      conditions: 'Acompte minimum 1 000 000 FCFA à la souscription. Solde impératif 30 jours avant le vol. Annulation sans frais jusqu’à 45 jours avant le départ.',
      servicesIncluded: [
        'Vol direct aller-retour Dakar - Médine / Djeddah - Dakar',
        'Visa officiel Hajj Nusuk & assurance médicale saoudienne',
        'Hébergement Makkah (Al Kiswah Towers)',
        'Hébergement Médine (Emaar Elite à 250m de la Mosquée)',
        'Restauration demi-pension (petit-déjeuner + dîner)',
        'Tentes climatisées à Mina et Arafat (zone sénégalaise)',
        'Transferts en bus VIP climatisés entre les Lieux Saints',
        'Visites pieuses guidées (Ziaras Médine & Makkah)',
        'Encadrement religieux continu et médecin dédié GIE TAIBA',
        'Kit complet du pèlerin (sacoche, guide rituel, étiquettes bagages)'
      ],
      status: 'PROVISOIRE',
      validFrom: '2026-09-01',
      activeVersionNumber: 1,
      versions: [
        {
          id: 'ver-std-1',
          packageId: 'pkg-std-2027',
          versionNumber: 1,
          price: 5100000,
          status: 'PROVISOIRE',
          effectiveFrom: '2026-09-01',
          note: 'Tarif indicatif provisoire fixé au lancement des préinscriptions',
          createdAt: now,
        },
      ],
      createdAt: now,
    },
    {
      id: 'pkg-conf-2027',
      voyageId: 'voy-haj2027-01',
      code: 'PKG-HAJ27-CONF',
      name: 'Confort',
      category: 'CONFORT',
      description: 'Hôtels 5 étoiles proches des Harams, chambres triples, pension complète et TGV Haramain.',
      price: 5500000,
      initialPrice: 5500000,
      currentPrice: 5500000,
      currency: 'FCFA',
      capacity: 30,
      roomType: 'TRIPLE',
      hotelMakkah: 'Swissôtel Al Maqam (Abraj Al Bait)',
      hotelMedina: 'Pullman Al Aqeeq',
      conditions: 'Acompte 1 500 000 FCFA. Solde 30 jours avant le vol. Modification sans frais.',
      servicesIncluded: [
        'Vol direct régulier AIBD - Médine',
        'Visa Hajj officiel et assurance multirisque étendue',
        'Hôtels 5 étoiles face aux esplanades des Harams',
        'Pension complète (3 repas buffet par jour)',
        'Chambres triples premium',
        'TGV Haramain High Speed Rail Makkah - Médine',
        'Accompagnateur dédié pour chaque sous-groupe de 25 pèlerins'
      ],
      status: 'PROVISOIRE',
      validFrom: '2026-09-01',
      activeVersionNumber: 1,
      versions: [
        {
          id: 'ver-conf-1',
          packageId: 'pkg-conf-2027',
          versionNumber: 1,
          price: 5500000,
          status: 'PROVISOIRE',
          effectiveFrom: '2026-09-01',
          note: 'Tarif indicatif formule Confort',
          createdAt: now,
        },
      ],
      createdAt: now,
    },
    {
      id: 'pkg-vip-2027',
      voyageId: 'voy-haj2027-01',
      code: 'PKG-HAJ27-VIP',
      name: 'VIP',
      category: 'VIP',
      description: 'Hôtels 5 étoiles première ligne Haram vue Kaaba, chambres doubles, pension complète gastronomique et conciergerie privée.',
      price: 6200000,
      initialPrice: 6200000,
      currentPrice: 6200000,
      currency: 'FCFA',
      capacity: 10,
      roomType: 'DOUBLE',
      hotelMakkah: 'Raffles Makkah Palace (Vue Kaaba)',
      hotelMedina: 'The Oberoi Madina',
      conditions: 'Acompte 2 500 000 FCFA. Solde 30 jours avant le vol. Conciergerie privée VIP 24h/24.',
      servicesIncluded: [
        'Vol en classe affaires Saudia Airlines',
        'Visa VIP Nusuk express',
        'Suites et chambres doubles de grand luxe face aux Harams',
        'Pension complète gastronomique',
        'Tente VIP privatisée à Mina (Zone Majliss)',
        'Voiture privée avec chauffeur pour transferts',
        'Service conciergerie personnalisé 24h/24'
      ],
      status: 'PROVISOIRE',
      validFrom: '2026-09-01',
      activeVersionNumber: 1,
      versions: [
        {
          id: 'ver-vip-1',
          packageId: 'pkg-vip-2027',
          versionNumber: 1,
          price: 6200000,
          status: 'PROVISOIRE',
          effectiveFrom: '2026-09-01',
          note: 'Tarif VIP indicatif initial',
          createdAt: now,
        },
      ],
      createdAt: now,
    },
    {
      id: 'pkg-oum-ram-2027',
      voyageId: 'voy-oum2027-ram',
      code: 'PKG-OUM27-CONF',
      name: 'Oumrah Ramadan Confort',
      category: 'CONFORT',
      description: 'Les 10 derniers jours bénis de Ramadan face au Haram avec hébergement de haut standing.',
      price: 2850000,
      initialPrice: 2850000,
      currentPrice: 2850000,
      currency: 'FCFA',
      capacity: 60,
      roomType: 'DOUBLE',
      hotelMakkah: 'Pullman Zamzam Makkah (10 derniers jours)',
      hotelMedina: 'Anwar Al Madinah Mövenpick',
      conditions: 'Acompte 1 000 000 FCFA. Solde 20 jours avant le vol.',
      servicesIncluded: [
        'Billet avion aller-retour Dakar - Djeddah',
        'Visa Oumrah 90 jours',
        'Hôtels 5 étoiles face aux Harams',
        'Iftar et Suhur quotidiens',
        'Ziaras guidées Médine et Badr',
        'Guide bilingue wolof / français'
      ],
      status: 'DEFINITIF',
      validFrom: '2026-09-01',
      activeVersionNumber: 1,
      versions: [
        {
          id: 'ver-oum-1',
          packageId: 'pkg-oum-ram-2027',
          versionNumber: 1,
          price: 2850000,
          status: 'DEFINITIF',
          effectiveFrom: '2026-09-01',
          note: 'Tarif définitif confirmé avec les compagnies et hôtels',
          createdAt: now,
        },
      ],
      createdAt: now,
    },
  ];

  const package_versions: PackageVersion[] = [
    ...packages[0].versions,
    ...packages[1].versions,
    ...packages[2].versions,
    ...packages[3].versions,
  ];

  // The 6 pilgrims as explicitly required in prompt section 11
  const clients: Client[] = [
    {
      id: 'cli-001',
      code: 'CLI-2027-001',
      firstName: 'SAIDOU',
      lastName: 'SOW',
      gender: 'M',
      birthDate: '1972-04-12',
      nationality: 'Sénégalaise',
      phone: '+221 77 520 11 22',
      whatsapp: '+221 77 520 11 22',
      email: 'saidou.sow@email.sn',
      address: 'Sacré-Cœur 3, Villa 124, Dakar',
      profession: 'Ingénieur Télécoms',
      contactPerson: 'Mme Mariama Sow',
      contactPhone: '+221 77 520 11 99',
      internalNotes: 'Dossier prioritaire. A demandé une chambre proche des ascenseurs.',
      status: 'ACTIF',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cli-002',
      code: 'CLI-2027-002',
      firstName: 'AISSATOU',
      lastName: 'FALL',
      gender: 'F',
      birthDate: '1980-08-25',
      nationality: 'Sénégalaise',
      phone: '+221 77 644 33 22',
      whatsapp: '+221 77 644 33 22',
      email: 'aissatou.fall@orange.sn',
      address: 'Mermoz Pyrotechnie, Dakar',
      profession: 'Pharmacienne',
      contactPerson: 'Ibrahima Fall',
      contactPhone: '+221 70 888 22 11',
      internalNotes: 'Voyage en famille, souhaite être dans le même vol que Fatoumata Sow.',
      status: 'ACTIF',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cli-003',
      code: 'CLI-2027-003',
      firstName: 'FATOUMATA',
      lastName: 'SOW',
      gender: 'F',
      birthDate: '1968-11-03',
      nationality: 'Sénégalaise',
      phone: '+221 77 312 90 01',
      whatsapp: '+221 77 312 90 01',
      email: 'fatoumata.sow@pro.sn',
      address: 'Fann Résidence, Rue des Ecrivains, Dakar',
      profession: 'Commerçante / Import-Export',
      contactPerson: 'Abdoulaye Sow',
      contactPhone: '+221 77 200 44 55',
      internalNotes: 'Acompte majeur de 4 000 000 FCFA déjà déposé.',
      status: 'ACTIF',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cli-004',
      code: 'CLI-2027-004',
      firstName: 'NDEYE BINTA',
      lastName: 'GADIAGA',
      gender: 'F',
      birthDate: '1985-02-14',
      nationality: 'Sénégalaise',
      phone: '+221 78 120 45 67',
      whatsapp: '+221 78 120 45 67',
      email: 'binta.gadiaga@gmail.com',
      address: 'Almadies, Zone 4, Dakar',
      profession: 'Cadre Bancaire',
      contactPerson: 'Mamadou Gadiaga',
      contactPhone: '+221 77 650 99 88',
      internalNotes: 'Préinscription confirmée. En attente de déblocage du prêt pèlerinage.',
      status: 'ACTIF',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cli-005',
      code: 'CLI-2027-005',
      firstName: 'SOKHNA',
      lastName: 'DIENG',
      gender: 'F',
      birthDate: '1976-06-19',
      nationality: 'Sénégalaise',
      phone: '+221 76 540 88 12',
      whatsapp: '+221 76 540 88 12',
      email: 'sokhna.dieng@yahoo.fr',
      address: 'Point E, Boulevard de l’Est, Dakar',
      profession: 'Enseignante-Chercheuse',
      contactPerson: 'Alioune Dieng',
      contactPhone: '+221 77 400 33 22',
      internalNotes: 'Inscription effectuée par son fils. À relancer fin du mois.',
      status: 'ACTIF',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cli-006',
      code: 'CLI-2027-006',
      firstName: 'NDEYE NGONE',
      lastName: 'BA',
      gender: 'F',
      birthDate: '1990-10-08',
      nationality: 'Sénégalaise',
      phone: '+221 77 980 12 34',
      whatsapp: '+221 77 980 12 34',
      email: 'ngone.ba@gmail.com',
      address: 'Nord Foire, Cité Damel, Dakar',
      profession: 'Architecte d’Intérieur',
      contactPerson: 'Papa Ba',
      contactPhone: '+221 77 555 44 33',
      internalNotes: 'Dossier complet en attente de versement.',
      status: 'ACTIF',
      createdAt: now,
      updatedAt: now,
    },
  ];

  // Inscriptions linking each of the 6 clients to Hajj 2027 Standard (5 100 000 FCFA)
  const inscriptions: Inscription[] = [
    {
      id: 'ins-001',
      code: 'INS-2027-001',
      clientId: 'cli-001',
      voyageId: 'voy-haj2027-01',
      packageId: 'pkg-std-2027',
      packageVersionId: 'ver-std-1',
      appliedPrice: 5100000,
      status: 'CONFIRMEE',
      agentId: 'usr-gerant-cheikh-ka',
      agentName: 'Cheikh Ibrahima Ka',
      createdAt: '2026-09-01T10:00:00Z',
      updatedAt: '2026-09-01T10:00:00Z',
    },
    {
      id: 'ins-002',
      code: 'INS-2027-002',
      clientId: 'cli-002',
      voyageId: 'voy-haj2027-01',
      packageId: 'pkg-std-2027',
      packageVersionId: 'ver-std-1',
      appliedPrice: 5100000,
      status: 'CONFIRMEE',
      agentId: 'usr-gerant-cheikh-ka',
      agentName: 'Cheikh Ibrahima Ka',
      createdAt: '2026-09-01T11:15:00Z',
      updatedAt: '2026-09-01T11:15:00Z',
    },
    {
      id: 'ins-003',
      code: 'INS-2027-003',
      clientId: 'cli-003',
      voyageId: 'voy-haj2027-01',
      packageId: 'pkg-std-2027',
      packageVersionId: 'ver-std-1',
      appliedPrice: 5100000,
      status: 'CONFIRMEE',
      agentId: 'usr-gerant-cheikh-ka',
      agentName: 'Cheikh Ibrahima Ka',
      createdAt: '2026-09-01T14:30:00Z',
      updatedAt: '2026-09-01T14:30:00Z',
    },
    {
      id: 'ins-004',
      code: 'INS-2027-004',
      clientId: 'cli-004',
      voyageId: 'voy-haj2027-01',
      packageId: 'pkg-std-2027',
      packageVersionId: 'ver-std-1',
      appliedPrice: 5100000,
      status: 'CONFIRMEE',
      agentId: 'usr-gerant-cheikh-ka',
      agentName: 'Cheikh Ibrahima Ka',
      createdAt: '2026-09-02T09:00:00Z',
      updatedAt: '2026-09-02T09:00:00Z',
    },
    {
      id: 'ins-005',
      code: 'INS-2027-005',
      clientId: 'cli-005',
      voyageId: 'voy-haj2027-01',
      packageId: 'pkg-std-2027',
      packageVersionId: 'ver-std-1',
      appliedPrice: 5100000,
      status: 'CONFIRMEE',
      agentId: 'usr-gerant-cheikh-ka',
      agentName: 'Cheikh Ibrahima Ka',
      createdAt: '2026-09-02T10:30:00Z',
      updatedAt: '2026-09-02T10:30:00Z',
    },
    {
      id: 'ins-006',
      code: 'INS-2027-006',
      clientId: 'cli-006',
      voyageId: 'voy-haj2027-01',
      packageId: 'pkg-std-2027',
      packageVersionId: 'ver-std-1',
      appliedPrice: 5100000,
      status: 'CONFIRMEE',
      agentId: 'usr-gerant-cheikh-ka',
      agentName: 'Cheikh Ibrahima Ka',
      createdAt: '2026-09-02T12:00:00Z',
      updatedAt: '2026-09-02T12:00:00Z',
    },
  ];

  // Payments as required in prompt section 11:
  // 1: SAIDOU SOW -> 250 000 FCFA
  // 2: AISSATOU FALL -> 250 000 FCFA
  // 3: FATOUMATA SOW -> 4 000 000 FCFA
  // 4, 5, 6 -> Aucun paiement
  const payments: Payment[] = [
    {
      id: 'pay-001',
      receiptNumber: 'PAY-2027-0001',
      clientId: 'cli-001',
      inscriptionId: 'ins-001',
      voyageId: 'voy-haj2027-01',
      amount: 250000,
      currency: 'FCFA',
      paymentMethod: 'Espèces',
      reference: 'REÇU-MANUEL-001',
      comment: 'Avance initiale de réservation Hajj 2027',
      status: 'VALIDE',
      agentId: 'usr-gerant-cheikh-ka',
      agentName: 'Cheikh Ibrahima Ka',
      paymentDate: '2026-09-01T10:30:00Z',
      createdAt: '2026-09-01T10:30:00Z',
      clientName: 'SAIDOU SOW',
      voyageCode: 'HAJ2027-01',
    },
    {
      id: 'pay-002',
      receiptNumber: 'PAY-2027-0002',
      clientId: 'cli-002',
      inscriptionId: 'ins-002',
      voyageId: 'voy-haj2027-01',
      amount: 250000,
      currency: 'FCFA',
      paymentMethod: 'Wave',
      reference: 'WAVE-TX-8839210',
      comment: 'Avance réservation Hajj 2027 via Wave',
      status: 'VALIDE',
      agentId: 'usr-gerant-cheikh-ka',
      agentName: 'Cheikh Ibrahima Ka',
      paymentDate: '2026-09-01T11:45:00Z',
      createdAt: '2026-09-01T11:45:00Z',
      clientName: 'AISSATOU FALL',
      voyageCode: 'HAJ2027-01',
    },
    {
      id: 'pay-003',
      receiptNumber: 'PAY-2027-0003',
      clientId: 'cli-003',
      inscriptionId: 'ins-003',
      voyageId: 'voy-haj2027-01',
      amount: 4000000,
      currency: 'FCFA',
      paymentMethod: 'Virement Bancaire',
      reference: 'VIR-CBAO-991204',
      comment: 'Acompte principal pour Fatoumata Sow',
      status: 'VALIDE',
      agentId: 'usr-gerant-cheikh-ka',
      agentName: 'Cheikh Ibrahima Ka',
      paymentDate: '2026-09-01T15:00:00Z',
      createdAt: '2026-09-01T15:00:00Z',
      clientName: 'FATOUMATA SOW',
      voyageCode: 'HAJ2027-01',
    },
  ];

  // Documents
  const documents: PilgrimDocument[] = [
    {
      id: 'doc-001',
      type: 'Passeport',
      clientId: 'cli-001',
      inscriptionId: 'ins-001',
      fileName: 'passeport_saidou_sow.pdf',
      fileUrl: '/docs/passeport_sample.pdf',
      receivedDate: '2026-09-01',
      expiryDate: '2029-08-14',
      status: 'VALIDE',
      validatedBy: 'Cheikh Ibrahima Ka',
      validatedAt: '2026-09-01T12:00:00Z',
      isClientVisible: true,
      createdAt: now,
    },
    {
      id: 'doc-002',
      type: 'Certificat Vaccination',
      clientId: 'cli-001',
      inscriptionId: 'ins-001',
      fileName: 'vaccin_meningite_sow.pdf',
      fileUrl: '/docs/vaccin_sample.pdf',
      receivedDate: '2026-09-01',
      expiryDate: '2028-05-10',
      status: 'VALIDE',
      validatedBy: 'Cheikh Ibrahima Ka',
      validatedAt: '2026-09-01T12:00:00Z',
      isClientVisible: true,
      createdAt: now,
    },
    {
      id: 'doc-003',
      type: 'Photo Identité',
      clientId: 'cli-001',
      inscriptionId: 'ins-001',
      fileName: 'photo_fond_blanc_sow.jpg',
      receivedDate: '2026-09-01',
      status: 'VALIDE',
      validatedBy: 'Cheikh Ibrahima Ka',
      validatedAt: '2026-09-01T12:00:00Z',
      isClientVisible: true,
      createdAt: now,
    },
    {
      id: 'doc-004',
      type: 'Passeport',
      clientId: 'cli-002',
      inscriptionId: 'ins-002',
      fileName: 'passeport_aissatou_fall.pdf',
      receivedDate: '2026-09-01',
      expiryDate: '2028-11-20',
      status: 'VALIDE',
      validatedBy: 'Cheikh Ibrahima Ka',
      validatedAt: '2026-09-01T12:10:00Z',
      isClientVisible: true,
      createdAt: now,
    },
    {
      id: 'doc-005',
      type: 'Passeport',
      clientId: 'cli-003',
      inscriptionId: 'ins-003',
      fileName: 'passeport_fatoumata_sow.pdf',
      receivedDate: '2026-09-01',
      expiryDate: '2030-01-10',
      status: 'VALIDE',
      validatedBy: 'Cheikh Ibrahima Ka',
      validatedAt: '2026-09-01T15:20:00Z',
      isClientVisible: true,
      createdAt: now,
    },
  ];

  const visas: Visa[] = [
    {
      id: 'visa-001',
      clientId: 'cli-001',
      inscriptionId: 'ins-001',
      status: 'DOSSIER_EN_PREPARATION',
      notes: 'Données biométriques prêtes pour téléversement plateforme Nusuk.',
      updatedAt: now,
    },
    {
      id: 'visa-002',
      clientId: 'cli-002',
      inscriptionId: 'ins-002',
      status: 'NON_DEMANDE',
      notes: 'En attente du certificat de vaccination.',
      updatedAt: now,
    },
    {
      id: 'visa-003',
      clientId: 'cli-003',
      inscriptionId: 'ins-003',
      status: 'DEMANDE',
      applicationDate: '2026-09-02',
      notes: 'Demande soumise aux autorités saoudiennes.',
      updatedAt: now,
    },
  ];

  const flights: Flight[] = [
    {
      id: 'flt-001',
      voyageId: 'voy-haj2027-01',
      airline: 'Saudia Airlines',
      flightNumber: 'SV-3420',
      departureCity: 'Dakar (DSS)',
      arrivalCity: 'Médine (MED)',
      departureDate: '2027-05-18',
      departureTime: '22:30',
      arrivalTime: '07:15 (+1)',
      terminal: 'Terminal 1 AIBD',
      status: 'PROGRAMME',
    },
    {
      id: 'flt-002',
      voyageId: 'voy-haj2027-01',
      airline: 'Saudia Airlines',
      flightNumber: 'SV-3421',
      departureCity: 'Djeddah (JED)',
      arrivalCity: 'Dakar (DSS)',
      departureDate: '2027-06-15',
      departureTime: '14:00',
      arrivalTime: '20:45',
      terminal: 'Terminal Hajj JED',
      status: 'PROGRAMME',
    },
  ];

  const tickets: Ticket[] = [
    {
      id: 'tkt-001',
      flightId: 'flt-001',
      clientId: 'cli-001',
      inscriptionId: 'ins-001',
      ticketNumber: '065-9920194821',
      pnr: 'TAIBA7',
      issueDate: '2026-09-02',
      status: 'EMIS',
    },
  ];

  const hotels: Hotel[] = [
    {
      id: 'htl-001',
      voyageId: 'voy-haj2027-01',
      name: 'Pullman Zamzam Makkah',
      city: 'Makkah',
      address: 'Abraj Al Bait Complex, Haram, Makkah',
      category: 5,
      contactPhone: '+966 12 571 5555',
      checkInDate: '2027-05-26',
      checkOutDate: '2027-06-14',
    },
    {
      id: 'htl-002',
      voyageId: 'voy-haj2027-01',
      name: 'Anwar Al Madinah Mövenpick',
      city: 'Médine',
      address: 'Central Northern Area, Haram, Médine',
      category: 5,
      contactPhone: '+966 14 818 1000',
      checkInDate: '2027-05-19',
      checkOutDate: '2027-05-26',
    },
  ];

  const rooms: Room[] = [
    {
      id: 'room-mak-401',
      hotelId: 'htl-001',
      voyageId: 'voy-haj2027-01',
      building: 'Tour A',
      floor: '4ème',
      roomNumber: '401',
      roomType: 'QUADRUPLE',
      capacity: 4,
      currentOccupancy: 1, // SAIDOU SOW
      notes: 'Vue partielle sur la place',
    },
    {
      id: 'room-mak-402',
      hotelId: 'htl-001',
      voyageId: 'voy-haj2027-01',
      building: 'Tour A',
      floor: '4ème',
      roomNumber: '402',
      roomType: 'DOUBLE',
      capacity: 2,
      currentOccupancy: 0,
      notes: 'Chambre VIP',
    },
    {
      id: 'room-med-301',
      hotelId: 'htl-002',
      voyageId: 'voy-haj2027-01',
      building: 'Aile Nord',
      floor: '3ème',
      roomNumber: '301',
      roomType: 'QUADRUPLE',
      capacity: 4,
      currentOccupancy: 1, // SAIDOU SOW
      notes: 'À 50 mètres de la porte des Femmes',
    },
  ];

  const room_assignments: RoomAssignment[] = [
    {
      id: 'ra-001',
      roomId: 'room-mak-401',
      hotelId: 'htl-001',
      clientId: 'cli-001',
      inscriptionId: 'ins-001',
      assignedAt: now,
    },
    {
      id: 'ra-002',
      roomId: 'room-med-301',
      hotelId: 'htl-002',
      clientId: 'cli-001',
      inscriptionId: 'ins-001',
      assignedAt: now,
    },
  ];

  const groups: Group[] = [
    {
      id: 'grp-001',
      voyageId: 'voy-haj2027-01',
      name: 'Groupe A — Cheikh Al Islam',
      guideId: 'acc-001',
      guideName: 'Oustaz Oumar Ba',
      busNumber: 'Bus VIP N° 12',
      hotelId: 'htl-001',
      notes: 'Groupe affecté au vol Saudia SV-3420',
    },
    {
      id: 'grp-002',
      voyageId: 'voy-haj2027-01',
      name: 'Groupe B — Al Falah',
      guideId: 'acc-002',
      guideName: 'Imam Moustapha Kane',
      busNumber: 'Bus VIP N° 14',
      hotelId: 'htl-001',
      notes: 'Rassemblement à 14h00',
    },
  ];

  const group_members: GroupMember[] = [
    {
      id: 'gm-001',
      groupId: 'grp-001',
      clientId: 'cli-001',
      inscriptionId: 'ins-001',
    },
    {
      id: 'gm-002',
      groupId: 'grp-001',
      clientId: 'cli-002',
      inscriptionId: 'ins-002',
    },
  ];

  const accompagnateurs: Accompagnateur[] = [
    {
      id: 'acc-001',
      name: 'Oustaz Oumar Ba',
      phone: '+221 77 430 22 11',
      role: 'Guide Religieux Principal & Formateur Rite',
      voyageId: 'voy-haj2027-01',
      availability: true,
      notes: '15 années d’expérience sur les rites du Hajj et Oumrah.',
    },
    {
      id: 'acc-002',
      name: 'Dr. Aïda Niasse',
      phone: '+221 77 622 99 88',
      role: 'Médecin Référent de la Mission Taiba',
      voyageId: 'voy-haj2027-01',
      availability: true,
      notes: 'Spécialiste gériatrie et médecine d’urgence.',
    },
  ];

  const expenses: Expense[] = [
    {
      id: 'exp-001',
      voyageId: 'voy-haj2027-01',
      category: 'Billets Avion',
      amount: 15000000,
      currency: 'FCFA',
      date: '2026-08-28',
      supplier: 'Saudia Airlines Dakar',
      receiptNumber: 'FA-SV-2026-091',
      comment: 'Acompte réservation contingent de 50 sièges vol spécial Hajj',
      createdBy: 'Cheikh Ibrahima Ka',
      createdAt: now,
    },
    {
      id: 'exp-002',
      voyageId: 'voy-haj2027-01',
      category: 'Hôtels Makkah',
      amount: 8500000,
      currency: 'FCFA',
      date: '2026-08-30',
      supplier: 'Pullman Zamzam Makkah',
      receiptNumber: 'BK-PUL-88912',
      comment: 'Réservation bloc de 20 chambres vue partielle Haram',
      createdBy: 'Cheikh Ibrahima Ka',
      createdAt: now,
    },
  ];

  const notifications: any[] = [];

  const audit_logs: AuditLog[] = [
    {
      id: 'log-001',
      userId: 'usr-superadmin-niass',
      userName: 'El Hadji Abdoulaye Niass',
      action: 'INITIALISATION_SYSTEME',
      entity: 'DATABASE',
      entityId: 'SYSTEM',
      newValue: 'Initialisation de GIE TAIBA VOYAGES avec les 6 pèlerins Hajj 2027',
      timestamp: now,
    },
    {
      id: 'log-002',
      userId: 'usr-gerant-cheikh-ka',
      userName: 'Cheikh Ibrahima Ka',
      action: 'ENREGISTREMENT_PAIEMENT',
      entity: 'PAYMENT',
      entityId: 'pay-001',
      newValue: '250 000 FCFA pour SAIDOU SOW (PAY-2027-0001)',
      timestamp: '2026-09-01T10:30:00Z',
    },
    {
      id: 'log-003',
      userId: 'usr-gerant-cheikh-ka',
      userName: 'Cheikh Ibrahima Ka',
      action: 'ENREGISTREMENT_PAIEMENT',
      entity: 'PAYMENT',
      entityId: 'pay-002',
      newValue: '250 000 FCFA pour AISSATOU FALL (PAY-2027-0002)',
      timestamp: '2026-09-01T11:45:00Z',
    },
    {
      id: 'log-004',
      userId: 'usr-gerant-cheikh-ka',
      userName: 'Cheikh Ibrahima Ka',
      action: 'ENREGISTREMENT_PAIEMENT',
      entity: 'PAYMENT',
      entityId: 'pay-003',
      newValue: '4 000 000 FCFA pour FATOUMATA SOW (PAY-2027-0003)',
      timestamp: '2026-09-01T15:00:00Z',
    },
  ];

  return {
    settings,
    users,
    clients,
    voyages,
    packages,
    package_versions,
    inscriptions,
    payments,
    documents,
    visas,
    flights,
    tickets,
    hotels,
    rooms,
    room_assignments,
    groups,
    group_members,
    accompagnateurs,
    expenses,
    notifications,
    audit_logs,
  };
}

class DatabaseManager {
  private data: DatabaseSchema;

  constructor() {
    ensureDataDir();
    if (fs.existsSync(DATA_FILE)) {
      try {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        
        // Merge missing settings fields if they don't exist in loaded data
        const initialSeedSettings = getInitialSeed().settings;
        this.data.settings = {
          ...initialSeedSettings,
          ...(this.data.settings || {})
        };
        // Also deeply merge bankDetails and mobileMoneyNumbers if missing
        if (!this.data.settings.bankDetails) {
          this.data.settings.bankDetails = initialSeedSettings.bankDetails;
        }
        if (!this.data.settings.mobileMoneyNumbers) {
          this.data.settings.mobileMoneyNumbers = initialSeedSettings.mobileMoneyNumbers;
        }
        
      } catch (err) {
        console.error('Error reading database file, loading initial seed:', err);
        this.data = getInitialSeed();
        this.save();
      }
    } else {
      this.data = getInitialSeed();
      this.save();
    }
  }

  public save() {
    ensureDataDir();
    fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  public resetToInitialSeed() {
    this.data = getInitialSeed();
    this.save();
    return this.data;
  }

  // Audit Helper
  public logAudit(
    userId: string,
    userName: string,
    action: string,
    entity: string,
    entityId: string,
    oldValue?: any,
    newValue?: any
  ) {
    const log: AuditLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      userName,
      action,
      entity,
      entityId,
      oldValue: oldValue ? (typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue)) : undefined,
      newValue: newValue ? (typeof newValue === 'string' ? newValue : JSON.stringify(newValue)) : undefined,
      timestamp: new Date().toISOString(),
    };
    this.data.audit_logs.unshift(log);
    // Keep max 500 logs
    if (this.data.audit_logs.length > 500) {
      this.data.audit_logs = this.data.audit_logs.slice(0, 500);
    }
    this.save();
  }

  // Settings
  public getSettings(): AgencySettings {
    return this.data.settings;
  }

  public updateSettings(updates: Partial<AgencySettings>, user?: UserSession): AgencySettings {
    const old = { ...this.data.settings };
    this.data.settings = { ...this.data.settings, ...updates };
    this.save();
    if (user) {
      this.logAudit(user.id, user.displayName, 'MODIFICATION_PARAMETRES', 'SETTINGS', this.data.settings.id, old, this.data.settings);
    }
    return this.data.settings;
  }

  // Users & Auth
  public getUsers() {
    return this.data.users.map(({ passwordHash, ...safeUser }) => safeUser);
  }

  public authenticate(emailOrPhone: string, password: string): UserSession | null {
    const cleanQuery = emailOrPhone.trim().toLowerCase();
    const user = this.data.users.find(
      (u) =>
        (u.email.toLowerCase() === cleanQuery || (u.phone && u.phone.replace(/[\s+-]/g, '') === cleanQuery.replace(/[\s+-]/g, ''))) &&
        u.passwordHash === password
    );
    if (!user) return null;
    const { passwordHash, ...session } = user;
    return session;
  }

  public authenticatePilgrim(identifier: string): { user: UserSession; client: Client } | null {
    const clean = identifier.trim().toLowerCase().replace(/[\s+-]/g, '');
    const client = this.data.clients.find(
      (c) =>
        c.code.toLowerCase() === clean ||
        c.phone.replace(/[\s+-]/g, '') === clean ||
        (c.email && c.email.toLowerCase() === identifier.trim().toLowerCase())
    );
    if (!client) return null;

    let user = this.data.users.find((u) => u.clientId === client.id);
    if (!user) {
      // Auto register a pilgrim user session
      user = {
        id: `usr-pilgrim-${client.id}`,
        email: client.email || `${client.code.toLowerCase()}@pelerin.taiba.sn`,
        displayName: `${client.firstName} ${client.lastName}`,
        role: 'PELERIN',
        clientId: client.id,
        phone: client.phone,
        passwordHash: 'pelerin123',
      };
      this.data.users.push(user);
      this.save();
    }

    const { passwordHash, ...safeUser } = user;
    return { user: safeUser, client };
  }

  // Clients
  public getClients(query?: { search?: string; status?: string }): Client[] {
    let list = [...this.data.clients];
    if (query?.status) {
      list = list.filter((c) => c.status === query.status);
    }
    if (query?.search) {
      const q = query.search.toLowerCase();
      list = list.filter(
        (c) =>
          c.firstName.toLowerCase().includes(q) ||
          c.lastName.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.email && c.email.toLowerCase().includes(q))
      );
    }
    return list;
  }

  public getClientById(id: string): Client | undefined {
    return this.data.clients.find((c) => c.id === id);
  }

  public createClient(clientData: Omit<Client, 'id' | 'code' | 'createdAt' | 'updatedAt'>, user: UserSession): Client {
    // Generate next client code CLI-2027-XXX
    const count = this.data.clients.length + 1;
    const code = `CLI-2027-${String(count).padStart(3, '0')}`;
    const now = new Date().toISOString();

    const client: Client = {
      ...clientData,
      id: `cli-${Date.now()}`,
      code,
      createdAt: now,
      updatedAt: now,
    };

    this.data.clients.unshift(client);
    this.save();
    this.logAudit(user.id, user.displayName, 'CREATION_CLIENT', 'CLIENT', client.id, null, client);
    return client;
  }

  public updateClient(id: string, updates: Partial<Client>, user: UserSession): Client {
    const index = this.data.clients.findIndex((c) => c.id === id);
    if (index === -1) throw new Error('Client introuvable');

    const old = this.data.clients[index];
    const updated: Client = {
      ...old,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.data.clients[index] = updated;
    this.save();
    this.logAudit(user.id, user.displayName, 'MODIFICATION_CLIENT', 'CLIENT', id, old, updated);
    return updated;
  }

  public deleteClient(id: string, user: UserSession): { success: boolean; message: string } {
    const index = this.data.clients.findIndex((c) => c.id === id);
    if (index === -1) throw new Error('Client introuvable');
    const client = this.data.clients[index];

    // Cascade delete linked inscriptions, payments, docs, etc.
    const clientIns = this.data.inscriptions.filter((i) => i.clientId === id);
    const insIds = clientIns.map((i) => i.id);

    this.data.payments = this.data.payments.filter((p) => p.clientId !== id && !insIds.includes(p.inscriptionId));
    this.data.documents = this.data.documents.filter((d) => d.clientId !== id && !insIds.includes(d.inscriptionId));
    this.data.visas = this.data.visas.filter((v) => v.clientId !== id && !insIds.includes(v.inscriptionId));
    this.data.tickets = this.data.tickets.filter((t) => t.clientId !== id);
    this.data.room_assignments = this.data.room_assignments.filter((ra) => ra.clientId !== id);
    this.data.group_members = this.data.group_members.filter((gm) => gm.clientId !== id);
    this.data.inscriptions = this.data.inscriptions.filter((i) => i.clientId !== id);

    this.data.clients.splice(index, 1);
    this.save();
    this.logAudit(user.id, user.displayName, 'SUPPRESSION_CLIENT', 'CLIENT', id, client, null);
    return { success: true, message: `Pèlerin ${client.firstName} ${client.lastName} supprimé avec succès` };
  }

  // Voyages
  public getVoyages(): Voyage[] {
    return this.data.voyages;
  }

  public getVoyageById(id: string): Voyage | undefined {
    return this.data.voyages.find((v) => v.id === id);
  }

  public createVoyage(voyageData: Omit<Voyage, 'id' | 'createdAt'>, user: UserSession): Voyage {
    const voyage: Voyage = {
      ...voyageData,
      id: `voy-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.data.voyages.push(voyage);
    this.save();
    this.logAudit(user.id, user.displayName, 'CREATION_VOYAGE', 'VOYAGE', voyage.id, null, voyage);
    return voyage;
  }

  public updateVoyage(id: string, updates: Partial<Voyage>, user: UserSession): Voyage {
    const index = this.data.voyages.findIndex((v) => v.id === id);
    if (index === -1) throw new Error('Voyage introuvable');
    const old = this.data.voyages[index];
    const updated: Voyage = { ...old, ...updates };
    this.data.voyages[index] = updated;
    this.save();
    this.logAudit(user.id, user.displayName, 'MODIFICATION_VOYAGE', 'VOYAGE', id, old, updated);
    return updated;
  }

  public deleteVoyage(id: string, user: UserSession): { success: boolean; message: string } {
    const index = this.data.voyages.findIndex((v) => v.id === id);
    if (index === -1) throw new Error('Campagne introuvable');
    const voyage = this.data.voyages[index];

    const linkedInscriptions = this.data.inscriptions.filter((i) => i.voyageId === id);
    const insIds = linkedInscriptions.map((i) => i.id);

    // Cascade cleanups
    this.data.payments = this.data.payments.filter((p) => !insIds.includes(p.inscriptionId) && p.voyageId !== id);
    this.data.documents = this.data.documents.filter((d) => !insIds.includes(d.inscriptionId));
    this.data.visas = this.data.visas.filter((v) => !insIds.includes(v.inscriptionId));
    this.data.inscriptions = this.data.inscriptions.filter((i) => i.voyageId !== id);
    this.data.packages = this.data.packages.filter((p) => p.voyageId !== id);
    this.data.expenses = this.data.expenses.filter((e) => e.voyageId !== id);
    this.data.flights = this.data.flights.filter((f) => f.voyageId !== id);
    this.data.groups = this.data.groups.filter((g) => g.voyageId !== id);

    this.data.voyages.splice(index, 1);
    this.save();
    this.logAudit(user.id, user.displayName, 'SUPPRESSION_VOYAGE', 'VOYAGE', id, voyage, null);
    return { success: true, message: `Campagne ${voyage.code} supprimée avec succès` };
  }

  // Packages & Versions (Requirement 9 & 36: Tariff History)
  public getPackages(voyageId?: string): VoyagePackage[] {
    if (voyageId) {
      return this.data.packages.filter((p) => p.voyageId === voyageId);
    }
    return this.data.packages;
  }

  public updatePackage(id: string, updates: Partial<VoyagePackage>, user: UserSession): VoyagePackage {
    const index = this.data.packages.findIndex((p) => p.id === id);
    if (index === -1) throw new Error('Package introuvable');
    const old = this.data.packages[index];
    const updated: VoyagePackage = { ...old, ...updates };
    this.data.packages[index] = updated;
    this.save();
    this.logAudit(user.id, user.displayName, 'MODIFICATION_PACKAGE', 'PACKAGE', id, old, updated);
    return updated;
  }

  public deletePackage(id: string, user: UserSession): { success: boolean; message: string } {
    const index = this.data.packages.findIndex((p) => p.id === id);
    if (index === -1) throw new Error('Package introuvable');
    const pkg = this.data.packages[index];

    this.data.packages.splice(index, 1);
    this.save();
    this.logAudit(user.id, user.displayName, 'SUPPRESSION_PACKAGE', 'PACKAGE', id, pkg, null);
    return { success: true, message: `Package ${pkg.name} supprimé avec succès` };
  }

  public createPackage(data: Omit<VoyagePackage, 'id' | 'activeVersionNumber' | 'versions' | 'createdAt'>, user: UserSession): VoyagePackage {
    const now = new Date().toISOString();
    const packageId = `pkg-${Date.now()}`;
    const initialVersion: PackageVersion = {
      id: `ver-${Date.now()}-1`,
      packageId,
      versionNumber: 1,
      price: data.price,
      status: data.status === 'DEFINITIF' ? 'DEFINITIF' : 'PROVISOIRE',
      effectiveFrom: data.validFrom,
      note: 'Création initiale du package',
      createdAt: now,
    };

    const pkg: VoyagePackage = {
      ...data,
      id: packageId,
      activeVersionNumber: 1,
      versions: [initialVersion],
      createdAt: now,
    };

    this.data.packages.push(pkg);
    this.data.package_versions.push(initialVersion);
    this.save();
    this.logAudit(user.id, user.displayName, 'CREATION_PACKAGE', 'PACKAGE', pkg.id, null, pkg);
    return pkg;
  }

  // Update package price by creating a new version without touching previous inscriptions
  public updatePackagePriceVersion(
    packageId: string,
    newPrice: number,
    status: 'PROVISOIRE' | 'DEFINITIF',
    effectiveFrom: string,
    note: string,
    user: UserSession
  ): VoyagePackage {
    const pkgIndex = this.data.packages.findIndex((p) => p.id === packageId);
    if (pkgIndex === -1) throw new Error('Package introuvable');

    const pkg = this.data.packages[pkgIndex];
    const nextVersionNumber = pkg.activeVersionNumber + 1;
    const now = new Date().toISOString();

    const newVersion: PackageVersion = {
      id: `ver-${Date.now()}-${nextVersionNumber}`,
      packageId,
      versionNumber: nextVersionNumber,
      price: newPrice,
      status,
      effectiveFrom,
      note,
      createdAt: now,
    };

    // Close previous version effectiveTo
    const previousVersion = pkg.versions[pkg.versions.length - 1];
    if (previousVersion) {
      previousVersion.effectiveTo = effectiveFrom;
    }

    pkg.versions.push(newVersion);
    pkg.activeVersionNumber = nextVersionNumber;
    pkg.price = newPrice;
    pkg.status = status;

    this.data.package_versions.push(newVersion);
    this.save();

    this.logAudit(
      user.id,
      user.displayName,
      'NOUVELLE_VERSION_TARIF_PACKAGE',
      'PACKAGE',
      packageId,
      { oldPrice: previousVersion?.price, oldStatus: previousVersion?.status },
      { newPrice, status, versionNumber: nextVersionNumber }
    );

    return pkg;
  }

  // Inscriptions
  public getInscriptions(query?: { voyageId?: string; clientId?: string }): Inscription[] {
    let list = [...this.data.inscriptions];
    if (query?.voyageId) list = list.filter((i) => i.voyageId === query.voyageId);
    if (query?.clientId) list = list.filter((i) => i.clientId === query.clientId);

    return list.map((ins) => this.hydrateInscription(ins));
  }

  public getInscriptionById(id: string): Inscription | undefined {
    const ins = this.data.inscriptions.find((i) => i.id === id);
    if (!ins) return undefined;
    return this.hydrateInscription(ins);
  }

  private hydrateInscription(ins: Inscription): Inscription {
    const client = this.data.clients.find((c) => c.id === ins.clientId);
    const voyage = this.data.voyages.find((v) => v.id === ins.voyageId);
    const pkg = this.data.packages.find((p) => p.id === ins.packageId);

    // Sum validated payments
    const payments = this.data.payments.filter(
      (p) => p.inscriptionId === ins.id && p.status === 'VALIDE'
    );
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = ins.appliedPrice - totalPaid;
    const paymentRate = ins.appliedPrice > 0 ? Math.round((totalPaid / ins.appliedPrice) * 100) : 0;

    let paymentStatus: 'SOLDE' | 'EN_COURS' | 'EN_RETARD' | 'IMPAYE' = 'IMPAYE';
    if (totalPaid >= ins.appliedPrice) {
      paymentStatus = 'SOLDE';
    } else if (totalPaid > 0) {
      paymentStatus = 'EN_COURS';
    }

    // Document completeness
    const requiredTypes = this.data.settings.defaultRequiredDocumentTypes;
    const clientDocs = this.data.documents.filter(
      (d) => d.inscriptionId === ins.id && d.status === 'VALIDE'
    );
    const validCount = clientDocs.length;
    const docRate = requiredTypes.length > 0 ? Math.min(100, Math.round((validCount / requiredTypes.length) * 100)) : 100;

    return {
      ...ins,
      client,
      voyage,
      package: pkg,
      totalPaid,
      balance,
      paymentRate,
      paymentStatus,
      documentCompletenessRate: docRate,
    };
  }

  public createInscription(
    data: { clientId: string; voyageId: string; packageId: string; status?: 'CONFIRMEE' | 'EN_ATTENTE' },
    user: UserSession
  ): Inscription {
    // Check for duplicate inscription
    const existing = this.data.inscriptions.find(
      (i) => i.clientId === data.clientId && i.voyageId === data.voyageId && i.status !== 'ANNULEE'
    );
    if (existing) {
      throw new Error('Ce pèlerin possède déjà une inscription active pour ce voyage.');
    }

    const pkg = this.data.packages.find((p) => p.id === data.packageId);
    if (!pkg) throw new Error('Package introuvable');

    const activeVersion = pkg.versions[pkg.versions.length - 1];
    const appliedPrice = pkg.price;
    const count = this.data.inscriptions.length + 1;
    const code = `INS-2027-${String(count).padStart(3, '0')}`;
    const now = new Date().toISOString();

    const inscription: Inscription = {
      id: `ins-${Date.now()}`,
      code,
      clientId: data.clientId,
      voyageId: data.voyageId,
      packageId: data.packageId,
      packageVersionId: activeVersion ? activeVersion.id : 'ver-1',
      appliedPrice,
      agreedPrice: appliedPrice,
      priceVersionSnapshotted: activeVersion ? activeVersion.versionNumber : 1,
      status: data.status || 'CONFIRMEE',
      agentId: user.id,
      agentName: user.displayName,
      createdAt: now,
      updatedAt: now,
    };

    this.data.inscriptions.push(inscription);

    // Also initialize default visa tracker
    this.data.visas.push({
      id: `visa-${Date.now()}`,
      clientId: data.clientId,
      inscriptionId: inscription.id,
      status: 'NON_DEMANDE',
      notes: 'Initialisé automatiquement à l’inscription',
      updatedAt: now,
    });

    this.save();
    this.logAudit(user.id, user.displayName, 'CREATION_INSCRIPTION', 'INSCRIPTION', inscription.id, null, inscription);
    return this.hydrateInscription(inscription);
  }

  public updateInscriptionStatus(id: string, status: Inscription['status'], user: UserSession): Inscription {
    const idx = this.data.inscriptions.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error('Inscription introuvable');
    const old = this.data.inscriptions[idx];
    this.data.inscriptions[idx] = { ...old, status, updatedAt: new Date().toISOString() };
    this.save();
    this.logAudit(user.id, user.displayName, 'STATUT_INSCRIPTION', 'INSCRIPTION', id, old.status, status);
    return this.hydrateInscription(this.data.inscriptions[idx]);
  }

  public updateInscriptionPrice(id: string, newPrice: number, reason: string, user: UserSession): Inscription {
    const idx = this.data.inscriptions.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error('Inscription introuvable');
    if (!newPrice || newPrice <= 0) throw new Error('Le montant du tarif doit être supérieur à 0');
    if (!reason || !reason.trim()) throw new Error('Le motif du changement de prix est obligatoire pour la traçabilité');

    const old = this.data.inscriptions[idx];
    const oldPrice = old.appliedPrice;
    
    // Recalculate balance
    const newBalance = Math.max(0, newPrice - old.totalPaid);

    this.data.inscriptions[idx] = {
      ...old,
      appliedPrice: newPrice,
      balance: newBalance,
      updatedAt: new Date().toISOString(),
    };
    this.save();

    // Log the audit event with old amount, new amount, difference, and mandatory motif
    this.logAudit(
      user.id,
      user.displayName,
      'MODIFICATION_PRIX_INSCRIPTION',
      'INSCRIPTION',
      id,
      { appliedPrice: oldPrice },
      { 
        appliedPrice: newPrice, 
        difference: newPrice - oldPrice,
        reason: reason.trim(),
        inscriptionCode: old.code
      }
    );

    return this.hydrateInscription(this.data.inscriptions[idx]);
  }

  public deleteInscription(id: string, user: UserSession): { success: boolean; message: string } {
    const idx = this.data.inscriptions.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error('Inscription introuvable');
    const removed = this.data.inscriptions.splice(idx, 1)[0];
    this.data.visas = this.data.visas.filter((v) => v.inscriptionId !== id);
    this.data.room_assignments = this.data.room_assignments.filter((ra) => ra.inscriptionId !== id);
    this.data.group_members = this.data.group_members.filter((gm) => gm.inscriptionId !== id);
    this.save();
    this.logAudit(user.id, user.displayName, 'SUPPRESSION_INSCRIPTION', 'INSCRIPTION', id, removed, null);
    return { success: true, message: `Inscription ${removed.code} supprimée avec succès` };
  }

  // Payments & Receipts (Requirements 12, 13, 26)
  public getPayments(query?: { clientId?: string; inscriptionId?: string; voyageId?: string }): Payment[] {
    let list = [...this.data.payments];
    if (query?.clientId) list = list.filter((p) => p.clientId === query.clientId);
    if (query?.inscriptionId) list = list.filter((p) => p.inscriptionId === query.inscriptionId);
    if (query?.voyageId) list = list.filter((p) => p.voyageId === query.voyageId);
    return list;
  }

  public createPayment(
    data: {
      clientId: string;
      inscriptionId: string;
      amount: number;
      paymentMethod: string;
      reference?: string;
      comment?: string;
      paymentDate?: string;
    },
    user: UserSession
  ): Payment {
    const inscription = this.data.inscriptions.find((i) => i.id === data.inscriptionId);
    if (!inscription) throw new Error('Inscription introuvable');

    const client = this.data.clients.find((c) => c.id === data.clientId);
    const voyage = this.data.voyages.find((v) => v.id === inscription.voyageId);

    // Generate sequential receipt PAY-2027-XXXX
    const count = this.data.payments.length + 1;
    const receiptNumber = `PAY-2027-${String(count).padStart(4, '0')}`;
    const now = new Date().toISOString();

    const payment: Payment = {
      id: `pay-${Date.now()}`,
      receiptNumber,
      clientId: data.clientId,
      inscriptionId: data.inscriptionId,
      voyageId: inscription.voyageId,
      amount: data.amount,
      currency: this.data.settings.currency || 'FCFA',
      paymentMethod: data.paymentMethod,
      reference: data.reference,
      comment: data.comment,
      status: 'VALIDE',
      agentId: user.id,
      agentName: user.displayName,
      paymentDate: data.paymentDate || now,
      createdAt: now,
      clientName: client ? `${client.firstName} ${client.lastName}` : undefined,
      voyageCode: voyage?.code,
    };

    this.data.payments.unshift(payment);
    this.save();

    this.logAudit(
      user.id,
      user.displayName,
      'ENREGISTREMENT_PAIEMENT',
      'PAYMENT',
      payment.id,
      null,
      { receiptNumber, amount: payment.amount, client: payment.clientName }
    );

    return payment;
  }

  public cancelPayment(paymentId: string, reason: string, user: UserSession): Payment {
    const index = this.data.payments.findIndex((p) => p.id === paymentId);
    if (index === -1) throw new Error('Paiement introuvable');

    const old = this.data.payments[index];
    if (old.status === 'ANNULE') {
      throw new Error('Ce paiement est déjà annulé.');
    }

    const updated: Payment = {
      ...old,
      status: 'ANNULE',
      comment: `${old.comment ? old.comment + ' | ' : ''}Annulé par ${user.displayName}: ${reason}`,
    };

    this.data.payments[index] = updated;
    this.save();

    this.logAudit(user.id, user.displayName, 'ANNULATION_PAIEMENT', 'PAYMENT', paymentId, old, updated);
    return updated;
  }

  // Documents (Requirements 15, 16)
  public getDocuments(query?: { clientId?: string; inscriptionId?: string }): PilgrimDocument[] {
    let list = [...this.data.documents];
    if (query?.clientId) list = list.filter((d) => d.clientId === query.clientId);
    if (query?.inscriptionId) list = list.filter((d) => d.inscriptionId === query.inscriptionId);
    return list;
  }

  public createDocument(data: Omit<PilgrimDocument, 'id' | 'createdAt'>, user: UserSession): PilgrimDocument {
    const doc: PilgrimDocument = {
      ...data,
      id: `doc-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.data.documents.unshift(doc);
    this.save();
    this.logAudit(user.id, user.displayName, 'AJOUT_DOCUMENT', 'DOCUMENT', doc.id, null, doc);
    return doc;
  }

  public updateDocumentStatus(
    id: string,
    status: PilgrimDocument['status'],
    comment: string | undefined,
    user: UserSession
  ): PilgrimDocument {
    const index = this.data.documents.findIndex((d) => d.id === id);
    if (index === -1) throw new Error('Document introuvable');
    const old = this.data.documents[index];
    const updated: PilgrimDocument = {
      ...old,
      status,
      comment: comment !== undefined ? comment : old.comment,
      validatedBy: status === 'VALIDE' ? user.displayName : old.validatedBy,
      validatedAt: status === 'VALIDE' ? new Date().toISOString() : old.validatedAt,
    };
    this.data.documents[index] = updated;
    this.save();
    this.logAudit(user.id, user.displayName, 'VALIDATION_DOCUMENT', 'DOCUMENT', id, old, updated);
    return updated;
  }

  // Visas
  public getVisas(voyageId?: string): Visa[] {
    if (!voyageId) return this.data.visas;
    const inscriptions = this.data.inscriptions.filter((i) => i.voyageId === voyageId);
    const insIds = new Set(inscriptions.map((i) => i.id));
    return this.data.visas.filter((v) => insIds.has(v.inscriptionId));
  }

  public updateVisa(id: string, updates: Partial<Visa>, user: UserSession): Visa {
    const index = this.data.visas.findIndex((v) => v.id === id);
    if (index === -1) throw new Error('Visa introuvable');
    const old = this.data.visas[index];
    const updated: Visa = { ...old, ...updates, updatedAt: new Date().toISOString() };
    this.data.visas[index] = updated;
    this.save();
    this.logAudit(user.id, user.displayName, 'MODIFICATION_VISA', 'VISA', id, old, updated);
    return updated;
  }

  // Flights & Tickets
  public getFlights(voyageId?: string): Flight[] {
    if (voyageId) return this.data.flights.filter((f) => f.voyageId === voyageId);
    return this.data.flights;
  }

  public createFlight(flightData: Omit<Flight, 'id'>, user: UserSession): Flight {
    const flight: Flight = { ...flightData, id: `flt-${Date.now()}` };
    this.data.flights.push(flight);
    this.save();
    this.logAudit(user.id, user.displayName, 'CREATION_VOL', 'FLIGHT', flight.id, null, flight);
    return flight;
  }

  public getTickets(query?: { flightId?: string; clientId?: string }): Ticket[] {
    let list = [...this.data.tickets];
    if (query?.flightId) list = list.filter((t) => t.flightId === query.flightId);
    if (query?.clientId) list = list.filter((t) => t.clientId === query.clientId);
    return list;
  }

  public createTicket(data: Omit<Ticket, 'id'>, user: UserSession): Ticket {
    const ticket: Ticket = { ...data, id: `tkt-${Date.now()}` };
    this.data.tickets.push(ticket);
    this.save();
    this.logAudit(user.id, user.displayName, 'EMISSION_BILLET', 'TICKET', ticket.id, null, ticket);
    return ticket;
  }

  // Hotels & Rooms (Requirement 19, 20: Anti-Capacity Overrun)
  public getHotels(voyageId?: string): Hotel[] {
    if (voyageId) return this.data.hotels.filter((h) => h.voyageId === voyageId);
    return this.data.hotels;
  }

  public createHotel(data: Omit<Hotel, 'id'>, user: UserSession): Hotel {
    const hotel: Hotel = { ...data, id: `htl-${Date.now()}` };
    this.data.hotels.push(hotel);
    this.save();
    this.logAudit(user.id, user.displayName, 'CREATION_HOTEL', 'HOTEL', hotel.id, null, hotel);
    return hotel;
  }

  public getRooms(hotelId?: string): (Room & { occupants: Client[] })[] {
    let list = [...this.data.rooms];
    if (hotelId) list = list.filter((r) => r.hotelId === hotelId);

    return list.map((r) => {
      const assignments = this.data.room_assignments.filter((ra) => ra.roomId === r.id);
      const occupantIds = assignments.map((ra) => ra.clientId);
      const occupants = this.data.clients.filter((c) => occupantIds.includes(c.id));
      return {
        ...r,
        currentOccupancy: occupants.length,
        occupants,
      };
    });
  }

  public createRoom(data: Omit<Room, 'id' | 'currentOccupancy'>, user: UserSession): Room {
    const room: Room = {
      ...data,
      id: `room-${Date.now()}`,
      currentOccupancy: 0,
    };
    this.data.rooms.push(room);
    this.save();
    this.logAudit(user.id, user.displayName, 'CREATION_CHAMBRE', 'ROOM', room.id, null, room);
    return room;
  }

  // Room Assignment with strict capacity enforcement (Requirement 20 & 43)
  public assignClientToRoom(roomId: string, clientId: string, inscriptionId: string, user: UserSession): RoomAssignment {
    const room = this.data.rooms.find((r) => r.id === roomId);
    if (!room) throw new Error('Chambre introuvable');

    // Count current active assignments
    const currentAssignments = this.data.room_assignments.filter((ra) => ra.roomId === roomId);
    if (currentAssignments.length >= room.capacity) {
      throw new Error(`Capacité maximale atteinte pour la chambre ${room.roomNumber} (${room.capacity} personnes max).`);
    }

    // Check if client is already assigned to a room in this same hotel
    const alreadyAssigned = this.data.room_assignments.find(
      (ra) => ra.clientId === clientId && ra.hotelId === room.hotelId
    );
    if (alreadyAssigned) {
      throw new Error('Ce pèlerin est déjà assigné à une chambre dans cet hôtel.');
    }

    const assignment: RoomAssignment = {
      id: `ra-${Date.now()}`,
      roomId,
      hotelId: room.hotelId,
      clientId,
      inscriptionId,
      assignedAt: new Date().toISOString(),
    };

    this.data.room_assignments.push(assignment);
    room.currentOccupancy = currentAssignments.length + 1;
    this.save();

    this.logAudit(
      user.id,
      user.displayName,
      'AFFECTATION_CHAMBRE',
      'ROOM_ASSIGNMENT',
      assignment.id,
      null,
      { room: room.roomNumber, clientId }
    );

    return assignment;
  }

  public removeClientFromRoom(roomId: string, clientId: string, user: UserSession) {
    const idx = this.data.room_assignments.findIndex((ra) => ra.roomId === roomId && ra.clientId === clientId);
    if (idx === -1) throw new Error('Affectation introuvable');

    const removed = this.data.room_assignments.splice(idx, 1)[0];
    const room = this.data.rooms.find((r) => r.id === roomId);
    if (room) {
      room.currentOccupancy = Math.max(0, room.currentOccupancy - 1);
    }
    this.save();

    this.logAudit(user.id, user.displayName, 'RETRAIT_CHAMBRE', 'ROOM_ASSIGNMENT', roomId, removed, null);
    return { success: true };
  }

  // Groups & Accompagnateurs
  public getGroups(voyageId?: string): (Group & { members: Client[] })[] {
    let list = [...this.data.groups];
    if (voyageId) list = list.filter((g) => g.voyageId === voyageId);

    return list.map((g) => {
      const memberLinks = this.data.group_members.filter((gm) => gm.groupId === g.id);
      const memberClientIds = memberLinks.map((gm) => gm.clientId);
      const members = this.data.clients.filter((c) => memberClientIds.includes(c.id));
      return { ...g, members };
    });
  }

  public createGroup(data: Omit<Group, 'id'>, user: UserSession): Group {
    const group: Group = { ...data, id: `grp-${Date.now()}` };
    this.data.groups.push(group);
    this.save();
    this.logAudit(user.id, user.displayName, 'CREATION_GROUPE', 'GROUP', group.id, null, group);
    return group;
  }

  public addClientToGroup(groupId: string, clientId: string, inscriptionId: string, user: UserSession): GroupMember {
    const existing = this.data.group_members.find((gm) => gm.groupId === groupId && gm.clientId === clientId);
    if (existing) throw new Error('Ce pèlerin fait déjà partie de ce groupe.');

    const member: GroupMember = {
      id: `gm-${Date.now()}`,
      groupId,
      clientId,
      inscriptionId,
    };
    this.data.group_members.push(member);
    this.save();
    this.logAudit(user.id, user.displayName, 'AJOUT_MEMBRE_GROUPE', 'GROUP', groupId, null, { clientId });
    return member;
  }

  public getAccompagnateurs(voyageId?: string): Accompagnateur[] {
    if (voyageId) return this.data.accompagnateurs.filter((a) => !a.voyageId || a.voyageId === voyageId);
    return this.data.accompagnateurs;
  }

  // Expenses & Profitability (Requirements 24 & 25)
  public getExpenses(voyageId?: string): Expense[] {
    if (voyageId) return this.data.expenses.filter((e) => e.voyageId === voyageId);
    return this.data.expenses;
  }

  public createExpense(data: Omit<Expense, 'id' | 'createdAt'>, user: UserSession): Expense {
    const expense: Expense = {
      ...data,
      id: `exp-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.data.expenses.push(expense);
    this.save();
    this.logAudit(user.id, user.displayName, 'AJOUT_DEPENSE', 'EXPENSE', expense.id, null, expense);
    return expense;
  }

  public updateExpense(id: string, updates: Partial<Expense>, user: UserSession): Expense {
    const idx = this.data.expenses.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error('Dépense introuvable');
    const old = this.data.expenses[idx];
    const updated: Expense = { ...old, ...updates };
    this.data.expenses[idx] = updated;
    this.save();
    this.logAudit(user.id, user.displayName, 'MODIFICATION_DEPENSE', 'EXPENSE', id, old, updated);
    return updated;
  }

  public deleteExpense(id: string, user: UserSession) {
    const idx = this.data.expenses.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error('Dépense introuvable');
    const removed = this.data.expenses.splice(idx, 1)[0];
    this.save();
    this.logAudit(user.id, user.displayName, 'SUPPRESSION_DEPENSE', 'EXPENSE', id, removed, null);
    return { success: true };
  }

  // Audit Logs
  public getAuditLogs(): AuditLog[] {
    return this.data.audit_logs;
  }

  // Dashboard Stats (Dynamic Calculations from Database)
  public getDashboardStats(): DashboardStats {
    const inscriptions = this.getInscriptions();
    const payments = this.data.payments.filter((p) => p.status === 'VALIDE');
    const clients = this.data.clients;
    const voyages = this.data.voyages;
    const expenses = this.data.expenses;

    // Activity
    const totalPilgrims = clients.length;
    const totalVoyages = voyages.length;
    const totalHajj = voyages.filter((v) => v.type === 'HAJJ').length;
    const totalUmrah = voyages.filter((v) => v.type === 'OUMRAH').length;

    const pilgrimsByVoyage = voyages.map((v) => {
      const count = inscriptions.filter((i) => i.voyageId === v.id).length;
      return {
        voyageName: v.title,
        voyageCode: v.code,
        count,
        capacity: v.capacity,
      };
    });

    const upcomingDepartures = voyages
      .filter((v) => v.status === 'OUVERT' || v.status === 'PLANIFIE')
      .map((v) => {
        const dep = new Date(v.departureDate).getTime();
        const diffDays = Math.ceil((dep - Date.now()) / (1000 * 3600 * 24));
        return {
          title: v.title,
          code: v.code,
          departureDate: v.departureDate,
          daysLeft: Math.max(0, diffDays),
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);

    // Finance
    const totalRevenueExpected = inscriptions.reduce((sum, i) => sum + i.appliedPrice, 0);
    const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalRemaining = Math.max(0, totalRevenueExpected - totalCollected);
    const recoveryRate = totalRevenueExpected > 0 ? Math.round((totalCollected / totalRevenueExpected) * 100) : 0;

    const paidInFullCount = inscriptions.filter((i) => (i.balance || 0) <= 0).length;
    const inProgressCount = inscriptions.filter((i) => (i.totalPaid || 0) > 0 && (i.balance || 0) > 0).length;
    const overdueCount = inscriptions.filter((i) => (i.totalPaid || 0) === 0).length;

    // Documents
    const completeCount = inscriptions.filter((i) => (i.documentCompletenessRate || 0) >= 100).length;
    const incompleteCount = inscriptions.filter((i) => (i.documentCompletenessRate || 0) < 100).length;

    // Recouvrement
    const highBalanceThreshold = this.data.settings.recoveryHighBalanceAmount || 2000000;
    const topDebtors = inscriptions
      .filter((i) => (i.balance || 0) > 0)
      .map((i) => {
        const client = i.client;
        const remaining = i.balance || 0;
        let priority: 'NORMAL' | 'IMPORTANT' | 'URGENT' = 'NORMAL';
        if (remaining >= highBalanceThreshold) {
          priority = 'URGENT';
        } else if (remaining > 1000000) {
          priority = 'IMPORTANT';
        }
        return {
          clientName: client ? `${client.firstName} ${client.lastName}` : 'Inconnu',
          phone: client?.phone || '',
          voyageCode: i.voyage?.code || '',
          appliedPrice: i.appliedPrice,
          paid: i.totalPaid || 0,
          remaining,
          priority,
        };
      })
      .sort((a, b) => b.remaining - a.remaining);

    // Profitability per voyage
    const profitability = voyages.map((v) => {
      const voyageInscriptions = inscriptions.filter((i) => i.voyageId === v.id);
      const voyageRevenue = voyageInscriptions.reduce((sum, i) => sum + i.appliedPrice, 0);
      const voyageExpenses = expenses.filter((e) => e.voyageId === v.id).reduce((sum, e) => sum + e.amount, 0);
      const netResult = voyageRevenue - voyageExpenses;
      const marginRate = voyageRevenue > 0 ? Math.round((netResult / voyageRevenue) * 100) : 0;
      return {
        voyageCode: v.code,
        voyageTitle: v.title,
        revenue: voyageRevenue,
        expenses: voyageExpenses,
        netResult,
        marginRate,
      };
    });

    return {
      activity: {
        totalPilgrims,
        totalVoyages,
        totalHajj,
        totalUmrah,
        pilgrimsByVoyage,
        upcomingDepartures,
      },
      finance: {
        totalRevenueExpected,
        totalCollected,
        totalRemaining,
        recoveryRate,
        paidInFullCount,
        inProgressCount,
        overdueCount,
      },
      documents: {
        completeCount,
        incompleteCount,
        missingPassports: inscriptions.length - this.data.documents.filter((d) => d.type === 'Passeport' && d.status === 'VALIDE').length,
        missingVisas: inscriptions.length - this.data.visas.filter((v) => v.status === 'APPROUVE').length,
        missingTickets: inscriptions.length - this.data.tickets.filter((t) => t.status === 'EMIS').length,
        expiredDocs: 0,
      },
      recouvrement: {
        topDebtors,
        urgentRemindersCount: topDebtors.filter((d) => d.priority === 'URGENT').length,
      },
      profitability,
    };
  }

  // Espace Pèlerin: strictly isolated view for a pilgrim (Requirement 27, 28, 29, 30, 32)
  public getPilgrimDossier(clientId: string) {
    const client = this.data.clients.find((c) => c.id === clientId);
    if (!client) throw new Error('Client introuvable');

    const inscriptions = this.getInscriptions({ clientId });
    const primaryInscription = inscriptions[0];

    const payments = this.data.payments.filter((p) => p.clientId === clientId && p.status === 'VALIDE');
    // Only documents marked as client visible
    const documents = this.data.documents.filter((d) => d.clientId === clientId && d.isClientVisible);
    const visa = this.data.visas.find((v) => v.clientId === clientId);
    const tickets = this.data.tickets.filter((t) => t.clientId === clientId);
    const flights = primaryInscription ? this.getFlights(primaryInscription.voyageId) : [];

    // Hotel & room assignment
    const assignments = this.data.room_assignments.filter((ra) => ra.clientId === clientId);
    const assignedRooms = assignments.map((ra) => {
      const room = this.data.rooms.find((r) => r.id === ra.roomId);
      const hotel = room ? this.data.hotels.find((h) => h.id === room.hotelId) : undefined;
      return {
        hotelName: hotel?.name,
        city: hotel?.city,
        roomNumber: room?.roomNumber,
        roomType: room?.roomType,
      };
    });

    // Group info
    const groupMember = this.data.group_members.find((gm) => gm.clientId === clientId);
    const group = groupMember ? this.data.groups.find((g) => g.id === groupMember.groupId) : undefined;

    // Sanitize client (remove internal notes strictly!)
    const safeClient = {
      id: client.id,
      code: client.code,
      firstName: client.firstName,
      lastName: client.lastName,
      gender: client.gender,
      birthDate: client.birthDate,
      nationality: client.nationality,
      phone: client.phone,
      whatsapp: client.whatsapp,
      email: client.email,
      address: client.address,
      status: client.status,
    };

    return {
      client: safeClient,
      inscription: primaryInscription,
      allInscriptions: inscriptions,
      payments,
      documents,
      visa,
      tickets,
      flights,
      rooms: assignedRooms,
      group: group ? { name: group.name, guideName: group.guideName, busNumber: group.busNumber } : null,
    };
  }
}

export const db = new DatabaseManager();
