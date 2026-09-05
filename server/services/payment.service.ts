import { paymentRepository } from '../repositories/payment.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { notificationRepository } from '../repositories/notification.repository.js';
import { Payment, UserSession } from '../../src/types.js';

export class PaymentService {
  public async getPayments(query?: {
    clientId?: string;
    inscriptionId?: string;
    campaignId?: string;
  }): Promise<Payment[]> {
    return paymentRepository.getPayments(query);
  }

  public async getPaymentById(id: string): Promise<Payment | null> {
    return paymentRepository.getPaymentById(id);
  }

  public async createPayment(
    data: {
      clientId: string;
      inscriptionId: string;
      amount: number;
      paymentMethod: string;
      reference?: string;
      comment?: string;
      paymentDate?: string;
    },
    actor: UserSession
  ): Promise<Payment> {
    const payment = await paymentRepository.createPayment({
      ...data,
      agentId: actor.id,
      agentName: actor.displayName || actor.email,
    });

    // 1. Audit log systématique
    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'ENREGISTREMENT_PAIEMENT',
      entityType: 'PAYMENT',
      entityId: payment.id,
      newValue: {
        receiptNumber: payment.receiptNumber,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        clientId: payment.clientId,
        inscriptionId: payment.inscriptionId,
      },
    });

    // 2. Notification pèlerin
    await notificationRepository.createNotification({
      recipientClientId: payment.clientId,
      inscriptionId: payment.inscriptionId,
      type: 'PAYMENT_VALIDATED',
      category: 'PAYMENT',
      title: `Paiement validé : ${payment.amount.toLocaleString('fr-FR')} FCFA`,
      message: `Votre versement de ${payment.amount.toLocaleString('fr-FR')} FCFA (${payment.paymentMethod}) a été validé. Reçu officiel n° ${payment.receiptNumber}.`,
      entityType: 'payment',
      entityId: payment.id,
      priority: 'HIGH',
      actionUrl: 'finances',
    });

    return payment;
  }

  public async cancelPayment(
    paymentId: string,
    reason: string,
    actor: UserSession
  ): Promise<Payment> {
    const canceled = await paymentRepository.cancelPayment(
      paymentId,
      reason,
      actor.id,
      actor.displayName || actor.email
    );

    // 1. Audit log systématique de l'annulation
    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'ANNULATION_PAIEMENT',
      entityType: 'PAYMENT',
      entityId: paymentId,
      newValue: {
        receiptNumber: canceled.receiptNumber,
        amount: canceled.amount,
        reason: reason.trim(),
        status: 'ANNULE',
      },
      reason: reason.trim(),
    });

    // 2. Notification pèlerin
    await notificationRepository.createNotification({
      recipientClientId: canceled.clientId,
      inscriptionId: canceled.inscriptionId,
      type: 'PAYMENT_CANCELLED',
      category: 'PAYMENT',
      title: 'Paiement annulé',
      message: `Le versement n° ${canceled.receiptNumber} a été annulé par la direction. Motif : ${reason.trim()}.`,
      entityType: 'payment',
      entityId: canceled.id,
      priority: 'HIGH',
      actionUrl: 'finances',
    });

    return canceled;
  }
}

export const paymentService = new PaymentService();
