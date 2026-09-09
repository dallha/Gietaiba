# RAPPORT DE RESET CONTRÔLÉ DE L'ENVIRONNEMENT DE TEST
## GIE TAIBA VOYAGES ERP (HAJJ & OUMRAH) — PHASE 5A

**Date :** 9 septembre 2026  
**Environnement :** ANTIGRAVITY  
**Cible :** Base de données relationnelle Neon PostgreSQL  
**Statut SaaS :** Pré-exploitation (Environnement de préparation métier scellé)  
**Devise :** *« Nettoyer le faux. Préserver le vrai. Bloquer l'inconnu. Ne jamais inventer. »*

---

## 1. Contexte & Justification du Reset

Le système SaaS / ERP de GIE TAIBA VOYAGES est en phase finale d'architecture et de pré-exploitation.
À la suite de la certification formelle du **JALON 0 (Normalisation des matricules métier)**, le présent Reset Contrôlé a pour objectif d'assainir intégralement la base de données en supprimant les données de test explicitement qualifiées, tout en préservant scrupuleusement les données réelles confirmées par la direction, sans jamais inventer la moindre donnée.

---

## 2. Inventaire et Classification Formelle

Chaque table et enregistrement a été audité et classifié selon les trois catégories strictes : `REAL`, `TEST`, `UNKNOWN`.

### A. Données d'Infrastructure & Configuration (`REAL / INFRA / CONFIG`) — CONSERVÉES
- **`users` (6 utilisateurs)** : Comptes du personnel et de la direction (`usr-admin`, `usr-direction`, `usr-caisse`, `usr-commercial`, `usr-agent`, `usr-pelerin`).
- **`roles` (6 rôles)** : `SUPER_ADMIN`, `ADMIN`, `RESPONSABLE_COMMERCIAL`, `AGENT_COMMERCIAL`, `COMPTABLE`, `PELERIN`.
- **`permissions` (31 permissions)** & **`role_permissions` (84 liaisons)** : Matrice RBAC validée.
- **`user_roles` (6 liaisons)** : Affectations des rôles aux utilisateurs.
- **`settings` (1 ligne)** : Configuration institutionnelle de l'agence GIE TAIBA VOYAGES.
- **`document_types` (5 lignes)** : Nomenclature des pièces requises (Passeport, Photo, Certificat Médical, etc.).
- **`business_sequences` (5 compteurs)** : Séquences atomiques annuelles pour codes métier.

### B. Données Métier Réelles Confirmées (`REAL`) — STRICTEMENT PRÉSERVÉES
- **`campaigns` (1 campagne)** : `voy-haj2027-01` (HAJJ 2027 — Code: `HAJ2027-01`, Départ: `2027-05-18`).
- **`packages` (2 packages confirmés)** :
  - `pkg-std-2027` : Package Standard (Tarif provisoire : 5 100 000 FCFA, Version 1)
  - `pkg-vip-2027` : Package VIP (Tarif provisoire : 5 900 000 FCFA, Version 1)
- **`clients` (6 pèlerins réels confirmés)** :
  1. `cli-001` : SAIDOU SOW (`GT-000001`, `+221 77 520 11 22`)
  2. `cli-002` : AISSATOU FALL (`GT-000002`, `+221 77 644 33 22`)
  3. `cli-003` : FATOUMATA SOW (`GT-000003`, `+221 77 312 90 01`)
  4. `cli-004` : NDEYE BINTA GADIAGA (`GT-000004`, `+221 78 120 45 67`)
  5. `cli-005` : SOKHNA DIENG (`GT-000005`, `+221 76 540 88 12`)
  6. `cli-006` : NDEYE NGONE BA (`GT-000006`, `+221 77 980 12 34`)
