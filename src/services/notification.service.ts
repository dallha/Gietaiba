import {
  doc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { AppNotification } from '../types.js';

/**
 * Creates a notification in Firestore using an idempotency key to prevent duplicates.
 * Uses trusted server endpoint when available, with fallback to direct Firestore.
 * 
 * @param data The notification data to save
 * @returns The generated idempotency key (document ID)
 */
export const createNotification = async (
  data: Omit<AppNotification, 'isRead' | 'createdAt' | 'id'>
): Promise<string> => {
  try {
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      const resData = await response.json();
      if (resData.idempotencyKey) {
        return resData.idempotencyKey;
      }
    }
  } catch (err) {
    console.warn('API notification create failed, attempting direct Firestore write:', err);
  }

  // Direct Firestore fallback
  try {
    const rawKey = `${data.recipientUserId}_${data.type}_${data.entityId || 'global'}_${data.title}`;
    const idempotencyKey = rawKey.replace(/[\/\s]/g, '_').substring(0, 150);

    const notificationRef = doc(db, 'notifications', idempotencyKey);
    await setDoc(
      notificationRef,
      {
        ...data,
        isRead: false,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );

    return idempotencyKey;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

/**
 * Marks a single notification as read in Firestore.
 */
export const markAsRead = async (notificationId: string): Promise<void> => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, {
      isRead: true,
      readAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Marks all notifications as read in Firestore for a given recipient.
 */
export const markAllAsRead = async (
  userId: string,
  additionalRecipientId?: string
): Promise<void> => {
  try {
    const recipientIds = [userId];
    if (additionalRecipientId && additionalRecipientId !== userId) {
      recipientIds.push(additionalRecipientId);
    }

    const q = query(
      collection(db, 'notifications'),
      where('recipientUserId', 'in', recipientIds),
      where('isRead', '==', false)
    );

    const snap = await getDocs(q);
    if (snap.empty) return;

    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
      batch.update(d.ref, {
        isRead: true,
        readAt: serverTimestamp(),
      });
    });

    await batch.commit();
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};
