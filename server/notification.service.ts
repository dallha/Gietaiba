import { adminDb } from './firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './db.js';

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

    // 1. Resolve user ID if only clientId is provided
    if (!recipientUserId && data.recipientClientId) {
      try {
        const usersSnap = await adminDb.collection('users')
          .where('clientId', '==', data.recipientClientId)
          .limit(1)
          .get();
        
        if (!usersSnap.empty) {
          recipientUserId = usersSnap.docs[0].id;
        }
      } catch (err) {
        console.warn('Could not query users collection in Firestore:', err);
      }

      // If still not resolved from Firestore, check memory/database users
      if (!recipientUserId) {
        const localUser = db.getUsers().find((u) => u.clientId === data.recipientClientId);
        if (localUser) {
          recipientUserId = localUser.id;
        } else {
          // Direct fallback to recipientClientId so the client can query by recipientClientId
          recipientUserId = data.recipientClientId;
        }
      }
    }

    if (!recipientUserId) {
      console.log(`Could not find recipientUserId for notification: ${data.title}`);
      return "";
    }

    // 2. Generate deterministic idempotency key to prevent duplicates
    let idempotencyKey = data.idempotencyKey;
    if (!idempotencyKey) {
      const rawKey = `${recipientUserId}_${data.type}_${data.entityType || 'ent'}_${data.entityId || 'none'}`;
      idempotencyKey = rawKey.replace(/[\/\s]/g, '_').substring(0, 150);
    }

    const notificationRef = adminDb.collection('notifications').doc(idempotencyKey);
    const existingDoc = await notificationRef.get();

    if (existingDoc.exists) {
      // If notification already exists with this idempotency key, do not overwrite if already read
      const existingData = existingDoc.data();
      if (existingData?.isRead) {
        return idempotencyKey;
      }
    }
    
    await notificationRef.set({
      id: idempotencyKey,
      recipientUserId,
      recipientClientId: data.recipientClientId || null,
      inscriptionId: data.inscriptionId || null,
      type: data.type,
      category: data.category,
      title: data.title,
      message: data.message,
      entityType: data.entityType || null,
      entityId: data.entityId || null,
      priority: data.priority || 'MEDIUM',
      actionUrl: data.actionUrl || null,
      metadata: data.metadata || {},
      isRead: false,
      readAt: null,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return idempotencyKey;
  } catch (error) {
    console.error("Error creating server notification:", error);
    // Return empty string to prevent crashing the main API flow
    return "";
  }
};
