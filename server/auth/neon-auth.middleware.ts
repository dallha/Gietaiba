import { Request, Response, NextFunction } from 'express';
// @ts-ignore - Resolves correctly in bundler (moduleResolution: bundler)
import { createAuthServer, RequestContext, CookieOptions } from '@neondatabase/auth/server';
import { pool } from '../db/neon.js';
import { UserSession } from '../../src/types.js';

/**
 * Convertit la requête Express en RequestContext requis par le SDK Neon Auth.
 * Neon Auth exige l'interface Web API Request ; cet adaptateur fait le pont
 * avec l'objet Request d'Express sans modifier l'infrastructure existante.
 */
function createExpressRequestContext(req: Request, res: Response): RequestContext {
  return {
    getCookies: () => req.headers.cookie ?? '',
    setCookie: (name: string, value: string, options: CookieOptions) => {
      res.cookie(name, value, {
        httpOnly:  options.httpOnly  ?? true,
        secure:    options.secure    ?? process.env.NODE_ENV === 'production',
        sameSite:  options.sameSite  ?? 'lax',
        maxAge:    options.maxAge    ? options.maxAge * 1000 : undefined,
        expires:   options.expires,
        path:      options.path,
        domain:    options.domain,
      });
    },
    getHeader: (name: string) => (req.header(name) as string) ?? null,
    getOrigin: () => (req.header('origin') as string) ?? '',
    // @ts-ignore - SDK interne : certaines versions lisent getFramework()
    getFramework: () => 'express',
  };
}

/**
 * Middleware Express isolé pour la Phase NEON-AUTH-1.1.
 *
 * NE REMPLACE PAS requireAuth — coexiste en parallèle.
 *
 * Flux :
 *   Session cookie Neon
 *     → SDK createAuthServer().getSession()
 *     → neon_auth.user.id
 *     → public.users.neon_auth_id
 *     → UserSession complet (compatible RBAC existant)
 *     → next()
 *
 * Garanties :
 *   - Aucune création de compte GIE TAIBA.
 *   - 401 si session Neon absente/invalide.
 *   - 403 si identité Neon non reconnue dans GIE TAIBA.
 *   - req.user conforme à l'interface UserSession (role, active, clientId, etc.).
 */
export const requireNeonAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const neonAuthUrl = process.env.NEON_AUTH_URL;
    if (!neonAuthUrl) {
      res.status(500).json({ error: 'Configuration serveur incomplète (NEON_AUTH_URL manquant).', code: 'CONFIG_ERROR' });
      return;
    }

    // cookieSecret est requis (min 32 chars) pour signer le cookie de cache session_data.
    // Doit être une variable d'environnement indépendante de SESSION_SECRET.
    const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;
    if (!cookieSecret || cookieSecret.length < 32) {
      res.status(500).json({
        error: 'Configuration serveur incomplète (NEON_AUTH_COOKIE_SECRET manquant ou trop court, min 32 chars).',
        code: 'CONFIG_ERROR',
      });
      return;
    }

    // Instanciation per-request — SDK gère le cache JWKS + validation crypto
    const auth = createAuthServer({
      baseUrl: neonAuthUrl,
      cookieSecret,
      context: () => createExpressRequestContext(req, res),
    });

    const sessionRes = await auth.getSession();

    // sessionRes.data est null si aucune session active ou token expiré
    if (!sessionRes?.data?.user || sessionRes.error) {
      res.status(401).json({
        error: 'Session Neon Auth absente, invalide ou expirée.',
        code: 'NEON_SESSION_INVALID',
      });
      return;
    }

    const neonUser = sessionRes.data.user;

    // ── IDENTITY BRIDGE ─────────────────────────────────────────────────────
    // Mapping strict : neon_auth_id → public.users
    // Aucun fallback email ici (réservé au PoC B5). En production, le scellement
    // doit être réalisé manuellement ou via un script de migration contrôlé.
    const result = await pool.query<{
      id: string;
      email: string;
      display_name: string | null;
      phone: string | null;
      role_id: string;
      status: string;
      active: boolean;
      client_id: string | null;
      allowed_inscription_ids: string[] | null;
    }>(
      `SELECT id, email, display_name, phone, role_id, status, active, client_id, allowed_inscription_ids
       FROM public.users
       WHERE neon_auth_id = $1
       LIMIT 1`,
      [neonUser.id]
    );

    if (result.rows.length === 0) {
      res.status(403).json({
        error: "Identité Neon Auth validée mais aucun compte GIE TAIBA autorisé (neon_auth_id non trouvé).",
        code: 'GIE_ACCOUNT_NOT_FOUND',
      });
      return;
    }

    const row = result.rows[0];

    // Contrôle du statut du compte (même règle que requireAuth)
    if (row.active === false || row.status === 'INACTIF' || row.status === 'SUSPENDU') {
      res.status(401).json({
        error: 'Ce compte GIE TAIBA a été suspendu ou désactivé.',
        code: 'ACCOUNT_DISABLED',
      });
      return;
    }

    // ── INJECTION req.user ────────────────────────────────────────────────────
    // Conforme à l'interface UserSession consommée par :
    //   - authorizationService.authorize(user, permission) → lit user.role + user.active
    //   - requirePermission()
    //   - requireStaff() → lit user.role === 'PELERIN'
    //   - routes qui lisent req.user.clientId pour l'isolation pèlerin
    const session: UserSession = {
      id:                    row.id,
      email:                 row.email,
      role:                  row.role_id,          // ← clé RBAC
      displayName:           row.display_name    ?? undefined,
      phone:                 row.phone           ?? undefined,
      clientId:              row.client_id       ?? undefined,
      allowedInscriptionIds: row.allowed_inscription_ids ?? undefined,
      active:                row.active,           // ← vérifié par authorize()
    };

    req.user = session;
    next();
  } catch (error: any) {
    console.error('[NeonAuthMiddleware] Erreur inattendue :', error);
    res.status(500).json({
      error: "Erreur interne lors de l'authentification Neon.",
      code: 'NEON_AUTH_ERROR',
    });
  }
};
