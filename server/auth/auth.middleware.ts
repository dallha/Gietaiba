import { Request, Response, NextFunction } from 'express';
import { pool } from '../db/neon.js';
import { UserSession } from '../../src/types.js';
import { authorizationService } from './authorization.service.js';
import { verifySignedSessionToken } from './token.service.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: UserSession;
    }
  }
}

/**
 * Authentication Middleware:
 * Resolves the authenticated user from PostgreSQL Neon.
 * 
 * Cryptographic verification:
 * 1. Checks 'Authorization: Bearer <token>'
 * 2. Cryptographically verifies HMAC-SHA256 signature and expiry
 * 3. Enforces that in production (NODE_ENV === 'production'), 'x-user-id' is STRICTLY REJECTED.
 * 4. NEVER defaults to users[0] or SUPER_ADMIN.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  const devUserIdHeader = (req.headers['x-user-id'] as string)?.trim();
  const isProduction = process.env.NODE_ENV === 'production';

  let resolvedUserId: string | null = null;

  // 1. Priorité absolue : Jeton cryptographique dans l'en-tête Authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const rawToken = authHeader.substring(7).trim();

    // Vérification de la signature cryptographique HMAC-SHA256
    const tokenPayload = verifySignedSessionToken(rawToken);
    if (tokenPayload) {
      resolvedUserId = tokenPayload.userId;
    } else {
      res.status(401).json({
        error: 'Jeton de session cryptographique invalide, falsifié ou expiré.',
        code: 'INVALID_TOKEN',
      });
      return;
    }
  }

  // 2. Gestion de l'en-tête x-user-id
  if (!resolvedUserId && devUserIdHeader) {
    if (isProduction) {
      // RÈGLE CRITIQUE PHASE 2.5 : Rejet formel de x-user-id en production
      res.status(401).json({
        error: 'L\'en-tête x-user-id est strictement interdit en production. Authentification cryptographique Bearer requise.',
        code: 'DEV_HEADER_FORBIDDEN_IN_PROD',
      });
      return;
    }

    // Autorisé uniquement hors production (développement / tests automatisés)
    resolvedUserId = devUserIdHeader;
  }

  // 3. Rejet strict si aucune identité n'a pu être vérifiée
  if (!resolvedUserId) {
    res.status(401).json({
      error: 'Non authentifié. Jeton cryptographique obligatoire (Authorization: Bearer <token>).',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  try {
    // 4. Résolution de l'utilisateur dans PostgreSQL Neon
    const result = await pool.query(
      `SELECT id, email, display_name, phone, role_id, status, active, client_id, allowed_inscription_ids
       FROM users
       WHERE id = $1 OR email = $1`,
      [resolvedUserId]
    );

    if (result.rows.length === 0) {
      res.status(401).json({
        error: 'Utilisateur introuvable ou supprimé.',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    const row = result.rows[0];

    // 5. Contrôle du statut du compte
    if (row.active === false || row.status === 'INACTIF' || row.status === 'SUSPENDU') {
      res.status(401).json({
        error: 'Ce compte utilisateur a été suspendu ou désactivé.',
        code: 'ACCOUNT_DISABLED',
      });
      return;
    }

    const session: UserSession = {
      id: row.id,
      email: row.email,
      role: row.role_id,
      displayName: row.display_name,
      phone: row.phone || undefined,
      clientId: row.client_id || undefined,
      allowedInscriptionIds: row.allowed_inscription_ids || undefined,
      active: row.active,
    };

    req.user = session;
    next();
  } catch (err: any) {
    console.error('[Auth Middleware] Erreur lors de la vérification auth:', err);
    res.status(500).json({ error: 'Erreur interne lors de l\'authentification.' });
  }
}

/**
 * Authorization Middleware:
 * Enforces specific RBAC permission check.
 */
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentification requise.', code: 'AUTH_REQUIRED' });
      return;
    }

    const allowed = await authorizationService.authorize(req.user, permission);
    if (!allowed) {
      res.status(403).json({
        error: `Accès non autorisé : la permission '${permission}' est requise pour effectuer cette action.`,
        code: 'FORBIDDEN',
      });
      return;
    }

    next();
  };
}

/**
 * Middleware preventing pilgrims from accessing staff ERP routes
 */
export function requireStaff(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentification requise.' });
    return;
  }

  if (req.user.role === 'PELERIN') {
    res.status(403).json({
      error: 'Accès interdit aux pèlerins. Espace réservé au personnel de Taiba Voyages.',
      code: 'STAFF_ONLY',
    });
    return;
  }

  next();
}
