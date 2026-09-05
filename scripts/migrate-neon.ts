import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pool, initSchema } from '../server/db/neon.js';

interface MigrationResult {
  table: string;
  jsonCount: number;
  migratedCount: number;
  status: 'PASS' | 'WARN' | 'FAIL';
  details?: string;
}

export async function runMigration(): Promise<{
  success: boolean;
  results: MigrationResult[];
  financials: {
    totalExpectedRevenue: number;
    totalCollectedPayments: number;
    totalExpenses: number;
  };
}> {
  console.log('====================================================');
  console.log('  MIGRATION TRAÇABLE & IDEMPOTENTE VERS NEON POSTGRESQL');
  console.log('====================================================');

  // 1. Vérification de la variable d'environnement
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL absente des variables d'environnement.");
  }

  // 2. Initialisation du schéma
  console.log('\n[1/5] Initialisation du schéma relationnel...');
  await initSchema();

  // 3. Lecture du fichier source database.json
  const dataFilePath = path.join(process.cwd(), 'data', 'database.json');
  if (!fs.existsSync(dataFilePath)) {
    throw new Error(`Fichier source introuvable : ${dataFilePath}`);
  }
  const rawData = fs.readFileSync(dataFilePath, 'utf8');
  const db = JSON.parse(rawData);

  console.log('\n[2/5] Début de la transaction de migration...');
  const client = await pool.connect();
  const results: MigrationResult[] = [];

  try {
    await client.query('BEGIN');

    // -------------------------------------------------------------
    // Helper pour enregistrer dans migration_id_map
    // -------------------------------------------------------------
    async function trackId(
      entityType: string,
      oldId: string,
      newId: string,
      status: string = 'MIGRATED',
      notes?: string
    ) {
      await client.query(
        `INSERT INTO migration_id_map (entity_type, old_id, new_id, status, notes, migrated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (entity_type, old_id) DO UPDATE
         SET status = EXCLUDED.status, notes = EXCLUDED.notes, migrated_at = NOW()`,
        [entityType, oldId, newId, status, notes || null]
      );
    }

    // -------------------------------------------------------------
    // A. RÔLES SYSTÈME & PERMISSIONS RBAC
    // -------------------------------------------------------------
    console.log('-> Initialisation des Rôles et Permissions RBAC...');
    const defaultRoles = [
      { id: 'SUPER_ADMIN', name: 'Super Administrateur', description: 'Accès absolu et gouvernance du système', is_system: true },
      { id: 'DIRECTION', name: 'Direction Générale', description: 'Supervision globale, annulation paiements, audit', is_system: true },
      { id: 'CAISSE', name: 'Responsable Caisse', description: 'Gestion des encaissements, reçus et rapprochements', is_system: true },
      { id: 'AGENT', name: 'Conseiller Pèlerinage', description: 'Gestion des clients et saisie des inscriptions', is_system: true },
      { id: 'LOGISTIQUE', name: 'Chef Logistique', description: 'Gestion des vols, hôtels, chambres et groupes', is_system: true },
      { id: 'PELERIN', name: 'Pèlerin', description: 'Accès strictement restreint à son propre dossier', is_system: true },
    ];

    for (const r of defaultRoles) {
      await client.query(
        `INSERT INTO roles (id, name, description, is_system, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name, description = EXCLUDED.description, is_system = EXCLUDED.is_system`,
        [r.id, r.name, r.description, r.is_system]
      );
    }

    const defaultPermissions = [
      // Clients
      { id: 'clients.view', module: 'clients', action: 'view', description: 'Consulter les fiches pèlerins' },
      { id: 'clients.create', module: 'clients', action: 'create', description: 'Créer un nouveau pèlerin' },
      { id: 'clients.update', module: 'clients', action: 'update', description: 'Modifier un pèlerin' },
      { id: 'clients.delete', module: 'clients', action: 'delete', description: 'Supprimer un pèlerin' },
      // Inscriptions
      { id: 'inscriptions.view', module: 'inscriptions', action: 'view', description: 'Consulter les dossiers' },
      { id: 'inscriptions.create', module: 'inscriptions', action: 'create', description: 'Créer un dossier' },
      { id: 'inscriptions.update', module: 'inscriptions', action: 'update', description: 'Modifier un dossier' },
      { id: 'inscriptions.delete', module: 'inscriptions', action: 'delete', description: 'Supprimer un dossier' },
      // Payments
      { id: 'payments.view', module: 'payments', action: 'view', description: 'Consulter les paiements' },
      { id: 'payments.create', module: 'payments', action: 'create', description: 'Encaisser un versement' },
      { id: 'payments.cancel', module: 'payments', action: 'cancel', description: 'Annuler un paiement (Direction/Admin)' },
      // Voyages
      { id: 'voyages.view', module: 'voyages', action: 'view', description: 'Consulter les campagnes et packages' },
      { id: 'voyages.manage', module: 'voyages', action: 'manage', description: 'Gérer les campagnes et tarifs' },
      // Logistique
      { id: 'logistique.view', module: 'logistique', action: 'view', description: 'Consulter vols et chambres' },
      { id: 'logistique.manage', module: 'logistique', action: 'manage', description: 'Assigner chambres et vols' },
      // Documents
      { id: 'documents.view', module: 'documents', action: 'view', description: 'Consulter les documents' },
      { id: 'documents.validate', module: 'documents', action: 'validate', description: 'Valider/Rejeter les pièces' },
      // Settings & Users
      { id: 'settings.manage', module: 'settings', action: 'manage', description: 'Modifier les paramètres agence' },
      { id: 'users.manage', module: 'users', action: 'manage', description: 'Gérer les comptes utilisateurs' },
      { id: 'audit.view', module: 'audit', action: 'view', description: 'Consulter le journal d\'audit' },
    ];

    for (const p of defaultPermissions) {
      await client.query(
        `INSERT INTO permissions (id, module, action, description, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [p.id, p.module, p.action, p.description]
      );
    }

    // Associer permissions par défaut
    for (const p of defaultPermissions) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         VALUES ('SUPER_ADMIN', $1)
         ON CONFLICT DO NOTHING`,
        [p.id]
      );
    }

    // -------------------------------------------------------------
    // B. SETTINGS
    // -------------------------------------------------------------
    console.log('-> Migration des paramètres d\'agence (settings)...');
    const s = db.settings;
    await client.query(
      `INSERT INTO settings (
        id, agency_name, subtitle, logo_url, currency, default_currency, phone, email,
        address, city, country, rc_number, license_number, tax_id, ninea, receipt_footer_terms,
        bank_details, mobile_money_numbers, recovery_urgent_threshold_days, recovery_high_balance_amount,
        default_required_document_types, payment_methods, expense_categories, cities, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, NOW())
      ON CONFLICT (id) DO UPDATE SET
        agency_name = EXCLUDED.agency_name,
        subtitle = EXCLUDED.subtitle,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        address = EXCLUDED.address,
        bank_details = EXCLUDED.bank_details,
        mobile_money_numbers = EXCLUDED.mobile_money_numbers,
        updated_at = NOW()`,
      [
        s.id || 'setting-1',
        s.agencyName,
        s.subtitle || null,
        s.logoUrl || null,
        s.currency || 'FCFA',
        s.defaultCurrency || 'FCFA',
        s.phone,
        s.email,
        s.address,
        s.city || null,
        s.country || null,
        s.rcNumber || null,
        s.licenseNumber || null,
        s.taxId || null,
        s.ninea || null,
        s.receiptFooterTerms || null,
        JSON.stringify(s.bankDetails || {}),
        JSON.stringify(s.mobileMoneyNumbers || {}),
        s.recoveryUrgentThresholdDays || 15,
        s.recoveryHighBalanceAmount || 2000000,
        s.defaultRequiredDocumentTypes || [],
        s.paymentMethods || [],
        s.expenseCategories || [],
        s.cities || [],
      ]
    );
    await trackId('settings', s.id || 'setting-1', s.id || 'setting-1');
    results.push({ table: 'settings', jsonCount: 1, migratedCount: 1, status: 'PASS' });

    // -------------------------------------------------------------
    // C. CLIENTS
    // -------------------------------------------------------------
    console.log('-> Migration des clients...');
    let clientsCount = 0;
    for (const c of db.clients || []) {
      await client.query(
        `INSERT INTO clients (
          id, code, civility, first_name, last_name, gender, birth_date, nationality,
          phone, whatsapp, email, address, profession, contact_person, contact_phone,
          internal_notes, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        ON CONFLICT (id) DO UPDATE SET
          code = EXCLUDED.code,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          phone = EXCLUDED.phone,
          status = EXCLUDED.status,
          updated_at = NOW()`,
        [
          c.id,
          c.code,
          c.civility || null,
          c.firstName,
          c.lastName,
          c.gender || null,
          c.birthDate ? new Date(c.birthDate) : null,
          c.nationality || 'Sénégalaise',
          c.phone,
          c.whatsapp || null,
          c.email || null,
          c.address || null,
          c.profession || null,
          c.contactPerson || null,
          c.contactPhone || null,
          c.internalNotes || null,
          c.status || 'ACTIF',
          c.createdAt || new Date().toISOString(),
          c.updatedAt || new Date().toISOString(),
        ]
      );
      await trackId('clients', c.id, c.id);
      clientsCount++;
    }
    results.push({
      table: 'clients',
      jsonCount: (db.clients || []).length,
      migratedCount: clientsCount,
      status: clientsCount === (db.clients || []).length ? 'PASS' : 'FAIL',
    });

    // -------------------------------------------------------------
    // D. USERS & USER_ROLES
    // -------------------------------------------------------------
    console.log('-> Migration des utilisateurs...');
    let usersCount = 0;
    for (const u of db.users || []) {
      await client.query(
        `INSERT INTO users (
          id, email, display_name, phone, password_hash, role_id, status, active, client_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          display_name = EXCLUDED.display_name,
          role_id = EXCLUDED.role_id,
          password_hash = EXCLUDED.password_hash,
          client_id = EXCLUDED.client_id,
          updated_at = NOW()`,
        [
          u.id,
          u.email,
          u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
          u.phone || null,
          u.passwordHash || 'default123',
          u.role || 'AGENT',
          u.active === false ? 'INACTIF' : 'ACTIF',
          u.active !== false,
          u.clientId || null,
        ]
      );

      // Assigner le rôle dans user_roles
      await client.query(
        `INSERT INTO user_roles (user_id, role_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [u.id, u.role || 'AGENT']
      );

      await trackId('users', u.id, u.id);
      usersCount++;
    }
    results.push({
      table: 'users',
      jsonCount: (db.users || []).length,
      migratedCount: usersCount,
      status: usersCount === (db.users || []).length ? 'PASS' : 'FAIL',
    });

    // -------------------------------------------------------------
    // E. CAMPAIGNS (VOYAGES)
    // -------------------------------------------------------------
    console.log('-> Migration des campagnes de voyage...');
    let voyagesCount = 0;
    for (const v of db.voyages || []) {
      await client.query(
        `INSERT INTO campaigns (
          id, code, title, type, year, departure_date, return_date, capacity, status,
          description, logistics_notes, responsable, responsable_phone, vols_summary, hotels_summary,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          capacity = EXCLUDED.capacity,
          status = EXCLUDED.status,
          updated_at = NOW()`,
        [
          v.id,
          v.code,
          v.title,
          v.type,
          v.year,
          new Date(v.departureDate),
          new Date(v.returnDate),
          v.capacity,
          v.status || 'OUVERT',
          v.description || null,
          v.logisticsNotes || null,
          v.responsable || null,
          v.responsablePhone || null,
          v.volsSummary || null,
          v.hotelsSummary || null,
          v.createdAt || new Date().toISOString(),
        ]
      );
      await trackId('campaigns', v.id, v.id);
      voyagesCount++;
    }
    results.push({
      table: 'campaigns',
      jsonCount: (db.voyages || []).length,
      migratedCount: voyagesCount,
      status: voyagesCount === (db.voyages || []).length ? 'PASS' : 'FAIL',
    });

    // -------------------------------------------------------------
    // F. PACKAGES
    // -------------------------------------------------------------
    console.log('-> Migration des formules packages...');
    let packagesCount = 0;
    const migratedPackageIds = new Set<string>();
    for (const p of db.packages || []) {
      await client.query(
        `INSERT INTO packages (
          id, campaign_id, code, name, category, description, price, initial_price, current_price,
          currency, capacity, room_type, hotel_makkah, hotel_medina, conditions, services_included,
          status, valid_from, active_version_number, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          price = EXCLUDED.price,
          current_price = EXCLUDED.current_price,
          active_version_number = EXCLUDED.active_version_number,
          updated_at = NOW()`,
        [
          p.id,
          p.voyageId,
          p.code,
          p.name,
          p.category,
          p.description || null,
          p.price,
          p.initialPrice || p.price,
          p.currentPrice || p.price,
          p.currency || 'FCFA',
          p.capacity || null,
          p.roomType || null,
          p.hotelMakkah || null,
          p.hotelMedina || null,
          p.conditions || null,
          p.servicesIncluded || [],
          p.status || 'PROVISOIRE',
          new Date(p.validFrom),
          p.activeVersionNumber || 1,
          p.createdAt || new Date().toISOString(),
        ]
      );
      migratedPackageIds.add(p.id);
      await trackId('packages', p.id, p.id);
      packagesCount++;
    }
    results.push({
      table: 'packages',
      jsonCount: (db.packages || []).length,
      migratedCount: packagesCount,
      status: packagesCount === (db.packages || []).length ? 'PASS' : 'FAIL',
    });

    // -------------------------------------------------------------
    // G. PACKAGE_VERSIONS (AVEC TRAITEMENT RIGOUREUX DE ver-oum-1)
    // -------------------------------------------------------------
    console.log('-> Migration des versions de tarifs packages...');
    let versionsCount = 0;
    let blockedVersionsCount = 0;
    for (const pv of db.package_versions || []) {
      // Règle 9 : Si le packageId n'est pas présent dans les packages migrés, bloquer et tracer
      if (!migratedPackageIds.has(pv.packageId)) {
        console.warn(`⚠️ [RÈGLE 9 - ANOMALIE] Version orpheline détectée : ${pv.id} référence le package inconnu ${pv.packageId}. Ligne bloquée et tracée dans migration_id_map.`);
        await trackId(
          'package_versions',
          pv.id,
          pv.id,
          'BLOCKED_ORPHAN',
          `Package parent inconnu (${pv.packageId}) non présent dans data/database.json. Ligne non insérée pour préserver l\'intégrité FK.`
        );
        blockedVersionsCount++;
        continue;
      }

      await client.query(
        `INSERT INTO package_versions (
          id, package_id, version_number, price, status, effective_from, effective_to, note, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          price = EXCLUDED.price,
          status = EXCLUDED.status,
          effective_from = EXCLUDED.effective_from,
          note = EXCLUDED.note`,
        [
          pv.id,
          pv.packageId,
          pv.versionNumber,
          pv.price,
          pv.status || 'PROVISOIRE',
          new Date(pv.effectiveFrom),
          pv.effectiveTo ? new Date(pv.effectiveTo) : null,
          pv.note || null,
          pv.createdAt || new Date().toISOString(),
        ]
      );
      await trackId('package_versions', pv.id, pv.id, 'MIGRATED');
      versionsCount++;
    }
    results.push({
      table: 'package_versions',
      jsonCount: (db.package_versions || []).length,
      migratedCount: versionsCount,
      status: blockedVersionsCount > 0 ? 'WARN' : 'PASS',
      details: `${versionsCount} migrées, ${blockedVersionsCount} bloquée(s) (ver-oum-1 orpheline)`,
    });

    // -------------------------------------------------------------
    // H. INSCRIPTIONS
    // -------------------------------------------------------------
    console.log('-> Migration des inscriptions...');
    let inscriptionsCount = 0;
    for (const ins of db.inscriptions || []) {
      await client.query(
        `INSERT INTO inscriptions (
          id, code, client_id, campaign_id, package_id, package_version_id, applied_price, agreed_price,
          price_version_snapshotted, status, agent_id, agent_name, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
          applied_price = EXCLUDED.applied_price,
          agreed_price = EXCLUDED.agreed_price,
          status = EXCLUDED.status,
          updated_at = NOW()`,
        [
          ins.id,
          ins.code,
          ins.clientId,
          ins.voyageId,
          ins.packageId,
          ins.packageVersionId,
          ins.appliedPrice,
          ins.agreedPrice || ins.appliedPrice,
          ins.priceVersionSnapshotted || 1,
          ins.status || 'CONFIRMEE',
          ins.agentId || null,
          ins.agentName || null,
          ins.createdAt || new Date().toISOString(),
          ins.updatedAt || new Date().toISOString(),
        ]
      );
      await trackId('inscriptions', ins.id, ins.id);
      inscriptionsCount++;
    }
    results.push({
      table: 'inscriptions',
      jsonCount: (db.inscriptions || []).length,
      migratedCount: inscriptionsCount,
      status: inscriptionsCount === (db.inscriptions || []).length ? 'PASS' : 'FAIL',
    });

    // -------------------------------------------------------------
    // I. PAYMENTS
    // -------------------------------------------------------------
    console.log('-> Migration des paiements...');
    let paymentsCount = 0;
    for (const pay of db.payments || []) {
      await client.query(
        `INSERT INTO payments (
          id, receipt_number, inscription_id, client_id, campaign_id, amount, currency,
          payment_method, reference, comment, status, agent_id, agent_name, client_name,
          campaign_code, payment_date, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          comment = EXCLUDED.comment,
          amount = EXCLUDED.amount`,
        [
          pay.id,
          pay.receiptNumber,
          pay.inscriptionId,
          pay.clientId,
          pay.voyageId,
          pay.amount,
          pay.currency || 'FCFA',
          pay.paymentMethod,
          pay.reference || null,
          pay.comment || null,
          pay.status || 'VALIDE',
          pay.agentId || null,
          pay.agentName || null,
          pay.clientName || null,
          pay.voyageCode || null,
          pay.paymentDate ? new Date(pay.paymentDate) : new Date(),
          pay.createdAt ? new Date(pay.createdAt) : new Date(),
        ]
      );
      await trackId('payments', pay.id, pay.id);
      paymentsCount++;
    }
    results.push({
      table: 'payments',
      jsonCount: (db.payments || []).length,
      migratedCount: paymentsCount,
      status: paymentsCount === (db.payments || []).length ? 'PASS' : 'FAIL',
    });

    // -------------------------------------------------------------
    // J. DOCUMENTS & DOCUMENT_TYPES
    // -------------------------------------------------------------
    console.log('-> Migration des types de documents et documents...');
    for (const typeName of db.settings.defaultRequiredDocumentTypes || []) {
      await client.query(
        `INSERT INTO document_types (id, name, is_required)
         VALUES ($1, $2, TRUE)
         ON CONFLICT (name) DO NOTHING`,
        [`doctype-${typeName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`, typeName]
      );
    }

    let docsCount = 0;
    for (const d of db.documents || []) {
      await client.query(
        `INSERT INTO documents (
          id, client_id, inscription_id, type, file_name, file_url, received_date,
          expiry_date, status, comment, validated_by, validated_at, is_client_visible, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          comment = EXCLUDED.comment,
          validated_by = EXCLUDED.validated_by,
          validated_at = EXCLUDED.validated_at`,
        [
          d.id,
          d.clientId,
          d.inscriptionId || null,
          d.type,
          d.fileName || null,
          d.fileUrl || null,
          d.receivedDate ? new Date(d.receivedDate) : null,
          d.expiryDate ? new Date(d.expiryDate) : null,
          d.status || 'RECU',
          d.comment || null,
          d.validatedBy || null,
          d.validatedAt ? new Date(d.validatedAt) : null,
          d.isClientVisible !== false,
          d.createdAt ? new Date(d.createdAt) : new Date(),
        ]
      );
      await trackId('documents', d.id, d.id);
      docsCount++;
    }
    results.push({
      table: 'documents',
      jsonCount: (db.documents || []).length,
      migratedCount: docsCount,
      status: docsCount === (db.documents || []).length ? 'PASS' : 'FAIL',
    });

    // -------------------------------------------------------------
    // K. VISAS
    // -------------------------------------------------------------
    console.log('-> Migration des visas...');
    let visasCount = 0;
    for (const v of db.visas || []) {
      await client.query(
        `INSERT INTO visas (
          id, client_id, inscription_id, status, visa_number, issue_date, expiry_date, notes, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          visa_number = EXCLUDED.visa_number,
          notes = EXCLUDED.notes,
          updated_at = NOW()`,
        [
          v.id,
          v.clientId,
          v.inscriptionId,
          v.status || 'NON_DEMANDE',
          v.visaNumber || null,
          v.issueDate ? new Date(v.issueDate) : null,
          v.expiryDate ? new Date(v.expiryDate) : null,
          v.notes || null,
          v.updatedAt ? new Date(v.updatedAt) : new Date(),
        ]
      );
      await trackId('visas', v.id, v.id);
      visasCount++;
    }
    results.push({
      table: 'visas',
      jsonCount: (db.visas || []).length,
      migratedCount: visasCount,
      status: visasCount === (db.visas || []).length ? 'PASS' : 'FAIL',
    });

    // -------------------------------------------------------------
    // L. VOLS & TICKETS
    // -------------------------------------------------------------
    console.log('-> Migration des vols et billets...');
    let flightsCount = 0;
    for (const f of db.flights || []) {
      await client.query(
        `INSERT INTO flights (
          id, campaign_id, airline, flight_number, departure_city, arrival_city,
          departure_date, departure_time, arrival_time, terminal, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (id) DO UPDATE SET
          airline = EXCLUDED.airline,
          flight_number = EXCLUDED.flight_number,
          status = EXCLUDED.status`,
        [
          f.id,
          f.voyageId,
          f.airline,
          f.flightNumber,
          f.departureCity,
          f.arrivalCity,
          new Date(f.departureDate),
          f.departureTime,
          f.arrivalTime,
          f.terminal || null,
          f.status || 'PROGRAMME',
        ]
      );
      await trackId('flights', f.id, f.id);
      flightsCount++;
    }
    results.push({
      table: 'flights',
      jsonCount: (db.flights || []).length,
      migratedCount: flightsCount,
      status: flightsCount === (db.flights || []).length ? 'PASS' : 'FAIL',
    });

    let ticketsCount = 0;
    for (const t of db.tickets || []) {
      await client.query(
        `INSERT INTO tickets (
          id, flight_id, client_id, inscription_id, ticket_number, pnr, issue_date, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (id) DO UPDATE SET
          ticket_number = EXCLUDED.ticket_number,
          pnr = EXCLUDED.pnr,
          status = EXCLUDED.status`,
        [
          t.id,
          t.flightId,
          t.clientId,
          t.inscriptionId || null,
          t.ticketNumber || null,
          t.pnr || null,
          t.issueDate ? new Date(t.issueDate) : null,
          t.status || 'EMIS',
        ]
      );
      await trackId('tickets', t.id, t.id);
      ticketsCount++;
    }
    results.push({
      table: 'tickets',
      jsonCount: (db.tickets || []).length,
      migratedCount: ticketsCount,
      status: ticketsCount === (db.tickets || []).length ? 'PASS' : 'FAIL',
    });

    // -------------------------------------------------------------
    // M. HÔTELS, CHAMBRES & AFFECTATIONS
    // -------------------------------------------------------------
    console.log('-> Migration des hôtels, chambres et affectations...');
    let hotelsCount = 0;
    for (const h of db.hotels || []) {
      await client.query(
        `INSERT INTO hotels (
          id, campaign_id, name, city, address, category, contact_phone, check_in_date, check_out_date, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          city = EXCLUDED.city`,
        [
          h.id,
          h.voyageId,
          h.name,
          h.city,
          h.address || null,
          h.category || null,
          h.contactPhone || null,
          h.checkInDate ? new Date(h.checkInDate) : null,
          h.checkOutDate ? new Date(h.checkOutDate) : null,
        ]
      );
      await trackId('hotels', h.id, h.id);
      hotelsCount++;
    }
    results.push({
      table: 'hotels',
      jsonCount: (db.hotels || []).length,
      migratedCount: hotelsCount,
      status: hotelsCount === (db.hotels || []).length ? 'PASS' : 'FAIL',
    });

    let roomsCount = 0;
    for (const r of db.rooms || []) {
      await client.query(
        `INSERT INTO rooms (
          id, hotel_id, campaign_id, building, floor, room_number, room_type, capacity, current_occupancy, notes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (id) DO UPDATE SET
          room_number = EXCLUDED.room_number,
          capacity = EXCLUDED.capacity,
          current_occupancy = EXCLUDED.current_occupancy`,
        [
          r.id,
          r.hotelId,
          r.voyageId,
          r.building || null,
          r.floor || null,
          r.roomNumber,
          r.roomType,
          r.capacity,
          r.currentOccupancy || 0,
          r.notes || null,
        ]
      );
      await trackId('rooms', r.id, r.id);
      roomsCount++;
    }
    results.push({
      table: 'rooms',
      jsonCount: (db.rooms || []).length,
      migratedCount: roomsCount,
      status: roomsCount === (db.rooms || []).length ? 'PASS' : 'FAIL',
    });

    let assignmentsCount = 0;
    for (const ra of db.room_assignments || []) {
      await client.query(
        `INSERT INTO room_assignments (
          id, room_id, hotel_id, client_id, inscription_id, assigned_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO NOTHING`,
        [
          ra.id,
          ra.roomId,
          ra.hotelId,
          ra.clientId,
          ra.inscriptionId || null,
          ra.assignedAt ? new Date(ra.assignedAt) : new Date(),
        ]
      );
      await trackId('room_assignments', ra.id, ra.id);
      assignmentsCount++;
    }
    results.push({
      table: 'room_assignments',
      jsonCount: (db.room_assignments || []).length,
      migratedCount: assignmentsCount,
      status: assignmentsCount === (db.room_assignments || []).length ? 'PASS' : 'FAIL',
    });

    // -------------------------------------------------------------
    // N. GROUPES & MEMBRES & ACCOMPAGNATEURS
    // -------------------------------------------------------------
    console.log('-> Migration des groupes et membres...');
    let groupsCount = 0;
    for (const g of db.groups || []) {
      await client.query(
        `INSERT INTO groups (
          id, campaign_id, name, guide_id, guide_name, bus_number, hotel_id, notes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          guide_name = EXCLUDED.guide_name`,
        [
          g.id,
          g.voyageId,
          g.name,
          g.guideId || null,
          g.guideName || null,
          g.busNumber || null,
          g.hotelId || null,
          g.notes || null,
        ]
      );
      await trackId('groups', g.id, g.id);
      groupsCount++;
    }
    results.push({
      table: 'groups',
      jsonCount: (db.groups || []).length,
      migratedCount: groupsCount,
      status: groupsCount === (db.groups || []).length ? 'PASS' : 'FAIL',
    });

    let membersCount = 0;
    for (const gm of db.group_members || []) {
      await client.query(
        `INSERT INTO group_members (
          id, group_id, client_id, inscription_id, created_at
        ) VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (id) DO NOTHING`,
        [
          gm.id,
          gm.groupId,
          gm.clientId,
          gm.inscriptionId || null,
        ]
      );
      await trackId('group_members', gm.id, gm.id);
      membersCount++;
    }
    results.push({
      table: 'group_members',
      jsonCount: (db.group_members || []).length,
      migratedCount: membersCount,
      status: membersCount === (db.group_members || []).length ? 'PASS' : 'FAIL',
    });

    let accCount = 0;
    for (const a of db.accompagnateurs || []) {
      await client.query(
        `INSERT INTO accompagnateurs (
          id, name, phone, role, campaign_id, availability, notes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          phone = EXCLUDED.phone`,
        [
          a.id,
          a.name,
          a.phone,
          a.role,
          a.voyageId || null,
          a.availability || null,
          a.notes || null,
        ]
      );
      await trackId('accompagnateurs', a.id, a.id);
      accCount++;
    }
    results.push({
      table: 'accompagnateurs',
      jsonCount: (db.accompagnateurs || []).length,
      migratedCount: accCount,
      status: accCount === (db.accompagnateurs || []).length ? 'PASS' : 'FAIL',
    });

    // -------------------------------------------------------------
    // O. EXPENSES (AVEC TRAITEMENT DE createdBy = "Mme Khady Diop")
    // -------------------------------------------------------------
    console.log('-> Migration des dépenses...');
    let expensesCount = 0;
    for (const exp of db.expenses || []) {
      // Règle 10 : Recherche de l'utilisateur correspondant dans les données existantes
      let resolvedUserId: string | null = null;
      let rawCreatorName = exp.createdBy || null;

      if (rawCreatorName) {
        // Recherche dans les utilisateurs existants par nom ou ID
        const matchedUser = (db.users || []).find(
          (u: any) =>
            u.id === rawCreatorName ||
            (u.displayName && u.displayName.toLowerCase().includes(rawCreatorName.toLowerCase()))
        );
        if (matchedUser) {
          resolvedUserId = matchedUser.id;
          console.log(`[RÈGLE 10] Dépense ${exp.id} : createur "${rawCreatorName}" résolu vers l'utilisateur existant "${matchedUser.id}" (${matchedUser.displayName}).`);
        } else {
          console.warn(`[RÈGLE 10] Dépense ${exp.id} : aucun utilisateur trouvé pour "${rawCreatorName}". Non attribué arbitrairement.`);
        }
      }

      await client.query(
        `INSERT INTO expenses (
          id, campaign_id, category, amount, currency, date, supplier, receipt_number, comment,
          created_by, created_by_name, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          amount = EXCLUDED.amount,
          category = EXCLUDED.category`,
        [
          exp.id,
          exp.voyageId,
          exp.category,
          exp.amount,
          exp.currency || 'FCFA',
          new Date(exp.date),
          exp.supplier || null,
          exp.receiptNumber || null,
          exp.comment || null,
          resolvedUserId,
          rawCreatorName,
          exp.createdAt ? new Date(exp.createdAt) : new Date(),
        ]
      );
      await trackId('expenses', exp.id, exp.id);
      expensesCount++;
    }
    results.push({
      table: 'expenses',
      jsonCount: (db.expenses || []).length,
      migratedCount: expensesCount,
      status: expensesCount === (db.expenses || []).length ? 'PASS' : 'FAIL',
    });

    // -------------------------------------------------------------
    // P. NOTIFICATIONS
    // -------------------------------------------------------------
    console.log('-> Migration des notifications...');
    let notifsCount = 0;
    for (const notif of db.notifications || []) {
      const idempotencyKey = notif.idempotencyKey || `migrated_${notif.id}`;
      await client.query(
        `INSERT INTO notifications (
          id, idempotency_key, recipient_client_id, type, category, title, message, is_read, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          message = EXCLUDED.message`,
        [
          notif.id,
          idempotencyKey,
          notif.clientId || null,
          notif.channel || 'SYSTEM',
          'GENERAL',
          notif.title,
          notif.message,
          notif.status === 'READ',
          notif.createdAt ? new Date(notif.createdAt) : new Date(),
        ]
      );
      await trackId('notifications', notif.id, notif.id);
      notifsCount++;
    }
    results.push({
      table: 'notifications',
      jsonCount: (db.notifications || []).length,
      migratedCount: notifsCount,
      status: notifsCount === (db.notifications || []).length ? 'PASS' : 'FAIL',
    });

    // -------------------------------------------------------------
    // Q. AUDIT LOGS
    // -------------------------------------------------------------
    console.log('-> Migration des journaux d\'audit...');
    let auditCount = 0;
    for (const log of db.audit_logs || []) {
      await client.query(
        `INSERT INTO audit_logs (
          id, actor_user_id, actor_user_name, action, entity_type, entity_id, old_value, new_value, reason, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING`,
        [
          log.id,
          log.userId || 'system',
          log.userName || 'Système',
          log.action,
          log.entity,
          log.entityId,
          typeof log.oldValue === 'object' ? JSON.stringify(log.oldValue) : log.oldValue || null,
          typeof log.newValue === 'object' ? JSON.stringify(log.newValue) : log.newValue || null,
          log.reason || null,
          log.timestamp ? new Date(log.timestamp) : new Date(),
        ]
      );
      await trackId('audit_logs', log.id, log.id);
      auditCount++;
    }
    results.push({
      table: 'audit_logs',
      jsonCount: (db.audit_logs || []).length,
      migratedCount: auditCount,
      status: auditCount === (db.audit_logs || []).length ? 'PASS' : 'FAIL',
    });

    // -------------------------------------------------------------
    // Validation finale de la transaction
    // -------------------------------------------------------------
    await client.query('COMMIT');
    console.log('\n[3/5] Transaction validée avec succès (COMMIT).');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ ERREUR CRITIQUE PENDANT LA TRANSACTION. ROLLBACK EFFECTUÉ :', error);
    throw error;
  } finally {
    client.release();
  }

  // 4. Calculs de validation financière
  console.log('\n[4/5] Calcul et vérification des totaux financiers...');
  const revRes = await pool.query(`SELECT COALESCE(SUM(applied_price), 0) as total FROM inscriptions WHERE status != 'ANNULEE'`);
  const payRes = await pool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'VALIDE'`);
  const expRes = await pool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses`);

  const totalExpectedRevenue = Number(revRes.rows[0].total);
  const totalCollectedPayments = Number(payRes.rows[0].total);
  const totalExpenses = Number(expRes.rows[0].total);

  console.log(`- Chiffre d'affaires attendu (inscriptions) : ${totalExpectedRevenue.toLocaleString('fr-FR')} FCFA`);
  console.log(`- Encaissements validés (paiements)         : ${totalCollectedPayments.toLocaleString('fr-FR')} FCFA`);
  console.log(`- Total des dépenses                         : ${totalExpenses.toLocaleString('fr-FR')} FCFA`);

  console.log('\n[5/5] Migration terminée avec succès !');

  return {
    success: true,
    results,
    financials: {
      totalExpectedRevenue,
      totalCollectedPayments,
      totalExpenses,
    },
  };
}

if (process.argv[1] && process.argv[1].endsWith('migrate-neon.ts')) {
  runMigration()
    .then(() => {
      console.log('Script exécuté avec succès.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Échec de la migration :', err);
      process.exit(1);
    });
}
