/**
 * Role-Based Access Control (RBAC) Module Permissions
 * 
 * Strict module allocation for GIE TAIBA VOYAGES:
 * - SUPER_ADMIN: Full system & administrative access, user provisioning
 * - DIRECTION: Full operational & financial management, supervision, audit, settings
 * - COMPTABLE: Financial operations (payments, debts, expenses, reports), read-only operational
 * - AGENT: Grand operational agent (clients, dossiers, visas, documents, logistics, trips), 0 financial access
 */

export const ROLE_ALLOWED_MODULES: Record<string, string[]> = {
  SUPER_ADMIN: [
    'dashboard',
    'clients',
    'inscriptions',
    'packages',
    'paiements',
    'recouvrement',
    'depenses',
    'voyages',
    'logistique',
    'hotels',
    'vols',
    'groupes',
    'documents',
    'visas',
    'rapports',
    'users-roles',
    'settings',
    'audit',
    'workspace',
  ],
  DIRECTION: [
    'dashboard',
    'clients',
    'inscriptions',
    'packages',
    'paiements',
    'recouvrement',
    'depenses',
    'voyages',
    'logistique',
    'hotels',
    'vols',
    'groupes',
    'documents',
    'visas',
    'rapports',
    'users-roles',
    'settings',
    'audit',
    'workspace',
  ],
  COMPTABLE: [
    'dashboard',
    'clients',
    'inscriptions',
    'packages',
    'paiements',
    'recouvrement',
    'depenses',
    'voyages',
    'documents',
    'rapports',
    'workspace',
  ],
  AGENT: [
    'dashboard',
    'clients',
    'inscriptions',
    'packages',
    'voyages',
    'logistique',
    'hotels',
    'vols',
    'groupes',
    'documents',
    'visas',
    'workspace',
  ],
};

/**
 * Normalizes role string to canonical uppercase role id
 */
export function normalizeRole(roleId: string | undefined | null): string {
  if (!roleId) return 'AGENT';
  const clean = roleId.trim().toUpperCase();
  if (clean === 'ADMIN' || clean === 'SUPERADMIN') return 'SUPER_ADMIN';
  if (clean === 'GERANT' || clean === 'DIRECTEUR' || clean === 'RESPONSABLE_COMMERCIAL') return 'DIRECTION';
  if (clean === 'CAISSE' || clean === 'COMPTABILITE') return 'COMPTABLE';
  if (clean === 'AGENT_COMMERCIAL' || clean === 'LOGISTIQUE' || clean === 'CONSEILLER') return 'AGENT';
  return clean;
}

/**
 * Checks if a specific module is accessible for a given role
 */
export function isModuleAllowedForRole(roleId: string | undefined | null, moduleId: string): boolean {
  if (!roleId) return false;
  const canonicalRole = normalizeRole(roleId);
  if (canonicalRole === 'SUPER_ADMIN') return true;

  const allowedModules = ROLE_ALLOWED_MODULES[canonicalRole];
  if (!allowedModules) return false;

  return allowedModules.includes(moduleId);
}

/**
 * User-friendly module labels in French for 403 screens and navigation
 */
export const MODULE_LABELS: Record<string, string> = {
  'dashboard': 'Tableau de bord exécutif',
  'clients': 'Pèlerins & Contacts',
  'inscriptions': 'Dossiers d’Inscription',
  'packages': 'Packages & Tarifs',
  'paiements': 'Caisse & Versements',
  'recouvrement': 'Recouvrement & Soldes',
  'depenses': 'Dépenses & Rentabilité',
  'voyages': 'Campagnes Hajj & Oumrah',
  'logistique': 'Logistique & Hébergements',
  'hotels': 'Hôtels Makkah & Médine',
  'vols': 'Vols & Billetterie',
  'groupes': 'Groupes & Encadreurs',
  'documents': 'GED Documents',
  'visas': 'Visas Nusuk & Statuts',
  'rapports': 'Rapports & Exports',
  'users-roles': 'Utilisateurs & Droits',
  'settings': 'Paramètres Agence',
  'audit': 'Journal d’Audit',
  'workspace': 'Espace Partagé',
  'espace-pelerin': 'Espace Pèlerin',
};
