import { documentRepository } from '../repositories/document.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { notificationRepository } from '../repositories/notification.repository.js';
import { PilgrimDocument, UserSession } from '../../src/types.js';

export interface PassportValidityResult {
  isValid: boolean;
  marginMonths: number;
  requiredMonths: number;
  message: string;
}

export class DocumentService {
  public async getDocuments(query?: { clientId?: string; inscriptionId?: string }): Promise<PilgrimDocument[]> {
    return documentRepository.getDocuments(query);
  }

  /**
   * Contrôle configurable de la validité du passeport par rapport à la date de fin de séjour (Correction 4).
   * Vérifie que la validité résiduelle est strictement supérieure ou égale à requiredValidityMonths (par défaut 6 mois).
   */
  public validatePassportValidity(
    passportExpiryStr: string,
    campaignEndDateStr: string,
    requiredValidityMonths: number = 6
  ): PassportValidityResult {
    const expiry = new Date(passportExpiryStr);
    const returnDate = new Date(campaignEndDateStr);

    if (isNaN(expiry.getTime()) || isNaN(returnDate.getTime())) {
      throw new Error('Dates de passeport ou de retour de campagne invalides.');
    }

    // Calcul de l'écart exact en mois
    const diffMs = expiry.getTime() - returnDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const marginMonths = diffDays / 30.4375; // moyenne jours par mois

    const isValid = marginMonths >= requiredValidityMonths;

    if (!isValid) {
      return {
        isValid: false,
        marginMonths: Math.round(marginMonths * 10) / 10,
        requiredMonths: requiredValidityMonths,
        message: `PASSPORT_EXPIRING_SOON: Le passeport expire le ${passportExpiryStr}, soit ${(Math.round(marginMonths * 10) / 10)} mois après la fin du voyage (${campaignEndDateStr}). Une marge minimale de ${requiredValidityMonths} mois est obligatoire pour l'obtention du visa saoudien.`,
      };
    }

    return {
      isValid: true,
      marginMonths: Math.round(marginMonths * 10) / 10,
      requiredMonths: requiredValidityMonths,
      message: `Passeport conforme (${Math.round(marginMonths * 10) / 10} mois de validité résiduelle).`,
    };
  }

  public async createDocument(
    data: Omit<PilgrimDocument, 'id' | 'createdAt'>,
    actor: UserSession
  ): Promise<PilgrimDocument> {
    const doc = await documentRepository.createDocument(data);

    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'AJOUT_DOCUMENT',
      entityType: 'DOCUMENT',
      entityId: doc.id,
      newValue: { type: doc.type, fileName: doc.fileName, clientId: doc.clientId },
    });

    return doc;
  }

  public async updateDocumentStatus(
    id: string,
    status: PilgrimDocument['status'],
    comment: string | undefined,
    actor: UserSession
  ): Promise<PilgrimDocument> {
    if (status === 'REFUSE' && (!comment || !comment.trim())) {
      throw new Error('Un motif de rejet est obligatoire pour tout document refusé.');
    }

    const updated = await documentRepository.updateDocumentStatus(
      id,
      status,
      comment,
      actor.displayName || actor.email
    );

    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'VALIDATION_DOCUMENT',
      entityType: 'DOCUMENT',
      entityId: id,
      newValue: { status, comment },
      reason: comment,
    });

    // Notifications selon le statut
    if (status === 'VALIDE') {
      await notificationRepository.createNotification({
        recipientClientId: updated.clientId,
        inscriptionId: updated.inscriptionId,
        type: 'DOCUMENT_VALIDATED',
        category: 'DOCUMENT',
        title: `Pièce validée : ${updated.fileName || updated.type}`,
        message: 'Votre document a été examiné et validé par l’équipe Taiba Voyages.',
        entityType: 'document',
        entityId: updated.id,
        priority: 'MEDIUM',
        actionUrl: 'documents',
      });
    } else if (status === 'REFUSE') {
      await notificationRepository.createNotification({
        recipientClientId: updated.clientId,
        inscriptionId: updated.inscriptionId,
        type: 'DOCUMENT_REJECTED',
        category: 'DOCUMENT',
        title: `Pièce rejetée : ${updated.fileName || updated.type}`,
        message: `Votre document n'a pas été accepté. Motif : ${comment || 'Non conforme'}.`,
        entityType: 'document',
        entityId: updated.id,
        priority: 'HIGH',
        actionUrl: 'documents',
      });
    }

    return updated;
  }
}

export const documentService = new DocumentService();
