const fs = require('fs');

let content = fs.readFileSync('src/components/pilgrim/PilgrimNotificationsView.tsx', 'utf8');

content = content.replace("import { PilgrimPortalNotification, PilgrimTab } from './PilgrimTypes.js';", "import { PilgrimTab } from './PilgrimTypes.js';\nimport { AppNotification } from '../../types.js';");
content = content.replace("notifications: PilgrimPortalNotification[];", "notifications: AppNotification[];\n  onMarkAsRead: (id: string) => void;\n  onMarkAllAsRead: () => void;");
content = content.replace("}) => {", "  onMarkAsRead,\n  onMarkAllAsRead\n}) => {");

content = content.replace(
  "        <p className=\"text-xs sm:text-sm text-slate-500 mt-0.5\">\n          Suivi des événements réels enregistrés sur vos formalités, versements et pièces administratives\n        </p>\n      </div>",
  "        <p className=\"text-xs sm:text-sm text-slate-500 mt-0.5\">\n          Suivi des événements réels enregistrés sur vos formalités, versements et pièces administratives\n        </p>\n      </div>\n      {notifications.some(n => !n.isRead) && (\n        <button onClick={onMarkAllAsRead} className=\"text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition\">\n          Tout marquer comme lu\n        </button>\n      )}"
);

content = content.replace(
  "        <div className=\"space-y-3\">\n          {notifications.map((notif) => {",
  "        <div className=\"space-y-3\">\n          {notifications.map((notif) => {"
);

content = content.replace(
  "              <div\n                key={notif.id}",
  "              <div\n                key={notif.id}\n                className={`bg-white rounded-2xl p-4 sm:p-5 border shadow-xs flex items-start justify-between gap-4 transition ${notif.isRead ? 'border-slate-200' : 'border-emerald-300 bg-emerald-50/20'} hover:border-slate-300`}\n              >"
);

content = content.replace(
  "                className=\"bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex items-start justify-between gap-4 hover:border-slate-300 transition\"\n              >",
  ""
);

content = content.replace(
  "                      <Calendar className=\"w-3 h-3 text-slate-300\" />\n                      <span>{formatDate(notif.date)}</span>",
  "                      <Calendar className=\"w-3 h-3 text-slate-300\" />\n                      <span>{notif.createdAt?.toDate ? formatDate(notif.createdAt.toDate().toISOString()) : ''}</span>"
);

content = content.replace(
  "                {notif.linkTab && (\n                  <button\n                    onClick={() => onNavigateTab(notif.linkTab!)}\n                    className=\"shrink-0 p-2 text-emerald-700 hover:bg-emerald-50 rounded-xl transition cursor-pointer font-bold text-xs flex items-center gap-1\"\n                    title=\"Voir le détail\"\n                  >\n                    <span className=\"hidden sm:inline\">Consulter</span>\n                    <ArrowRight className=\"w-4 h-4\" />\n                  </button>\n                )}",
  `                <div className="flex items-center gap-2 shrink-0">
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
                </div>`
);

fs.writeFileSync('src/components/pilgrim/PilgrimNotificationsView.tsx', content);

