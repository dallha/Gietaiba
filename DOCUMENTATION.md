# Documentation Complète du SaaS - GIE TAIBA VOYAGES (ERP Hajj & Oumrah)

## 1. Présentation Générale
Ce système est un **ERP (Enterprise Resource Planning) SaaS** complet et sur mesure, conçu spécifiquement pour les agences de voyages organisant des pèlerinages (Hajj et Oumrah). 
Il centralise la gestion administrative, financière, logistique et sécuritaire de l'agence, tout en offrant un **Portail Pèlerin** dédié aux clients finaux.

## 2. Architecture Technique
* **Frontend** : React 18, TypeScript, Vite.
* **Styling** : Tailwind CSS, Lucide React (Icônes), Framer Motion (Animations).
* **Backend & Base de données** : Firebase (Firestore NoSQL, Firebase Authentication).
* **Architecture d'accès** : Single Page Application (SPA) avec routage protégé et séparation stricte entre l'espace ERP (Staff) et l'espace Portail (Pèlerins).

---

## 3. Modèles de Données (Collections Firestore)
L'architecture de la base de données est construite autour des entités suivantes :

* `users` : Utilisateurs du système (Staff et Pèlerins) avec leurs identifiants Auth et leur `roleId`.
* `roles` : Matrice RBAC définissant les permissions des rôles (SUPER_ADMIN, CAISSIER, etc.).
* `clients` : Fiches d'identité des pèlerins (données civiles, passeport, contacts).
* `voyages` : Campagnes de voyage (ex: Hajj 2027, Oumrah Ramadan).
* `packages` : Formules tarifaires liées aux voyages (Standard, VIP, etc.).
* `inscriptions` : Dossiers liant un Client, un Voyage et un Package avec un prix convenu.
* `payments` : Reçus et transactions financières liées aux inscriptions.
* `documents` : Pièces justificatives (Passeports, Photos) et leur statut de validation.
* `visas` : Suivi des demandes de visas (Nusuk).
* `flights`, `hotels`, `rooms` : Logistique et hébergement.
* `expenses` : Dépenses opérationnelles de l'agence.
* `notifications` : Système central de notification (alertes de paiement, validation de document).
* `settings` : Configuration globale de l'agence (Nom, devise, logo, conditions).

---

## 4. Modules Principaux de l'ERP (Espace Équipe)

### 4.1. Tableau de Bord (Dashboard)
* **Vue d'ensemble** : Chiffre d'affaires, total des encaissements, reste à recouvrer.
* **KPIs Logistiques** : Places disponibles par voyage, taux de complétion des documents.
* **Alertes** : Suivi des retards de paiement et des passeports manquants/expirés.

### 4.2. Gestion des Clients & Inscriptions
* **Fiches Clients** : Profil complet du pèlerin (Identité, contact, urgence).
* **Création de Dossier (Inscription)** : Association du client à un voyage spécifique. L'inscription capture le prix du package au moment "T" (immuabilité tarifaire).
* **Statuts** : En attente, Confirmée, Annulée.

### 4.3. Gestion Financière (Paiements & Caisse)
* **Encaissements** : Saisie des paiements par espèce, virement, chèque ou mobile money (Wave, Orange Money).
* **Reçus** : Génération et impression de reçus professionnels.
* **Recouvrement** : Suivi du solde restant dû par pèlerin avec code couleur d'urgence.

### 4.4. Gestion Administrative (Documents & Visas)
* **Collecte de Documents** : Téléversement sécurisé des scans (Passeports, photos, vaccins).
* **Workflow de Validation** : Manquant ➔ Reçu ➔ En vérification ➔ Valide / Refusé.
* **Visas Nusuk** : Suivi des demandes de visas biométriques en Arabie Saoudite.

### 4.5. Logistique & Hébergement
* **Vols** : Planification des vols aller/retour.
* **Hôtels & Chambres** : Allocation des pèlerins dans les chambres (Double, Triple, Quadruple) à La Mecque et Médine.
* **Groupes** : Assignation de guides et constitution des bus.

### 4.6. Catalogue (Voyages & Packages)
* **Création de Campagnes** : Définition des dates, capacités et types (Hajj/Oumrah).
* **Versioning des Tarifs** : Gestion des évolutions de prix sans impacter les inscriptions passées.

---

## 5. Portail Pèlerin (Espace Client)
Le portail (`/portail`) est une interface simplifiée, en lecture seule, conçue pour rassurer le client et réduire les appels à l'agence.

* **Sécurité** : L'accès est conditionné par un compte lié à une `fiche Client`. Un pèlerin ne voit **que** ses propres dossiers (`allowedInscriptionIds`).
* **Fonctionnalités** :
  * État du compte (Total payé, Reste à payer, reçus téléchargeables).
  * Statut des documents et alertes si un passeport est expiré.
  * Suivi du Visa et des informations logistiques (Vol, Hôtel) dès qu'elles sont publiées.

---

## 6. Sécurité & RBAC (Role-Based Access Control)
La sécurité est assurée à deux niveaux (Frontend et Backend).

### 6.1. Rôles et Permissions (Frontend)
* **Matrice Dynamique** : Les rôles sont définis dans Firestore. Chaque rôle possède un tableau de permissions (ex: `users.view`, `payments.create`).
* **Guards (Guards.tsx)** : Les composants UI sont protégés par la fonction `hasPermission`. Si un utilisateur n'a pas le droit de voir les finances, l'onglet disparaît.
* **Super Admin (God Mode)** : Un accès racine absolu (généralement via `mr.niass@gmail.com`) avec la permission joker `*`.

### 6.2. Règles Firestore (Backend)
* `firestore.rules` assure que même si le code source de l'application est modifié, un utilisateur non autorisé ne peut pas lire ou écrire des données sensibles directement dans la base de données.
* Les pèlerins n'ont accès en lecture qu'à leur propre document utilisateur et à leurs données spécifiques.

---

## 7. Flux Fonctionnels Clés

1. **Cycle de vie d'un pèlerin** : 
   `Création Fiche Client` ➔ `Création Inscription (Dossier)` ➔ `Saisie des Paiements` ➔ `Collecte des Documents` ➔ `Demande Visa` ➔ `Affectation Chambre/Vol`.
2. **Cycle de sécurité d'un compte** :
   `Connexion Firebase Auth` ➔ `Vérification document /users/{uid}` ➔ `Récupération du /roles/{roleId}` ➔ `Application de la matrice de permissions`.

---

## 8. Maintenance et Diagnostic
* **Panneau de Diagnostic** : Accessible dans le Dashboard, permet de vérifier en temps réel la connectivité aux APIs Firestore et Firebase Auth.
* **Journal d'Audit** : Traçabilité complète des actions sensibles (qui a modifié quoi, à quelle heure).

---
*Généré par Google AI Studio - Agent Architecte ERP.*
