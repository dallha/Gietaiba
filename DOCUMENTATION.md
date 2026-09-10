# Documentation Complète du SaaS — GIE TAIBA VOYAGES (ERP Hajj & Oumrah)

**Version :** 2.0.0 — Migré PostgreSQL/Neon Auth  
**Dernière mise à jour :** Septembre 2026

---

## 1. Présentation Générale

GIE TAIBA VOYAGES est un **ERP (Enterprise Resource Planning) SaaS** complet et sur mesure, conçu spécifiquement pour les agences de voyages organisant des pèlerinages Hajj et Oumrah.

Il centralise la gestion administrative, financière, logistique et sécuritaire de l'agence, tout en offrant un **Portail Pèlerin** dédié aux clients finaux.

**Utilisateurs cibles :**
- **Personnel de l'agence** (Direction, Caissiers, Agents Commerciaux, Logistique, Comptable) — via l'espace ERP (`/erp/*`)
- **Pèlerins** (clients finaux) — via le Portail Pèlerin (`/portail/*`, `/pelerin/*`)

**Devise opérationnelle :** FCFA (Franc CFA)  
**Environnement de production :** https://gietaiba.onrender.com

---

## 2. Architecture Technique

### 2.1 Stack Technologique

| Couche | Technologie | Version |
|--------|------------|---------|
| **Frontend** | React, TypeScript, Vite | React 19, TS ~5.8, Vite 6 |
| **Styling** | Tailwind CSS | v4 (`@tailwindcss/vite`) |
| **Icônes** | Lucide React | ^0.546 |
| **Animations** | Motion | ^12.23 |
| **Graphiques** | Recharts | ^3.10 |
| **PDF** | jsPDF + jspdf-autotable | ^4.2 / ^5.0 |
| **QR Codes** | jsQR + qrcode | ^1.4 / ^1.5 |
| **CSV** | PapaParse | ^5.7 |
| **Routing** | React Router DOM | ^7.18 |
| **Backend** | Express | ^4.21 |
| **Base de données** | PostgreSQL (Neon Cloud) | pg ^8.23 |
| **Authentification** | Neon Auth | @neondatabase/auth ^0.5.0-beta |
| **Bundling prod** | esbuild | ^0.25 |
| **Dev server** | tsx | ^4.21 |

### 2.2 Schéma d'Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Navigateur (SPA)                     │
│  React 19 + React Router 7 + Tailwind CSS 4             │
│  AuthContext (neonClient SDK → cookie HttpOnly)          │
└─────────────┬───────────────────────┬───────────────────┘
              │                       │
              │  API calls (cookies)  │
              ▼                       ▼
