// Shared contracts for account provisioning workflow (V1)
// Used by both backend routes and frontend API client.

export interface ProvisionStaffInput {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  roleId: string; // Must be one of: 'AGENT', 'AGENT_COMMERCIAL', 'CAISSE', 'COMPTABLE', 'LOGISTIQUE', 'RESPONSABLE_COMMERCIAL'
  clientId?: string;
  allowedInscriptionIds?: string[];
}

export interface ProvisionPilgrimInput {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  clientId: string; // REQUIRED
  allowedInscriptionIds?: string[];
}

// NOTE: neonAuthId is NEVER included in frontend-facing responses.
// Server uses it internally only (logging, audit, compensation).
export interface ProvisionResult {
  userId: string;
  email: string;
  tempPassword: string;
  role: string;
  createdAt: string;
}

export interface EmailCheckResult {
  email: string;
  available: boolean;
  existingInGie?: boolean;
}

export type ProvisionErrorCode =
  | 'EMAIL_EXISTS_IN_NEON_AUTH'
  | 'EMAIL_EXISTS_IN_GIE'
  | 'INVALID_ROLE'
  | 'CLIENT_ID_REQUIRED'
  | 'CLIENT_NOT_FOUND'
  | 'NEON_AUTH_API_ERROR'
  | 'DB_INSERT_ERROR'
  | 'COMPENSATION_FAILED'
  | 'UNAUTHORIZED'
  | 'PASSWORD_CHANGE_REQUIRED';

export interface ProvisionError {
  error: string;
  code: ProvisionErrorCode;
  details?: Record<string, unknown>;
}

export interface ProvisionPartialResult {
  status: 'partial';
  message: string;
  correlationId: string; // References audit_logs.id — NOT neonAuthId
}

/** Allowed staff roles for provisioning V1 */
export const PROVISIONED_STAFF_ROLES: readonly string[] = [
  'AGENT',
  'COMPTABLE',
  'DIRECTION',
] as const;

export const PELERIN_ROLE_ID = 'PELERIN' as const;
