import { inscriptionRepository } from '../repositories/inscription.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { Inscription, UserSession } from '../../src/types.js';

export class InscriptionService {
  public async getInscriptions(query?: { campaignId?: string; clientId?: string }): Promise<Inscription[]> {
    return inscriptionRepository.getInscriptions(query);
  }

  public async getInscriptionById(id: string): Promise<Inscription | null> {
    return inscriptionRepository.getInscriptionById(id);
  }

  public async createInscription(
    data: { clientId: string; campaignId: string; packageId: string; status?: 'CONFIRMEE' | 'EN_ATTENTE' },
    actor: UserSession
  ): Promise<Inscription> {
    const inscription = await inscriptionRepository.createInscription({
      ...data,
      agentId: actor.id,
      agentName: actor.displayName || actor.email,
    });

    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'CREATION_INSCRIPTION',
      entityType: 'INSCRIPTION',
      entityId: inscription.id,
      newValue: {
        code: inscription.code,
        clientId: inscription.clientId,
        campaignId: inscription.voyageId,
        appliedPrice: inscription.appliedPrice,
      },
    });

    return inscription;
  }

  /**
   * Price modification on an existing inscription (agreedPrice / appliedPrice).
   * Enforces mandatory justification motive and comprehensive audit trail.
   */
  public async updateInscriptionPrice(
    id: string,
    newPrice: number,
    reason: string,
    actor: UserSession
  ): Promise<Inscription> {
    if (!reason || !reason.trim()) {
      throw new Error('Le motif de modification du prix convenu est obligatoire pour la traçabilité financière.');
    }
    if (!newPrice || newPrice <= 0) {
      throw new Error('Le nouveau montant convenu doit être strictement supérieur à 0.');
    }

    const current = await inscriptionRepository.getInscriptionById(id);
    if (!current) throw new Error('Dossier d\'inscription introuvable.');

    const oldPrice = current.appliedPrice;
    const updated = await inscriptionRepository.updateInscriptionPrice(id, newPrice);

    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'MODIFICATION_PRIX_INSCRIPTION',
      entityType: 'INSCRIPTION',
      entityId: id,
      oldValue: { appliedPrice: oldPrice },
      newValue: {
        appliedPrice: newPrice,
        difference: newPrice - oldPrice,
        reason: reason.trim(),
        inscriptionCode: current.code,
      },
      reason: reason.trim(),
    });

    return updated;
  }

  public async updateInscriptionStatus(
    id: string,
    status: Inscription['status'],
    actor: UserSession
  ): Promise<Inscription> {
    const current = await inscriptionRepository.getInscriptionById(id);
    if (!current) throw new Error('Dossier d\'inscription introuvable.');

    const updated = await inscriptionRepository.updateInscriptionStatus(id, status);

    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'STATUT_INSCRIPTION',
      entityType: 'INSCRIPTION',
      entityId: id,
      oldValue: { status: current.status },
      newValue: { status: updated.status },
    });

    return updated;
  }

  /**
   * Non-destructive cancellation of an inscription (Rule 10)
   * Preserves contract history and sets status to ANNULEE with audit log.
   */
  public async cancelInscription(
    id: string,
    reason: string,
    actor: UserSession
  ): Promise<Inscription> {
    const current = await inscriptionRepository.getInscriptionById(id);
    if (!current) throw new Error('Dossier d\'inscription introuvable.');

    const updated = await inscriptionRepository.updateInscriptionStatus(id, 'ANNULEE');

    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'ANNULATION_INSCRIPTION',
      entityType: 'INSCRIPTION',
      entityId: id,
      oldValue: { status: current.status },
      newValue: { status: 'ANNULEE', reason },
      reason,
    });

    return updated;
  }

  public async deleteInscription(id: string, actor: UserSession): Promise<{ success: boolean; message: string }> {
    const current = await inscriptionRepository.getInscriptionById(id);
    if (!current) throw new Error('Dossier d\'inscription introuvable.');

    await inscriptionRepository.deleteInscription(id);

    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'SUPPRESSION_INSCRIPTION',
      entityType: 'INSCRIPTION',
      entityId: id,
      oldValue: { code: current.code, clientId: current.clientId },
    });

    return { success: true, message: `Inscription ${current.code} supprimée avec succès.` };
  }
}

export const inscriptionService = new InscriptionService();
