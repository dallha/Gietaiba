import React, { useRef } from 'react';
import { 
  QrCode, 
  Printer, 
  ShieldCheck, 
  Phone, 
  MapPin, 
  Compass, 
  User as UserIcon,
  Sparkles
} from 'lucide-react';
import { Client, Inscription, Voyage, VoyagePackage } from '../../types.js';

interface PilgrimBadgeViewProps {
  client: Client;
  activeInscription: Inscription | null;
}

export const PilgrimBadgeView: React.FC<PilgrimBadgeViewProps> = ({
  client,
  activeInscription,
}) => {
  const badgeRef = useRef<HTMLDivElement>(null);

  if (!activeInscription) {
    return (
      <div className="bg-white rounded-3xl p-8 text-center border border-slate-200">
        <p className="text-slate-500 text-xs">Veuillez d'abord sélectionner un dossier actif.</p>
      </div>
    );
  }

  // Requirement 14: OPAQUE QR CODE PAYLOAD
  // Strictly NO passport, phone, amount paid, balance, or sensitive PII in the QR code!
  // It contains only an opaque verification reference URL with an opaque hash.
  const opaqueToken = btoa(`${activeInscription.id}:${activeInscription.code}`).replace(/=/g, '');
  const opaqueVerificationUrl = `https://taibavoyages.sn/verify?ref=${encodeURIComponent(activeInscription.code)}&tok=${opaqueToken}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(opaqueVerificationUrl)}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header & Print Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <QrCode className="w-6 h-6 text-emerald-700" />
            <span>Badge & QR Code Officiel du Pèlerin</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Présentez ce badge numérique lors des convocations à l'aéroport et aux rassemblements
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Imprimer le Badge</span>
        </button>
      </div>

      {/* Main Badge Layout (Printable) */}
      <div className="max-w-md mx-auto print:max-w-sm print:mx-auto print:my-0">
        <div 
          ref={badgeRef}
          className="bg-white rounded-3xl border-2 border-slate-200 shadow-xl overflow-hidden print:shadow-none print:border print:m-0 print:rounded-2xl"
        >
          {/* Badge Header Strip */}
          <div className="bg-linear-to-r from-emerald-900 via-emerald-800 to-emerald-950 text-white p-6 text-center relative">
            <div className="w-12 h-12 bg-white/95 rounded-2xl p-1.5 flex items-center justify-center mx-auto mb-2 shadow-md">
              <img
                src="/assets/logo-taiba.svg"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/logo-taiba.svg';
                }}
                alt="Logo Officiel GIE TAIBA VOYAGES"
                className="w-full h-full object-contain"
              />
            </div>
            <h3 className="font-black text-sm tracking-wider uppercase">GIE TAIBA VOYAGES</h3>
            <p className="text-[10px] text-amber-300 font-bold uppercase tracking-widest mt-0.5">
              Badge Officiel Pèlerin • {activeInscription.voyage?.type || 'HAJJ'} {activeInscription.voyage?.year || '2027'}
            </p>
          </div>

          {/* Badge Body */}
          <div className="p-6 text-center space-y-4">
            {/* Pilgrim Avatar / Photo */}
            <div className="relative mx-auto w-24 h-24">
              {client.photoUrl ? (
                <img
                  src={client.photoUrl}
                  alt={`${client.firstName} ${client.lastName}`}
                  referrerPolicy="no-referrer"
                  className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-md mx-auto"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-emerald-100 text-emerald-900 border-2 border-emerald-200 flex items-center justify-center font-black text-2xl mx-auto">
                  {client.firstName ? client.firstName[0] : 'P'}{client.lastName ? client.lastName[0] : 'V'}
                </div>
              )}
            </div>

            {/* Pilgrim Name & Codes */}
            <div>
              <h4 className="text-lg font-black text-slate-900 leading-tight">
                {client.civility || ''} {client.firstName} {client.lastName}
              </h4>
              <p className="text-xs text-slate-500 font-mono mt-1">
                Client : <strong>{client.code}</strong> • Dossier : <strong>{activeInscription.code}</strong>
              </p>
            </div>

            {/* Campaign & Package Info */}
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 text-xs space-y-1">
              <div className="flex justify-between items-center text-slate-600">
                <span>Campagne :</span>
                <span className="font-bold text-slate-900">{activeInscription.voyage?.title || 'Campagne'}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Formule :</span>
                <span className="font-bold text-slate-900">{activeInscription.package?.name || 'Standard'}</span>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="bg-amber-50 rounded-2xl p-3 border border-amber-100 text-xs text-left">
              <p className="font-bold text-amber-900 text-[10px] uppercase tracking-wider mb-1">
                Contact d'Urgence Famille
              </p>
              <p className="font-bold text-slate-900">
                {client.contactPerson || 'Direction Taiba Voyages'}
              </p>
              <p className="text-slate-600 text-[11px]">
                {client.contactPhone || '+221 33 821 00 00'}
              </p>
            </div>

            {/* OPAQUE QR CODE */}
            <div className="pt-2 flex flex-col items-center">
              <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs inline-block">
                <img
                  src={qrCodeUrl}
                  alt="QR Code Pèlerin Opaque"
                  referrerPolicy="no-referrer"
                  className="w-36 h-36 mx-auto"
                />
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-2 max-w-xs">
                QR Code opaque de contrôle certifié GIE TAIBA VOYAGES (données sensibles protégées)
              </p>
            </div>
          </div>

          {/* Footer note */}
          <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 text-center text-[10px] text-slate-400">
            En cas de perte ou d'urgence aux Lieux Saints : Contactez le chef de mission Taiba.
          </div>
        </div>
      </div>
    </div>
  );
};
