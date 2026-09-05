import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../firebase.js';
import { AppNotification } from '../types.js';
import { useAuth } from '../auth/AuthContext.js';

export const useNotifications = () => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    // Build recipient identifiers:
    // For pilgrims: currentUser.id and currentUser.clientId (if available)
    // For staff: currentUser.id and 'STAFF'
    const isPilgrim = currentUser.roleId === 'PILGRIM';
    const recipientIds = new Set<string>();
    if (currentUser.id) recipientIds.add(currentUser.id);
    
    if (isPilgrim) {
      if (currentUser.clientId) recipientIds.add(currentUser.clientId);
    } else {
      recipientIds.add('STAFF');
    }

    const recipientList = Array.from(recipientIds).slice(0, 10);
    if (recipientList.length === 0) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('recipientUserId', 'in', recipientList),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifs: AppNotification[] = [];
        let unread = 0;

        snapshot.forEach((doc) => {
          const data = doc.data() as AppNotification;
          data.id = doc.id;
          notifs.push(data);
          if (!data.isRead) {
            unread++;
          }
        });

        // In-memory robust sort descending by createdAt without requiring composite indexes
        notifs.sort((a, b) => {
          const getMs = (val: any) => {
            if (!val) return 0;
            if (val.toMillis) return val.toMillis();
            if (val.toDate) return val.toDate().getTime();
            if (typeof val === 'number') return val;
            return new Date(val).getTime() || 0;
          };
          return getMs(b.createdAt) - getMs(a.createdAt);
        });

        setNotifications(notifs);
        setUnreadCount(unread);
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to notifications from Firestore:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.id, currentUser?.clientId, currentUser?.roleId]);

  return { notifications, unreadCount, loading };
};
