import React from 'react';
import { 
  Compass, 
  Calendar, 
  CreditCard, 
  FileText, 
  ArrowRight, 
  CheckCircle, 
  Clock, 
  Layers, 
  Check
} from 'lucide-react';
import { Inscription, Payment, PilgrimDocument } from '../../types.js';
import { formatFCFA, formatDate } from '../../utils/format.js';
import { PilgrimTab } from './PilgrimTypes.js';

interface PilgrimVoyagesViewProps {
  inscriptions: Inscription[];
  activeInscriptionId: string;
  payments: Payment[];
  documents: PilgrimDocument[];
  onSelectInscription: (id: string) => void;
  onNavigateTab: (tab: PilgrimTab) => void;
}

export const PilgrimVoyagesView: React.FC<PilgrimVoyagesViewProps> = ({
  inscriptions,
  activeInscriptionId,
  payments,
  documents,
  onSelectInscription,
  onNavigateTab,
}) => {
  return (
    <div className="space-y-6">
      {/* Title & Introduction */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Compass className="w-6 h-6 text-emerald-700" />
            <span>Mes Voyages & Dossiers ({inscriptions.length})</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Consultez l'ensemble de vos dossiers officiels Hajj et Oumrah autorisés par l'administration
          </p>
        </div>
      </div>

      {inscriptions.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-base font-bold text-slate-800">Aucun voyage actif trouvé</p>
          <p className="text-xs text-slate-400 mt-1">
            Aucun dossier n'est actuellement rattaché à votre compte pèlerin.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {inscriptions.map((ins) => {
            const isCurrent = ins.id === activeInscriptionId;
            
            // Payments specific to this inscription
            const insPayments = payments.filter(p => !p.inscriptionId || p.inscriptionId === ins.id);
            const agreedPrice = ins.agreedPrice || ins.appliedPrice || 0;
            const totalPaid = ins.totalPaid !== undefined 
              ? ins.totalPaid 
              : insPayments.filter(p => p.status === 'VALIDE' || p.status === 'VALIDATED').reduce((s, p) => s + p.amount, 0);
            const balance = ins.balance !== undefined ? ins.balance : Math.max(0, agreedPrice - totalPaid);
            const percentPaid = agreedPrice > 0 ? Math.min(100, Math.round((totalPaid / agreedPrice) * 100)) : 0;

            // Documents for this inscription (strictly client-visible)
            const insDocs = documents.filter(d => !d.inscriptionId || d.inscriptionId === ins.id);
            const validatedDocs = insDocs.filter(d => d.status === 'VALIDE' || d.status === 'VALIDATED');

            return (
              <div
                key={ins.id}
                className={`bg-white rounded-3xl p-6 border transition-all shadow-xs flex flex-col justify-between ${
                  isCurrent 
                    ? 'border-emerald-600 ring-2 ring-emerald-600/20' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-4">
                  {/* Top Bar: Code, Type & Current Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200">
                        {ins.code}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        ins.voyage?.type === 'HAJJ' 
                          ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                          : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                      }`}>
                        {ins.voyage?.type || 'HAJJ'}
                      </span>
                    </div>

                    {isCurrent ? (
                      <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Dossier Sélectionné
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                        {ins.statut}
                      </span>
                    )}
                  </div>

                  {/* Voyage Title & Campagne Dates */}
                  <div>
                    <h3 className="text-lg font-black text-slate-900 leading-tight">
                      {ins.voyage?.title || 'Pèlerinage'}
                    </h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {ins.voyage?.departureDate ? `Départ : ${formatDate(ins.voyage.departureDate)}` : 'Dates à confirmer'}
                      </span>
                      {ins.voyage?.returnDate && (
                        <span>• Retour : {formatDate(ins.voyage.returnDate)}</span>
                      )}
                    </p>
                  </div>

                  {/* Package & Tariff Snapshot Invariant (Requirement 8) */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Package attribué :</span>
                      <span className="font-bold text-slate-900">{ins.package?.name || 'Standard'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Version tarifaire scellée :</span>
                      <span className="font-bold text-amber-700">
                        {ins.priceVersionSnapshotted ? `Version V${ins.priceVersionSnapshotted}` : 'Version V1'}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">Tarif convenu :</span>
                      <span className="font-black text-slate-900 text-sm">{formatFCFA(agreedPrice)}</span>
                    </div>
                  </div>

                  {/* Financial & Documentary Progress */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Montant versé :</span>
                      <span className="font-bold text-emerald-800">
                        {formatFCFA(totalPaid)} ({percentPaid}%)
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Solde restant dû :</span>
                      <span className={`font-black ${balance === 0 ? 'text-emerald-700' : 'text-amber-600'}`}>
                        {formatFCFA(balance)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Pièces validées :</span>
                      <span className="font-bold text-slate-700">
                        {validatedDocs.length} / {Math.max(validatedDocs.length, insDocs.length)} document(s)
                      </span>
                    </div>

                    {/* Mini progress line */}
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mt-2">
                      <div 
                        className="bg-emerald-600 h-full rounded-full transition-all"
                        style={{ width: `${percentPaid}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-5 border-t border-slate-100 mt-5 flex items-center justify-between gap-3">
                  <button
                    onClick={() => {
                      onSelectInscription(ins.id);
                      onNavigateTab('dossier');
                    }}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      isCurrent
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                    }`}
                  >
                    <span>Consulter le Dossier</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
