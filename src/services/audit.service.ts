import { api } from './api.js';

export type AuditAction = 
  | 'USER_CREATED'
  | 'USER_DEACTIVATED'
  | 'USER_REACTIVATED'
  | 'USER_ROLE_CHANGED'
  | 'ROLE_CREATED'
  | 'ROLE_UPDATED'
  | 'ROLE_PERMISSIONS_UPDATED'
  | 'PILGRIM_ACCOUNT_CREATED'
  | 'PILGRIM_CLIENT_LINKED'
  | 'PILGRIM_LINK_REVOKED'
  | 'PILGRIM_DOSSIERS_UPDATED'
  | 'PAYMENT_CREATED'
  | 'PAYMENT_CANCELLED'
  | 'PACKAGE_PRICE_UPDATED'
  | 'PACKAGE_PRICE_VERSIONED'
  | 'PRICE_MODIFIED'
  | 'AGREED_PRICE_CHANGED'
  | 'CAMPAIGN_CREATED'
  | 'CAMPAIGN_UPDATED'
  | 'CAMPAIGN_DELETED'
  | 'PACKAGE_CREATED'
  | 'PACKAGE_UPDATED'
  | 'PACKAGE_DELETED'
  | 'SENSITIVE_DOCUMENT_ACCESSED'
  | string;

export const logAudit = async (
  _actorUid: string,
  _actorRole: string,
  action: AuditAction,
  entityType: string,
  entityId: string,
  metadata?: any
) => {
  try {
    await api.createAuditLog({
      action,
      entityType,
      entityId,
      metadata: metadata || null,
    });
  } catch (error) {
    console.error('Failed to log audit event to Neon:', error);
  }
};

/**
 * Mandatory trigger for logging price modification on inscriptions (agreedPrice / appliedPrice).
 * Enforces recording old amount, new amount, price difference, and mandatory motive/reason.
 */
export const logPriceModificationAudit = async (
  actorUid: string,
  actorRole: string,
  inscriptionId: string,
  inscriptionCode: string,
  oldPrice: number,
  newPrice: number,
  reason: string,
  clientName?: string
) => {
  return logAudit(
    actorUid,
    actorRole,
    'PRICE_MODIFIED',
    'INSCRIPTION',
    inscriptionId,
    {
      inscriptionCode,
      clientName,
      oldPrice,
      newPrice,
      difference: newPrice - oldPrice,
      reason: reason.trim(),
      modifiedAt: new Date().toISOString()
    }
  );
};

export const logCampaignAudit = async (
  actorUid: string,
  actorRole: string,
  action: 'CAMPAIGN_CREATED' | 'CAMPAIGN_UPDATED' | 'CAMPAIGN_DELETED',
  campaignId: string,
  details: any
) => {
  return logAudit(actorUid, actorRole, action, 'CAMPAIGN', campaignId, details);
};

export const logPackageAudit = async (
  actorUid: string,
  actorRole: string,
  action: 'PACKAGE_CREATED' | 'PACKAGE_UPDATED' | 'PACKAGE_DELETED' | 'PACKAGE_PRICE_VERSIONED',
  packageId: string,
  details: any
) => {
  return logAudit(actorUid, actorRole, action, 'PACKAGE', packageId, details);
};
