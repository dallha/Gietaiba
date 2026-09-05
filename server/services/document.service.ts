import { documentRepository } from '../repositories/document.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { notificationRepository } from '../repositories/notification.repository.js';
import { PilgrimDocument, UserSession } from '../../src/types.js';

export class DocumentService {
  public async getDocuments(query?: { clientId?: string; inscriptionId?: string }): Promise<PilgrimDocument[]> {
    return documentRepository.getDocuments(query);
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
