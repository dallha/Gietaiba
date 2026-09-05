import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCheck,
  CreditCard,
  FileText,
  Clock,
  ChevronRight,
  X,
  Plane,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { AppNotification } from '../../types.js';
import { useNotifications } from '../../hooks/useNotifications.js';
import { markAsRead, markAllAsRead } from '../../services/notification.service.js';
import { useAuth } from '../../auth/AuthContext.js';

interface NotificationBellProps {
  onNavigate: (module: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  onNavigate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'OPERATION' | 'ADMIN'>('ALL');

  const { currentUser } = useAuth();
  const { notifications, unreadCount } = useNotifications();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'OPERATION') {
      return n.category === 'PAYMENT' || n.category === 'DOCUMENT' || n.category === 'LOGISTICS';
    }
    if (activeFilter === 'ADMIN') {
      return n.category === 'SYSTEM' || n.category === 'GENERAL' || n.priority === 'HIGH';
    }
    return true;
  });

  const handleNotificationClick = async (notif: AppNotification) => {
    if (notif.id && !notif.isRead) {
      try {
        await markAsRead(notif.id);
      } catch (err) {
        console.error('Error marking as read:', err);
      }
    }
    setIsOpen(false);
    if (notif.actionUrl) {
      onNavigate(notif.actionUrl);
    } else if (notif.category === 'PAYMENT') {
      onNavigate('paiements');
    } else if (notif.category === 'DOCUMENT') {
      onNavigate('documents');
    } else if (notif.category === 'LOGISTICS') {
      onNavigate('logistique');
    }
  };

  const handleMarkAllAsRead = async () => {
    if (currentUser?.id) {
      try {
        await markAllAsRead(currentUser.id, currentUser.clientId);
      } catch (err) {
        console.error('Error marking all as read:', err);
      }
    }
  };

  const formatTimeAgo = (dateVal: any) => {
    try {
      let date: Date;
      if (!dateVal) return "À l'instant";
      if (dateVal.toDate) {
        date = dateVal.toDate();
      } else if (typeof dateVal === 'string' || typeof dateVal === 'number') {
        date = new Date(dateVal);
      } else {
        return "À l'instant";
      }

      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return "À l'instant";
      if (diffMins < 60) return `Il y a ${diffMins} min`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `Il y a ${diffHours} h`;
      const diffDays = Math.floor(diffHours / 24);
      return `Il y a ${diffDays} j`;
    } catch {
      return "Récemment";
    }
  };

  const getNotificationIcon = (notif: AppNotification) => {
    if (notif.category === 'PAYMENT') {
      return (
        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
          <CreditCard className="w-4 h-4" />
        </div>
      );
    }
    if (notif.category === 'DOCUMENT') {
      return (
        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
          <FileText className="w-4 h-4" />
        </div>
      );
    }
    if (notif.category === 'LOGISTICS') {
      return (
        <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 border border-sky-200">
          <Plane className="w-4 h-4" />
        </div>
      );
    }
    if (notif.priority === 'HIGH') {
      return (
        <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 border border-rose-200">
          <AlertTriangle className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200">
        <Info className="w-4 h-4" />
      </div>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        id="notification-bell-btn"
        aria-label="Centre de notifications et alertes"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer focus:outline-hidden"
      >
        <Bell className="w-5 h-5" />

        {/* Real-time Badge Counter from Firestore */}
        {unreadCount > 0 && (
          <span
            id="notification-badge-counter"
            className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-slate-900 shadow-sm animate-pulse"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Popover */}
      {isOpen && (
        <div
          id="notification-popover-dropdown"
          className="absolute right-0 mt-2 w-84 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden text-slate-800 animate-in fade-in-0 zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="p-4 bg-linear-to-r from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black tracking-wide uppercase">Centre de Notifications</h3>
                <p className="text-[10px] text-slate-400">
                  {unreadCount > 0 ? `${unreadCount} alerte(s) Firestore non lue(s)` : 'Toutes les alertes sont traitées'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-[10px] text-amber-300 hover:text-amber-200 font-semibold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Marquer tout comme lu dans Firestore"
                >
                  <CheckCheck className="w-3 h-3" />
                  <span>Tout lire</span>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 p-2 bg-slate-50 border-b border-slate-200 text-xs">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-center font-bold text-[11px] transition-all cursor-pointer ${
                activeFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Toutes ({notifications.length})
            </button>
            <button
              onClick={() => setActiveFilter('OPERATION')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-center font-bold text-[11px] transition-all cursor-pointer ${
                activeFilter === 'OPERATION'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Métier ({notifications.filter((n) => n.category === 'PAYMENT' || n.category === 'DOCUMENT' || n.category === 'LOGISTICS').length})
            </button>
            <button
              onClick={() => setActiveFilter('ADMIN')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-center font-bold text-[11px] transition-all cursor-pointer ${
                activeFilter === 'ADMIN'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Admin ({notifications.filter((n) => n.category === 'SYSTEM' || n.category === 'GENERAL' || n.priority === 'HIGH').length})
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-84 overflow-y-auto divide-y divide-slate-100">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <CheckCheck className="w-10 h-10 mx-auto text-emerald-500/60 mb-2" />
                <p className="text-xs font-bold text-slate-700">Aucune notification en attente</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Les nouveaux encaissements, formalités et alertes apparaîtront ici en direct.
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer hover:bg-slate-50 ${
                      !notif.isRead ? 'bg-amber-50/50 font-medium' : ''
                    }`}
                  >
                    {/* Icon */}
                    {getNotificationIcon(notif)}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{notif.title}</h4>
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-amber-600 shrink-0" title="Non lu" />
                        )}
                      </div>

                      <p className="text-[11px] text-slate-600 leading-snug mt-0.5 line-clamp-2">
                        {notif.message}
                      </p>

                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100/80">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 font-normal">
                          <Clock className="w-2.5 h-2.5" />
                          {formatTimeAgo(notif.createdAt)}
                        </span>

                        <span className="text-[10px] font-bold text-amber-700 hover:text-amber-800 inline-flex items-center gap-0.5">
                          <span>Accéder</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center text-[10px] text-slate-500 font-medium">
            Source de vérité : Firestore • Synchronisation temps réel
          </div>
        </div>
      )}
    </div>
  );
};
