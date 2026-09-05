import React, { useState } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  Clock,
  UserCheck,
  FileSpreadsheet,
} from 'lucide-react';
import { AuditLog, User, AgencySettings } from '../../types.js';
import { formatDateTime } from '../../utils/format.js';

interface AuditLogsModuleProps {
  logs: AuditLog[];
  users: User[];
  settings?: AgencySettings;
}

export const AuditLogsModule: React.FC<AuditLogsModuleProps> = ({ logs, users, settings }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const filteredLogs = logs.filter((log) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      log.action.toLowerCase().includes(term) ||
      (log.details && JSON.stringify(log.details).toLowerCase().includes(term)) ||
      (log.userId && log.userId.toLowerCase().includes(term));

    const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const getActionBadge = (action: string) => {
    if (action.includes('ANNULATION')) {
      return 'bg-rose-100 text-rose-800 border-rose-300';
    }
    if (action.includes('PAIEMENT')) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
    if (action.includes('PRIX') || action.includes('PRICE')) {
      return 'bg-amber-100 text-amber-800 border-amber-300';
    }
    if (action.includes('CAMPAIGN') || action.includes('VOYAGE')) {
      return 'bg-purple-100 text-purple-800 border-purple-300';
    }
    if (action.includes('PACKAGE')) {
      return 'bg-indigo-100 text-indigo-800 border-indigo-300';
    }
    if (action.includes('INSCRIPTION') || action.includes('CLIENT')) {
      return 'bg-blue-100 text-blue-800 border-blue-300';
    }
    return 'bg-slate-100 text-slate-800 border-slate-300';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            Piste d'Audit & Journal de Sécurité Immuable
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Traçabilité intégrale de toutes les opérations sensibles : encaissements, annulations, accès et modifications.
          </p>
        </div>

        <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-mono text-xs font-bold self-start sm:self-auto">
          {logs.length} Événements Horodatés
        </span>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Rechercher par action, utilisateur ou détail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-2.5 focus:outline-hidden focus:border-amber-500 cursor-pointer"
          >
            <option value="ALL">Toutes les actions</option>
            <option value="MODIFICATION_PRIX_INSCRIPTION">Modifications de prix (Dérogations / Remises)</option>
            <option value="PAIEMENT_ENCAISSE">Paiements encaissés</option>
            <option value="ANNULATION_PAIEMENT">Annulations de reçus</option>
            <option value="INSCRIPTION_CREEE">Créations d'inscriptions</option>
            <option value="CLIENT_CREE">Créations de pèlerins</option>
            <option value="ATTRIBUTION_CHAMBRE">Attributions de chambres</option>
            <option value="CAMPAIGN_CREATED">Créations de campagnes</option>
            <option value="PACKAGE_PRICE_VERSIONED">Ajustements de grille Nusuk / Packages</option>
          </select>
        </div>
      </div>

      {/* Audit Logs List: Mobile Cards + Desktop Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {/* Mobile Cards View */}
        <div className="block md:hidden p-3 space-y-3 bg-slate-50/50">
          {filteredLogs.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-lg border border-slate-200 p-4">
              Aucun journal d'audit ne correspond à vos critères.
            </div>
          ) : (
            filteredLogs.map((log) => {
              const user = users.find((u) => u.id === log.userId);
              const badgeClass = getActionBadge(log.action);
              return (
                <div
                  key={log.id}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border font-sans ${badgeClass}`}>
                      {log.action}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {formatDateTime(log.timestamp)}
                    </span>
                  </div>

                  <div>
                    <span className="font-sans font-bold text-slate-900 text-xs block">
                      {user ? `${user.firstName} ${user.lastName}` : log.userId || 'SYSTÈME'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-sans">{user?.role || 'ADMIN'}</span>
                  </div>

                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono text-[11px] space-y-1">
                    <div className="text-slate-700">
                      <span className="text-slate-400">Cible :</span> {log.entityType} ({log.entityId.slice(0, 12)}...)
                    </div>
                    {log.details && (
                      <pre className="text-[9px] text-slate-600 bg-white p-1.5 rounded border border-slate-200 overflow-x-auto">
                        {JSON.stringify(log.details || {}, null, 1)}
                      </pre>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-3 px-4">Horodatage (UTC)</th>
                <th className="py-3 px-4">Utilisateur / Opérateur</th>
                <th className="py-3 px-4">Action Enregistrée</th>
                <th className="py-3 px-4">Entité / Réf.</th>
                <th className="py-3 px-4">Données Opérationnelles (Payload)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => {
                const user = users.find((u) => u.id === log.userId);
                const badgeClass = getActionBadge(log.action);
                return (
                  <tr key={log.id} className="hover:bg-slate-50 font-mono">
                    <td className="py-3 px-4 text-slate-600 text-[11px] whitespace-nowrap">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-sans font-bold text-slate-900 block">
                        {user ? `${user.firstName} ${user.lastName}` : log.userId || 'SYSTÈME'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-sans">{user?.role || 'ADMIN'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border font-sans ${badgeClass}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-semibold">
                      {log.entityType} ({log.entityId.slice(0, 10)}...)
                    </td>
                    <td className="py-3 px-4">
                      <pre className="text-[10px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-200 max-w-md overflow-x-auto">
                        {JSON.stringify(log.details || {}, null, 1)}
                      </pre>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
