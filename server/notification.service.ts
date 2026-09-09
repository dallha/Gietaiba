import { notificationRepository } from './repositories/notification.repository.js';
import { userRepository } from './repositories/user.repository.js';

export interface AdminNotificationData {
  recipientUserId?: string;
  recipientClientId?: string;
  inscriptionId?: string;
  type: string;
  category: 'SYSTEM' | 'PAYMENT' | 'DOCUMENT' | 'LOGISTICS' | 'GENERAL';
  title: string;
  message: string;
  entityType?: 'payment' | 'document' | 'visa' | 'flight' | 'hotel' | 'inscription' | 'client';
  entityId?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  actionUrl?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

export const sendNotification = async (data: AdminNotificationData): Promise<string> => {
  try {
    let recipientUserId = data.recipientUserId;

    if (!recipientUserId && data.recipientClientId) {
      const localUser = await userRepository.getUserByClientId(data.recipientClientId);
      if (localUser) {
        recipientUserId = localUser.id;
      }
    }

    return await notificationRepository.createNotification({
      ...data,
      recipientUserId,
    });
  } catch (error) {
    console.error("Error creating server notification in Neon:", error);
    return "";
  }
};
