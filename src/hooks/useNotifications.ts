import { useState, useEffect, useCallback } from 'react';
import { AppNotification } from '../types.js';
import { useAuth } from '../auth/AuthContext.js';
import { api } from '../services/api.js';

export const useNotifications = () => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!currentUser) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      const data = await api.getNotifications();
      const notifs: AppNotification[] = Array.isArray(data) ? data : [];

      let unread = 0;
      notifs.forEach((n) => {
        if (!n.isRead) {
          unread++;
        }
      });

      // Sort descending by createdAt
      notifs.sort((a, b) => {
        const tA = new Date(a.createdAt || 0).getTime();
        const tB = new Date(b.createdAt || 0).getTime();
        return tB - tA;
      });

      setNotifications(notifs);
      setUnreadCount(unread);
    } catch (error) {
      console.warn('Erreur chargement notifications via API:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchNotifications();

    // Polling toutes les 30 secondes pour actualisation fluide
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  return { notifications, unreadCount, loading, refresh: fetchNotifications };
};