┌─────────────────────────────────────────────────────────┐
│               Express Server (Node.js)                  │
│                                                         │
│  ┌──────────────────────┐  ┌──────────────────────────┐ │
│  │  Neon Auth Proxy     │  │  API Routes              │ │
│  │  /api/auth/*         │  │  /api/clients            │ │
│  │  → neon auth service │  │  /api/voyages            │ │
│  │  (skip /me, /users)  │  │  /api/inscriptions       │ │
│  └──────────────────────┘  │  /api/payments           │ │
│                            │  /api/documents          │ │
│  ┌──────────────────────┐  │  /api/visas              │ │
│  │  requireNeonAuth     │  │  /api/flights, /hotels   │ │
│  │  middleware           │  │  /api/pilgrim/*          │ │
│  │  cookie → neon SDK   │  │  /api/settings           │ │
│  │  → public.users map  │  │  /api/audit-logs         │ │
│  └──────────────────────┘  └──────────────────────────┘ │
│                                                         │
│  ┌──────────────────────┐  ┌──────────────────────────┐ │
│  │  PostgreSQL Pool     │  │  Vite Middleware (dev)    │ │
│  │  (Neon Cloud)        │  │  express.static (prod)   │ │
│  └──────────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 2.3 Mode de fonctionnement

| Mode | Frontend | Backend |
|------|----------|---------|
| **Développement** | Vite middleware (HMR) | `tsx server.ts` |
| **Production** | `vite build` → `dist/` statique | `esbuild server.ts` → `dist/server.cjs` |

Le serveur Express sert à la fois l'API et le bundle statique de l'application React. En production, toutes les routes non-API retournent `index.html` (SPA fallback) pour gérer le routage côté client.

### 2.4 Séparation des espaces

Deux espaces protégés coexistent avec une **séparation stricte** :

| Espace | Préfixe | Guard | Rôles autorisés |
|--------|---------|-------|-----------------|
| ERP (Staff) | `/erp/*` | `ErpGuard` | Tous sauf PELERIN |
| Portail Pèlerin | `/portail/*`, `/pelerin/*` | `PilgrimGuard` | PELERIN uniquement |

Toute tentative d'accès croisé est bloquée (403 côté UI + 403 côté API).

---

## 3. Authentification & Sécurité

### 3.1 Neon Auth — Source d'identité unique

L'authentification est entièrement déléguée à **Neon Auth**, un service hébergé qui gère :
- **Google OAuth 2.0** — connexion social
- **Email / Mot de passe** — connexion par identifiants
- **Sessions** — cookies HttpOnly signés (SameSite=Lax, Secure en production)

Aucun mot de passe n'est stocké côté application. Neon Auth gère le hashing, le reset, et la validation.

### 3.2 Proxy Neon Auth

Le proxy (`server/auth/neon-auth.proxy.ts`) intercepte toutes les requêtes `/api/auth/*` et les transmet au service Neon Auth hébergé. Deux routes sont exclues du proxy et gérées localement :
- `GET /api/auth/me` — retourne la session courante (utilisateur + données GIE)
- `GET /api/auth/users` — listing des utilisateurs (protégé par `users.read`)

### 3.3 Middleware requireNeonAuth

Le middleware `server/auth/neon-auth.middleware.ts` implémente le pont d'identité :

```
Cookie HttpOnly Neon Auth
  → SDK createAuthServer().getSession()
  → neon_auth.user.id
  → SELECT FROM public.users WHERE neon_auth_id = $1
  → UserSession complet (role, active, clientId, etc.)
  → next()
```

**Garanties :**
| Condition | Réponse HTTP | Code |
|-----------|-------------|------|
| Session absente ou expirée | 401 | `NEON_SESSION_INVALID` |
| `neon_auth_id` non trouvé dans `public.users` | 403 | `GIE_ACCOUNT_NOT_FOUND` |
| Compte suspendu/désactivé | 401 | `ACCOUNT_DISABLED` |
| Erreur Neon inattendue | 500 | `NEON_AUTH_ERROR` |

**Aucun auto-provisionnement** : un compte Neon Auth valide mais non mappé à un `public.users` reçoit un 403 bloquant. Le mapping doit être réalisé manuellement ou par script de migration.

### 3.4 Flux OAuth Google (verifier)

Le frontend utilise le SDK Neon Auth client pour l'OAuth :

1. L'utilisateur clique "Continuer avec Google"
2. Neon Auth redirige vers Google avec un callback contenant `neon_auth_session_verifier`
3. `AuthContext.initAuth()` détecte le paramètre `neon_auth_session_verifier` dans l'URL
4. Appel `neonAuthClient.getSession()` — le SDK échange le verifier → obtient les cookies de session HttpOnly
5. `GET /api/auth/me` récupère les données utilisateur complètes

### 3.5 RBAC (Role-Based Access Control)

Le contrôle d'accès repose sur 3 tables PostgreSQL :

| Table | Rôle |
|-------|------|
| `roles` | Définit les rôles (SUPER_ADMIN, DIRECTION, CAISSE, AGENT, LOGISTIQUE, PELERIN) |
| `permissions` | Référentiel des permissions (module.action, ex: `clients.read`) |
| `role_permissions` | Association rôle → permissions |

**Côté backend :** `requirePermission('module.action')` vérifie la permission via `authorizationService.authorize()`.

**Côté frontend :** `hasPermission()` dans `AuthContext` et composants `<PermissionGuard>` masquent les éléments UI non autorisés.

**Super Admin (God Mode) :** Privilèges absolus basés sur le rôle `SUPER_ADMIN` ou sur des emails spécifiques hardcodés.

### 3.6 Variables d'environnement requises

| Variable | Description | Usage |
|----------|-------------|-------|
| `DATABASE_URL` | Chaîne de connexion PostgreSQL Neon | Pool serveur |
| `NEON_AUTH_URL` | URL du projet Neon Auth | Middleware + Proxy |
| `NEON_AUTH_COOKIE_SECRET` | Secret de signature des cookies (min 32 caractères) | Middleware + Proxy |
| `SESSION_SECRET` | Secret de session applicative (min 32 caractères, obligatoire en prod) | Sessions Express |
| `VITE_NEON_AUTH_URL` | URL Neon Auth pour le frontend | SDK client |
| `PORT` | Port du serveur (défaut: 3000) | Serveur Express |

---

## 4. Modèle de Données (PostgreSQL)

Le schéma complet est défini dans `server/db/schema.sql` (599 lignes, 22 sections).

### 4.1 Configuration & RBAC

| Table | Description |
|-------|-------------|
| `settings` | Configuration de l'agence : nom, devise (FCFA), téléphone, coordonnées bancaires, mobile money, seuils de recouvrement |
| `roles` | Rôles du système (SUPER_ADMIN, DIRECTION, CAISSE, AGENT, LOGISTIQUE, PELERIN) |
| `permissions` | Permissions granulaires (module.action) |
| `role_permissions` | Table de liaison rôle → permissions |

### 4.2 Clients & Utilisateurs

| Table | Description |
|-------|-------------|
| `clients` | Fiches d'identité des pèlerins — code `CLI-YYYY-NNN`, données civiles, passeport, contact, statut (ACTIF/EN_ATTENTE/ARCHIVE) |
| `users` | Utilisateurs du système (staff & pèlerins) — email unique, `role_id`, `client_id` (si pèlerin), `neon_auth_id` (UUID Neon Auth), `allowed_inscription_ids` |
| `user_roles` | Rôles supplémentaires par utilisateur (table de liaison) |
| `user_client_access` | Habilitation multi-client : un utilisateur peut gérer plusieurs pèlerins — types : TITULAIRE, TUTEUR_FAMILLE, PAYEUR_TIERS, GESTIONNAIRE. Permissions granulaires : `can_view`, `can_pay`, `can_upload_docs` |

### 4.3 Campagnes & Packages

| Table | Description |
|-------|-------------|
| `campaigns` | Campagnes de voyage — code `HAJ2027-01`, type (HAJJ/OUMRAH/AUTRE), capacité, statut (PLANIFIE/OUVERT/CLOTURE/ARCHIVE) |
| `packages` | Formules tarifaires — catégorie (STANDARD/CONFORT/VIP), prix (initial, courant), type de chambre, hôtels Makkah/Médine |
| `package_versions` | Historique immuable des prix — numéro de version, statut (PROVISOIRE/DEFINITIF), dates d'effet |

### 4.4 Inscriptions (Dossiers)

| Table | Description |
|-------|-------------|
| `inscriptions` | Dossiers d'inscription — code `INS-YYYY-NNN`, prix appliqué (snapshot du package_version), statut (EN_ATTENTE/CONFIRMEE/ANNULEE) |
| | **Contrainte unique partielle** : un pèlerin ne peut avoir qu'un seul dossier actif par campagne |

### 4.5 Paiements & Finances

| Table | Description |
|-------|-------------|
| `payments` | Reçus de paiement — code `PAY-YYYY-NNNN`, montant, méthode (ESPECES, VIREMENT, WAVE, ORANGE_MONEY, etc.), statut (VALIDE/ANNULE) |
| `payment_reversals` | Traçabilité des annulations (contre-passation) — raison, montant renversé, auteur |
| `payment_schedules` | Échéancier prévisionnel — date d'échéance, montant dû, statut (PENDING/PARTIAL/PAID/OVERDUE/CANCELLED) |
| `payment_schedule_allocations` | Allocation comptable FIFO des paiements sur les échéances |

### 4.6 Documents & Visas

| Table | Description |
|-------|-------------|
| `document_types` | Types de documents requis (Passeport, Photo, Vaccin, etc.) |
| `documents` | Pièces justificatives — statut (MANQUANT/RECU/EN_VERIFICATION/VALIDE/EXPIRE/REFUSE/REJETE), raison de rejet |
| `visas` | Suivi des visas Nusuk — statut (NON_DEMANDE → EMIS), numéro, dates |

### 4.7 Logistique

| Table | Description |
|-------|-------------|
| `flights` | Vols — compagnie, numéro, villes, dates, statut (PROGRAMME → EFFECTUE) |
| `flight_segments` | Segments multi-escales (ALLER/RETOUR/TRANSIT/INTERNE) |
| `tickets` | Billets assignés aux pèlerins — numéro, PNR, statut |
| `hotels` | Hébergements — nom, ville (Makkah/Médine/Djeddah), catégorie, dates |
| `rooms` | Chambres — type (INDIVIDUELLE/DOUBLE/TRIPLE/QUADRUPLE/SUITE), **capacité physique** avec `current_occupancy` |
| `room_assignments` | Affectations pèlerin → chambre (contrainte unique par hôtel) |
| `hotel_stays` | Séjours géolocalisés par pèlerin (Makkah/Médine/Djeddah) |
| `groups` | Groupes de pèlerins — guide, bus, hôtel assigné |
| `group_members` | Membres d'un groupe |
| `accompagnateurs` | Accompagnateurs de voyage — disponibilité, campagne assignée |

### 4.8 Dépenses

| Table | Description |
|-------|-------------|
| `expenses` | Dépenses opérationnelles — code unique, catégorie, montant, fournisseur, campagne associée |

### 4.9 Notifications & Audit

| Table | Description |
|-------|-------------|
| `notifications` | Notifications centralisées — clé d'idempotence (dédoublonnage), priorité, catégorie, marquage lu/non-lu |
| `audit_logs` | Journal d'audit infalsifiable — acteur, action, entité, anciennes/nouvelles valeurs, métadonnées |

### 4.10 Tables Techniques

| Table | Description |
|-------|-------------|
| `business_sequences` | Compteurs atomiques annuels pour la génération séquentielle de codes métier |
| `idempotency_keys` | Clés d'idempotence (TTL 24h, empreinte de requête pour détection de fraude) |
| `migration_id_map` | Traçabilité de migration (ancien_id → nouveau_id) |

### 4.11 Fonction SQL atomique

```sql
SELECT get_next_business_sequence(p_type, p_year)
```

Génère atomiquement le prochain numéro séquentiel pour un type donné (INS, PAY, etc.) via `INSERT ... ON CONFLICT ... DO UPDATE` (optimistic locking).

---

## 5. Modules ERP (Espace Équipe)

Chaque module correspond à un dossier dans `src/modules/` :

### 5.1 Tableau de Bord (`dashboard`)
- Chiffre d'affaires prévisionnel, total encaissé, reste à recouvrer
- KPIs logistiques : places disponibles, taux de complétion des documents
- Alertes : retards de paiement, passeports expirés

### 5.2 Gestion des Clients (`clients`)
- Fiches clients complètes (identité, contact, urgence, passeport)
- Création, mise à jour, archivage, suppression avec vérification des dépendances
- Codes séquentiels `CLI-YYYY-NNN`
- Statuts : ACTIF, EN_ATTENTE, ARCHIVE

### 5.3 Inscriptions (`inscriptions`)
- Dossiers liant un client, un voyage et un package
- Capture du prix appliqué au moment T (snapshot de `package_versions`)
- Workflow : création → confirmation → annulation
- Un seul dossier actif par client par campagne (contrainte DB)
- Codes `INS-YYYY-NNN`

### 5.4 Paiements & Caisse (`paiements`)
- Encaissements par espèce, virement, Wave, Orange Money, etc.
- Génération et impression de reçus professionnels (PDF)
- Annulation avec contre-passation (reversal) traçable
- Codes `PAY-YYYY-NNNN`
- Échéancier dynamique avec allocation FIFO

### 5.5 Recouvrement (`recouvrement`)
- Suivi du solde restant dû par pèlerin
- Code couleur d'urgence (seuil configurable)
- Vue consolidée des échéances impayées

### 5.6 Documents (`documents`)
- Collecte et validation des pièces justificatives
- Workflow : Manquant → Reçu → En vérification → Valide / Refusé
- Rejet avec motif
- Types configurables depuis `settings.default_required_document_types`

### 5.7 Visas (`visas`)
- Suivi des demandes de visas Nusuk
- Workflow : NON_DEMANDE → DOSSIER_EN_PREPARATION → DEMANDÉ → TRAITEMENT → APPROUVE / EMIS

### 5.8 Logistique (`logistique`)
- **Vols** : planification, segments multi-escales, gestion des statuts
- **Billets** : assignation aux pèlerins
- **Hôtels & Chambres** : capacité physique stricte (`SELECT FOR UPDATE`), affectation nominative
- **Seat Map** : vue visuelle de l'occupation des chambres
- **Groupes** : constitution des groupes, assignation de guides et bus
- **Accompagnateurs** : suivi de disponibilité

### 5.9 Voyages / Campagnes (`voyages`)
- Création de campagnes (type HAJJ/OUMRAH/AUTRE, capacité, dates)
- Vue calendrier
- Statuts : PLANIFIE → OUVERT → CLOTURE → ARCHIVE
- Codes `HAJYYYY-NN`

### 5.10 Packages (`packages`)
- Formules tarifaires (STANDARD/CONFORT/VIP) avec versioning de prix
- Historique immuable via `package_versions`
- Informations hôtels Makkah/Médine, type de chambre

### 5.11 Dépenses (`depenses`)
- Enregistrement des charges opérationnelles par campagne
- Catégories configurables
- Codes uniques `EXP-YYYY-NNN`
- Annulation et suppression traçables

### 5.12 Rapports (`rapports`)
- Tableaux de bord financiers et logistiques
- Export CSV (PapaParse)

### 5.13 Utilisateurs & Rôles (`users`)
- Gestion des comptes staff et pèlerins
- Configuration des rôles et permissions
- Habilitation multi-client (tuteurs, payeurs tiers)
- Module UsersRolesModule

### 5.14 Paramètres (`settings`)
- Configuration globale de l'agence
- Coordonnées bancaires, mobile money
- Seuils de recouvrement
- Types de documents requis, méthodes de paiement

### 5.15 Audit (`audit`)
- Consultation du journal d'audit
- Traçabilité complète des actions sensibles

---

## 6. Portail Pèlerin (Espace Client)

Le portail est une interface simplifiée, en lecture seule, conçue pour rassurer le client et réduire les appels à l'agence.

### 6.1 Isolation & Sécurité

- **Isolation IDOR stricte** : le `clientId` est extrait exclusivement de la session Neon Auth (`req.user.clientId`). Tout paramètre d'URL demandant le dossier d'un tiers est rejeté en 403.
- Les pèlerins ne voient **que** les inscriptions dans `allowedInscriptionIds`.
- Les documents non visibles côté client (`is_client_visible = false`) sont filtrés côté serveur.

### 6.2 Habilitation Multi-Client (5D)

Un compte pèlerin peut gérer plusieurs bénéficiaires via `user_client_access` :

| Type d'accès | Description |
|-------------|-------------|
| `TITULAIRE` | Le pèlerin lui-même |
| `TUTEUR_FAMILLE` | Tuteur légal (parent d'un mineur) |
| `PAYEUR_TIERS` | Personne payant pour le compte du pèlerin |
| `GESTIONNAIRE` | Gestionnaire délégué (secrétaire, assistant) |

Chaque accès définit des permissions granulaires : `can_view`, `can_pay`, `can_upload_docs`.

### 6.3 Fonctionnalités

| Fonctionnalité | Description |
|---------------|-------------|
| Dossier complet | État du dossier, package, campagne |
| Reçus | Consultation et téléchargement des reçus de paiement |
| Échéancier | Suivi des échéances et soldes |
| Documents | Statut des pièces et alertes (passeport expiré) |
| Visa | Suivi de la demande Nusuk |
| Logistique | Informations vol et hôtel (dès publication) |
| Ajout bénéficiaire | Création d'un dossier pour un proche |
| Dépôt documents | Upload de documents pour les bénéficiaires autorisés |
| Paiement en ligne | Enregistrement de paiements (Wave, Orange Money) |

### 6.4 Routes API Pèlerin

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/pilgrim/beneficiaries` | GET | Liste des bénéficiaires accessibles |
| `/api/pilgrim/beneficiaries` | POST | Ajouter un bénéficiaire |
| `/api/pilgrim/dossier` | GET | Dossier complet du pèlerin |
| `/api/pilgrim/documents` | POST | Déposer un document |
| `/api/pilgrim/payments` | POST | Enregistrer un paiement |

---

## 7. API

### 7.1 Conventions

| Règle | Détail |
|-------|--------|
| **Protocole** | HTTPS obligatoire en production |
| **Format** | JSON (`application/json; charset=utf-8`) |
| **Encodage** | UTF-8 strict |
| **Authentification** | Cookie HttpOnly Neon Auth (pas de Bearer token localStorage) |
| **Idempotence** | En-tête `Idempotency-Key` obligatoire sur les mutations financières |
| **Erreurs** | Format normalisé : `{ error, code, details, error_info: { code, message, details } }` |

### 7.2 Codes d'erreur normalisés

| Code HTTP | Code Machine | Cas |
|-----------|-------------|-----|
| 400 | `BAD_REQUEST` | Payload invalide |
| 400 | `INSCRIPTION_ALREADY_EXISTS` | Client déjà inscrit activement sur la campagne |
| 401 | `NEON_SESSION_INVALID` | Session Neon Auth absente/expirée |
| 401 | `ACCOUNT_DISABLED` | Compte suspendu/désactivé |
| 403 | `FORBIDDEN` | Permission RBAC insuffisante |
| 403 | `GIE_ACCOUNT_NOT_FOUND` | neon_auth_id non mappé dans public.users |
| 404 | `NOT_FOUND` | Ressource inexistante |
| 409 | `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST` | Clé d'idempotence réutilisée avec body altéré |
| 422 | `ROOM_FULL_ERROR` | Capacité maximale de la chambre atteinte |
| 422 | `CAMPAIGN_MUTATION_FORBIDDEN_CLOSED` | Campagne clôturée |
| 422 | `PASSPORT_INVALID` | Passeport expiré ou invalide |
| 500 | `NEON_AUTH_ERROR` | Erreur interne Neon Auth |

### 7.3 Matrice RBAC

| Permission | SUPER_ADMIN | DIRECTION | CAISSE | AGENT | LOGISTIQUE | PELERIN |
|-----------|:-----------:|:---------:|:------:|:-----:|:----------:|:-------:|
| `users.read` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `users.create` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `users.update` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `users.delete` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `clients.read` | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 (own) |
| `clients.create` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `clients.update` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `clients.delete` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `voyages.read` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `voyages.manage` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `inscriptions.read` | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 (own) |
| `inscriptions.create` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `inscriptions.update` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `inscriptions.cancel` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `payments.read` | ✅ | ✅ | ✅ | ✅ | ❌ | 🔒 (valid) |
| `payments.create` | ✅ | ✅ | ✅ | ✅ | ❌ | 🔒 (own) |
| `payments.cancel` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `documents.read` | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 (visible) |
| `documents.create` | ✅ | ✅ | ✅ | ✅ | ❌ | 🔒 (own) |
| `documents.validate` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `visas.read` | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| `visas.update` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `logistics.read` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `logistics.manage` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `expenses.read` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `expenses.create` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `expenses.delete` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `settings.read` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `settings.manage` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `reports.read` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `audit.read` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

*Légende : 🔒 = accès restreint aux données du pèlerin connecté*

### 7.4 Référentiel des Endpoints

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| GET | `/api/health` | — | Health check (public) |
| **Auth** | | | |
| GET | `/api/auth/neon-me` | Neon Auth | Session Neon Auth vérifiée |
| POST | `/api/auth/logout` | Neon Auth | Déconnexion (204) |
| GET | `/api/auth/me` | Neon Auth | Données utilisateur courant |
| GET | `/api/auth/users` | `users.read` | Listing basique des utilisateurs |
| * | `/api/auth/*` | — | Proxy Neon Auth (login, signup, google, etc.) |
| **Utilisateurs** | | | |
| GET | `/api/users` | `users.read` | Liste complète des utilisateurs |
| POST | `/api/users` | `users.create` | Créer un utilisateur |
| PUT | `/api/users/:id` | `users.update` | Modifier un utilisateur |
| DELETE | `/api/users/:id` | `users.delete` | Supprimer un utilisateur |
| GET | `/api/users/:id/client-access` | `users.read` | Habilitations multi-client |
| POST | `/api/users/:id/client-access` | `users.update` | Accorder un accès client |
| DELETE | `/api/users/:id/client-access/:clientId` | `users.update` | Révoquer un accès client |
| GET | `/api/roles` | Neon Auth | Liste des rôles |
| **Configuration** | | | |
| GET | `/api/settings` | `settings.read` | Paramètres de l'agence |
| PUT | `/api/settings` | `settings.manage` | Modifier les paramètres |
| **Dashboard** | | | |
| GET | `/api/dashboard/stats` | `reports.read` | Statistiques exécutives |
| **Clients** | | | |
| GET | `/api/clients` | `clients.read` | Liste des clients (search, status) |
| GET | `/api/clients/:id` | `clients.read` / IDOR | Fiche client |
| POST | `/api/clients` | `clients.create` | Créer un client |
| PUT | `/api/clients/:id` | `clients.update` | Modifier un client |
| GET | `/api/clients/:id/dependencies` | `clients.read` | Dépendances d'un client |
| POST | `/api/clients/:id/archive` | `clients.update` | Archiver un client |
| DELETE | `/api/clients/:id` | `clients.delete` | Supprimer un client |
| **Voyages / Campagnes** | | | |
| GET | `/api/voyages` (ou `/api/campaigns`) | `voyages.read` | Liste des campagnes |
| POST | `/api/voyages` | `voyages.manage` | Créer une campagne |
| PUT | `/api/voyages/:id` | `voyages.manage` | Modifier une campagne |
| DELETE | `/api/voyages/:id` | `voyages.manage` | Supprimer une campagne |
| **Packages** | | | |
| GET | `/api/packages` | `voyages.read` | Liste des packages (filter: voyageId) |
| POST | `/api/packages` | `voyages.manage` | Créer un package |
| PUT | `/api/packages/:id` | `voyages.manage` | Modifier un package |
| DELETE | `/api/packages/:id` | `voyages.manage` | Supprimer un package |
| POST | `/api/packages/:id/new-price-version` | `voyages.manage` | Nouvelle version de prix |
| **Inscriptions** | | | |
| GET | `/api/inscriptions` | `inscriptions.read` | Liste des inscriptions |
| POST | `/api/inscriptions` | `inscriptions.create` | Créer une inscription |
| PATCH | `/api/inscriptions/:id/price` | `inscriptions.update` | Modifier le prix |
| PUT | `/api/inscriptions/:id/status` | `inscriptions.update` | Changer le statut |
| DELETE | `/api/inscriptions/:id` | `inscriptions.cancel` | Annuler une inscription |
| **Paiements** | | | |
| GET | `/api/payments` | `payments.read` | Liste des paiements |
| POST | `/api/payments` | `payments.create` | Enregistrer un paiement |
| POST | `/api/payments/:id/cancel` | `payments.cancel` | Annuler un paiement |
| **Documents** | | | |
| GET | `/api/documents` | `documents.read` | Liste des documents |
| POST | `/api/documents` | `documents.create` | Ajouter un document |
| PUT | `/api/documents/:id/status` | `documents.validate` | Valider/refuser un document |
| **Visas** | | | |
| GET | `/api/visas` | `visas.read` | Liste des visas |
| PUT | `/api/visas/:id` | `visas.update` | Mettre à jour un visa |
| **Logistique** | | | |
| GET | `/api/flights` | `logistics.read` | Liste des vols |
| POST | `/api/flights` | `logistics.manage` | Créer un vol |
| GET | `/api/tickets` | `logistics.read` | Liste des billets |
| POST | `/api/tickets` | `logistics.manage` | Créer un billet |
| GET | `/api/hotels` | `logistics.read` | Liste des hôtels |
| POST | `/api/hotels` | `logistics.manage` | Créer un hôtel |
| GET | `/api/rooms` | `logistics.read` | Liste des chambres |
| POST | `/api/rooms` | `logistics.manage` | Créer une chambre |
| POST | `/api/rooms/:id/assign` | `logistics.manage` | Affecter un pèlerin |
| DELETE | `/api/rooms/:id/occupants/:clientId` | `logistics.manage` | Retirer un occupant |
| GET | `/api/groups` | `logistics.read` | Liste des groupes |
| POST | `/api/groups` | `logistics.manage` | Créer un groupe |
| POST | `/api/groups/:id/members` | `logistics.manage` | Ajouter un membre |
| GET | `/api/accompagnateurs` | `logistics.read` | Liste des accompagnateurs |
| **Dépenses** | | | |
| GET | `/api/expenses` | `expenses.read` | Liste des dépenses |
| POST | `/api/expenses` | `expenses.create` | Créer une dépense |
| PUT | `/api/expenses/:id` | `expenses.create` | Modifier une dépense |
| POST | `/api/expenses/:id/cancel` | `expenses.delete` | Annuler une dépense |
| DELETE | `/api/expenses/:id` | `expenses.delete` | Supprimer une dépense |
| **Audit** | | | |
| GET | `/api/audit-logs` | `audit.read` | Journal d'audit |
| POST | `/api/audit-logs` | Neon Auth | Écrire un log d'audit |
| **Notifications** | | | |
| GET | `/api/notifications` | Neon Auth | Notifications de l'utilisateur |
| POST | `/api/notifications` | Neon Auth | Créer une notification |
| PUT | `/api/notifications/:id/read` | Neon Auth | Marquer comme lu |
| PUT | `/api/notifications/read-all` | Neon Auth | Tout marquer comme lu |
| **Pèlerin** | | | |
| GET | `/api/pilgrim/beneficiaries` | Neon Auth | Bénéficiaires accessibles |
| POST | `/api/pilgrim/beneficiaries` | Neon Auth | Ajouter un bénéficiaire |
| GET | `/api/pilgrim/dossier` | Neon Auth + IDOR | Dossier complet |
| POST | `/api/pilgrim/documents` | Neon Auth + canUploadDocs | Déposer un document |
| POST | `/api/pilgrim/payments` | Neon Auth + canPay | Enregistrer un paiement |

---

## 8. Invariants Métier & Garanties

### 8.1 Codes Séquentiels Atomiques

Tous les codes métier sont générés de manière atomique via la fonction PostgreSQL `get_next_business_sequence()` :

| Type | Format | Exemple |
|------|--------|---------|
| Client | `CLI-YYYY-NNN` | CLI-2027-001 |
| Inscription | `INS-YYYY-NNN` | INS-2027-001 |
| Paiement | `PAY-YYYY-NNNN` | PAY-2027-0001 |
| Dépense | `EXP-YYYY-NNN` | EXP-2027-001 |

Le compteur est atomique (`INSERT ... ON CONFLICT DO UPDATE ... RETURNING`) et annuel, garantissant l'unicité sans conflit de concurrence.

### 8.2 Immuabilité Tarifaire

Lors de la création d'une inscription, le prix du package est **snapshoté** dans `package_versions`. Les modifications ultérieures du tarif n'affectent pas les inscriptions existantes :

```
inscription.applied_price  ←  package_versions.price (au moment de l'inscription)
inscription.package_version_id  →  package_versions.id (référence immutable)
```

### 8.3 Allocation FIFO des Paiements

Les paiements sont ventilés sur les échéances (`payment_schedules`) selon un algorithme FIFO (First In, First Out) dans `payment_schedule_allocations`. Chaque allocation est traçable.

### 8.4 Capacité Physique des Chambres

L'affectation d'un pèlerin dans une chambre utilise un verrou pessimiste (`SELECT FOR UPDATE`) pour empêcher les dépassements de capacité concurrents :

1. `SELECT ... FOR UPDATE` sur la ligne `rooms`
2. Vérification : `current_occupancy < capacity`
3. Si complète → `422 ROOM_FULL_ERROR`
4. Sinon → incrémentation atomique `current_occupancy + 1`

### 8.5 Idempotence des Mutations Financières

L'en-tête `Idempotency-Key` est obligatoire sur les mutations financières (inscriptions, paiements). La table `idempotency_keys` (TTL 24h) enregistre chaque requête avec une empreinte du body. Réutilisation détectée → `409 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST`.

### 8.6 Isolation IDOR du Pèlerin

Toute requête de type pèlerin (`/api/pilgrim/*`, `/api/clients/:id` pour un PELERIN, etc.) valide que le `clientId` demandé correspond à `req.user.clientId`. Toute tentative d'accès à un tiers → `403 Forbidden`.

### 8.7 Campagne Clôturée

Une campagne au statut `CLOTURE` ou `ARCHIVE` bloque toute mutation opérationnelle (inscription, paiement) avec `422 CAMPAIGN_MUTATION_FORBIDDEN_CLOSED`. Une dérogation `overrideClosedCampaign` est possible pour les admin.

### 8.8 Journal d'Audit

Chaque action sensible (création, modification, annulation) est tracée dans `audit_logs` avec : acteur, action, type d'entité, ID d'entité, anciennes/nouvelles valeurs, métadonnées. Ce journal est **infalsifiable** (append-only).

---

## 9. Déploiement

### 9.1 Environnement de production

| Élément | Détail |
|---------|--------|
| **Hébergeur** | Render |
| **URL** | https://gietaiba.onrender.com |
| **Build** | `npm run build` → `vite build` + `esbuild server.ts` → `dist/server.cjs` |
| **Start** | `npm start` → `node dist/server.cjs` |
| **Dev** | `npm run dev` → `tsx server.ts` (Vite HMR) |
| **Lint** | `npm run lint` → `tsc --noEmit` |

### 9.2 Variables d'environnement (Render)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Chaîne de connexion PostgreSQL Neon (ne pas exposer) |
| `NEON_AUTH_URL` | URL du projet Neon Auth |
| `NEON_AUTH_COOKIE_SECRET` | Secret de signature des cookies (min 32 chars) |
| `SESSION_SECRET` | Secret de session Express (min 32 chars, obligatoire en prod) |
| `VITE_NEON_AUTH_URL` | URL Neon Auth côté client (injectée au build) |
| `PORT` | Port du serveur (défaut: 3000) |

### 9.3 Sécurité production

- `SESSION_SECRET` **obligatoire** (min 32 caractères) — le serveur refuse de démarrer sans
- `NEON_AUTH_COOKIE_SECRET` obligatoire (min 32 caractères) — vérifié par le middleware
- `x-user-id` header strictement rejeté en production
- Cookies : `HttpOnly`, `Secure` (HTTPS only), `SameSite=Lax`
- SSL Neon : `rejectUnauthorized: false` (standard Neon Cloud)

---

## 10. Développement Local

### 10.1 Prérequis

- Node.js >= 18
- npm
- Accès à une base de données PostgreSQL (Neon ou locale)

### 10.2 Installation

```bash
git clone <repository-url>
cd Gietaiba
npm install
```

### 10.3 Configuration

Créer un fichier `.env` à la racine du projet :

```
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
NEON_AUTH_URL=https://your-project.neon-auth.com
NEON_AUTH_COOKIE_SECRET=your-cookie-secret-min-32-chars-long
SESSION_SECRET=your-session-secret-min-32-chars-long
VITE_NEON_AUTH_URL=https://your-project.neon-auth.com
PORT=3000
```

> ⚠️ Ne jamais commiter le fichier `.env`. Il est exclu par `.gitignore`.

### 10.4 Scripts

| Commande | Description |
|----------|-------------|
| `npm run dev` | Démarrage en mode développement (tsx + Vite HMR) |
| `npm run build` | Build de production (Vite + esbuild) |
| `npm start` | Démarrage en mode production |
| `npm run lint` | Vérification des types TypeScript |
| `npm run clean` | Nettoyage des fichiers buildés |

### 10.5 Schéma de la base de données

Le schéma est initialisé automatiquement au démarrage du serveur via `initSchema()` (`server/db/neon.ts`) qui exécute `server/db/schema.sql` dans une transaction ACID.

---

## Notes de Migration

Ce document remplace la version précédente qui décrivait l'architecture Firebase/Firestore. Les changements majeurs :

| Avant (Firebase) | Après (PostgreSQL/Neon) |
|-------------------|------------------------|
| Firestore (NoSQL) | PostgreSQL Neon Cloud (relationnel) |
| Firebase Authentication | Neon Auth (cookie HttpOnly) |
| Bearer token localStorage | Cookie HttpOnly signé |
| Règles Firestore (server-side) | Middleware Express `requireNeonAuth` + `requirePermission` |
| IDs Firebase auto-générés | IDs texte `cli-*`, `usr-*`, etc. + codes métier séquentiels |
| Collections plates | Tables relationnelles avec contraintes ACID |
| Pas de transactions | Transactions ACID PostgreSQL (`withTransaction`) |

### Parties du document API_CONTRACT.md qui sont obsolètes

Le fichier `docs/API_CONTRACT.md` n'a pas été entièrement mis à jour suite à la migration Neon Auth. Les points obsolètes :

1. **Section 1.2** — Décrit l'en-tête `Authorization: Bearer <token>`. L'implémentation actuelle utilise des **cookies HttpOnly Neon Auth**, pas des Bearer tokens.
2. **Section 3.1 (POST /api/auth/login)** — Ce endpoint n'existe plus. L'authentification passe par le proxy Neon Auth (`/api/auth/sign-in/email-password` ou `/api/auth/sign-in/social`).
3. **Section 3.1 (POST /api/auth/pilgrim-login)** — Ce endpoint n'existe plus. Les pèlerins utilisent Neon Auth comme tout autre utilisateur.
4. **Section 4 (Guide d'intégration)** — Décrit le stockage du token dans `localStorage`. L'implémentation actuelle utilise exclusivement des cookies HttpOnly.
5. **Section 2 (Matrice RBAC)** — Les noms de rôles dans la matrice ne correspondent pas exactement aux IDs de la base (ex: `AGENT_COMMERCIAL` vs `AGENT`, `COMPTABLE` vs `CAISSE`).

---

*Document généré à partir de l'analyse du code source — Septembre 2026*
