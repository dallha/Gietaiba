# 📋 CONTRAT D'API OFFICIEL — ERP GIE TAIBA VOYAGES (PHASE 5)

**Version :** 5.0.0-PROD  
**Environnement cible :** Production & SaaS Multi-tenant  
**Devise opérationnelle :** *« Nettoyer le faux. Préserver le vrai. Bloquer l'inconnu. Ne jamais inventer. »*

---

## 1. CONVENTIONS GLOBALES

### 1.1 Protocole & Format
- **Protocole :** HTTPS obligatoire (HTTP en local dev).
- **Encodage :** UTF-8 strict.
- **Format d'échange :** JSON (`application/json; charset=utf-8`).

### 1.2 En-têtes HTTP Requis
| En-tête | Requis | Description | Exemple |
|---|---|---|---|
| `Content-Type` | Oui sur POST/PUT/PATCH | Type MIME du corps | `application/json` |
| `Idempotency-Key` | Oui sur mutations financières & critiques | Clé unique garantissant une exécution unique sous concurrence | `Idempotency-Key: PAY-uuid-v4` |
| `Accept` | Recommandé | Type de réponse attendu | `application/json` |

> ℹ️ **Authentification :** La session est gérée par Neon Auth via un cookie HttpOnly (`credentials: 'same-origin'`). Aucun en-tête `Authorization` n'est requis côté client — le cookie est automatiquement transmis par le navigateur. L'ancien en-tête `x-user-id` n'est plus utilisé.

---

### 1.3 Format Standard des Réponses Réussies

```json
{
  "success": true,
  "data": { ... },
  "metadata": {
    "timestamp": "2026-09-08T22:50:00.000Z",
    "requestId": "req-12345"
  }
}
```
*(Pour la compatibilité descendante des endpoints de collections et objets existants, les données peuvent être renvoyées directement sous forme d'objet ou de tableau JSON).*

---

### 1.4 Format Standard Normalisé des Erreurs

Toutes les erreurs renvoyées par l'API respectent la structure unifiée suivante :

```json
{
  "error": "Message explicite et compréhensible pour l'opérateur ou l'utilisateur",
  "code": "CODE_MACHINE_UNIFIE",
  "details": {},
  "error_info": {
    "code": "CODE_MACHINE_UNIFIE",
    "message": "Message explicite et compréhensible",
    "details": {}
  }
}
```

#### Codes HTTP & Codes d'Erreur Normalisés
| Code HTTP | Statut | Code Machine (`code`) | Cas d'utilisation |
|---|---|---|---|
| `400` | Bad Request | `BAD_REQUEST` | Payload invalide, paramètres manquants |
| `400` | Bad Request | `INSCRIPTION_ALREADY_EXISTS` | Client déjà inscrit activement sur la campagne |
| `401` | Unauthorized | `UNAUTHORIZED` | Jeton absent, altéré, falsifié ou expiré |
| `403` | Forbidden | `FORBIDDEN` | Rôle insuffisant (RBAC) ou tentative de violation d'isolation pèlerin (IDOR) |
| `404` | Not Found | `NOT_FOUND` | Ressource (client, campagne, chambre, paiement) inexistante |
| `409` | Conflict | `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST` | Clé d'idempotence réutilisée avec un corps de requête altéré |
| `422` | Unprocessable Entity | `ROOM_FULL_ERROR` | Tentative d'affectation sur une chambre ayant atteint sa capacité maximale |
| `422` | Unprocessable Entity | `CAMPAIGN_MUTATION_FORBIDDEN_CLOSED` | Tentative de modification opérationnelle sur une campagne clôturée sans dérogation |
| `422` | Unprocessable Entity | `DATE_INCOHERENTE` | Date d'inscription postérieure ou égale à la date de départ |
| `422` | Unprocessable Entity | `ECHEANCE_APRES_DEPART` | Échéance planifiée après la date de début de campagne |
| `422` | Unprocessable Entity | `SOLDE_INSUFFISANT` | Annulation ou encaissement excédant les plafonds autorisés |
| `500` | Internal Error | `INTERNAL_SERVER_ERROR` | Exception inattendue côté serveur ou rupture d'intégrité |

---

## 2. MATRICE D'ACCÈS RBAC (CONTRÔLE DES RÔLES)

L'ERP implémente un modèle RBAC strict sur 6 rôles :

1. `SUPER_ADMIN` : Droits absolus, audits système, configuration globale, dérogations administratives.
2. `ADMIN` / `DIRECTION` : Gestion stratégique, clôture de campagne, dérogations, rapports consolidés.
3. `COMPTABLE` / `RESPONSABLE_FINANCIER` : Encaissements, annulation de paiements, dépenses, réconciliations financières.
4. `AGENT_COMMERCIAL` : Création de clients, enregistrement d'inscriptions, encaissements autorisés (pas d'annulations).
5. `LOGISTIQUE` : Hôtels, chambres, affectation nominative des pèlerins, vols et tickets.
6. `PELERIN` : Accès strictement restreint et hermétique à son propre dossier (`/api/pilgrim/*`).

