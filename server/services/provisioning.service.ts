import crypto from 'node:crypto';
import { pool } from '../db/neon.js';
import { auditRepository } from '../repositories/audit.repository.js';
import type { Request } from 'express';
import {
  PROVISIONED_STAFF_ROLES,
  PELERIN_ROLE_ID,
  type ProvisionStaffInput,
  type ProvisionPilgrimInput,
  type ProvisionResult,
  type EmailCheckResult,
  type ProvisionErrorCode,
  type ProvisionPartialResult,
} from '../../contracts/provisioning.js';

// ── Error types ──────────────────────────────────────────────────────

export class ProvisionError extends Error {
  constructor(public code: ProvisionErrorCode, message: string) {
    super(message);
    this.name = 'ProvisionError';
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Validate and return the NEON_AUTH_URL at startup — fail-fast if missing or not HTTPS */
function getNeonAuthUrl(): string {
  const url = process.env.NEON_AUTH_URL;
  if (!url) {
    throw new Error('FATAL: NEON_AUTH_URL environment variable is required');
  }
  if (!url.startsWith('https://')) {
    throw new Error('FATAL: NEON_AUTH_URL must use HTTPS protocol');
  }
  return url.replace(/\/+$/, ''); // strip trailing slash
}

/** Validate email format */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Generate a secure random password.
 * - crypto.randomBytes for entropy
 * - Enforces mixed case + digits
 * - Length between 12 and 20 characters
 */
export function generateSecurePassword(length = 16): string {
  const clamped = Math.max(12, Math.min(20, length));

  // Generate raw bytes, encode as alphanumeric
  const raw = crypto.randomBytes(clamped);
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < clamped; i++) {
    password += ALPHABET[raw[i] % ALPHABET.length];
  }

  // Ensure at least one uppercase, one lowercase, one digit
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);

  if (!hasUpper) {
    const positions = [0, 1, 2];
    const pick = positions[crypto.randomInt(positions.length)];
    password = password.substring(0, pick) + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[crypto.randomInt(26)] + password.substring(pick + 1);
  }
  if (!hasLower) {
    const positions = [3, 4, 5];
    const pick = positions[crypto.randomInt(positions.length)];
    const safePick = Math.min(pick, clamped - 1);
    password = password.substring(0, safePick) + 'abcdefghijklmnopqrstuvwxyz'[crypto.randomInt(26)] + password.substring(safePick + 1);
  }
  if (!hasDigit) {
    const positions = [6, 7, 8];
    const pick = positions[crypto.randomInt(positions.length)];
    const safePick = Math.min(pick, clamped - 1);
    password = password.substring(0, safePick) + '0123456789'[crypto.randomInt(10)] + password.substring(safePick + 1);
  }

  return password;
}

// ── Neon Auth Admin API calls ────────────────────────────────────────

