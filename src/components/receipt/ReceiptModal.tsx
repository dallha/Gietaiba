import React, { useRef } from 'react';
import { Payment, Inscription, AgencySettings } from '../../types.js';
import { formatFCFA, formatDate } from '../../utils/format.js';
import { Printer, Download, X, CheckCircle, Share2 } from 'lucide-react';

interface ReceiptModalProps {
  isOpen?: boolean;
  onClose: () => void;
  payment: Payment;
  inscription?: Inscription;
  settings?: AgencySettings;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen = true,
  onClose,
  payment,
  inscription,
  settings,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // Standard browser print to PDF
    window.print();
  };

  const clientName = payment.clientName || `${inscription?.client?.firstName || ''} ${inscription?.client?.lastName || ''}`.trim() || 'Pèlerin';
  const voyageTitle = inscription?.voyage?.title || payment.voyageCode || 'Hajj 2027';
  const packageName = inscription?.package?.name || 'Standard';
  const appliedPrice = inscription?.appliedPrice || 5100000;
  const totalPaid = inscription?.totalPaid || payment.amount;
  const balance = inscription?.balance !== undefined ? inscription.balance : Math.max(0, appliedPrice - totalPaid);

  return (
    <div id="receipt-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8">
        {/* Actions bar (non-printable) */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 font-bold text-sm">
              ✓
            </span>
            <div>
              <h3 className="text-sm font-semibold">Reçu Officiel de Caisse</h3>
              <p className="text-xs text-slate-400">N° {payment.receiptNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="receipt-print-btn"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimer
            </button>
            <button
              id="receipt-download-btn"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Télécharger PDF
            </button>
            <button
              id="receipt-close-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* The Formal Document */}
        <div ref={receiptRef} className="p-8 md:p-10 bg-white text-slate-900 print:p-0">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-amber-600/30 pb-6 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-9 h-9 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center font-serif text-lg font-bold">
                  TV
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">
                    {settings?.agencyName || 'GIE TAIBA VOYAGES'}
                  </h1>
                  <p className="text-xs text-amber-800 font-medium">Hajj & Oumrah — Agrément Officiel</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed">
                {settings?.address || 'Avenue Cheikh Anta Diop, Immeuble Taiba, Dakar'}<br />
                Tél : {settings?.phone || '+221 33 824 55 00'} | Email : {settings?.email || 'contact@taiba-voyages.sn'}<br />
                RC: {settings?.rcNumber || 'SN.DKR.2014.B.1820'} • NINEA: {settings?.ninea || '005421882 2V3'}
              </p>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold rounded-sm tracking-wider uppercase">
                REÇU DE PAIEMENT
              </span>
              <p className="text-base font-mono font-bold text-slate-900 mt-2">
                N° {payment.receiptNumber}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Date : <span className="font-semibold text-slate-700">{formatDate(payment.paymentDate)}</span>
              </p>
            </div>
          </div>

          {/* Core Info Grid */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 text-sm">
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Pèlerin / Client</span>
              <p className="text-base font-bold text-slate-900 mt-0.5">{clientName}</p>
              {inscription?.client?.code && (
                <p className="text-xs font-mono text-slate-500">ID: {inscription.client.code}</p>
              )}
              {inscription?.client?.phone && (
                <p className="text-xs text-slate-600">{inscription.client.phone}</p>
              )}
            </div>
            <div className="text-right">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Campagne & Formule</span>
              <p className="text-base font-bold text-slate-900 mt-0.5">{voyageTitle}</p>
              <p className="text-xs text-amber-800 font-semibold">Package {packageName}</p>
              {inscription?.code && (
                <p className="text-xs font-mono text-slate-500">Dossier: {inscription.code}</p>
              )}
            </div>
          </div>

          {/* Payment Line Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden mb-6">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4">Désignation</th>
                  <th className="py-3 px-4">Mode de Paiement</th>
                  <th className="py-3 px-4">Référence</th>
                  <th className="py-3 px-4 text-right">Montant Encaissé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-slate-900">Règlement d'acompte pèlerinage</span>
                    <div className="text-xs text-slate-500">{payment.comment || 'Acompte enregistré en caisse'}</div>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-700">{payment.paymentMethod}</td>
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-600">{payment.reference || '—'}</td>
                  <td className="py-3.5 px-4 text-right font-bold text-slate-900 text-base">
                    {formatFCFA(payment.amount, payment.currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Financial Breakdown */}
          <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-8 bg-amber-50/50 p-4 rounded-lg border border-amber-200/60">
            <div className="text-xs text-slate-600 max-w-xs space-y-1">
              <p className="font-semibold text-slate-800">Situation financière du dossier :</p>
              <p>Tarif convenu du package : <span className="font-medium text-slate-900">{formatFCFA(appliedPrice)}</span></p>
              <p>Cumul des versements validés : <span className="font-medium text-emerald-700">{formatFCFA(totalPaid)}</span></p>
              <p className="text-amber-900 font-bold">Solde restant à devoir : {formatFCFA(balance)}</p>
            </div>

            <div className="text-right w-full md:w-auto">
              <div className="bg-white px-5 py-3 rounded-lg border border-amber-300 shadow-xs inline-block">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Total Reçu</span>
                <span className="text-2xl font-black text-amber-700">{formatFCFA(payment.amount, payment.currency)}</span>
              </div>
            </div>
          </div>

          {/* Signature & Security Footer */}
          <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-200 text-xs">
            <div>
              <p className="text-slate-500 mb-10">Agent / Caissier ayant délivré :</p>
              <p className="font-semibold text-slate-800">{payment.agentName}</p>
              <p className="text-[10px] text-slate-400">Cachet & Signature caisse Taiba</p>
            </div>
            <div className="text-right">
              <p className="text-slate-500 mb-10">Signature du Pèlerin ou Déposant :</p>
              <p className="font-semibold text-slate-800">{clientName}</p>
              <p className="text-[10px] text-slate-400">Pour acquit et validation du solde</p>
            </div>
          </div>

          <div className="mt-8 pt-3 border-t border-dashed border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-mono">Émis le {formatDate(payment.createdAt)} par ERP GIE TAIBA VOYAGES V4</span>
            <span className="text-emerald-700 font-medium flex items-center gap-1">
              <CheckCircle className="w-3 h-3 inline" /> Transaction enregistrée en base de données
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
