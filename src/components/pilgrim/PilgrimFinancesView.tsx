import React, { useState } from 'react';
import { 
  CreditCard, 
  Receipt, 
  Download, 
  CheckCircle, 
  Clock, 
  Printer, 
  FileText, 
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { Payment, Inscription, AgencySettings } from '../../types.js';
import { formatFCFA, formatDate } from '../../utils/format.js';
import { ReceiptModal } from '../receipt/ReceiptModal.js';

interface PilgrimFinancesViewProps {
  activeInscription: Inscription | null;
  payments: Payment[];
  settings?: AgencySettings;
}

export const PilgrimFinancesView: React.FC<PilgrimFinancesViewProps> = ({
  activeInscription,
  payments,
  settings,
}) => {
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  if (!activeInscription) {
    return (
      <div className="bg-white rounded-3xl p-8 text-center border border-slate-200">
        <p className="text-slate-500 text-xs">Veuillez d'abord sélectionner un dossier actif.</p>
      </div>
    );
  }

  // Contract snapshot prices (Strict Requirement 8)
  const agreedPrice = activeInscription.agreedPrice || activeInscription.appliedPrice || 0;
  const totalPaid = activeInscription.totalPaid !== undefined 
    ? activeInscription.totalPaid 
    : payments.filter(p => p.status === 'VALIDE' || p.status === 'VALIDATED').reduce((sum, p) => sum + p.amount, 0);
  const remainingBalance = activeInscription.balance !== undefined
    ? activeInscription.balance
    : Math.max(0, agreedPrice - totalPaid);
  const percentPaid = agreedPrice > 0 ? Math.min(100, Math.round((totalPaid / agreedPrice) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Title & Safety Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-emerald-700" />
            <span>Paiements & Reçus Officiels</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Historique certifié conforme de l'ensemble de vos versements enregistrés en caisse
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-xs font-bold">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Reçus Authentifiés par GIE TAIBA VOYAGES</span>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Tarif convenu */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Tarif Convenu (Snapshot)
          </span>
          <p className="text-2xl font-black text-slate-900 mt-1">
            {formatFCFA(agreedPrice)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Version : {activeInscription.priceVersionSnapshotted ? `V${activeInscription.priceVersionSnapshotted}` : 'V1'}
          </p>
        </div>

        {/* Total versé */}
        <div className="bg-white rounded-3xl p-5 border border-emerald-200 shadow-xs bg-emerald-50/30">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
            Total Versé en Caisse
          </span>
          <p className="text-2xl font-black text-emerald-900 mt-1">
            {formatFCFA(totalPaid)}
          </p>
          <p className="text-[11px] text-emerald-700 font-bold mt-0.5">
            {percentPaid}% du voyage réglé
          </p>
        </div>

        {/* Solde restant */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
            Solde Restant Dû
          </span>
          <p className={`text-2xl font-black mt-1 ${remainingBalance === 0 ? 'text-emerald-700' : 'text-amber-600'}`}>
            {formatFCFA(remainingBalance)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {remainingBalance === 0 ? 'Dossier soldé' : 'À régler avant le départ'}
          </p>
        </div>
      </div>

      {/* Payments History Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900">
              Versements Enregistrés ({payments.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Dossier réf : <strong className="text-slate-800 font-mono">{activeInscription.code}</strong>
            </p>
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <Receipt className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-bold text-slate-700 text-sm">Aucun versement enregistré</p>
            <p className="mt-1">Vos versements en agence ou par virement apparaîtront ici dès validation par la comptabilité.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="p-4">N° Reçu</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Moyen</th>
                  <th className="p-4 text-right">Montant</th>
                  <th className="p-4 text-center">Statut</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => {
                  const isValidated = p.status === 'VALIDE' || p.status === 'VALIDATED';
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-mono font-bold text-slate-900">
                        {p.receiptNumber || 'REC-EN-ATTENTE'}
                      </td>
                      <td className="p-4 text-slate-600 font-medium">
                        {formatDate(p.paymentDate || p.createdAt)}
                      </td>
                      <td className="p-4 font-bold text-slate-700 uppercase">
                        {p.paymentMethod || 'ESPÈCES'}
                      </td>
                      <td className="p-4 text-right font-black text-slate-900 text-sm">
                        {formatFCFA(p.amount)}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                          isValidated 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isValidated ? 'VALIDÉ' : 'EN ATTENTE'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setSelectedPayment(p)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition cursor-pointer shadow-2xs"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Voir le Reçu</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Official Receipt Modal */}
      {selectedPayment && (
        <ReceiptModal
          isOpen={true}
          payment={selectedPayment}
          inscription={activeInscription}
          settings={settings}
          onClose={() => setSelectedPayment(null)}
        />
      )}
    </div>
  );
};
