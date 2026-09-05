import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Calendar, 
  CreditCard, 
  FileText, 
  Plane, 
  ShieldCheck, 
  ArrowRight,
  Sparkles,
  MapPin,
  AlertCircle,
  Building,
  Check
} from 'lucide-react';
import { Client, Inscription, Payment, PilgrimDocument, Visa, Flight, Hotel, Voyage } from '../../types.js';
import { formatFCFA, formatDate } from '../../utils/format.js';
import { PilgrimDossierProgress, PilgrimTab } from './PilgrimTypes.js';

interface PilgrimHomeViewProps {
  client: Client;
  activeInscription: Inscription | null;
  allInscriptions: Inscription[];
  payments: Payment[];
  documents: PilgrimDocument[];
  visa: Visa | null;
  flight: Flight | null;
  hotelMakkah: Hotel | null;
  hotelMadinah: Hotel | null;
  progress: PilgrimDossierProgress;
  onNavigateTab: (tab: PilgrimTab) => void;
  onSelectInscription: (id: string) => void;
}

export const PilgrimHomeView: React.FC<PilgrimHomeViewProps> = ({
  client,
  activeInscription,
  allInscriptions,
  payments,
  documents,
  visa,
  flight,
  hotelMakkah,
  hotelMadinah,
  progress,
  onNavigateTab,
  onSelectInscription,
}) => {
  if (!activeInscription) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
        <p className="text-slate-500 text-sm">Aucun dossier actif sélectionné.</p>
      </div>
    );
  }

  // Contract snapshot prices (Strict Requirement 8: Never recompute from current package price)
  const agreedPrice = activeInscription.agreedPrice || activeInscription.appliedPrice || 0;
  const totalPaid = activeInscription.totalPaid !== undefined 
    ? activeInscription.totalPaid 
    : payments.filter(p => p.status === 'VALIDE' || p.status === 'VALIDATED').reduce((sum, p) => sum + p.amount, 0);
  const remainingBalance = activeInscription.balance !== undefined
    ? activeInscription.balance
    : Math.max(0, agreedPrice - totalPaid);

  const financialPercent = agreedPrice > 0 ? Math.min(100, Math.round((totalPaid / agreedPrice) * 100)) : 0;

  // Next milestone determination from real data
  let nextMilestone: { title: string; date: string; description: string } | null = null;
  if (remainingBalance > 0) {
    nextMilestone = {
      title: 'Solde du séjour à régulariser',
      date: 'Avant la clôture administrative',
      description: `Reste à verser : ${formatFCFA(remainingBalance)}`
    };
  } else if (flight?.departureDate) {
    nextMilestone = {
      title: 'Convocation Vol Aller (AIBD)',
      date: formatDate(flight.departureDate),
      description: `Vol direct ${flight.airline || ''} (${flight.flightNumber || 'Direct'})`
    };
  } else if (activeInscription.voyage?.departureDate) {
    nextMilestone = {
      title: 'Départ prévisionnel de la campagne',
      date: formatDate(activeInscription.voyage.departureDate),
      description: activeInscription.voyage.title
    };
  }

  // Steps definition for dynamic progression tracker (Requirement 12)
  const STEPS = [
    {
      id: 'dossier',
      label: 'Dossier',
      done: progress.dossierComplete,
      detail: activeInscription.statut || 'Enregistré'
    },
    {
      id: 'documents',
      label: 'Documents',
      done: progress.documentsComplete,
      detail: `${progress.documentsRatio.validated}/${progress.documentsRatio.total} validés`
    },
    {
      id: 'visa',
      label: 'Visa',
      done: progress.visaComplete,
      detail: visa?.statut === 'VALIDE' || visa?.statut === 'EMIS' ? 'Obtenu' : 'En instruction'
    },
    {
      id: 'billet',
      label: 'Billet & Vol',
      done: progress.flightComplete,
      detail: flight ? 'Confirmé' : 'En attente'
    },
    {
      id: 'logistique',
      label: 'Hébergement',
      done: progress.hotelComplete,
      detail: hotelMakkah || hotelMadinah ? 'Attribué' : 'En cours'
    },
    {
      id: 'depart',
      label: 'Prêt au départ',
      done: progress.readyForDeparture,
      detail: progress.readyForDeparture ? 'Prêt' : 'En finalisation'
    }
  ];

  return (
    <div className="space-y-6">
      {/* 1. Welcome Card & Pilgrim Identity */}
      <div className="bg-linear-to-br from-emerald-900 via-emerald-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-md border border-emerald-800 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-emerald-700/60 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold text-amber-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Espace Personnel GIE TAIBA VOYAGES</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Bienvenue, {client.civility || ''} {client.firstName} {client.lastName}
            </h1>
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-emerald-200">
              <span className="font-mono bg-emerald-950/60 px-2.5 py-0.5 rounded-md border border-emerald-700/50">
                Code Client : <strong className="text-white">{client.code}</strong>
              </span>
              <span>•</span>
              <span>Dossier actif : <strong className="text-white">{activeInscription.code}</strong></span>
              <span>•</span>
              <span>Passeport : <strong className="font-mono text-white">{client.passportNumber || 'N/A'}</strong></span>
            </div>
          </div>

          {/* Quick Financial Snapshot Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 sm:min-w-64">
            <p className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider">
              Statut du Règlement
            </p>
            <p className="text-2xl font-black text-amber-400 mt-1">
              {formatFCFA(remainingBalance)}
            </p>
            <p className="text-[11px] text-slate-300 mt-0.5">
              {remainingBalance === 0 ? 'Dossier intégralement soldé' : 'Solde restant dû'}
            </p>
            
            {/* Progress mini-bar */}
            <div className="w-full bg-black/20 rounded-full h-2 mt-3 overflow-hidden">
              <div 
                className="bg-amber-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${financialPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-emerald-200 text-right mt-1 font-bold">
              {financialPercent}% réglé
            </p>
          </div>
        </div>
      </div>

      {/* 2. Dynamic Progression Tracker (Requirement 12: Real Progression Tracker) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Progression Réelle de Votre Dossier</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Étape calculée strictement d'après vos pièces, versements et formalités réelles
            </p>
          </div>
          <span className="text-sm font-black text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            {progress.overallPercentage}%
          </span>
        </div>

        {/* Dynamic Multi-Step Flow */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
          {STEPS.map((step, idx) => (
            <div 
              key={step.id} 
              className={`p-3 rounded-xl border transition-all text-left ${
                step.done 
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' 
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono font-bold text-slate-400">0{idx + 1}</span>
                {step.done ? (
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                    <Check className="w-3 h-3" />
                  </span>
                ) : (
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px] font-bold">
                    <Clock className="w-3 h-3" />
                  </span>
                )}
              </div>
              <p className="text-xs font-bold leading-tight">{step.label}</p>
              <p className={`text-[10px] mt-0.5 font-medium ${step.done ? 'text-emerald-700' : 'text-slate-400'}`}>
                {step.detail}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Essential Dashboard Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Campagne & Snapshot Tarifaire (Requirement 8) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Voyage & Inscription Snapshot Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span>Campagne & Formule Tarifaire</span>
              </h3>
              <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-lg uppercase">
                {activeInscription.statut}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px] mb-0.5">Campagne Officielle</span>
                <span className="font-bold text-slate-900 text-sm block">
                  {activeInscription.voyage?.title || 'Campagne Taiba Voyages'}
                </span>
                <span className="text-slate-500 mt-1 block">
                  Type : <strong>{activeInscription.voyage?.type || 'HAJJ'}</strong> • Année {activeInscription.voyage?.year || '2027'}
                </span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px] mb-0.5">Package & Version Tarifaire</span>
                <span className="font-bold text-slate-900 text-sm block">
                  {activeInscription.package?.name || 'Package Sélectionné'}
                </span>
                <span className="text-amber-700 font-bold mt-1 block">
                  Snapshot : {activeInscription.priceVersionSnapshotted ? `Version V${activeInscription.priceVersionSnapshotted}` : 'Version Fixée'}
                </span>
              </div>
            </div>

            {/* Invariant Tariff Snapshot Notice */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-bold text-slate-800">Tarif Convenu à l'Inscription (Invariable)</p>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Le montant contractuel de votre dossier est strictement scellé :
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-lg font-black text-slate-900">{formatFCFA(agreedPrice)}</p>
                <p className="text-[10px] text-emerald-700 font-bold">
                  {totalPaid >= agreedPrice ? 'Payé en totalité' : `${formatFCFA(totalPaid)} déjà versés`}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => onNavigateTab('dossier')}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
              >
                <span>Consulter le détail complet du dossier</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Access Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Finances Action */}
            <button
              onClick={() => onNavigateTab('finances')}
              className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-xs transition text-left cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <CreditCard className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-slate-900">Versements & Reçus</h4>
              <p className="text-xs text-slate-500 mt-1">
                {payments.length} versement(s) enregistré(s) • Consultez et téléchargez vos reçus certifiés.
              </p>
            </button>

            {/* GED Documents Action */}
            <button
              onClick={() => onNavigateTab('documents')}
              className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-xs transition text-left cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-slate-900">Mes Pièces & GED</h4>
              <p className="text-xs text-slate-500 mt-1">
                {documents.length} document(s) visible(s) • Passeport, assurance, attestation et visa.
              </p>
            </button>
          </div>
        </div>

        {/* Right Column: Next Milestones & Badge Shortcut */}
        <div className="space-y-6">
          {/* Next Milestone Box */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Prochaine Échéance</span>
            </h3>

            {nextMilestone ? (
              <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 text-xs space-y-1.5">
                <p className="font-black text-amber-900 text-sm">{nextMilestone.title}</p>
                <p className="text-amber-800 font-bold flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  <span>{nextMilestone.date}</span>
                </p>
                <p className="text-slate-600 text-[11px] leading-relaxed pt-1">
                  {nextMilestone.description}
                </p>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400">
                Toutes les formalités actuelles sont à jour pour ce dossier.
              </div>
            )}

            {/* Assistance Contact Note */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-600 space-y-1">
              <p className="font-bold text-slate-900">Besoin d'aide sur votre voyage ?</p>
              <p className="text-slate-500">Contactez votre conseiller Taiba Voyages ou rendez-vous en agence.</p>
            </div>
          </div>

          {/* Badge & Opaque QR Shortcut (Requirement 14) */}
          <div className="bg-linear-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-xs border border-slate-800 text-center space-y-3">
            <div className="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-base">Badge Pèlerin Numérique</h4>
              <p className="text-xs text-slate-400 mt-1">
                Présentez votre QR Code sécurisé lors des convocations et rassemblements
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('badge')}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Afficher mon Badge & QR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