- **`inscriptions` (6 dossiers réels confirmés, tous sur Package Standard)** :
  - `ins-001` (`GT-HJ27-000001`) : Saidou Sow — Prix gravé : 5 100 000 FCFA
  - `ins-002` (`GT-HJ27-000002`) : Aissatou Fall — Prix gravé : 5 100 000 FCFA
  - `ins-003` (`GT-HJ27-000003`) : Fatoumata Sow — Prix gravé : 5 100 000 FCFA
  - `ins-004` (`GT-HJ27-000004`) : Ndeye Binta Gadiaga — Prix gravé : 5 100 000 FCFA
  - `ins-005` (`GT-HJ27-000005`) : Sokhna Dieng — Prix gravé : 5 100 000 FCFA
  - `ins-006` (`GT-HJ27-000006`) : Ndeye Ngone Ba — Prix gravé : 5 100 000 FCFA
- **`payments` (3 versements réels confirmés)** :
  1. `pay-001` : Saidou Sow — 250 000 FCFA (Espèces, reçu `GT-PAY27-000001`, réf: `REÇU-MANUEL-001`)
  2. `pay-002` : Aissatou Fall — 250 000 FCFA (Wave, reçu `GT-PAY27-000002`, réf: `WAVE-TX-8839210`)
  3. `pay-003` : Fatoumata Sow — 4 000 000 FCFA (Virement Bancaire CBAO, reçu `GT-PAY27-000003`, réf: `VIR-CBAO-991204`)
  👉 **Total Réel Reçu : 4 500 000 FCFA**.

### C. Données Inconnues (`UNKNOWN`) — NON ALTÉRÉES
- **`pkg-conf-2027` (Package Confort, 5 500 000 FCFA)** : Non formellement confirmé comme réel par la direction, mais non qualifié expressément de test. En vertu de la règle suprême, il est **bloqué, signalé et conservé sans modification**.

### D. Données de Développement & Fictives (`TEST`) — SUPPRIMÉES LORS DU RESET
1. **Paiement Orange Money de test (`pay-1788542397098`)** :
   - *Critères de validation multicritère stricts :*
     - `id` : `pay-1788542397098`
     - `client_id` : `cli-001`
     - `inscription_id` : `ins-001`
     - `amount` : `250000.00`
     - `payment_method` : `ORANGE_MONEY`
     - `reference` : `OM-7890123`
     - `created_at` : `2026-09-04T17:19:57.098Z`
     - `agent_id` : `usr-admin`
   - *Statut :* Test dev identifié.
2. **`expenses` (2 dépenses fictives de test)** :
   - `exp-001` : Saudia Airlines Dakar (15 000 000 FCFA) — Fictive
   - `exp-002` : Pullman Zamzam Makkah (8 500 000 FCFA) — Fictive
   - *Statut :* Total réel des dépenses engagées = **0 FCFA**.
3. **Logistique de test** :
   - `flights` (2 vols) & `tickets` (1 billet test) : Supprimés.
   - `hotels` (2 hôtels), `rooms` (3 chambres), `room_assignments` (2 affectations test) : Supprimés.
   - `groups` (2 groupes), `group_members` (2 membres), `accompagnateurs` (2 accompagnateurs) : Supprimés.
4. **Visas de test (`visas` — 3 lignes)** :
   - Supprimés. **Aucun visa n'est créé artificiellement**. Les dossiers visas seront ouverts uniquement lors d'opérations réelles.
5. **Documents de test (`documents` — 5 fichiers fictifs)** :
   - Supprimés.
6. **Notifications et logs dev (`notifications`, `audit_logs`)** :
   - Purgés pour initialiser le journal d'audit de production démarrant par l'événement formel du Reset.

---

## 3. Protocole Technique du Reset Contrôlé

Le nettoyage s'effectue sous une **transaction unique ACID** via le script `scripts/reset-test-environment.ts` selon l'ordre strict suivant :

1. **Vérification préliminaire de sécurité** :
   - Constat de la présence des 3 paiements réels (`pay-001`, `pay-002`, `pay-003`). En cas d'absence $\to$ `ROLLBACK` immédiat et arrêt (`STOP`).
   - Contrôle multicritère du paiement `pay-1788542397098`. En cas de divergence $\to$ requalification en `UNKNOWN` et arrêt immédiat.
