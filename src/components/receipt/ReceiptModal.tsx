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
    <div id="receipt-modal-backdrop" className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 sm:bg-slate-900/80 backdrop-blur-md sm:p-4 sm:items-center sm:justify-center overflow-hidden print:p-0 print:bg-white print:static print:block">
      <div className="w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] max-w-2xl bg-white sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 print:border-none print:shadow-none print:max-w-full print:w-full print:rounded-none print:h-auto print:max-h-full">
        {/* Actions bar (sticky top, non-printable) */}
        <div className="sticky top-0 z-20 shrink-0 flex items-center justify-between px-3.5 sm:px-6 py-3 sm:py-4 bg-slate-900 text-white shadow-xs print:hidden">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs sm:text-sm">
              ✓
            </span>
            <div>
              <h3 className="text-xs sm:text-sm font-semibold">Reçu Officiel de Caisse</h3>
              <p className="text-[11px] sm:text-xs text-slate-400">N° {payment.receiptNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              id="receipt-print-btn"
              onClick={handlePrint}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer</span>
            </button>
            <button
              id="receipt-download-btn"
              onClick={handleDownload}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Télécharger</span> PDF
            </button>
            <button
              id="receipt-close-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-1 sm:ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* The Formal Document (Scrollable body on mobile reader) */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3.5 sm:p-8 md:p-10 bg-slate-100/60 sm:bg-white print:p-0 print:overflow-visible print:bg-white">
          <div ref={receiptRef} className="bg-white p-4 sm:p-0 rounded-2xl sm:rounded-none border border-slate-200/80 sm:border-none shadow-xs sm:shadow-none text-slate-900 print:p-0 print:border-none print:shadow-none">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b-2 border-amber-600/30 pb-4 sm:pb-6 mb-4 sm:mb-6 gap-3 print:flex-row print:pb-2 print:mb-2 print:gap-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center font-serif text-base sm:text-lg font-bold print:w-7 print:h-7 print:text-sm">
                    TV
                  </div>
                  <div>
                    <h1 className="text-base sm:text-xl font-bold tracking-tight text-slate-900 print:text-base">
                      {settings?.agencyName || 'GIE TAIBA VOYAGES'}
                    </h1>
                    <p className="text-[11px] sm:text-xs text-amber-800 font-medium print:text-[9px]">Hajj & Oumrah — Agrément Officiel</p>
                  </div>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-1 sm:mt-2 max-w-sm leading-relaxed print:text-[8px] print:mt-0.5">
                  {settings?.address || 'Avenue Cheikh Anta Diop, Immeuble Taiba, Dakar'}<br />
                  Tél : {settings?.phone || '+221 33 824 55 00'} | Email : {settings?.email || 'contact@taiba-voyages.sn'}<br />
                  RC: {settings?.rcNumber || 'SN.DKR.2014.B.1820'} • NINEA: {settings?.ninea || '005421882 2V3'}
                </p>
              </div>

              <div className="text-left sm:text-right print:text-right">
                <span className="inline-block px-2 sm:px-3 py-0.5 sm:py-1 bg-amber-50 border border-amber-300 text-amber-900 text-[10px] sm:text-xs font-bold rounded-sm tracking-wider uppercase print:text-[8px] print:py-0">
                  REÇU DE PAIEMENT
                </span>
                <p className="text-sm sm:text-base font-mono font-bold text-slate-900 mt-1 sm:mt-2 print:text-xs print:mt-0.5">
                  N° {payment.receiptNumber}
                </p>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1 print:text-[8px]">
                  Date : <span className="font-semibold text-slate-700">{formatDate(payment.paymentDate)}</span>
                </p>
              </div>
            </div>

            {/* Core Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 bg-slate-50 p-3 sm:p-4 rounded-lg border border-slate-200 mb-4 sm:mb-6 text-xs sm:text-sm print:grid-cols-2 print:p-2 print:mb-2 print:gap-2 print:text-xs">
              <div>
                <span className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wide print:text-[8px]">Pèlerin / Client</span>
                <p className="text-sm sm:text-base font-bold text-slate-900 mt-0.5 print:text-xs">{clientName}</p>
                {inscription?.client?.code && (
                  <p className="text-[11px] sm:text-xs font-mono text-slate-500 print:text-[8px]">ID: {inscription.client.code}</p>
                )}
                {inscription?.client?.phone && (
                  <p className="text-[11px] sm:text-xs text-slate-600 print:text-[8px]">{inscription.client.phone}</p>
                )}
              </div>
              <div className="text-left sm:text-right print:text-right">
                <span className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wide print:text-[8px]">Campagne & Formule</span>
                <p className="text-sm sm:text-base font-bold text-slate-900 mt-0.5 print:text-xs">{voyageTitle}</p>
                <p className="text-[11px] sm:text-xs text-amber-800 font-semibold print:text-[8px]">Package {packageName}</p>
                {inscription?.code && (
                  <p className="text-[11px] sm:text-xs font-mono text-slate-500 print:text-[8px]">Dossier: {inscription.code}</p>
                )}
              </div>
            </div>

            {/* Payment Line Table */}
            <div className="border border-slate-200 rounded-lg overflow-x-auto mb-4 sm:mb-6 print:mb-2">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-[10px] sm:text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                    <th className="py-2.5 sm:py-3 px-3 sm:px-4 print:py-1 print:px-2">Désignation</th>
                    <th className="py-2.5 sm:py-3 px-3 sm:px-4 print:py-1 print:px-2">Mode de Paiement</th>
                    <th className="py-2.5 sm:py-3 px-3 sm:px-4 print:py-1 print:px-2">Référence</th>
                    <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-right print:py-1 print:px-2">Montant Encaissé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2.5 sm:py-3.5 px-3 sm:px-4 print:py-1.5 print:px-2">
                      <span className="font-semibold text-slate-900">Règlement d'acompte pèlerinage</span>
                      <div className="text-[11px] sm:text-xs text-slate-500">{payment.comment || 'Acompte enregistré en caisse'}</div>
                    </td>
                    <td className="py-2.5 sm:py-3.5 px-3 sm:px-4 font-medium text-slate-700 print:py-1.5 print:px-2">{payment.paymentMethod}</td>
                    <td className="py-2.5 sm:py-3.5 px-3 sm:px-4 font-mono text-[11px] sm:text-xs text-slate-600 print:py-1.5 print:px-2">{payment.reference || '—'}</td>
                    <td className="py-2.5 sm:py-3.5 px-3 sm:px-4 text-right font-bold text-slate-900 text-sm sm:text-base print:py-1.5 print:px-2">
                      {formatFCFA(payment.amount, payment.currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Financial Breakdown */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-3 sm:gap-4 mb-5 sm:mb-8 bg-amber-50/50 p-3 sm:p-4 rounded-lg border border-amber-200/60 print:flex-row print:p-2 print:mb-2 print:gap-2">
              <div className="text-[11px] sm:text-xs text-slate-600 max-w-xs space-y-1 print:text-[9px] print:space-y-0.5">
                <p className="font-semibold text-slate-800">Situation financière du dossier :</p>
                <p>Tarif convenu du package : <span className="font-medium text-slate-900">{formatFCFA(appliedPrice)}</span></p>
                <p>Cumul des versements validés : <span className="font-medium text-emerald-700">{formatFCFA(totalPaid)}</span></p>
                <p className="text-amber-900 font-bold">Solde restant à devoir : {formatFCFA(balance)}</p>
              </div>

              <div className="text-right w-full md:w-auto">
                <div className="bg-white px-4 sm:px-5 py-2 sm:py-3 rounded-lg border border-amber-300 shadow-xs inline-block print:py-1 print:px-2.5">
                  <span className="text-[10px] sm:text-xs text-slate-500 font-semibold uppercase tracking-wider block print:text-[8px]">Total Reçu</span>
                  <span className="text-xl sm:text-2xl font-black text-amber-700 print:text-base">{formatFCFA(payment.amount, payment.currency)}</span>
                </div>
              </div>
            </div>

            {/* Signature & Security Footer */}
            <div className="grid grid-cols-2 gap-4 sm:gap-8 pt-3 sm:pt-4 border-t border-slate-200 text-xs print:pt-1.5 print:gap-4">
              <div>
                <p className="text-slate-500 mb-6 sm:mb-10 print:mb-4 print:text-[9px]">Agent / Caissier ayant délivré :</p>
                <p className="font-semibold text-slate-800 print:text-[9px]">{payment.agentName}</p>
                <p className="text-[10px] text-slate-400 print:text-[7px]">Cachet & Signature caisse Taiba</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500 mb-6 sm:mb-10 print:mb-4 print:text-[9px]">Signature du Pèlerin ou Déposant :</p>
                <p className="font-semibold text-slate-800 print:text-[9px]">{clientName}</p>
                <p className="text-[10px] text-slate-400 print:text-[7px]">Pour acquit et validation du solde</p>
              </div>
            </div>

            <div className="mt-4 sm:mt-8 pt-2 sm:pt-3 border-t border-dashed border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[10px] sm:text-[11px] text-slate-400 gap-1 print:mt-1.5 print:pt-1 print:text-[7px] print:flex-row">
              <span className="font-mono">Émis le {formatDate(payment.createdAt)} par ERP GIE TAIBA VOYAGES V4</span>
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle className="w-3 h-3 inline print:w-2 print:h-2" /> Transaction enregistrée en base de données
              </span>
            </div>
          </div>
        </div>

        {/* Bottom touch actions bar for mobile reader */}
        <div className="flex sm:hidden items-center justify-between gap-2 p-3 bg-white border-t border-slate-200 shrink-0 shadow-xs print:hidden">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer text-center"
          >
            Fermer le lecteur
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimer</span>
          </button>
        </div>
      </div>
    </div>
  );
};
