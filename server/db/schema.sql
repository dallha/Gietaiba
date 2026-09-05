-- =====================================================================
-- SCHEMA POSTGRESQL RELATIONNEL METIER — ERP GIE TAIBA VOYAGES
-- BASE DE DONNEES : NEON CLOUD POSTGRESQL (Production / Staging)
-- =====================================================================

-- 1. CONFIGURATION DE L'AGENCE
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  agency_name TEXT NOT NULL,
  subtitle TEXT,
  logo_url TEXT,
  currency TEXT NOT NULL DEFAULT 'FCFA',
  default_currency TEXT NOT NULL DEFAULT 'FCFA',
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT,
  country TEXT,
  rc_number TEXT,
  license_number TEXT,
  tax_id TEXT,
  ninea TEXT,
  receipt_footer_terms TEXT,
  bank_details JSONB,
  mobile_money_numbers JSONB,
  recovery_urgent_threshold_days INT DEFAULT 15,
  recovery_high_balance_amount NUMERIC(15, 2) DEFAULT 2000000,
  default_required_document_types TEXT[],
  payment_methods TEXT[],
  expense_categories TEXT[],
  cities TEXT[],
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RBAC : RÔLES & PERMISSIONS
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY, -- 'SUPER_ADMIN', 'DIRECTION', 'CAISSE', 'AGENT', 'LOGISTIQUE', 'PELERIN'
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY, -- e.g. 'clients.view', 'payments.create'
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 3. CLIENTS / PÈLERINS (Créée avant users pour permettre la FK users.client_id)
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY, -- 'cli-*'
  code TEXT UNIQUE NOT NULL, -- 'CLI-2027-001'
  civility TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('M', 'F')),
  birth_date DATE,
  nationality TEXT DEFAULT 'Sénégalaise',
  phone TEXT NOT NULL,
  whatsapp TEXT,
  email TEXT,
  address TEXT,
  profession TEXT,
  contact_person TEXT,
  contact_phone TEXT,
  internal_notes TEXT,
  passport_number TEXT,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIF' CHECK (status IN ('ACTIF', 'EN_ATTENTE', 'ARCHIVE')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. UTILISATEURS DU SYSTÈME (STAFF & PÈLERINS)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- 'usr-*'
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role_id TEXT NOT NULL REFERENCES roles(id),
  status TEXT NOT NULL DEFAULT 'ACTIF' CHECK (status IN ('ACTIF', 'INACTIF', 'SUSPENDU', 'ARCHIVE')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  allowed_inscription_ids TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);

-- 5. CAMPAGNES DE VOYAGE (HAJJ & OUMRAH)
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY, -- 'voy-*'
  code TEXT UNIQUE NOT NULL, -- 'HAJ2027-01'
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('HAJJ', 'OUMRAH', 'AUTRE')),
  year INT NOT NULL,
  departure_date DATE NOT NULL,
  return_date DATE NOT NULL,
  capacity INT NOT NULL CHECK (capacity > 0),
  status TEXT NOT NULL DEFAULT 'OUVERT' CHECK (status IN ('PLANIFIE', 'OUVERT', 'CLOTURE', 'ARCHIVE')),
  description TEXT,
  logistics_notes TEXT,
  responsable TEXT,
  responsable_phone TEXT,
  vols_summary TEXT,
  hotels_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PACKAGES DE VOYAGE
CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY, -- 'pkg-*'
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('STANDARD', 'CONFORT', 'VIP')),
  description TEXT,
  price NUMERIC(15, 2) NOT NULL CHECK (price >= 0),
  initial_price NUMERIC(15, 2) NOT NULL CHECK (initial_price >= 0),
  current_price NUMERIC(15, 2) NOT NULL CHECK (current_price >= 0),
  currency TEXT NOT NULL DEFAULT 'FCFA',
  capacity INT CHECK (capacity > 0),
  room_type TEXT CHECK (room_type IN ('INDIVIDUELLE', 'DOUBLE', 'TRIPLE', 'QUADRUPLE')),
  hotel_makkah TEXT,
  hotel_medina TEXT,
  conditions TEXT,
  services_included TEXT[],
  status TEXT NOT NULL DEFAULT 'PROVISOIRE' CHECK (status IN ('PROVISOIRE', 'DEFINITIF', 'ARCHIVE')),
  valid_from DATE NOT NULL,
  active_version_number INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. VERSIONS DES PRIX DES PACKAGES (HISTORIQUE & IMMUABILITE)
