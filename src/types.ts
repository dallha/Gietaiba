export interface UserSession {
  id: string;
  email: string;
  role: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  clientId?: string;
  allowedInscriptionIds?: string[];
  phone?: string;
  active?: boolean;
  permissions?: string[];
  roles?: string[];
  accessibleClientIds?: string[];
}

export interface UserClientAccess {
  id: string;
  userId: string;
  clientId: string;
  relationshipType: 'TITULAIRE' | 'TUTEUR_FAMILLE' | 'PAYEUR_TIERS' | 'GESTIONNAIRE';
  canView: boolean;
  canPay: boolean;
  canUploadDocs: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  client?: Client;
}

export interface SystemConfig {
  initialized: boolean;
  initializedAt?: string;
  initialSuperAdminUid?: string;
}

export interface Role {
  id: string; // e.g. SUPER_ADMIN, DIRECTION, CAISSE, etc.
  name: string;
  permissions: string[];
  description?: string;
  isSystem?: boolean;
}

export interface User {
  id: string; // The Firestore document ID (same as authUid)
  authUid: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  roleId: string; // Matches Role.id
  status: 'ACTIF' | 'INACTIF' | 'SUSPENDU' | 'ARCHIVE';
  active: boolean;
  clientId?: string; // Only if roleId is 'PILGRIM'
  allowedInscriptionIds?: string[]; // Specific inscriptions allowed for multi-dossier control
  isTest?: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export type Package = VoyagePackage;

export interface AgencySettings {
  id?: string;
  agencyName: string;
  subtitle?: string;
  logoUrl?: string;
  currency?: string;
  defaultCurrency?: string;
  phone: string;
  email: string;
  address: string;
  city?: string;
  country?: string;
  rcNumber?: string;
  licenseNumber?: string;
  taxId?: string;
  ninea?: string;
  receiptFooterTerms?: string;
  bankDetails?: {
    bankName?: string;
    iban?: string;
    bic?: string;
  };
  mobileMoneyNumbers?: {
    wave?: string;
    orangeMoney?: string;
  };
  recoveryUrgentThresholdDays?: number;
  recoveryHighBalanceAmount?: number;
  defaultRequiredDocumentTypes?: string[];
  paymentMethods?: string[];
  expenseCategories?: string[];
  cities?: string[];
}

export interface ClientContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface Client {
  id: string;
  code: string; // CLI-2027-001
  civility?: 'M.' | 'Mme' | 'El Hadj' | 'Adja' | string;
  firstName: string;
  lastName: string;
  passportNumber?: string;
  gender: 'M' | 'F';
  birthDate: string;
  nationality: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  address: string;
  profession: string;
  contactPerson: string;
  contactPhone: string;
  internalNotes?: string;
  photoUrl?: string;
  status: 'ACTIF' | 'EN_ATTENTE' | 'ARCHIVE';
  isTest?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Voyage {
  id: string;
  code: string; // HAJ2027-01, OUM2027-RAM
  title: string;
  type: 'HAJJ' | 'OUMRAH' | string;
  year: number;
  departureDate: string;
  returnDate: string;
  startDate?: string;
  endDate?: string;
  capacity: number; // Capacité totale
  status: 'PLANIFIE' | 'OUVERT' | 'EN_COURS' | 'CLOTURE' | 'ARCHIVE';
  responsable?: string; // Responsable / Chef de mission (ex. El Hadj Amadou Niang)
  responsablePhone?: string;
  hotelsSummary?: string; // e.g. "Pullman Zamzam 5★ (Makkah) + Anwar Al Madinah 5★"
  volsSummary?: string; // e.g. "Air Sénégal / Saudia (Vols Directs AIBD - JED/MED)"
  flightIds?: string[];
  hotelIds?: string[];
  description?: string;
  logisticsNotes?: string;
  createdAt: string;
}

export type Campaign = Voyage;

export interface IncludedService {
  id: string;
  category: 'HEBERGEMENT' | 'TRANSPORT' | 'RESTAURATION' | 'VISA' | 'ENCADREMENT' | 'ZIARAS' | 'SANTE' | 'AUTRE';
  label: string;
  detail?: string;
  isIncluded: boolean;
}

export interface PackageVersion {
  id: string;
  packageId: string;
  versionNumber: number;
  price: number;
  status: 'PROVISOIRE' | 'DEFINITIF';
  effectiveFrom: string;
  effectiveTo?: string;
  note?: string;
  createdAt: string;
}

export interface VoyagePackage {
  id: string;
  voyageId: string;
  name: string; // Standard, Confort, Premium, VIP
  code?: string;
  category?: 'STANDARD' | 'CONFORT' | 'PREMIUM' | 'VIP';
  description: string;
  price: number;
  initialPrice?: number;
  currentPrice?: number;
  currency: string;
  capacity?: number; // Quota de places pour ce package
  conditions?: string; // Conditions d'annulation et échéancier
  servicesIncluded?: (string | IncludedService)[];
  roomType?: string; // QUADRUPLE, TRIPLE, DOUBLE, SINGLE
  hotelMakkah?: string;
  hotelMedina?: string;
  status: 'PROVISOIRE' | 'DEFINITIF' | 'ACTIF' | 'ARCHIVE';
  validFrom: string;
  validTo?: string;
  activeVersionNumber: number;
  versions: PackageVersion[];
  createdAt: string;
}

export interface Inscription {
  id: string;
  code: string; // INS-2027-001
  clientId: string;
  voyageId: string;
  campaignId?: string;
  packageId: string;
  packageVersionId: string;
  appliedPrice: number; // Snapshot historique immuable du prix convenu au moment de l'inscription
  agreedPrice?: number; // Alias explicite du prix convenu
  priceVersionSnapshotted?: number; // Numéro de version tarifaire capturée (ex. V1)
  status: 'CONFIRMEE' | 'EN_ATTENTE' | 'ANNULEE';
  agentId: string;
  agentName: string;
  isTest?: boolean;
  registrationDate?: string;
  createdAt: string;
  updatedAt: string;
  // Computed / expanded fields for convenience
  client?: Client;
  voyage?: Voyage;
  package?: VoyagePackage;
  totalPaid?: number;
  balance?: number;
  paymentRate?: number;
  paymentStatus?: 'SOLDE' | 'EN_COURS' | 'EN_RETARD' | 'IMPAYE';
  documentCompletenessRate?: number;
}

export interface Payment {
  id: string;
  receiptNumber: string; // PAY-2027-0001
  clientId: string;
  inscriptionId: string;
  voyageId: string;
  amount: number;
  currency: string;
  paymentMethod: string; // Especes, Wave, Orange Money, Virement, Cheque, Carte, Autre
  reference?: string;
  comment?: string;
  status: 'VALIDE' | 'ANNULE' | 'EN_ATTENTE';
  agentId: string;
  agentName: string;
  paymentDate: string;
  isTest?: boolean;
  createdAt: string;
  // Joined fields
  clientName?: string;
  voyageCode?: string;
}

export type DocumentStatus = 'MANQUANT' | 'RECU' | 'EN_VERIFICATION' | 'VALIDE' | 'EXPIRE' | 'REFUSE';

export interface PilgrimDocument {
  id: string;
  type: string; // Passeport, Visa, Assurance, Billet, Vaccination, Photo, Autre
  clientId: string;
  inscriptionId: string;
  fileName: string;
  fileUrl?: string;
  receivedDate?: string;
  expiryDate?: string;
  status: DocumentStatus;
  comment?: string;
  validatedBy?: string;
  validatedAt?: string;
  isClientVisible: boolean;
  createdAt: string;
}

export type VisaStatus = 'NON_DEMANDE' | 'DOSSIER_EN_PREPARATION' | 'DEMANDE' | 'EN_TRAITEMENT' | 'APPROUVE' | 'REFUSE' | 'EXPIRE';

export interface Visa {
  id: string;
  clientId: string;
  inscriptionId: string;
  status: VisaStatus;
  visaNumber?: string;
  nusukApplicationNumber?: string;
  rejectionReason?: string;
  applicationDate?: string;
  issueDate?: string;
  expiryDate?: string;
  notes?: string;
  updatedAt: string;
}

export interface Flight {
  id: string;
  voyageId: string;
  airline: string;
  flightNumber: string;
  departureCity: string;
  arrivalCity: string;
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  terminal?: string;
  status: 'PROGRAMME' | 'CONFIRME' | 'RETARDE' | 'EFFECTUE' | 'ANNULE';
}

export interface Ticket {
  id: string;
  flightId: string;
  clientId: string;
  inscriptionId: string;
  ticketNumber: string;
  pnr?: string;
  fileUrl?: string;
  issueDate: string;
  status: 'EMIS' | 'EN_ATTENTE' | 'ANNULE';
}

export interface Hotel {
  id: string;
  voyageId: string;
  name: string;
  city: 'Makkah' | 'Médine' | string;
  address: string;
  category: number; // Stars (e.g. 4, 5)
  contactPhone?: string;
  checkInDate: string;
  checkOutDate: string;
}

export interface Room {
  id: string;
  hotelId: string;
  voyageId: string;
  building?: string;
  floor?: string;
  roomNumber: string;
  roomType: 'INDIVIDUELLE' | 'DOUBLE' | 'TRIPLE' | 'QUADRUPLE' | 'SUITE';
  capacity: number;
  currentOccupancy: number;
  notes?: string;
}

export interface RoomAssignment {
  id: string;
  roomId: string;
  hotelId: string;
  clientId: string;
  inscriptionId: string;
  assignedAt: string;
  checkInDate?: string;
  checkOutDate?: string;
  notes?: string;
  createdAt?: string;
}

export interface Group {
  id: string;
  voyageId: string;
  name: string; // Groupe A, Groupe B...
  guideId?: string;
  guideName?: string;
  busNumber?: string;
  hotelId?: string;
  notes?: string;
}

export interface GroupMember {
  id: string;
  groupId: string;
  clientId: string;
  inscriptionId: string;
}

export interface Accompagnateur {
  id: string;
  name: string;
  phone: string;
  role: string;
  voyageId?: string;
  availability: boolean;
  notes?: string;
}

export interface Expense {
  id: string;
  code?: string; // EXP-YYYY-000001
  voyageId: string;
  category: string; // Billets, Hotel, Transport, Visa, Assurance, Restauration, Salaires, Communication, Administration, Autre
  amount: number;
  currency: string;
  date: string;
  supplier: string;
  receiptNumber?: string;
  receiptUrl?: string;
  comment?: string;
  createdBy: string;
  createdAt: string;
}

export interface PaymentSchedule {
  id: string;
  inscriptionId: string;
  dueDate: string;
  amountDue: number;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HotelStay {
  id: string;
  inscriptionId: string;
  clientId: string;
  hotelId: string;
  campaignId: string;
  packageId?: string;
  city: 'Makkah' | 'Médine' | 'Djeddah' | string;
  checkInDate: string;
  checkOutDate: string;
  roomType: string;
  roomId?: string;
  shuttleService?: boolean;
  createdAt: string;
}

export interface FlightSegment {
  id: string;
  flightId: string;
  segmentType: 'ALLER' | 'RETOUR' | 'TRANSIT' | 'INTERNE';
  departureAirport: string;
  arrivalAirport: string;
  flightNumber: string;
  airline: string;
  departureTime: string;
  arrivalTime: string;
  terminal?: string;
  createdAt: string;
}

export interface AppNotification {
  id?: string;
  recipientUserId: string;
  recipientClientId?: string;
  inscriptionId?: string;
  type: string;
  category: 'SYSTEM' | 'PAYMENT' | 'DOCUMENT' | 'LOGISTICS' | 'GENERAL' | 'INSCRIPTION';
  title: string;
  message: string;
  entityType?: 'payment' | 'document' | 'visa' | 'flight' | 'hotel' | 'inscription' | 'client';
  entityId?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  isRead: boolean;
  readAt?: any;
  createdAt: any;
  expiresAt?: any;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export interface AuditLog {
  id: string;
  actorUid?: string;
  actorRole?: string;
  action: string;
  entityType?: string;
  entityId: string;
  entity?: string;
  oldValue?: string;
  newValue?: string;
  metadata?: any;
  timestamp: string;
  ip?: string;
  userId?: string;
  userName?: string;
  details?: string;
}

export interface DashboardStats {
  activity: {
    totalPilgrims: number;
    totalVoyages: number;
    totalHajj: number;
    totalUmrah: number;
    pilgrimsByVoyage: { voyageName: string; voyageCode: string; count: number; capacity: number }[];
    upcomingDepartures: { title: string; code: string; departureDate: string; daysLeft: number }[];
  };
  finance: {
    totalRevenueExpected: number;
    totalCollected: number;
    totalRemaining: number;
    recoveryRate: number;
    paidInFullCount: number;
    inProgressCount: number;
    overdueCount: number;
  };
  documents: {
    completeCount: number;
    incompleteCount: number;
    missingPassports: number;
    missingVisas: number;
    missingTickets: number;
    expiredDocs: number;
  };
  recouvrement: {
    topDebtors: {
      clientName: string;
      phone: string;
      voyageCode: string;
      appliedPrice: number;
      paid: number;
      remaining: number;
      priority: 'NORMAL' | 'IMPORTANT' | 'URGENT';
      lastPaymentDate?: string;
    }[];
    urgentRemindersCount: number;
  };
  profitability: {
    voyageCode: string;
    voyageTitle: string;
    revenue: number;
    expenses: number;
    netResult: number;
    marginRate: number;
  }[];
}
