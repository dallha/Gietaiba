import { pool } from '../db/neon.js';
import { UserSession } from '../../src/types.js';

export interface RolePermissionsMap {
  [roleId: string]: Set<string>;
}

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ['*'],
  DIRECTION: [
    'clients.*', 'inscriptions.*', 'visas.*', 'documents.*',
    'voyages.*', 'campaigns.*', 'packages.*', 'logistics.*', 'logistique.*',
    'payments.*', 'expenses.*', 'depenses.*', 'reports.*',
    'audit.*', 'settings.*', 'users.read'
  ],
  COMPTABLE: [
    'payments.*', 'expenses.*', 'depenses.*', 'reports.*',
    'clients.read', 'clients.view', 'inscriptions.read', 'inscriptions.view',
    'voyages.read', 'voyages.view', 'packages.read', 'documents.read', 'documents.view'
  ],
  AGENT: [
    'clients.read', 'clients.view', 'clients.create', 'clients.update',
    'inscriptions.read', 'inscriptions.view', 'inscriptions.create', 'inscriptions.update',
    'visas.read', 'visas.view', 'visas.update',
    'documents.read', 'documents.view', 'documents.create',
    'voyages.read', 'voyages.view', 'campaigns.read', 'packages.read',
    'logistics.read', 'logistics.view', 'logistique.read', 'logistique.view',
    'logistics.manage', 'logistique.manage'
  ],
};

class AuthorizationService {
  private rolePermissionsCache: RolePermissionsMap | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds

  /**
   * Loads or refreshes the permissions matrix from PostgreSQL Neon
   */
  public async getRolePermissions(): Promise<RolePermissionsMap> {
    const now = Date.now();
    if (this.rolePermissionsCache && now < this.cacheExpiry) {
      return this.rolePermissionsCache;
    }

    try {
      const result = await pool.query(
        `SELECT role_id, permission_id FROM role_permissions`
      );

      const map: RolePermissionsMap = {};
      // 1. Initialiser avec la matrice par défaut des 6 rôles
      for (const [roleId, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
        map[roleId] = new Set<string>(perms);
      }
      // 2. Fusionner les permissions explicites en base de données
      for (const row of result.rows) {
        if (!map[row.role_id]) {
          map[row.role_id] = new Set<string>();
        }
        map[row.role_id].add(row.permission_id);
      }

      this.rolePermissionsCache = map;
      this.cacheExpiry = now + this.CACHE_TTL;
      return map;
    } catch (error) {
      console.error('[AuthorizationService] Erreur lors du chargement des permissions:', error);
      // Fallback sur matrice par défaut
      const map: RolePermissionsMap = {};
      for (const [roleId, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
        map[roleId] = new Set<string>(perms);
      }
      return map;
    }
  }

  public invalidateCache(): void {
    this.rolePermissionsCache = null;
    this.cacheExpiry = 0;
  }

  /**
   * Central authorization check: authorize(user, permission)
   */
  public async authorize(user: UserSession | null | undefined, permission: string): Promise<boolean> {
    if (!user) return false;
    if (user.active === false) return false;

    const role = user.role;

    // SUPER_ADMIN has full governance over all modules
    if (role === 'SUPER_ADMIN') {
      return true;
    }

    // PELERIN is strictly isolated to pilgrim portal
    if (role === 'PELERIN') {
      const allowedPilgrimPermissions = new Set([
        'pilgrim.portal',
        'pilgrim.dossier',
        'pilgrim.documents.read',
        'pilgrim.payments.read'
      ]);
      return allowedPilgrimPermissions.has(permission);
    }

    const permissionsMap = await this.getRolePermissions();
    const rolePermissions = permissionsMap[role];

    if (!rolePermissions) {
      return false;
    }

    // Check direct permission or wildcard module permission (e.g. 'clients.*')
    if (rolePermissions.has('*') || rolePermissions.has(permission)) {
      return true;
    }

    // Synonym normalization (read <-> view, logistics <-> logistique, expenses <-> depenses)
    const aliases = this.getPermissionAliases(permission);
    for (const alias of aliases) {
      if (rolePermissions.has(alias)) return true;
      const [mod] = alias.split('.');
      if (mod && (rolePermissions.has(`${mod}.*`) || rolePermissions.has(mod))) {
        return true;
      }
    }

    const [module] = permission.split('.');
    if (module && rolePermissions.has(`${module}.*`)) {
      return true;
    }

    return false;
  }

  private getPermissionAliases(perm: string): string[] {
    const parts = perm.split('.');
    if (parts.length < 2) return [perm];
    const [mod, act] = parts;

    const moduleAliases: Record<string, string[]> = {
      campaigns: ['campaigns', 'voyages'],
      voyages: ['campaigns', 'voyages'],
      logistics: ['logistics', 'logistique'],
      logistique: ['logistics', 'logistique'],
      expenses: ['expenses', 'depenses'],
      depenses: ['expenses', 'depenses'],
    };

    const actionAliases: Record<string, string[]> = {
      read: ['read', 'view'],
      view: ['read', 'view'],
      manage: ['manage', 'update', 'create', 'delete'],
      cancel: ['cancel', 'delete'],
    };

    const mods = moduleAliases[mod] || [mod];
    const acts = actionAliases[act] || [act];

    const aliases: string[] = [];
    for (const m of mods) {
      for (const a of acts) {
        aliases.push(`${m}.${a}`);
      }
    }
    return aliases;
  }

  /**
   * Protection rule: checks if a target user is the last active SUPER_ADMIN
   */
  public async isLastActiveSuperAdmin(userId: string): Promise<boolean> {
    const res = await pool.query(
      `SELECT id FROM users WHERE role_id = 'SUPER_ADMIN' AND active = TRUE`
    );
    const superAdmins = res.rows;
    if (superAdmins.length <= 1 && superAdmins.some((u) => u.id === userId)) {
      return true;
    }
    return false;
  }
}

export const authorizationService = new AuthorizationService();
