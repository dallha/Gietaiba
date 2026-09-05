import { visaRepository } from '../repositories/visa.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { notificationRepository } from '../repositories/notification.repository.js';
import { Visa, UserSession } from '../../src/types.js';

export class VisaService {
  public async getVisas(campaignId?: string): Promise<Visa[]> {
    return visaRepository.getVisas(campaignId);
  }

  public async updateVisa(id: string, updates: Partial<Visa>, actor: UserSession): Promise<Visa> {
    const updated = await visaRepository.updateVisa(id, updates);

    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'MODIFICATION_VISA',
      entityType: 'VISA',
      entityId: id,
      newValue: { status: updated.status, visaNumber: updated.visaNumber },
    });

    if (updated.status === 'APPROUVE') {
      await notificationRepository.createNotification({
        recipientClientId: updated.clientId,
        inscriptionId: updated.inscriptionId,
        type: 'VISA_AVAILABLE',
        category: 'LOGISTICS',
        title: 'Visa officiel délivré',
        message: 'Votre visa pour le Royaume d\'Arabie Saoudite a été validé par le Ministère et est disponible.',
        entityType: 'visa',
        entityId: updated.id,
        priority: 'HIGH',
        actionUrl: 'dossier',
      });
    }

    return updated;
  }
}

export const visaService = new VisaService();
