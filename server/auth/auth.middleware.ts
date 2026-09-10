import { Request, Response, NextFunction } from 'express';
import { UserSession } from '../../src/types.js';
import { authorizationService } from './authorization.service.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: UserSession;
    }
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
