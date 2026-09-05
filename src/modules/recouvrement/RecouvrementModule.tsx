import React, { useState } from 'react';
import {
  AlertCircle,
  Phone,
  MessageSquare,
  CreditCard,
  Search,
  Filter,
  CheckCircle,
  Clock,
  Send,
  X,
} from 'lucide-react';
import { Inscription, Client, Voyage, AgencySettings } from '../../types.js';
import { formatFCFA, formatDate } from '../../utils/format.js';

interface RecouvrementModuleProps {
  inscriptions: Inscription[];
  clients: Client[];
  voyages: Voyage[];
  settings?: AgencySettings;
  onNavigateToPayment: (clientId: string, inscriptionId: string) => void;
}

export const RecouvrementModule: React.FC<RecouvrementModuleProps> = ({
  inscriptions,
  clients,
  voyages,
  settings,
  onNavigateToPayment,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [activeMessageModal, setActiveMessageModal] = useState<{
    client: Client;
    inscription: Inscription;
  } | null>(null);

  // Filter only inscriptions with a remaining balance
  const debtors = inscriptions
    .filter((ins) => ins.balance > 0)
    .map((ins) => {
      let priority: 'NORMAL' | 'IMPORTANT' | 'URGENT' = 'NORMAL';
      if (ins.balance >= 3000000 || ins.totalPaid === 0) {
        priority = 'URGENT';
      } else if (ins.balance >= 1000000) {
        priority = 'IMPORTANT';
      }

      const client = clients.find((c) => c.id === ins.clientId) || ins.client;
      return {
        ...ins,
        client,
        priority,
      };
    })
    .sort((a, b) => b.balance - a.balance);

  const totalOutstanding = debtors.reduce((sum, d) => sum + d.balance, 0);

  const filteredDebtors = debtors.filter((d) => {
    const term = searchTerm.toLowerCase();
    const clientName = `${d.client?.firstName || ''} ${d.client?.lastName || ''}`.toLowerCase();
    const matchesSearch =
      clientName.includes(term) ||
      d.code.toLowerCase().includes(term) ||
      (d.client?.phone && d.client.phone.includes(term));

    const matchesPriority = priorityFilter === 'ALL' || d.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return { label: 'URGENT', bg: 'bg-rose-100 text-rose-800 border-rose-300' };
      case 'IMPORTANT':
        return { label: 'IMPORTANT', bg: 'bg-amber-100 text-amber-800 border-amber-300' };
      case 'NORMAL':
      default:
        return { label: 'NORMAL', bg: 'bg-blue-100 text-blue-800 border-blue-300' };
    }
  };

  const getReminderText = (client?: Client, ins?: Inscription) => {
    const name = client ? `${client.civility} ${client.lastName}` : 'Cher Pèlerin';
    const balance = ins ? formatFCFA(ins.balance) : '';
    const voyage = ins?.voyage?.title || 'Hajj 2027';
    return `Salam Alaykoum ${name}. L'agence GIE TAIBA VOYAGES vous rappelle que le solde restant de votre dossier pour le ${voyage} s'élève à ${balance}. Merci de vous rapprocher de notre caisse avant la date limite pour confirmer la réservation de vos vols et hébergements. Qu'Allah bénisse votre démarche.`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            Module de Recouvrement & Gestion des Soldes
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pilotage des relances, créances pèlerins et priorisation des encaissements critiques.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-amber-50/80 px-4 py-2.5 rounded-lg border border-amber-200">
          <div>
            <span className="text-[10px] text-amber-900 font-bold uppercase block">Créances Totales</span>
            <span className="text-lg font-black text-amber-700">{formatFCFA(totalOutstanding)}</span>
          </div>
          <div className="pl-4 border-l border-amber-200 text-right">
            <span className="text-[10px] text-amber-900 font-bold uppercase block">Pèlerins Débiteurs</span>
            <span className="text-lg font-black text-slate-900">{debtors.length}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Rechercher débiteur, téléphone, dossier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-2.5 focus:outline-hidden focus:border-amber-500 cursor-pointer"
          >
            <option value="ALL">Toutes les priorités</option>
            <option value="URGENT">🔴 URGENT (Solde &gt; 3M ou 0€)</option>
            <option value="IMPORTANT">🟡 IMPORTANT (Solde 1M - 3M)</option>
            <option value="NORMAL">🔵 NORMAL (Solde &lt; 1M)</option>
          </select>
          <span className="text-xs text-slate-500 font-medium ml-2">
            {filteredDebtors.length} dossier{filteredDebtors.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Debtors List: Mobile Cards + Desktop Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {/* Mobile Cards View */}
        <div className="block md:hidden p-3 space-y-3 bg-slate-50/50">
          {filteredDebtors.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-lg border border-slate-200 p-4">
              Aucun pèlerin débiteur ne correspond à ces critères.
            </div>
          ) : (
            filteredDebtors.map((d) => {
              const badge = getPriorityBadge(d.priority);
              const percentPaid = d.appliedPrice > 0 ? Math.round((d.totalPaid / d.appliedPrice) * 100) : 0;
              return (
                <div
                  key={d.id}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.bg}`}>
                      {badge.label}
                    </span>
                    <span className="font-semibold text-slate-700 text-xs">
                      {d.voyage?.code || 'HAJ2027'}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {d.client?.civility} {d.client?.lastName} {d.client?.firstName}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{d.client?.phone}</p>
                    <p className="text-[11px] text-amber-800 font-medium mt-0.5">Package : {d.package?.name}</p>
                  </div>

                  {/* Progression */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Recouvrement effectué</span>
                      <span className="font-bold text-slate-800">{percentPaid}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all"
                        style={{ width: `${percentPaid}%` }}
                      />
                    </div>
                  </div>

                  {/* Financial amounts */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Tarif</span>
                      <span className="font-bold text-slate-800 block truncate">{formatFCFA(d.appliedPrice)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-700 block font-medium">Versé</span>
                      <span className="font-bold text-emerald-700 block truncate">{formatFCFA(d.totalPaid)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-rose-700 block font-medium">Reste</span>
                      <span className="font-black text-rose-700 block truncate">{formatFCFA(d.balance)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    {d.client && (
                      <button
                        onClick={() => setActiveMessageModal({ client: d.client!, inscription: d })}
                        className="flex-1 py-2 px-2.5 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Relancer
                      </button>
                    )}
                    <button
                      onClick={() => onNavigateToPayment(d.clientId, d.id)}
                      className="flex-1 py-2 px-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Encaisser
                    </button>
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
                <th className="py-3 px-4">Priorité</th>
                <th className="py-3 px-4">Pèlerin</th>
                <th className="py-3 px-4">Dossier & Voyage</th>
                <th className="py-3 px-4 text-right">Tarif Inscription</th>
                <th className="py-3 px-4 text-right">Déjà Encaissé</th>
                <th className="py-3 px-4 text-right">Reste à Devoir</th>
                <th className="py-3 px-4 text-center">Progression</th>
                <th className="py-3 px-4 text-right">Actions Relance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDebtors.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Aucun pèlerin débiteur ne correspond à ces critères.
                  </td>
                </tr>
              ) : (
                filteredDebtors.map((d) => {
                  const badge = getPriorityBadge(d.priority);
                  const percentPaid = d.appliedPrice > 0 ? Math.round((d.totalPaid / d.appliedPrice) * 100) : 0;
                  return (
                    <tr key={d.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">
                          {d.client?.civility} {d.client?.lastName} {d.client?.firstName}
                        </p>
                        <p className="text-[11px] text-slate-500">{d.client?.phone}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{d.voyage?.code || 'HAJ2027'}</span>
                        <div className="text-[11px] text-amber-800 font-medium">
                          Package {d.package?.name}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700">
                        {formatFCFA(d.appliedPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-700">
                        {formatFCFA(d.totalPaid)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-rose-700 text-sm">
                        {formatFCFA(d.balance)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="w-24 mx-auto">
                          <div className="flex justify-between text-[9px] text-slate-500 mb-0.5">
                            <span>{percentPaid}%</span>
                          </div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-600 h-full rounded-full"
                              style={{ width: `${percentPaid}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {d.client && (
                            <button
                              onClick={() => setActiveMessageModal({ client: d.client!, inscription: d })}
                              className="p-1.5 rounded bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                              title="Envoyer Message WhatsApp / SMS de relance"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => onNavigateToPayment(d.clientId, d.id)}
                            className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                          >
                            <CreditCard className="w-3 h-3" />
                            Encaisser
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* WhatsApp / SMS Reminder Modal */}
      {activeMessageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                Relance Client — {activeMessageModal.client.firstName} {activeMessageModal.client.lastName}
              </h3>
              <button onClick={() => setActiveMessageModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <p className="text-slate-500">Destinataire :</p>
                <p className="text-sm font-bold text-slate-900">
                  {activeMessageModal.client.phone} ({activeMessageModal.client.firstName} {activeMessageModal.client.lastName})
                </p>
                <p className="text-slate-500 mt-1">
                  Solde dû : <span className="font-bold text-rose-700">{formatFCFA(activeMessageModal.inscription.balance)}</span>
                </p>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Message Officiel de Relance GIE TAIBA VOYAGES
                </label>
                <textarea
                  rows={5}
                  readOnly
                  value={getReminderText(activeMessageModal.client, activeMessageModal.inscription)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-800 font-sans leading-relaxed text-xs select-all"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <span className="text-[11px] text-slate-500">Modèle conforme protocole agence</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveMessageModal(null)}
                    className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                  >
                    Fermer
                  </button>
                  <a
                    href={`https://wa.me/${activeMessageModal.client.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                      getReminderText(activeMessageModal.client, activeMessageModal.inscription)
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Ouvrir WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
