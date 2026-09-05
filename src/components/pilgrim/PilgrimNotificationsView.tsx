import React from 'react';
import { 
  Bell, 
  CreditCard, 
  FileCheck2, 
  Plane, 
  CheckCircle, 
  AlertCircle, 
  Calendar, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { PilgrimTab } from './PilgrimTypes.js';
import { AppNotification } from '../../types.js';
import { formatDate } from '../../utils/format.js';

interface PilgrimNotificationsViewProps {
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onNavigateTab: (tab: PilgrimTab) => void;
}

export const PilgrimNotificationsView: React.FC<PilgrimNotificationsViewProps> = ({
  notifications,
  onNavigateTab,
  onMarkAsRead,
  onMarkAllAsRead
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Bell className="w-6 h-6 text-emerald-700" />
          <span>Centre de Notifications & Alertes</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Suivi des événements réels enregistrés sur vos formalités, versements et pièces administratives
        </p>
      </div>
      {notifications.some(n => !n.isRead) && (
        <button onClick={onMarkAllAsRead} className="text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition">
          Tout marquer comme lu
        </button>
      )}

      {notifications.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
          <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">Aucune nouvelle notification</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Dès qu'un paiement sera comptabilisé ou qu'un document sera validé par l'administration, une notification apparaîtra ici.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => {
            const getIcon = () => {
              if (notif.category === 'PAYMENT' || notif.type.includes('PAYMENT')) {
                return <CreditCard className="w-5 h-5 text-emerald-600" />;
              }
              if (notif.category === 'DOCUMENT' || notif.type.includes('DOCUMENT')) {
                if (notif.type.includes('REJECT') || notif.priority === 'HIGH') {
                  return <AlertCircle className="w-5 h-5 text-rose-600" />;
                }
                return <FileCheck2 className="w-5 h-5 text-amber-600" />;
              }
              if (notif.type.includes('VISA') || notif.type.includes('PASSPORT')) {
                return <CheckCircle className="w-5 h-5 text-blue-600" />;
              }
              if (notif.type.includes('FLIGHT') || notif.type.includes('TICKET')) {
                return <Plane className="w-5 h-5 text-indigo-600" />;
              }
              return <Bell className="w-5 h-5 text-slate-600" />;
            };

            const formattedTime = () => {
              if (!notif.createdAt) return "À l'instant";
              try {
                if (typeof (notif.createdAt as any).toDate === 'function') {
                  return formatDate((notif.createdAt as any).toDate().toISOString());
                }
                if (typeof notif.createdAt === 'string') {
                  return formatDate(notif.createdAt);
                }
              } catch {
                return '';
              }
              return '';
            };

            return (
              <div
                key={notif.id}
                className={`bg-white rounded-2xl p-4 sm:p-5 border shadow-xs flex items-start justify-between gap-4 transition ${notif.isRead ? 'border-slate-200 opacity-90' : 'border-emerald-300 bg-emerald-50/25'} hover:border-slate-300`}
              >

                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 mt-0.5 border border-slate-100">
                    {getIcon()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">{notif.title}</h4>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{notif.message}</p>
                    {formattedTime() && (
                      <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1 font-medium">
                        <Calendar className="w-3 h-3 text-slate-300" />
                        <span>{formattedTime()}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!notif.isRead && (
                    <button onClick={() => notif.id && onMarkAsRead(notif.id)} className="p-2 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition cursor-pointer" title="Marquer comme lu">
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                  {notif.actionUrl && (
                    <button onClick={() => onNavigateTab(notif.actionUrl as PilgrimTab)} className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-xl transition cursor-pointer font-bold text-xs flex items-center gap-1" title="Voir le détail">
                      <span className="hidden sm:inline">Consulter</span><ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