---

## 3. RÉFÉRENTIEL DES ENDPOINTS

### 3.1 Authentification (`/api/auth`)

L'authentification est **entièrement déléguée à Neon Auth** via le proxy `/api/auth/*` (sign-in email/password, Google, request-password-reset, etc.). Neon Auth gère les identifiants, la vérification et l'émission de la session.

#### `POST /api/auth/*` (proxy Neon Auth)
- **Description :** Endpoints d'authentification délégués à Neon Auth : `sign-in` (email/password), `google`, `request-password-reset`, `reset-password`, `sign-out`, etc.
- **Accès :** Public (sauf `sign-out`).
- **Réponse :** Neon Auth établit un cookie de session HttpOnly. Aucun jeton n'est renvoyé au client.

#### `GET /api/auth/me`
- **Description :** Récupération de la session courante à partir du cookie HttpOnly (pour validation au rechargement de page).
- **Accès :** Tout utilisateur authentifié.
- **Headers :** Aucun — le cookie de session est transmis automatiquement (`credentials: 'same-origin'`).
- **Flux :** `requireNeonAuth` → résolution `neon_auth_id` → chargement de l'utilisateur depuis `public.users` → RBAC.
- **Response 200 OK :** Renvoie l'objet session `user` (id, email, displayName, role, clientId, allowedInscriptionIds, permissions).

---

### 3.2 Tableau de Bord & Baseline Financière (`/api/dashboard`)

#### `GET /api/dashboard/stats`
- **Description :** Statistiques exécutives calculées dynamiquement à partir de PostgreSQL (zéro mock, zéro invention).
- **Accès :** `reports.read` (SUPER_ADMIN, DIRECTION, COMPTABLE, AGENT).
- **Invariants officiels certifiés :**
  - Chiffre d'Affaires prévisionnel (6 inscriptions Standard à 5.1M) : **30 600 000 FCFA**.
  - Total Encaissé réel (3 versements confirmés) : **4 500 000 FCFA**.
  - Dépenses engagées réelles : **0 FCFA**.
  - Solde restant à recouvrer : **26 100 000 FCFA**.
  - Résultat d'exploitation actuel : **Non déterminé** (dépenses opérationnelles futures non encore engagées).

---

### 3.3 Dossier Inscription 360 & Pèlerins (`/api/inscriptions`, `/api/clients`)

#### `GET /api/inscriptions`
- **Description :** Liste consolidée des dossiers d'inscriptions Hajj & Oumrah.
- **Accès :** `inscriptions.read`.
- **Paramètres :** `campaignId`, `status`, `search`.

