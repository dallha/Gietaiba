import React, { useState } from 'react';
import {
  TrendingDown,
  Plus,
  Trash2,
  PieChart as PieIcon,
  DollarSign,
  TrendingUp,
  X,
  Ban,
  AlertCircle,
} from 'lucide-react';
import { Expense, Voyage, Inscription, AgencySettings } from '../../types.js';
import { formatFCFA, formatDate } from '../../utils/format.js';
import { api } from '../../services/api.js';

interface DepensesModuleProps {
  expenses: Expense[];
  voyages: Voyage[];
  inscriptions: Inscription[];
  settings?: AgencySettings;
  onRefresh: () => void;
  onCreateExpense: (expense: Partial<Expense>) => Promise<Expense>;
  onDeleteExpense: (id: string) => Promise<any>;
}

export const DepensesModule: React.FC<DepensesModuleProps> = ({
  expenses,
  voyages,
  inscriptions,
  settings,
  onRefresh,
  onCreateExpense,
  onDeleteExpense,
}) => {
  const [selectedVoyageId, setSelectedVoyageId] = useState(voyages[0]?.id || '');
  const [showAddModal, setShowAddModal] = useState(false);

  // New expense form
  const [newExpForm, setNewExpForm] = useState<Partial<Expense>>({
    voyageId: voyages[0]?.id || '',
    category: 'HOTELS_MAKKAH',
    description: '',
    amount: 5000000,
    paymentMethod: 'Virement bancaire',
    date: new Date().toISOString().split('T')[0],
  });

  const activeVoyage = voyages.find((v) => v.id === selectedVoyageId);

  // Financial calculations for active voyage (excluding cancelled & test expenses)
  const voyageInscriptions = inscriptions.filter((i) => i.voyageId === selectedVoyageId && i.status !== 'ANNULEE');
  const voyageExpenses = expenses.filter((e) => e.voyageId === selectedVoyageId);
  const activeVoyageExpenses = voyageExpenses.filter((e) => e.status !== 'ANNULEE' && !e.isTest);

  const totalCA = voyageInscriptions.reduce((acc, i) => acc + (i.appliedPrice || 0), 0);
  const totalExpenses = activeVoyageExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const netResult = totalCA - totalExpenses;
  const marginRate = totalCA > 0 ? Math.round((netResult / totalCA) * 100) : 0;

  // Cancellation modal state
  const [cancelModalExpense, setCancelModalExpense] = useState<Expense | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpForm.description || !newExpForm.amount) {
      alert('Veuillez remplir le libellé et le montant.');
      return;
    }
    try {
      await onCreateExpense({
        ...newExpForm,
        voyageId: selectedVoyageId,
      });
      setShowAddModal(false);
      setNewExpForm({
        voyageId: selectedVoyageId,
        category: 'HOTELS_MAKKAH',
        description: '',
        amount: 1000000,
        paymentMethod: 'Virement bancaire',
        date: new Date().toISOString().split('T')[0],
      });
      onRefresh();
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    }
  };

  const handleCancelExpense = async () => {
    if (!cancelModalExpense) return;
    if (!cancelReason.trim()) {
      alert('Le motif d\'annulation est obligatoire.');
      return;
    }
    setCancelLoading(true);
    try {
      await api.cancelExpense(cancelModalExpense.id, cancelReason.trim());
      setCancelModalExpense(null);
      setCancelReason('');
      onRefresh();
    } catch (err: any) {
      alert(`Erreur lors de l'annulation: ${err.message}`);
    } finally {
      setCancelLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const exp = expenses.find((e) => e.id === id);
    if (exp && exp.status !== 'ANNULEE') {
      setCancelModalExpense(exp);
      setCancelReason('');
      return;
    }
    if (!confirm('Supprimer cette charge d’exploitation ?')) return;
    try {
      await onDeleteExpense(id);
      onRefresh();
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-amber-600" />
            Dépenses d'Exploitation & Rentabilité Métier
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Calcul automatique du résultat net et du compte d'exploitation prévisionnel par voyage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedVoyageId}
            onChange={(e) => setSelectedVoyageId(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg py-2 px-3 focus:outline-hidden focus:border-amber-500 font-bold text-slate-800 cursor-pointer"
          >
            {voyages.map((v) => (
              <option key={v.id} value={v.id}>
                {v.code} — {v.title}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            Ajouter une Dépense
          </button>
        </div>
      </div>

      {/* P&L Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block">Chiffre d'Affaires Contrat</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">
            {formatFCFA(totalCA)}
          </span>
          <span className="text-[11px] text-slate-400">{voyageInscriptions.length} pèlerins engagés</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block">Total Dépenses Engagées</span>
          <span className="text-2xl font-black text-rose-700 mt-1 block">
            {formatFCFA(totalExpenses)}
          </span>
          <span className="text-[11px] text-slate-400">{voyageExpenses.length} lignes de frais enregistrées</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block">Marge Brute / Résultat Net</span>
          <span className="text-2xl font-black text-emerald-700 mt-1 block">
            {formatFCFA(netResult)}
          </span>
          <span className="text-[11px] text-emerald-700 font-medium">Bénéfice opérationnel agence</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block">Taux de Marge Commerciale</span>
          <span className="text-2xl font-black text-amber-700 mt-1 block">
            {marginRate} %
          </span>
          <span className="text-[11px] text-slate-400">Ratio Marge / Chiffre d'Affaires</span>
        </div>
      </div>

      {/* Expense Lines: Mobile Cards + Desktop Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Détail des Charges — {activeVoyage?.title}
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            Total : <strong className="text-slate-900 font-bold">{formatFCFA(totalExpenses)}</strong>
          </span>
        </div>

        {/* Mobile Cards View */}
        <div className="block md:hidden p-3 space-y-3 bg-slate-50/50">
          {voyageExpenses.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-lg border border-slate-200 p-4">
              Aucune dépense enregistrée sur cette campagne.
            </div>
          ) : (
            voyageExpenses.map((exp) => (
              <div
                key={exp.id}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-[10px] text-slate-800 border border-slate-200">
                    {exp.category}
                  </span>
                  <span className="text-[11px] text-slate-500">{formatDate(exp.date)}</span>
                </div>

                <div>
                  <p className="font-bold text-slate-900 text-xs">{exp.description}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Mode : {exp.paymentMethod}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-sm font-black text-rose-700">
                    {formatFCFA(exp.amount, exp.currency)}
                  </span>
                  <button
                    onClick={() => handleDelete(exp.id)}
                    className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Supprimer la dépense"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Poste de Dépense</th>
                <th className="py-3 px-4">Libellé & Fournisseur</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4">Mode de Règlement</th>
                <th className="py-3 px-4 text-right">Montant Décaissé</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {voyageExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Aucune dépense enregistrée sur cette campagne.
                  </td>
                </tr>
              ) : (
                voyageExpenses.map((exp) => (
                  <tr key={exp.id} className={`hover:bg-slate-50 ${exp.status === 'ANNULEE' ? 'opacity-60 bg-slate-50/50' : ''}`}>
                    <td className="py-3 px-4 text-slate-600">{formatDate(exp.date)}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-[10px] text-slate-800">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-800">{exp.description || exp.comment || 'Charge engagée'}</p>
                      {exp.supplier && <p className="text-[10px] text-slate-400">{exp.supplier}</p>}
                    </td>
                    <td className="py-3 px-4">
                      {exp.status === 'ANNULEE' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <Ban className="w-3 h-3" />
                          Annulée
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Validée
                        </span>
                      )}
                      {exp.cancellationReason && (
                        <p className="text-[10px] text-rose-500 italic mt-0.5 max-w-xs truncate" title={exp.cancellationReason}>
                          {exp.cancellationReason}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{exp.paymentMethod || 'Espèces'}</td>
                    <td className={`py-3 px-4 text-right font-bold text-sm ${exp.status === 'ANNULEE' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                      {formatFCFA(exp.amount, exp.currency)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {exp.status !== 'ANNULEE' ? (
                        <button
                          onClick={() => {
                            setCancelModalExpense(exp);
                            setCancelReason('');
                          }}
                          className="p-1.5 rounded text-amber-600 hover:bg-amber-50 cursor-pointer inline-flex items-center gap-1 text-[11px] font-semibold"
                          title="Annuler cette dépense"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Annuler</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Clôturée</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add Expense */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                Saisie Charge d'Exploitation
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Poste de Charge *</label>
                <select
                  value={newExpForm.category}
                  onChange={(e) => setNewExpForm({ ...newExpForm, category: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5"
                >
                  <option value="HOTELS_MAKKAH">Hôtellerie Makkah (Haram)</option>
                  <option value="HOTELS_MEDINE">Hôtellerie Médine (Nabawi)</option>
                  <option value="VOLS">Affrètement & Billetterie Aérienne</option>
                  <option value="VISAS_NUSUK">Frais Plateforme & Visas Nusuk</option>
                  <option value="TRANSPORTS_TERRESTRES">Autocars & Transferts TGV Haramain</option>
                  <option value="RESTAURATION">Restauration & Traiteur</option>
                  <option value="ASSISTANCE_MEDICALE">Assurance & Kit Médical</option>
                  <option value="AUTRES">Autres Frais Généraux</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Description / Prestataire *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Acompte Réservation Hôtel Pullman Zamzam"
                  value={newExpForm.description}
                  onChange={(e) => setNewExpForm({ ...newExpForm, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Montant (FCFA) *</label>
                  <input
                    type="number"
                    step="50000"
                    min="1000"
                    required
                    value={newExpForm.amount}
                    onChange={(e) => setNewExpForm({ ...newExpForm, amount: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Date Règlement *</label>
                  <input
                    type="date"
                    required
                    value={newExpForm.date}
                    onChange={(e) => setNewExpForm({ ...newExpForm, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Mode de Paiement *</label>
                <select
                  value={newExpForm.paymentMethod}
                  onChange={(e) => setNewExpForm({ ...newExpForm, paymentMethod: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5"
                >
                  <option value="Virement bancaire">Virement bancaire</option>
                  <option value="Chèque">Chèque d'entreprise</option>
                  <option value="Espèces">Espèces</option>
                  <option value="Carte bancaire">Carte Corporate</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                >
                  Valider la Dépense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal d'Annulation de Dépense */}
      {cancelModalExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-rose-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Ban className="w-4 h-4 text-rose-300" />
                Annulation de Charge d'Exploitation
              </h3>
              <button onClick={() => setCancelModalExpense(null)} className="text-slate-300 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-1">
                <p className="font-bold">Dépense à annuler :</p>
                <p>{cancelModalExpense.category} — {formatFCFA(cancelModalExpense.amount, cancelModalExpense.currency)}</p>
                <p className="text-[11px] text-rose-600">Cette opération exclura le montant des charges réelles tout en conservant la traçabilité comptable.</p>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1 text-xs">Motif d'annulation *</label>
                <textarea
                  rows={3}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ex : Erreur de saisie, remboursement fournisseur, doublon..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCancelModalExpense(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  disabled={cancelLoading}
                  onClick={handleCancelExpense}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {cancelLoading ? 'Annulation...' : 'Confirmer l\'annulation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