async function callNeonAdminCreateUser(
  cookieHeader: string,
  body: { email: string; password: string; name: string; role?: string; emailVerified?: boolean; data?: Record<string, unknown> },
  reqOrigin?: string
): Promise<{ id: string; email: string }> {
  const neonAuthUrl = getNeonAuthUrl();
  const origin = reqOrigin || process.env.APP_URL || 'https://gietaiba.onrender.com';

  const response = await fetch(`${neonAuthUrl}/admin/create-user`, {
    method: 'POST',
    redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader,
      'Origin': origin,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const responseBody = await response.text(); // logged server-side ONLY
    console.error('[Provisioning] Neon Auth create-user failed', {
      status: response.status,
      body: responseBody,
    });

    if (response.status === 403) {
      throw new ProvisionError('UNAUTHORIZED', 'Session Neon Auth invalide ou privilèges insuffisants.');
    }
    if (response.status === 409 || responseBody.includes('already') || responseBody.includes('exist')) {
      throw new ProvisionError('EMAIL_EXISTS_IN_NEON_AUTH', `Un compte existe déjà pour ${body.email}`);
    }
    // Generic message to client — raw Neon Auth body never leaked
    throw new ProvisionError('NEON_AUTH_API_ERROR', `Erreur lors de la création du compte. Code: ${response.status}`);
  }

  const result = await response.json();
  return { id: result.user.id, email: result.user.email };
}

async function callNeonAdminRemoveUser(
  cookieHeader: string,
  userId: string,
  reqOrigin?: string
): Promise<void> {
  const neonAuthUrl = getNeonAuthUrl();
  const origin = reqOrigin || process.env.APP_URL || 'https://gietaiba.onrender.com';

  const response = await fetch(`${neonAuthUrl}/admin/remove-user`, {
    method: 'POST',
    redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader,
      'Origin': origin,
    },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('[Provisioning] Neon Auth remove-user failed', {
      status: response.status,
      body,
      userId,
    });
    throw new Error(`remove-user returned ${response.status}`);
  }
}

async function callNeonAdminRequestPasswordReset(cookieHeader: string, email: string, origin: string) {
  const neonAuthUrl = getNeonAuthUrl();
  const res = await fetch(`${neonAuthUrl}/request-password-reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader, 'Origin': origin },
    body: JSON.stringify({ email, redirectUrl: `${origin}/reset-password` })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`request-password-reset returned ${res.status} - ${text}`);
  }
}

async function callNeonAdminSetUserPassword(cookieHeader: string, userId: string, password: string, origin: string) {
  const neonAuthUrl = getNeonAuthUrl();
  const res = await fetch(`${neonAuthUrl}/admin/set-user-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader, 'Origin': origin },
    body: JSON.stringify({ userId, newPassword: password })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`set-user-password returned ${res.status} - ${text}`);
  }
}

