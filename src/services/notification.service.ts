import { AppNotification } from '../types.js';
import { api } from './api.js';

/**
 * Creates a notification in Neon PostgreSQL via the central REST API.
 * Uses an idempotency key to prevent duplicates.
 * 
 * @param data The notification data to save
 * @returns The generated idempotency key
 */
export const createNotification = async (
  data: Omit<AppNotification, 'isRead' | 'createdAt' | 'id'>
): Promise<string> => {
  try {
    const res = await api.createNotification(data);
    return res.idempotencyKey || '';
  } catch (error) {
    console.error('Error creating notification via API:', error);
    return '';
  }
};

/**
 * Marks a single notification as read.
 */
export const markAsRead = async (notificationId: string): Promise<void> => {
  try {
    await api.markNotificationAsRead(notificationId);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Marks all notifications as read for the authenticated user.
 */
export const markAllAsRead = async (
  _userId?: string,
  _additionalRecipientId?: string
): Promise<void> => {
  try {
    await api.markAllNotificationsAsRead();
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};