#### `POST /api/inscriptions`
- **Description :** Création transactionnelle et atomique d'un dossier contractuel 360.
- **Accès :** `inscriptions.write` (SUPER_ADMIN, DIRECTION, AGENT).
- **Headers :** `Idempotency-Key` (recommandé).
- **Garanties ACID du service :**
  1. Génération atomique du code séquentiel annuel `INS-YYYY-XXXXXX` via `SELECT FOR UPDATE` sur `business_sequences`.
  2. Vérification anti-doublon (un pèlerin ne peut avoir qu'un seul dossier actif par campagne).
  3. Vérification de l'état de la campagne (rejet `422` si la campagne est clôturée).
  4. Validation de cohérence des dates (`dateInscription < dateDepart`).
  5. Génération dynamique de l'échéancier prévisionnel (3 échéances plafonnées avant départ).
  6. Initialisation automatique de la ligne logistique visa au statut `NON_DEMANDE`.
  7. Journalisation dans `audit_logs` sous la même transaction.

#### `GET /api/inscriptions/:id/dossier-360`
- **Description :** Vue complète à 360° du dossier pèlerin (fiche client, package, échéances calculées, paiements imputés, chambre affectée, ticket vol, visa).
- **Accès :** `inscriptions.read` (Staff) ou Pèlerin propriétaire du dossier.

---

### 3.4 Caisse, Versements & Échéanciers Dynamiques (`/api/payments`)

#### `POST /api/payments`
- **Description :** Enregistrement transactionnel d'un encaissement de versement pèlerin.
- **Accès :** `payments.write` (SUPER_ADMIN, DIRECTION, COMPTABLE, AGENT).
- **Headers :** `Idempotency-Key` (obligatoire pour prévenir les doubles débits réseau).
- **Request Body :**
  ```json
  {
    "inscriptionId": "uuid-inscription",
    "amount": 250000,
    "paymentMethod": "Wave",
    "reference": "WAVE-TRX-7890",
    "comment": "Premier acompte Hajj 2027"
  }
  ```
- **Garanties ACID du service :**
  1. Génération du numéro de reçu officiel séquentiel annuel `PAY-YYYY-XXXXXX`.
  2. Imputation dynamique et ventilation FIFO sur les échéances non échues ou partielles (`payment_schedules`).
  3. Mise à jour de l'historique d'allocations (`payment_schedule_allocations`).
  4. Recalcul instantané du solde restant dû.
  5. Journalisation d'audit immuable.

#### `POST /api/payments/:id/cancel`
- **Description :** Annulation transactionnelle d'un encaissement erroné avec contre-passation (reversal).
- **Accès :** `payments.cancel` (SUPER_ADMIN, DIRECTION, COMPTABLE uniquement — AGENT strictement refusé `403`).
- **Headers :** `Idempotency-Key` (recommandé).
- **Request Body :**
  ```json
  {
    "reason": "Chèque sans provision - Erreur de saisie guichet"
  }
  ```

---

### 3.5 Logistique & Hôtellerie (`/api/hotels`, `/api/rooms`)

#### `POST /api/rooms/:id/assign`
- **Description :** Affectation nominative d'un pèlerin dans une chambre d'hôtel.
- **Accès :** `logistics.write` (SUPER_ADMIN, DIRECTION, LOGISTIQUE).
- **Request Body :**
  ```json
  {
    "clientId": "cli-001",
    "inscriptionId": "uuid-inscription"
  }
  ```
- **Garanties Concurrence PUA :**
  - Verrou pessimiste `SELECT FOR UPDATE` sur la ligne `rooms`.
  - Contrôle strict : `current_occupancy < capacity`.
  - Rejet atomique `422 Unprocessable Entity` (`ROOM_FULL_ERROR`) si la chambre est complète.
  - Incrémentation atomique du nombre d'occupants dans la même transaction.

#### `POST /api/rooms/assign/:assignmentId/unassign`
- **Description :** Libération d'une place en chambre et décrémentation atomique de l'occupation.
- **Accès :** `logistics.write`.

---

### 3.6 Espace Pèlerin (Self-Service Isolé) (`/api/pilgrim`)

#### `GET /api/pilgrim/dossier`
- **Description :** Restitution sécurisée du dossier du pèlerin connecté.
- **Accès :** `PELERIN` authentifié.
- **Isolation IDOR absolue :** L'identifiant client est extrait exclusivement de la session cryptographique (`req.user.clientId`). Tout paramètre d'URL demandant le dossier d'un tiers est rejeté en `403 Forbidden`.

---

## 4. GUIDE D'INTÉGRATION FRONTEND

1. **Session HttpOnly :** L'authentification repose sur le cookie de session HttpOnly émis par Neon Auth. Toutes les requêtes API utilisent `credentials: 'same-origin'` — le cookie est transmis automatiquement par le navigateur.
2. **Aucun stockage de jeton :** Ne jamais stocker de token dans `localStorage` ni `sessionStorage`. Aucun en-tête `Authorization` n'est émis par le frontend.
3. **Connexion :** Rediriger vers `/api/auth/*` (proxy Neon Auth) pour le sign-in (email/password ou Google). Après connexion, recharger la session via `GET /api/auth/me`.
4. **Gestion des erreurs :** Intercepter les codes `401` pour rediriger vers `/login`, afficher des alertes explicites sur les rejets `422` (surbooking, dates incohérentes, campagne clôturée).
5. **Idempotence :** Sur toute action de création financière (paiement, inscription), générer un UUID v4 côté client et le transmettre dans l'en-tête `Idempotency-Key`.