async function callNeonAdminRevokeUserSessions(cookieHeader: string, userId: string, origin: string) {
  const neonAuthUrl = getNeonAuthUrl();
  const res = await fetch(`${neonAuthUrl}/admin/revoke-user-sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader, 'Origin': origin },
    body: JSON.stringify({ userId })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`revoke-user-sessions returned ${res.status} - ${text}`);
  }
}

// ── Compensation with re-check ───────────────────────────────────────

async function compensateNeonUser(
  cookieHeader: string,
  neonAuthId: string,
  userId: string
): Promise<void> {
  // Re-check: does the public.users row actually exist?
  const check = await pool.query(
    'SELECT 1 FROM users WHERE neon_auth_id = $1',
    [neonAuthId]
  );

  if (check.rows.length > 0) {
    // The row DOES exist — INSERT may have succeeded with a transient error.
    // Do NOT remove the Neon user — that would create an orphan.
    console.warn('[Provisioning] Compensation skipped: public.users row exists after INSERT failure', {
      neonAuthId,
      userId,
    });
    return;
  }

  // Confirmed: users row is absent — safe to remove Neon user
  await callNeonAdminRemoveUser(cookieHeader, neonAuthId);
}

// ── Internal provisioning core ───────────────────────────────────────

interface ProvisionInput {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  roleId: string;
  clientId?: string;
  allowedInscriptionIds?: string[];
  auditAction: string;
}

async function provisionCore(
  req: Request,
  input: ProvisionInput
): Promise<ProvisionResult> {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    throw new ProvisionError('UNAUTHORIZED', 'Session Neon Auth manquante.');
  }

  // Actor info from authenticated session
  const actorId = req.user?.id;
  const actorName = req.user?.displayName || req.user?.email || 'unknown';

  // 1. Normalize & validate email
  const email = input.email.toLowerCase().trim();
  if (!email || !isValidEmail(email)) {
    throw new ProvisionError('INVALID_ROLE', 'Format email invalide.');
  }
  if (!input.firstName?.trim() || !input.lastName?.trim()) {
    throw new ProvisionError('INVALID_ROLE', 'Prénom et nom sont requis.');
  }

  // 2. Validate role
  if (input.roleId === PELERIN_ROLE_ID) {
    // Pilgrim validation handled by caller — just ensure clientId
    if (!input.clientId) {
      throw new ProvisionError('CLIENT_ID_REQUIRED', 'Un identifiant client est requis pour un compte pèlerin.');
    }
  } else if (!PROVISIONED_STAFF_ROLES.includes(input.roleId)) {
    throw new ProvisionError('INVALID_ROLE', `Rôle invalide: ${input.roleId}`);
  }

  // 3. Validate clientId if provided and role is not PILGRIM (already required above)
  if (input.clientId) {
    const clientCheck = await pool.query('SELECT 1 FROM clients WHERE id = $1', [input.clientId]);
    if (clientCheck.rows.length === 0) {
      throw new ProvisionError('CLIENT_NOT_FOUND', `Client introuvable: ${input.clientId}`);
    }
  }

  // 4. Validate allowedInscriptionIds
  if (input.allowedInscriptionIds !== undefined) {
    if (!Array.isArray(input.allowedInscriptionIds) || !input.allowedInscriptionIds.every(id => typeof id === 'string' && id.length > 0)) {
      throw new ProvisionError('INVALID_ROLE', 'allowedInscriptionIds doit être un tableau de chaînes non vides.');
    }
  }

  // 5. Check email availability in public.users
  const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (emailCheck.rows.length > 0) {
    throw new ProvisionError('EMAIL_EXISTS_IN_GIE', `Un compte existe déjà pour ${email}`);
  }

  // 6. Generate temp password
  const tempPassword = generateSecurePassword(16);

  // 7. Create Neon Auth identity
  const displayName = `${input.firstName.trim()} ${input.lastName.trim()}`;
  const neonUser = await callNeonAdminCreateUser(
    cookieHeader,
    {
      email,
      password: tempPassword,
      name: displayName,
      emailVerified: true,
    },
    req.headers.origin
  );

  // 8. Insert public.users row
  const userId = `usr-${Date.now()}`;
  const passwordHash = crypto.randomBytes(32).toString('hex');

  try {
    await pool.query(
      `INSERT INTO users (
        id, email, display_name, phone, password_hash, role_id, status, active,
        client_id, allowed_inscription_ids, neon_auth_id, must_change_password,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'ACTIF', true, $7, $8, $9, true, NOW(), NOW())`,
      [
        userId,
        email,
        displayName,
        input.phone || null,
        passwordHash,
        input.roleId,
        input.clientId || null,
        input.allowedInscriptionIds || null,
        neonUser.id,
      ]
    );
  } catch (insertError) {
    console.error('[Provisioning] INSERT public.users failed', {
      userId,
      email,
      roleId: input.roleId,
      error: insertError instanceof Error ? insertError.message : String(insertError),
    });

    // Compensation with re-check: only remove Neon user if row is confirmed absent
    try {
      await compensateNeonUser(cookieHeader, neonUser.id, userId);
    } catch (compensationError) {
      // Compensation itself failed — CRITICAL: Neon user exists, no DB row
      console.error('[Provisioning] CRITICAL: Compensation failed — manual intervention required', {
        neonAuthId: neonUser.id,
        email,
        userId,
        compensationError: compensationError instanceof Error ? compensationError.message : String(compensationError),
      });

      // Audit log with full details (server-side only)
      let correlationId: string;
      try {
        const auditEntry = await auditRepository.logAudit({
          actorUserId: actorId || 'system',
          actorUserName: actorName,
          action: input.auditAction,
          entityType: 'USER',
          entityId: userId,
          newValue: { email, role: input.roleId, clientId: input.clientId, compensationStatus: 'FAILED' },
        });
        correlationId = auditEntry.id;
      } catch {
        correlationId = `log-${Date.now()}-audit-failed`;
      }

      const partialResult: ProvisionPartialResult = {
        status: 'partial',
        message: 'Compte partiellement créé. Intervention manuelle requise.',
        correlationId,
      };
      // Throw with 207 status hint — caller handles the HTTP status
      const err = new ProvisionError('COMPENSATION_FAILED', JSON.stringify(partialResult));
      (err as any).statusCode = 207;
      throw err;
    }

    throw new ProvisionError('DB_INSERT_ERROR', 'Erreur lors de la création du compte utilisateur.');
  }

  // 9. Insert user_roles
  try {
    await pool.query(
      'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, input.roleId]
    );
  } catch (roleError) {
    console.error('[Provisioning] INSERT user_roles failed', {
      userId,
      roleId: input.roleId,
      error: roleError instanceof Error ? roleError.message : String(roleError),
    });
    // Non-fatal for the user — log and continue. User exists but has no role mapping.
  }

  // 10. Audit log
  try {
    await auditRepository.logAudit({
      actorUserId: actorId || 'system',
      actorUserName: actorName,
      action: input.auditAction,
      entityType: 'USER',
      entityId: userId,
      newValue: { email, role: input.roleId, clientId: input.clientId },
    });
  } catch (auditError) {
    // Audit log failure is non-fatal
    console.error('[Provisioning] Audit log failed', {
      userId,
      action: input.auditAction,
      error: auditError instanceof Error ? auditError.message : String(auditError),
    });
  }

  // 11. Return result — tempPassword included ONLY in response, NEVER logged, NEVER stored
  const result: ProvisionResult = {
    userId,
    email,
    tempPassword,
    role: input.roleId,
    createdAt: new Date().toISOString(),
  };

  return result;
}

// ── Public service ───────────────────────────────────────────────────

class ProvisioningService {
  /**
   * Provision a staff account (agent, caisse, comptable, etc.)
   * Creates Neon Auth identity + public.users row + user_roles.
   */
  async provisionStaff(req: Request, input: ProvisionStaffInput): Promise<ProvisionResult> {
    return provisionCore(req, {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      roleId: input.roleId,
      clientId: input.clientId,
      allowedInscriptionIds: input.allowedInscriptionIds,
      auditAction: 'STAFF_ACCOUNT_PROVISIONED',
    });
  }

  /**
   * Provision a pilgrim account.
   * Creates Neon Auth identity + public.users row + user_roles.
   * clientId is REQUIRED.
   */
  async provisionPilgrim(req: Request, input: ProvisionPilgrimInput): Promise<ProvisionResult> {
    return provisionCore(req, {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      roleId: PELERIN_ROLE_ID,
      clientId: input.clientId,
      allowedInscriptionIds: input.allowedInscriptionIds,
      auditAction: 'PILGRIM_ACCOUNT_PROVISIONED',
    });
  }

  /**
   * Check if an email is available for provisioning.
   * Returns availability status based on public.users table.
   */
  async checkEmail(email: string): Promise<EmailCheckResult> {
    const normalized = email.toLowerCase().trim();
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [normalized]);
    return {
      email: normalized,
      available: result.rows.length === 0,
      existingInGie: result.rows.length > 0,
    };
  }

  /**
   * Toggles staff account active status (ACTIF <-> INACTIF).
   * Does NOT delete Neon Auth identity. Simply prevents login and revokes access.
   */
  async toggleStaffStatus(req: Request, targetUserId: string, newActive: boolean) {
    const actorId = req.user?.id;
    if (!actorId) {
      throw new ProvisionError('UNAUTHORIZED', 'Authentification requise.');
    }

    if (actorId === targetUserId && !newActive) {
      throw new ProvisionError('UNAUTHORIZED', 'Action interdite : vous ne pouvez pas désactiver votre propre compte.');
    }

    const userRes = await pool.query(
      'SELECT id, email, display_name, role_id, status, active FROM users WHERE id = $1',
      [targetUserId]
    );
    if (userRes.rows.length === 0) {
      throw new ProvisionError('CLIENT_NOT_FOUND', 'Utilisateur introuvable.');
    }
    const target = userRes.rows[0];

    // Protection of root account and last active SUPER_ADMIN
    if (target.role_id === 'SUPER_ADMIN') {
      if (target.email.toLowerCase() === 'mr.niass@gmail.com' && !newActive) {
        throw new ProvisionError('UNAUTHORIZED', 'Action interdite : le compte racine propriétaire ne peut pas être désactivé.');
      }
      if (!newActive) {
        const countRes = await pool.query(
          "SELECT COUNT(*) as count FROM users WHERE role_id = 'SUPER_ADMIN' AND active = TRUE"
        );
        const activeAdmins = parseInt(countRes.rows[0].count, 10);
        if (activeAdmins <= 1) {
          throw new ProvisionError('UNAUTHORIZED', 'Action interdite : impossible de désactiver le dernier Super Administrateur actif.');
        }
      }
    }

    const newStatus = newActive ? 'ACTIF' : 'INACTIF';
    const updateRes = await pool.query(
      'UPDATE users SET active = $1, status = $2, updated_at = NOW() WHERE id = $3 RETURNING id, email, display_name, role_id, status, active',
      [newActive, newStatus, targetUserId]
    );

    try {
      await auditRepository.logAudit({
        actorUserId: actorId,
        actorUserName: req.user?.displayName || req.user?.email || 'admin',
        action: newActive ? 'STAFF_REACTIVATED' : 'STAFF_DEACTIVATED',
        entityType: 'USER',
        entityId: targetUserId,
        oldValue: { status: target.status, active: target.active },
        newValue: { status: newStatus, active: newActive },
      });
    } catch (auditErr) {
      console.error('[Provisioning] Audit log failed for toggleStaffStatus', auditErr);
    }

    return updateRes.rows[0];
  }

  /**
   * Definitively deprovisions a staff account:
   * 1. Checks protections (not self, not root, not last SUPER_ADMIN)
   * 2. Checks business dependencies (inscriptions, payments, expenses, audit logs)
   * 3. Revokes identity from Neon Auth
   * 4. Updates PostgreSQL:
   *    - If hasDependencies: soft deprovision (status = 'DEPROVISIONNE', active = false, neon_auth_id = NULL)
   *    - If no dependencies: hard delete from users table
   *    - Always cleans user_roles and user_client_access
   * 5. Logs audit with complete user snapshot
   */
  async deprovisionStaff(req: Request, targetUserId: string): Promise<{ success: boolean; deprovisionType: string; message: string }> {
    const actorId = req.user?.id;
    if (!actorId) {
      throw new ProvisionError('UNAUTHORIZED', 'Authentification requise.');
    }

    if (actorId === targetUserId) {
      throw new ProvisionError('UNAUTHORIZED', 'Action interdite : vous ne pouvez pas déprovisionner votre propre compte en cours d\'utilisation.');
    }

    // 1. Lock and load target user
    const userRes = await pool.query(
      'SELECT id, email, display_name, role_id, status, active, neon_auth_id FROM users WHERE id = $1',
      [targetUserId]
    );
    if (userRes.rows.length === 0) {
      throw new ProvisionError('CLIENT_NOT_FOUND', 'Utilisateur introuvable.');
    }
    const target = userRes.rows[0];

    // 2. Protections for SUPER_ADMIN & Root
    if (target.role_id === 'SUPER_ADMIN') {
      if (target.email.toLowerCase() === 'mr.niass@gmail.com') {
        throw new ProvisionError('UNAUTHORIZED', 'Action interdite : le compte racine propriétaire est protégé et ne peut pas être déprovisionné.');
      }
      const countRes = await pool.query(
        "SELECT COUNT(*) as count FROM users WHERE role_id = 'SUPER_ADMIN' AND active = TRUE"
      );
      const activeAdmins = parseInt(countRes.rows[0].count, 10);
      if (activeAdmins <= 1) {
        throw new ProvisionError('UNAUTHORIZED', 'Action interdite : impossible de déprovisionner le dernier Super Administrateur actif du système.');
      }
    }

    // 3. Check dependencies BEFORE modifying anything
    const [insRes, payRes, expRes, auditRes] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM inscriptions WHERE agent_id = $1', [targetUserId]),
      pool.query('SELECT COUNT(*) as count FROM payments WHERE agent_id = $1', [targetUserId]),
      pool.query('SELECT COUNT(*) as count FROM expenses WHERE created_by = $1', [targetUserId]),
      pool.query('SELECT COUNT(*) as count FROM audit_logs WHERE actor_user_id = $1', [targetUserId]),
    ]);

    const insCount = parseInt(insRes.rows[0].count, 10);
    const payCount = parseInt(payRes.rows[0].count, 10);
    const expCount = parseInt(expRes.rows[0].count, 10);
    const auditCount = parseInt(auditRes.rows[0].count, 10);
    const hasDependencies = (insCount + payCount + expCount) > 0;

    // 4. Capture complete snapshot for audit trail & disaster recovery
    const targetSnapshot = {
      targetUserId: target.id,
      targetEmail: target.email,
      targetDisplayName: target.display_name,
      targetRoleId: target.role_id,
      neonAuthId: target.neon_auth_id,
      insCount,
      payCount,
      expCount,
      auditCount,
      hasDependencies,
      deprovisionType: hasDependencies ? 'SOFT_DEPROVISIONED' : 'HARD_DELETED',
      timestamp: new Date().toISOString(),
    };

    // 5. Remove Neon Auth Identity (if present)
    if (target.neon_auth_id) {
      const cookieHeader = req.headers.cookie;
      if (cookieHeader) {
        try {
          await callNeonAdminRemoveUser(cookieHeader, target.neon_auth_id);
        } catch (neonErr: any) {
          const msg = String(neonErr?.message || '');
          if (msg.includes('404') || msg.includes('not found')) {
            console.warn('[Provisioning] Neon Auth user already absent, continuing DB deprovision', {
              userId: target.id,
              neonAuthId: target.neon_auth_id,
            });
          } else {
            console.error('[Provisioning] Neon Auth remove-user failed:', neonErr);
            throw new ProvisionError('NEON_AUTH_API_ERROR', `Échec de révocation dans Neon Auth (${neonErr.message}). Déprovisionnement interrompu.`);
          }
        }
      }
    }

    // 6. Execute PostgreSQL updates/deletions atomically
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM user_roles WHERE user_id = $1', [targetUserId]);
      await client.query('DELETE FROM user_client_access WHERE user_id = $1', [targetUserId]);

      if (hasDependencies) {
        // Soft delete: keep row but free the email and clear auth link
        await client.query(
          "UPDATE users SET status = 'DEPROVISIONNE', active = FALSE, neon_auth_id = NULL, email = email || '.deleted.' || extract(epoch from now())::int, updated_at = NOW() WHERE id = $1",
          [targetUserId]
        );
      } else {
        await client.query('DELETE FROM users WHERE id = $1', [targetUserId]);
      }

      await client.query('COMMIT');
    } catch (dbErr: any) {
      await client.query('ROLLBACK');
      console.error('[Provisioning] CRITICAL: DB transaction failed during deprovisioning', {
        targetUserId,
        snapshot: targetSnapshot,
        error: dbErr.message,
      });
      throw new ProvisionError('DB_INSERT_ERROR', `Erreur base de données lors du déprovisionnement : ${dbErr.message}`);
    } finally {
      client.release();
    }

    // 7. Audit log with full snapshot
    try {
      await auditRepository.logAudit({
        actorUserId: actorId,
        actorUserName: req.user?.displayName || req.user?.email || 'admin',
        action: 'STAFF_DEPROVISIONED',
        entityType: 'USER',
        entityId: targetUserId,
        oldValue: targetSnapshot,
        newValue: {
          status: hasDependencies ? 'DEPROVISIONNE' : 'DELETED',
          active: false,
          deprovisionType: targetSnapshot.deprovisionType,
        },
      });
    } catch (auditErr) {
      console.error('[Provisioning] Audit log failed for deprovisionStaff', auditErr);
    }

    return {
      success: true,
      deprovisionType: targetSnapshot.deprovisionType,
      message: hasDependencies
        ? `Compte révoqué de Neon Auth. Traces métier (${insCount} dossiers, ${payCount} paiements, ${expCount} dépenses, ${auditCount} actions) archivées sous statut DÉPROVISIONNÉ.`
        : 'Compte vierge révoqué de Neon Auth et intégralement purgé de la base de données.',
    };
  }
  async sendResetEmail(req: Request, targetUserId: string) {
    const actorId = req.user?.id;
    if (!actorId) throw new ProvisionError('UNAUTHORIZED', 'Authentification requise.');

    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) throw new ProvisionError('UNAUTHORIZED', 'Session Neon Auth manquante.');

    const userRes = await pool.query('SELECT email FROM users WHERE id = $1', [targetUserId]);
    
    if (userRes.rows.length > 0) {
      const email = userRes.rows[0].email;
      try {
        await callNeonAdminRequestPasswordReset(
          cookieHeader,
          email,
          req.headers.origin || process.env.APP_URL || 'https://gietaiba.onrender.com'
        );
        
        await auditRepository.logAudit({
          actorUserId: actorId,
          actorUserName: req.user?.displayName || req.user?.email || 'admin',
          action: 'STAFF_RESET_EMAIL_SENT',
          entityType: 'USER',
          entityId: targetUserId,
          newValue: { action: 'EMAIL_RESET_REQUESTED' },
        });
      } catch (err: any) {
        console.error('[Provisioning] Neon Auth request-password-reset failed:', err.message);
        // We do not throw to avoid enumeration, we just log it.
      }
    } else {
      console.warn(`[Provisioning] Reset email requested for unknown user: ${targetUserId}`);
    }

    // Always return generic success to avoid enumeration
    return { message: 'La demande de réinitialisation a été traitée.' };
  }

  async resetStaffPassword(req: Request, targetUserId: string) {
    const actorId = req.user?.id;
    if (!actorId) throw new ProvisionError('UNAUTHORIZED', 'Authentification requise.');

    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) throw new ProvisionError('UNAUTHORIZED', 'Session Neon Auth manquante.');

    const userRes = await pool.query('SELECT neon_auth_id, email FROM users WHERE id = $1', [targetUserId]);
    if (userRes.rows.length === 0) {
      throw new ProvisionError('CLIENT_NOT_FOUND', 'Utilisateur introuvable.');
    }
    const target = userRes.rows[0];
    if (!target.neon_auth_id) {
      throw new ProvisionError('INVALID_STATE', 'Ce compte ne possède pas d\'identité Neon Auth.');
    }

    const tempPassword = generateSecurePassword(16);
    const origin = req.headers.origin || process.env.APP_URL || 'https://gietaiba.onrender.com';

    try {
      await callNeonAdminSetUserPassword(cookieHeader, target.neon_auth_id, tempPassword, origin);
      
      // Auto-révocation des sessions existantes (recommandation sécurité V2.3)
      try {
        await callNeonAdminRevokeUserSessions(cookieHeader, target.neon_auth_id, origin);
      } catch (revokeErr) {
        console.warn('[Provisioning] Impossible de révoquer les sessions après reset MDP:', revokeErr.message);
      }
      
      await pool.query('UPDATE users SET must_change_password = TRUE, updated_at = NOW() WHERE id = $1', [targetUserId]);

      await auditRepository.logAudit({
        actorUserId: actorId,
        actorUserName: req.user?.displayName || req.user?.email || 'admin',
        action: 'STAFF_PASSWORD_RESET_BY_ADMIN',
        entityType: 'USER',
        entityId: targetUserId,
        newValue: { action: 'TEMP_PASSWORD_GENERATED', must_change_password: true },
      });

      return {
        success: true,
        temporaryPassword: tempPassword,
        mustChangePassword: true
      };
    } catch (err: any) {
      console.error('[Provisioning] Neon Auth set-user-password failed:', err.message);
      throw new ProvisionError('NEON_AUTH_API_ERROR', 'Erreur lors de la génération du mot de passe temporaire.');
    }
  }

  async revokeStaffSessions(req: Request, targetUserId: string) {
    const actorId = req.user?.id;
    if (!actorId) throw new ProvisionError('UNAUTHORIZED', 'Authentification requise.');

    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) throw new ProvisionError('UNAUTHORIZED', 'Session Neon Auth manquante.');

    const userRes = await pool.query('SELECT neon_auth_id FROM users WHERE id = $1', [targetUserId]);
    if (userRes.rows.length === 0) {
      throw new ProvisionError('CLIENT_NOT_FOUND', 'Utilisateur introuvable.');
    }
    const target = userRes.rows[0];
    if (!target.neon_auth_id) {
      throw new ProvisionError('INVALID_STATE', 'Ce compte ne possède pas d\'identité Neon Auth.');
    }

    const origin = req.headers.origin || process.env.APP_URL || 'https://gietaiba.onrender.com';

    try {
      await callNeonAdminRevokeUserSessions(cookieHeader, target.neon_auth_id, origin);

      await auditRepository.logAudit({
        actorUserId: actorId,
        actorUserName: req.user?.displayName || req.user?.email || 'admin',
        action: 'STAFF_SESSIONS_REVOKED',
        entityType: 'USER',
        entityId: targetUserId,
        newValue: { action: 'SESSIONS_REVOKED' },
      });

      return { message: 'Sessions révoquées.' };
    } catch (err: any) {
      console.error('[Provisioning] Neon Auth revoke-user-sessions failed:', err.message);
      throw new ProvisionError('NEON_AUTH_API_ERROR', 'Erreur lors de la révocation des sessions.');
    }
  }

}

export const provisioningService = new ProvisioningService();