CREATE TABLE IF NOT EXISTS package_versions (
  id TEXT PRIMARY KEY, -- 'ver-*'
  package_id TEXT NOT NULL REFERENCES packages(id) ON DELETE RESTRICT,
  version_number INT NOT NULL,
  price NUMERIC(15, 2) NOT NULL CHECK (price >= 0),
  status TEXT NOT NULL DEFAULT 'PROVISOIRE' CHECK (status IN ('PROVISOIRE', 'DEFINITIF')),
  effective_from DATE NOT NULL,
  effective_to DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_pkg_version UNIQUE (package_id, version_number)
);

-- 8. DOSSIERS D'INSCRIPTION DES PÈLERINS
CREATE TABLE IF NOT EXISTS inscriptions (
  id TEXT PRIMARY KEY, -- 'ins-*'
  code TEXT UNIQUE NOT NULL, -- 'INS-2027-001'
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  package_id TEXT NOT NULL REFERENCES packages(id) ON DELETE RESTRICT,
  package_version_id TEXT NOT NULL REFERENCES package_versions(id) ON DELETE RESTRICT,
  applied_price NUMERIC(15, 2) NOT NULL CHECK (applied_price >= 0),
  agreed_price NUMERIC(15, 2) NOT NULL CHECK (agreed_price >= 0),
  price_version_snapshotted INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'CONFIRMEE' CHECK (status IN ('EN_ATTENTE', 'CONFIRMEE', 'ANNULEE')),
  agent_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  agent_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index unique partiel : un pèlerin ne peut avoir qu'un dossier actif par campagne
CREATE UNIQUE INDEX IF NOT EXISTS uq_client_campaign_active ON inscriptions(client_id, campaign_id) WHERE status != 'ANNULEE';

-- 9. PAIEMENTS & REÇUS FINANCIERS
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY, -- 'pay-*'
  receipt_number TEXT UNIQUE NOT NULL, -- 'PAY-2027-0001'
  inscription_id TEXT NOT NULL REFERENCES inscriptions(id) ON DELETE RESTRICT,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'FCFA',
  payment_method TEXT NOT NULL,
  reference TEXT,
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'VALIDE' CHECK (status IN ('VALIDE', 'ANNULE')),
  agent_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  agent_name TEXT,
  client_name TEXT,
  campaign_code TEXT,
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. REVERSALS / ANNULATIONS DE PAIEMENTS (TRAÇABILITÉ FINANCIÈRE ABSOLUE)
CREATE TABLE IF NOT EXISTS payment_reversals (
  id TEXT PRIMARY KEY, -- 'rev-*'
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_user_name TEXT,
  reversed_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- 11. GESTION DES DOCUMENTS
CREATE TABLE IF NOT EXISTS document_types (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY, -- 'doc-*'
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  inscription_id TEXT REFERENCES inscriptions(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  file_name TEXT,
  file_url TEXT,
  received_date TIMESTAMPTZ,
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'RECU' CHECK (status IN ('MANQUANT', 'RECU', 'EN_VERIFICATION', 'VALIDE', 'EXPIRE', 'REFUSE', 'REJETE', 'VALIDATED', 'REJECTED')),
  comment TEXT,
  validated_by TEXT,
  validated_at TIMESTAMPTZ,
  is_client_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. GESTION DES VISAS (NUSUK)
CREATE TABLE IF NOT EXISTS visas (
  id TEXT PRIMARY KEY, -- 'visa-*'
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  inscription_id TEXT NOT NULL REFERENCES inscriptions(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'NON_DEMANDE' CHECK (status IN ('NON_DEMANDE', 'DOSSIER_EN_PREPARATION', 'DEMANDE', 'EN_TRAITEMENT', 'APPROUVE', 'REFUSE', 'EXPIRE', 'VALIDE', 'EMIS')),
  visa_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. VOLS & BILLETS
CREATE TABLE IF NOT EXISTS flights (
  id TEXT PRIMARY KEY, -- 'flt-*'
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  airline TEXT NOT NULL,
  flight_number TEXT NOT NULL,
  departure_city TEXT NOT NULL,
  arrival_city TEXT NOT NULL,
  departure_date DATE NOT NULL,
  departure_time TEXT NOT NULL,
  arrival_time TEXT NOT NULL,
  terminal TEXT,
  status TEXT NOT NULL DEFAULT 'PROGRAMME' CHECK (status IN ('PROGRAMME', 'CONFIRME', 'DECALE', 'ANNULE', 'RETARDE', 'EFFECTUE')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY, -- 'tkt-*'
  flight_id TEXT NOT NULL REFERENCES flights(id) ON DELETE RESTRICT,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  inscription_id TEXT REFERENCES inscriptions(id) ON DELETE SET NULL,
  ticket_number TEXT,
  pnr TEXT,
  issue_date DATE,
  status TEXT NOT NULL DEFAULT 'EMIS' CHECK (status IN ('EMIS', 'RESERVE', 'EN_ATTENTE', 'ANNULE')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. HÔTELS & CHAMBRES (AVEC CAPACITÉ PHYSIQUE STRICTE)
CREATE TABLE IF NOT EXISTS hotels (
  id TEXT PRIMARY KEY, -- 'htl-*'
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT,
  category TEXT,
  contact_phone TEXT,
  check_in_date DATE,
  check_out_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY, -- 'room-*'
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  building TEXT,
  floor TEXT,
  room_number TEXT NOT NULL,
  room_type TEXT NOT NULL CHECK (room_type IN ('INDIVIDUELLE', 'DOUBLE', 'TRIPLE', 'QUADRUPLE', 'SUITE')),
  capacity INT NOT NULL CHECK (capacity > 0),
  current_occupancy INT NOT NULL DEFAULT 0 CHECK (current_occupancy >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_assignments (
  id TEXT PRIMARY KEY, -- 'ra-*'
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  inscription_id TEXT REFERENCES inscriptions(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_client_hotel UNIQUE (client_id, hotel_id)
);

-- 15. GROUPES & ACCOMPAGNATEURS
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY, -- 'grp-*'
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  guide_id TEXT,
  guide_name TEXT,
  bus_number TEXT,
  hotel_id TEXT REFERENCES hotels(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
  id TEXT PRIMARY KEY, -- 'gm-*'
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  inscription_id TEXT REFERENCES inscriptions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_group_client UNIQUE (group_id, client_id)
);

CREATE TABLE IF NOT EXISTS accompagnateurs (
  id TEXT PRIMARY KEY, -- 'acc-*'
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  role TEXT NOT NULL,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  availability BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. DÉPENSES & CHARGES
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY, -- 'exp-*'
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  category TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'FCFA',
  date DATE NOT NULL,
  supplier TEXT,
  receipt_number TEXT,
  comment TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT UNIQUE,
  recipient_user_id TEXT,
  recipient_client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  inscription_id TEXT REFERENCES inscriptions(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'GENERAL',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  priority TEXT DEFAULT 'MEDIUM',
  action_url TEXT,
  metadata JSONB,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. JOURNAL D'AUDIT (INFALSIFIABLE)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY, -- 'log-*'
  actor_user_id TEXT NOT NULL,
  actor_user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. TABLE TECHNIQUE DE TRAÇABILITÉ MIGRATION
CREATE TABLE IF NOT EXISTS migration_id_map (
  entity_type TEXT NOT NULL,
  old_id TEXT NOT NULL,
  new_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'MIGRATED',
  notes TEXT,
  migrated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (entity_type, old_id)
);

-- =====================================================================
-- INDEX DE PERFORMANCE ET DE RECHERCHE
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_inscriptions_client ON inscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_inscriptions_campaign ON inscriptions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_inscriptions_status ON inscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payments_inscription ON payments(inscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_documents_client ON documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_inscription ON documents(inscription_id);
CREATE INDEX IF NOT EXISTS idx_visas_client ON visas(client_id);
CREATE INDEX IF NOT EXISTS idx_visas_inscription ON visas(inscription_id);
CREATE INDEX IF NOT EXISTS idx_rooms_hotel ON rooms(hotel_id);
CREATE INDEX IF NOT EXISTS idx_room_assignments_room ON room_assignments(room_id);
CREATE INDEX IF NOT EXISTS idx_room_assignments_client ON room_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_expenses_campaign ON expenses(campaign_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- =====================================================================
-- MISE A JOUR IDEMPOTENTE DES CONTRAINTES & COLONNES EXISTANTES
-- =====================================================================
ALTER TABLE visas DROP CONSTRAINT IF EXISTS visas_status_check;
ALTER TABLE visas ADD CONSTRAINT visas_status_check CHECK (status IN ('NON_DEMANDE', 'DOSSIER_EN_PREPARATION', 'DEMANDE', 'EN_TRAITEMENT', 'APPROUVE', 'REFUSE', 'EXPIRE', 'VALIDE', 'EMIS'));

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE documents ADD CONSTRAINT documents_status_check CHECK (status IN ('MANQUANT', 'RECU', 'EN_VERIFICATION', 'VALIDE', 'EXPIRE', 'REFUSE', 'REJETE', 'VALIDATED', 'REJECTED'));

ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_room_type_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_room_type_check CHECK (room_type IN ('INDIVIDUELLE', 'DOUBLE', 'TRIPLE', 'QUADRUPLE', 'SUITE'));
ALTER TABLE rooms ALTER COLUMN floor TYPE TEXT USING floor::TEXT;

ALTER TABLE accompagnateurs ALTER COLUMN availability TYPE BOOLEAN USING (availability::boolean);

ALTER TABLE flights DROP CONSTRAINT IF EXISTS flights_status_check;
ALTER TABLE flights ADD CONSTRAINT flights_status_check CHECK (status IN ('PROGRAMME', 'CONFIRME', 'DECALE', 'ANNULE', 'RETARDE', 'EFFECTUE'));

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_status_check CHECK (status IN ('EMIS', 'RESERVE', 'EN_ATTENTE', 'ANNULE'));

-- =====================================================================
-- 20. PHASE 4.1 : COMPTEURS ATOMIQUES ET ERP HARDENING
-- =====================================================================

-- Table de compteurs métier atomiques (annuels ou globaux)
CREATE TABLE IF NOT EXISTS business_sequences (
  sequence_type TEXT NOT NULL,
  year INT NOT NULL DEFAULT 0,
  current_value INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (sequence_type, year)
);

-- Fonction atomique de génération séquentielle
CREATE OR REPLACE FUNCTION get_next_business_sequence(p_type TEXT, p_year INT DEFAULT 0)
RETURNS INT AS $$
DECLARE
  v_next INT;
BEGIN
  INSERT INTO business_sequences (sequence_type, year, current_value, updated_at)
  VALUES (p_type, p_year, 1, NOW())
  ON CONFLICT (sequence_type, year)
  DO UPDATE SET current_value = business_sequences.current_value + 1, updated_at = NOW()
  RETURNING current_value INTO v_next;
  
  RETURN v_next;
END;
$$ LANGUAGE plpgsql;

-- Code métier distinct sur les dépenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS code TEXT UNIQUE;

-- Échéancier prévisionnel de paiement par inscription
CREATE TABLE IF NOT EXISTS payment_schedules (
  id TEXT PRIMARY KEY,
  inscription_id TEXT NOT NULL REFERENCES inscriptions(id) ON DELETE RESTRICT,
  due_date DATE NOT NULL,
  amount_due NUMERIC(15, 2) NOT NULL CHECK (amount_due > 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED')),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_inscription ON payment_schedules(inscription_id);

-- Séjours hôteliers géolocalisés par pèlerin (Makkah / Médine)
CREATE TABLE IF NOT EXISTS hotel_stays (
  id TEXT PRIMARY KEY,
  inscription_id TEXT NOT NULL REFERENCES inscriptions(id) ON DELETE RESTRICT,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  package_id TEXT REFERENCES packages(id) ON DELETE SET NULL,
  city TEXT NOT NULL CHECK (city IN ('Makkah', 'Médine', 'Djeddah')),
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  room_type TEXT NOT NULL,
  room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  shuttle_service BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hotel_stays_inscription ON hotel_stays(inscription_id);
CREATE INDEX IF NOT EXISTS idx_hotel_stays_client ON hotel_stays(client_id);

-- Segments de vol multi-escales
CREATE TABLE IF NOT EXISTS flight_segments (
  id TEXT PRIMARY KEY,
  flight_id TEXT NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
  segment_type TEXT NOT NULL CHECK (segment_type IN ('ALLER', 'RETOUR', 'TRANSIT', 'INTERNE')),
  departure_airport TEXT NOT NULL,
  arrival_airport TEXT NOT NULL,
  flight_number TEXT NOT NULL,
  airline TEXT NOT NULL,
  departure_time TIMESTAMPTZ NOT NULL,
  arrival_time TIMESTAMPTZ NOT NULL,
  terminal TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_flight_segments_flight ON flight_segments(flight_id);

-- =====================================================================
-- 21. PHASE 4.2 : WORKFLOWS TRANSACTIONNELS, ALLOCATIONS & IDEMPOTENCE
-- =====================================================================

-- Table d'allocation comptable traçable des paiements sur les échéances
CREATE TABLE IF NOT EXISTS payment_schedule_allocations (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  payment_schedule_id TEXT NOT NULL REFERENCES payment_schedules(id) ON DELETE RESTRICT,
  amount_allocated NUMERIC(15, 2) NOT NULL CHECK (amount_allocated > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_psa_payment ON payment_schedule_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_psa_schedule ON payment_schedule_allocations(payment_schedule_id);

-- Table de clés d'idempotence multi-acteurs avec détection d'empreinte de requête
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  request_fingerprint TEXT NOT NULL,
  response_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  PRIMARY KEY (key, actor_user_id)
);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);

-- Support de rejet avec motif sur documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

