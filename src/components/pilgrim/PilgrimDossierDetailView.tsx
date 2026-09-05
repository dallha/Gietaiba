import React from 'react';
import { 
  FileText, 
  User, 
  Compass, 
  CreditCard, 
  Plane, 
  Building, 
  ShieldAlert, 
  ShieldCheck, 
  Calendar, 
  Phone, 
  Mail, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  ArrowLeft
} from 'lucide-react';
import { Client, Inscription, Payment, PilgrimDocument, Visa, Flight, Hotel, Group } from '../../types.js';
import { formatFCFA, formatDate } from '../../utils/format.js';
import { PilgrimTab } from './PilgrimTypes.js';

interface PilgrimDossierDetailViewProps {
  client: Client;
  activeInscription: Inscription | null;
  payments: Payment[];
  documents: PilgrimDocument[];
  visa: Visa | null;
  flight: Flight | null;
  hotelMakkah: Hotel | null;
  hotelMadinah: Hotel | null;
  group: Group | null;
  isDenied?: boolean;
  onNavigateTab: (tab: PilgrimTab) => void;
}

export const PilgrimDossierDetailView: React.FC<PilgrimDossierDetailViewProps> = ({
  client,
  activeInscription,
  payments,
  documents,
  visa,
  flight,
  hotelMakkah,
  hotelMadinah,
  group,
  isDenied = false,
  onNavigateTab,
}) => {
  // Requirement 6: Strict IDOR Deny screen if user tried accessing unauthorized dossier
  if (isDenied || !activeInscription) {
    return (
      <div className="bg-white rounded-3xl p-8 sm:p-12 border border-red-200 text-center max-w-xl mx-auto space-y-4 shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto border border-red-200">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">Accès Refusé au Dossier</h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          Vous n'êtes pas autorisé à consulter ce dossier ou il ne fait pas partie de vos autorisations officielles accordées par l'administration de <strong>GIE TAIBA VOYAGES</strong>.
        </p>
        <button
          onClick={() => onNavigateTab('voyages')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Revenir à mes voyages autorisés</span>
        </button>
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

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded-md border border-slate-200">
              {activeInscription.code}
            </span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200 uppercase">
              {activeInscription.statut}
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900">
            Dossier : {activeInscription.voyage?.title || 'Pèlerinage'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Date d'inscription : {formatDate(activeInscription.createdAt || client.createdAt)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateTab('finances')}
            className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 transition cursor-pointer"
          >
            Voir les Versements
          </button>
          <button
            onClick={() => onNavigateTab('badge')}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Badge & QR
          </button>
        </div>
      </div>

      {/* Grid of Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. IDENTITÉ */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2 border-b border-slate-100 pb-3">
            <User className="w-4 h-4 text-emerald-700" />
            <span>Identité du Pèlerin</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Nom complet</span>
              <span className="font-bold text-slate-900 text-sm">
                {client.civility || ''} {client.firstName} {client.lastName}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-400 block text-[11px]">Passeport</span>
                <span className="font-mono font-bold text-slate-900">
                  {client.passportNumber || 'En attente de transmission'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Nationalité</span>
                <span className="font-bold text-slate-900">{client.nationality || 'Sénégalaise'}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-400 block text-[11px]">Téléphone</span>
                <span className="font-bold text-slate-900">{client.phone || 'Non renseigné'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Email</span>
                <span className="font-bold text-slate-900">{client.email || 'Non renseigné'}</span>
              </div>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Personne à contacter en urgence</span>
              <span className="font-medium text-slate-800">
                {client.contactPerson ? `${client.contactPerson} (${client.contactPhone || 'N/A'})` : 'Non renseignée'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. VOYAGE & TARIF CONVENU */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2 border-b border-slate-100 pb-3">
            <Compass className="w-4 h-4 text-amber-600" />
            <span>Voyage & Formule Contractuelle</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Campagne & Type</span>
              <span className="font-bold text-slate-900 text-sm">
                {activeInscription.voyage?.title || 'Campagne Officielle'}
              </span>
              <span className="text-slate-500 block text-[11px]">
                Type : {activeInscription.voyage?.type || 'HAJJ'} • Édition {activeInscription.voyage?.year || '2027'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-400 block text-[11px]">Date de départ</span>
                <span className="font-bold text-slate-900">
                  {activeInscription.voyage?.departureDate ? formatDate(activeInscription.voyage.departureDate) : 'À confirmer'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Date de retour</span>
                <span className="font-bold text-slate-900">
                  {activeInscription.voyage?.returnDate ? formatDate(activeInscription.voyage.returnDate) : 'À confirmer'}
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Package sélectionné :</span>
                <span className="font-bold text-slate-900">{activeInscription.package?.name || 'Standard'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Version tarifaire :</span>
                <span className="font-bold text-amber-700">
                  {activeInscription.priceVersionSnapshotted ? `Version V${activeInscription.priceVersionSnapshotted}` : 'V1'}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                <span className="font-bold text-slate-700">Tarif convenu (Snapshot) :</span>
                <span className="font-black text-slate-900">{formatFCFA(agreedPrice)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. FINANCES */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2 border-b border-slate-100 pb-3">
            <CreditCard className="w-4 h-4 text-emerald-700" />
            <span>Finances & État de Paiement</span>
          </h3>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-[10px] uppercase font-bold text-slate-400">Tarif Conclu</p>
              <p className="text-sm font-black text-slate-900 mt-0.5">{formatFCFA(agreedPrice)}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <p className="text-[10px] uppercase font-bold text-emerald-700">Total Versé</p>
              <p className="text-sm font-black text-emerald-800 mt-0.5">{formatFCFA(totalPaid)}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
              <p className="text-[10px] uppercase font-bold text-amber-700">Reste Dû</p>
              <p className="text-sm font-black text-amber-800 mt-0.5">{formatFCFA(remainingBalance)}</p>
            </div>
          </div>

          <div className="text-xs text-slate-500">
            <p>Nombre de versements enregistrés : <strong>{payments.length}</strong></p>
            <button
              onClick={() => onNavigateTab('finances')}
              className="mt-2 text-emerald-700 font-bold hover:underline cursor-pointer"
            >
              Consulter l'historique et imprimer vos reçus →
            </button>
          </div>
        </div>

        {/* 4. LOGISTIQUE (Vols, Hôtels, Encadrement) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2 border-b border-slate-100 pb-3">
            <Plane className="w-4 h-4 text-blue-600" />
            <span>Logistique & Hébergement</span>
          </h3>

          <div className="space-y-3 text-xs">
            {/* Vol */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <Plane className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-slate-900">Transport Aérien</p>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  {flight 
                    ? `Vol ${flight.airline || ''} (${flight.flightNumber || 'Direct'}) • Départ AIBD le ${flight.departureDate ? formatDate(flight.departureDate) : 'À préciser'}`
                    : 'Attribution des convocations et des billets en cours par la commission transport.'
                  }
                </p>
              </div>
            </div>

            {/* Hôtels */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <Building className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-slate-900">Hôtels aux Lieux Saints</p>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  {hotelMakkah?.name || 'Hôtel Makkah de standing'} & {hotelMadinah?.name || 'Hôtel Madinah proximité Mosquée'}
                </p>
              </div>
            </div>

            {/* Groupe */}
            {group && (
              <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100">
                <p className="font-bold text-emerald-950">Groupe & Accompagnement</p>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Groupe : <strong>{group.name}</strong> • Responsable : {group.leaderName || 'Guide Taiba'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. DOCUMENTS DU DOSSIER (Publics uniquement) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-700" />
            <span>Documents & Pièces Officielles Disponibles</span>
          </h3>
          <button
            onClick={() => onNavigateTab('documents')}
            className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
          >
            Accéder à la GED complète →
          </button>
        </div>

        {documents.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-4">
            Aucune pièce officielle n'a encore été rendue visible par l'administration.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {documents.slice(0, 6).map((doc) => (
              <div key={doc.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
                <div>
                  <p className="font-bold text-slate-900">{doc.name || doc.type}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Type : {doc.type} • {formatDate(doc.createdAt)}</p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    doc.status === 'VALIDE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {doc.status}
                  </span>
                  {doc.fileUrl && (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-emerald-700 hover:underline"
                    >
                      Consulter
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