2. **Suppression ordonnée des tables TEST** (respect de l'arborescence des clés étrangères) :
   - `room_assignments` $\to$ `rooms` $\to$ `hotel_stays` $\to$ `hotels`
   - `tickets` $\to$ `flight_segments` $\to$ `flights`
   - `group_members` $\to$ `groups` $\to$ `accompagnateurs`
   - `documents`
   - `visas`
   - `expenses`
   - `payment_schedule_allocations` & `payment_reversals` & `idempotency_keys`
   - `notifications` & `audit_logs` (anciens logs dev)
3. **Suppression du versement de test qualifié** :
   - Suppression unique de `pay-1788542397098`.
4. **Préservation du package `pkg-conf-2027` (`UNKNOWN`)** :
   - Aucune modification.
5. **Synchronisation déterministe des échéanciers dans `payment_schedules`** :
   - Source formelle : `InscriptionWorkflowService.calculateDynamicSchedules`.
   - Date de départ officielle lue en base (`voy-haj2027-01`) : `2027-05-18`.
   - Délai : 259 jours (> 90 jours $\implies$ règle tripartite validée).
   - Échéance 1 ($J+7$) : `2026-09-08` (30% = 1 530 000 FCFA).
   - Échéance 2 (Mi-parcours) : `2026-12-28` (40% = 2 040 000 FCFA).
   - Échéance 3 ($J-30$ avant le 18 mai 2027) : `2027-04-18` (30% = 1 530 000 FCFA).
   - Total : 18 tranches générées, toutes strictement antérieures au départ.
6. **Ventilation comptable FIFO réelle** :
   - Lecture des 3 paiements réels existants (`GT-PAY27-000001` 250k, `GT-PAY27-000002` 250k, `GT-PAY27-000003` 4M).
   - Calcul et insertion des allocations exactes dans `payment_schedule_allocations`.
   - Total alloué = **4 500 000 FCFA**. Aucun paiement synthétique créé.
7. **Contrôle des compteurs `business_sequences` par observation pure** :
   - Zéro écriture ni réparation silencieuse.
   - Comparaison stricte : `CLIENT` = 6, `INSCRIPTION_HAJJ` = 6, `INSCRIPTION_UMRAH` = 0, `PAYMENT` = 3, `EXPENSE` = 0.
8. **Enregistrement de l'Audit Log Initial** :
   - Action : `RESET_TEST_ENVIRONMENT`
   - Entité : `SYSTEM`
   - Acteur : `SUPER_ADMIN` (`usr-admin`)

---

## 4. Contrôles d'Intégrité Post-Reset (Observation PURE)

Le script n'effectue aucun ajustement forcé : il **observe** et **compare** :
- Somme des 3 versements réels confirmés $\to$ Observée : **4 500 000 FCFA** [CONFORME]
- Somme des dépenses réelles $\to$ Observée : **0 FCFA** [CONFORME]
- Total dû calculé par les pèlerins $\to$ Observé : **26 100 000 FCFA** [CONFORME]
- Visas créés lors du reset $\to$ Observé : **0** [CONFORME]
- Inscriptions confirmées $\to$ Observé : **6** (toutes sur Standard à 5 100 000 FCFA) [CONFORME]
- Packages préservés $\to$ Observé : **3** (Standard `REAL`, VIP `REAL`, Confort `UNKNOWN`) [CONFORME]
- Séquences atomiques $\to$ Observées : `CLI=6, HAJJ_27=6, UMRAH_27=0, PAY_27=3, EXP=0` [CONFORME]
- Archive `data/database.json` $\to$ SHA-256 intact : `140ab4ea75a4aba802d4c1ec47b1d3d1b0f8b0de05f0c9216489fd3b7115f473` [CONFORME]
- Certification Indépendante $\to$ `scripts/certify-jalon0.ts` : **JALON 0 : CERTIFIÉ (16/16 PASS)**
- Suites de validation automatisées $\to$ **86/86 TESTS PASS (100%)**
- Build de production $\to$ **100% SUCCÈS** (SPA Vite + `dist/server.cjs` en 6.8s)
