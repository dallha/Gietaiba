import React, { useState } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Printer,
  Ban,
  Filter,
  CheckCircle2,
  Calendar,
  X,
  Wallet,
  ArrowDownLeft,
} from 'lucide-react';
import { Payment, Inscription, Client, AgencySettings } from '../../types.js';
import { formatFCFA, formatDate, formatDateTime } from '../../utils/format.js';

interface PaiementsModuleProps {
  payments: Payment[];
  inscriptions: Inscription[];
  clients: Client[];
  settings?: AgencySettings;
  onRefresh: () => void;
  onCreatePayment: (data: {
    clientId: string;
    inscriptionId: string;
    amount: number;
    paymentMethod: string;
    reference?: string;
    comment?: string;
    paymentDate?: string;
  }) => Promise<Payment>;
  onCancelPayment: (id: string, reason: string) => Promise<Payment>;
  onOpenReceipt: (payment: Payment, inscription?: Inscription) => void;
  defaultClientId?: string;
  defaultInscriptionId?: string;
}

export const PaiementsModule: React.FC<PaiementsModuleProps> = ({
  payments,
  inscriptions,
  clients,
  settings,
  onRefresh,
  onCreatePayment,
  onCancelPayment,
  onOpenReceipt,
  defaultClientId,
  defaultInscriptionId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [showModal, setShowModal] = useState(Boolean(defaultClientId));
  const [cancelingPaymentId, setCancelingPaymentId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Payment Form State
  const [formClientId, setFormClientId] = useState(defaultClientId || '');
  const [formInscriptionId, setFormInscriptionId] = useState(defaultInscriptionId || '');
  const [formAmount, setFormAmount] = useState<number>(500000);
  const [formMethod, setFormMethod] = useState('Espèces');
  const [formReference, setFormReference] = useState('');
  const [formComment, setFormComment] = useState('Acompte versement en caisse');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);

  // Find candidate inscriptions for selected client
  const clientInscriptions = inscriptions.filter((i) => !formClientId || i.clientId === formClientId);
  const selectedInscription = inscriptions.find((i) => i.id === formInscriptionId);

  const totalCollected = payments.reduce((acc, p) => acc + (p.amount || 0), 0);

  const filteredPayments = payments.filter((p) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (p.clientName && p.clientName.toLowerCase().includes(term)) ||
      p.receiptNumber.toLowerCase().includes(term) ||
      (p.reference && p.reference.toLowerCase().includes(term));

    const matchesMethod = methodFilter === 'ALL' || p.paymentMethod === methodFilter;
    return matchesSearch && matchesMethod;
  });

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClientId || !formInscriptionId || !formAmount || formAmount <= 0) {
      alert('Veuillez renseigner le pèlerin, le dossier et un montant valide.');
      return;
    }

    try {
      const created = await onCreatePayment({
        clientId: formClientId,
        inscriptionId: formInscriptionId,
        amount: Number(formAmount),
        paymentMethod: formMethod,
        reference: formReference,
        comment: formComment,
        paymentDate: formDate,
      });

      setShowModal(false);
      onRefresh();
      // Auto open official receipt
      onOpenReceipt(created, selectedInscription);
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    }
  };

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelingPaymentId || !cancelReason.trim()) {
      alert("Veuillez indiquer le motif d'annulation (obligatoire pour l'audit).");
      return;
    }
    try {
      await onCancelPayment(cancelingPaymentId, cancelReason);
      setCancelingPaymentId(null);
      setCancelReason('');
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
            <CreditCard className="w-5 h-5 text-amber-600" />
            Caisse & Journal des Encaissements
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Enregistrement sécurisé des règlements pèlerins et édition automatique des reçus numérotés.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-50 px-4 py-2 rounded-lg border border-slate-200 text-right hidden md:block">
            <span className="text-[10px] text-slate-500 font-semibold uppercase block">Total Encaissé</span>
            <span className="text-base font-black text-emerald-700">{formatFCFA(totalCollected)}</span>
          </div>

          <button
            onClick={() => {
              if (clients.length > 0 && !formClientId) {
                setFormClientId(clients[0].id);
                const firstIns = inscriptions.find((i) => i.clientId === clients[0].id);
                if (firstIns) setFormInscriptionId(firstIns.id);
              }
              setShowModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white" />
            Encaisser en Caisse
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Rechercher reçu (PAY-2027...), pèlerin..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-2.5 focus:outline-hidden focus:border-amber-500 cursor-pointer"
          >
            <option value="ALL">Tous les modes de paiement</option>
            {settings?.paymentMethods?.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            )) || (
              <>
                <option value="Espèces">Espèces</option>
                <option value="Wave">Wave</option>
                <option value="Orange Money">Orange Money</option>
                <option value="Virement bancaire">Virement bancaire</option>
                <option value="Chèque">Chèque</option>
              </>
            )}
          </select>
          <span className="text-xs text-slate-500 font-medium ml-2">
            {filteredPayments.length} transaction{filteredPayments.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Transactions List: Mobile Cards + Desktop Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {/* Mobile Cards View */}
        <div className="block md:hidden p-3 space-y-3 bg-slate-50/50">
          {filteredPayments.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-lg border border-slate-200 p-4">
              Aucun paiement enregistré pour cette sélection.
            </div>
          ) : (
            filteredPayments.map((payment) => {
              const ins = inscriptions.find((i) => i.id === payment.inscriptionId);
              return (
                <div
                  key={payment.id}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {payment.receiptNumber}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {formatDate(payment.paymentDate)}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{payment.clientName}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">{payment.voyageCode}</p>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Mode de règlement</span>
                      <span className="font-semibold text-slate-800">{payment.paymentMethod}</span>
                      {payment.reference && (
                        <p className="text-[10px] font-mono text-slate-400">{payment.reference}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-medium">Montant</span>
                      <span className="text-sm font-black text-emerald-700">
                        {formatFCFA(payment.amount, payment.currency)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                    <span className="text-[11px] text-slate-500">
                      Encaissé par : <strong className="text-slate-700 font-semibold">{payment.agentName}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onOpenReceipt(payment, ins)}
                        className="px-2.5 py-1 rounded bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200 font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Reçu
                      </button>
                      <button
                        onClick={() => setCancelingPaymentId(payment.id)}
                        className="p-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                        title="Annuler ce paiement (Direction)"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
                <th className="py-3 px-4">N° Reçu</th>
                <th className="py-3 px-4">Pèlerin</th>
                <th className="py-3 px-4">Campagne</th>
                <th className="py-3 px-4">Date de Règlement</th>
                <th className="py-3 px-4">Mode & Réf</th>
                <th className="py-3 px-4 text-right">Montant Encaissé</th>
                <th className="py-3 px-4 text-center">Caissier</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Aucun paiement enregistré pour cette sélection.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => {
                  const ins = inscriptions.find((i) => i.id === payment.inscriptionId);
                  return (
                    <tr key={payment.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {payment.receiptNumber}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">{payment.clientName}</p>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-600">
                        {payment.voyageCode}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {formatDate(payment.paymentDate)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{payment.paymentMethod}</span>
                        {payment.reference && (
                          <p className="text-[10px] font-mono text-slate-400">{payment.reference}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                        {formatFCFA(payment.amount, payment.currency)}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-600">
                        {payment.agentName}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenReceipt(payment, ins)}
                            className="p-1.5 rounded bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
                            title="Imprimer / Afficher le reçu officiel"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setCancelingPaymentId(payment.id)}
                            className="p-1.5 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                            title="Annuler ce paiement (Direction)"
                          >
                            <Ban className="w-3.5 h-3.5" />
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

      {/* New Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-400" />
                Enregistrer un Versement en Caisse
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Pèlerin *</label>
                <select
                  required
                  value={formClientId}
                  onChange={(e) => {
                    const cId = e.target.value;
                    setFormClientId(cId);
                    const matchingIns = inscriptions.find((i) => i.clientId === cId);
                    if (matchingIns) setFormInscriptionId(matchingIns.id);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5"
                >
                  <option value="">-- Sélectionner un pèlerin --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.lastName} {c.firstName} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Dossier d'Inscription *</label>
                <select
                  required
                  value={formInscriptionId}
                  onChange={(e) => setFormInscriptionId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5"
                >
                  <option value="">-- Sélectionner le dossier --</option>
                  {clientInscriptions.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.code} — {i.voyage?.code} (Package {i.package?.name} - Solde dû : {formatFCFA(i.balance)})
                    </option>
                  ))}
                </select>
              </div>

              {selectedInscription && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-slate-700 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-amber-900 font-semibold block">Situation Actuelle</span>
                    <span className="text-xs">
                      Tarif : {formatFCFA(selectedInscription.appliedPrice)} • Déjà versé : {formatFCFA(selectedInscription.totalPaid)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">Solde à payer</span>
                    <span className="text-sm font-black text-amber-900">
                      {formatFCFA(selectedInscription.balance)}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Montant à Encaisser (FCFA) *</label>
                  <input
                    type="number"
                    step="10000"
                    min="1000"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-sm text-emerald-800"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Date d'Encaissement *</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Mode de Règlement *</label>
                  <select
                    value={formMethod}
                    onChange={(e) => setFormMethod(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  >
                    <option value="Espèces">Espèces (Guichet)</option>
                    <option value="Wave">Wave</option>
                    <option value="Orange Money">Orange Money</option>
                    <option value="Virement bancaire">Virement bancaire</option>
                    <option value="Chèque">Chèque</option>
                    <option value="Carte bancaire">Carte bancaire</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">N° Réf / Transaction</label>
                  <input
                    type="text"
                    value={formReference}
                    onChange={(e) => setFormReference(e.target.value)}
                    placeholder="Ex: TX-9842 ou N° Chèque"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Libellé / Commentaire</label>
                <input
                  type="text"
                  value={formComment}
                  onChange={(e) => setFormComment(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold cursor-pointer inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Valider & Générer Reçu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Payment Confirmation Modal */}
      {cancelingPaymentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-rose-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Ban className="w-4 h-4" />
                Annulation Exceptionnelle de Paiement
              </h3>
              <button onClick={() => setCancelingPaymentId(null)} className="text-rose-200 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmCancel} className="p-6 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Cette action supprimera le règlement de la caisse, recalculera immédiatement le solde dû du pèlerin et inscrira une trace indélébile dans le Journal d'Audit.
              </p>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Motif d'annulation obligatoire *
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ex: Erreur de saisie de montant par le caissier / Chèque rejeté..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCancelingPaymentId(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Retour
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-bold cursor-pointer"
                >
                  Confirmer l'Annulation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
