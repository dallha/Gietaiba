import React, { useState, useEffect } from 'react';
import {
  Compass,
  CreditCard,
  FileText,
  Stamp,
  Bed,
  Users2,
  Phone,
  Printer,
  CheckCircle,
  Clock,
  LogOut,
  AlertCircle,
  Download,
  Calendar,
  Building,
  ShieldCheck,
  QrCode,
} from 'lucide-react';
import QRCode from 'qrcode';
import { Client, Inscription, Payment, PilgrimDocument, Visa, AgencySettings } from '../../types.js';
import { formatFCFA, formatDate, getPaymentStatusBadge, getDocStatusBadge, getVisaStatusBadge } from '../../utils/format.js';
import { api } from '../../services/api.js';

interface EspacePelerinModuleProps {
  currentClientId: string;
  clients: Client[];
  settings?: AgencySettings;
  onExitPortal: () => void;
  onOpenReceipt: (payment: Payment, inscription?: Inscription) => void;
  onSelectClient: (clientId: string) => void;
}

export const EspacePelerinModule: React.FC<EspacePelerinModuleProps> = ({
  currentClientId,
  clients,
  settings,
  onExitPortal,
  onOpenReceipt,
  onSelectClient,
}) => {
  const [dossier, setDossier] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadPilgrimData() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getPilgrimDossier(currentClientId);
        setDossier(data);
        if (data?.inscription?.code) {
          const qrData = JSON.stringify({
            code: data.inscription.code,
            clientId: currentClientId,
            clientName: `${data.client?.firstName || ''} ${data.client?.lastName || ''}`.trim(),
            voyageId: data.inscription.voyageId,
          });
          const url = await QRCode.toDataURL(qrData, { width: 160, margin: 1 });
          setQrCodeUrl(url);
        }
      } catch (err: any) {
        setError(err.message || 'Impossible de charger votre dossier');
      } finally {
        setLoading(false);
      }
    }
    if (currentClientId) {
      loadPilgrimData();
    }
  }, [currentClientId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center text-white space-y-3">
          <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium">Chargement de votre Espace Pèlerin sécurisé...</p>
        </div>
      </div>
    );
  }

  const client = dossier?.client || clients.find((c) => c.id === currentClientId);
  const inscription: Inscription | undefined = dossier?.inscription;
  const payments: Payment[] = dossier?.payments || [];
  const docs: PilgrimDocument[] = dossier?.documents || [];
  const visa: Visa | undefined = dossier?.visa;
  const rooms: any[] = dossier?.rooms || [];
  const group = dossier?.group;

  const totalPaid = inscription?.totalPaid || 0;
  const appliedPrice = inscription?.appliedPrice || 5100000;
  const balance = inscription?.balance !== undefined ? inscription.balance : appliedPrice - totalPaid;
  const paymentProgress = appliedPrice > 0 ? Math.round((totalPaid / appliedPrice) * 100) : 0;

  const validDocsCount = docs.filter((d) => d.status === 'VALIDE').length;
  const docsProgress = Math.min(100, Math.round((validDocsCount / 4) * 100));

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans antialiased pb-12">
      {/* Mobile-Friendly Topbar */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-amber-500 to-amber-700 text-slate-950 font-serif font-black flex items-center justify-center text-sm shadow-xs border border-amber-300/40">
              TV
            </div>
            <div>
              <span className="text-xs font-bold tracking-tight text-white block">
                {settings?.agencyName || 'GIE TAIBA VOYAGES'}
              </span>
              <span className="text-[10px] text-amber-400 font-medium block">
                Portail Pèlerin Sécurisé
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Aperçu Fiche Pèlerin (Mode Back-Office Staff Uniquement) */}
            <div className="flex items-center gap-1 bg-slate-800/80 border border-slate-700 px-2 py-1 rounded-lg">
              <span className="text-[10px] text-amber-400 font-bold uppercase hidden sm:inline">Aperçu Client :</span>
              <select
                aria-label="Aperçu Client Staff"
                value={currentClientId}
                onChange={(e) => onSelectClient(e.target.value)}
                className="bg-transparent border-0 text-[11px] text-slate-200 focus:outline-hidden font-medium cursor-pointer"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                    {c.lastName} {c.firstName} ({c.id})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onExitPortal}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer border border-slate-700"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back-Office</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {/* Welcome Card */}
        <div className="bg-linear-to-br from-slate-900 via-slate-900 to-amber-950/40 p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between text-xs text-amber-400 font-semibold mb-2">
            <span>Dossier Officiel : {inscription?.code || 'DOS-HAJ2027'}</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px]">
              {inscription?.voyage?.title || 'Hajj 2027'}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-white">
            Bienvenue, {client?.civility} {client?.firstName} {client?.lastName}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Suivez en direct l'avancement de votre voyage, vos versements et vos documents de voyage.
          </p>

          <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400 text-[11px] block">Formule Souscrite</span>
              <span className="font-bold text-amber-300">{inscription?.package?.name || 'Package Standard'}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 text-[11px] block">Date de Départ</span>
              <span className="font-bold text-white">
                {formatDate(inscription?.voyage?.departureDate || '2027-05-20')}
              </span>
            </div>
          </div>
        </div>

        {/* Digital Badge & QR Pass */}
        {qrCodeUrl && (
          <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center gap-4">
            <div className="bg-white p-2.5 rounded-xl shrink-0 shadow-md">
              <img
                src={qrCodeUrl}
                alt="QR Code Pèlerin"
                className="w-24 h-24 sm:w-28 sm:h-28 object-contain"
              />
            </div>
            <div className="flex-1 text-center sm:text-left space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                <QrCode className="w-3 h-3" />
                <span>Pass & Badge Numérique Homologué</span>
              </div>
              <h3 className="text-sm font-bold text-white">
                Code Dossier : {inscription?.code}
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Présentez ce QR Code aux guichets de l'agence ou lors de l'enregistrement AIBD pour vérification instantanée de votre dossier.
              </p>
            </div>
          </div>
        )}

        {/* Financial Progress & Balance */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-400" />
              Situation Financière Personnelle
            </h2>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
              {paymentProgress} % Réglé
            </span>
          </div>

          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-linear-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, paymentProgress)}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 text-center">
            <div>
              <span className="text-[10px] text-slate-400 block">Tarif Convenu</span>
              <span className="font-bold text-xs text-white">{formatFCFA(appliedPrice)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Total Versé</span>
              <span className="font-bold text-xs text-emerald-400">{formatFCFA(totalPaid)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Solde Restant</span>
              <span className="font-bold text-xs text-amber-400">{formatFCFA(balance)}</span>
            </div>
          </div>

          {balance > 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-xs text-amber-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <span className="font-semibold">Rappel d'échéance :</span>
                <p className="text-[11px] text-amber-300/80 mt-0.5">
                  Merci de régulariser votre solde restant avant le 15 Avril 2027 auprès de notre caisse ou par Wave / Virement.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Official Receipts Download */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Printer className="w-4 h-4 text-amber-400" />
            Mes Reçus de Paiement Officiels
          </h2>

          {payments.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">Aucun reçu de paiement disponible pour l'instant.</p>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-400">{p.receiptNumber}</span>
                      <span className="text-[10px] text-slate-400 font-medium">({p.paymentMethod})</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Règlement du {formatDate(p.paymentDate)} • Encaissé par {p.agentName}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-black text-white">{formatFCFA(p.amount, p.currency)}</span>
                    <button
                      onClick={() => onOpenReceipt(p, inscription)}
                      className="px-2.5 py-1 rounded bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" /> Reçu
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Formalités, Visa & Hébergement Tabs / Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Visa Status */}
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Stamp className="w-4 h-4 text-amber-400" /> Visa Consulaire
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {visa?.status || 'EN_TRAITEMENT'}
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
              <p className="text-slate-400">
                Réf Nusuk : <span className="text-white font-mono">{visa?.nusukApplicationNumber || 'En cours'}</span>
              </p>
              <p className="text-slate-400">
                N° Visa : <span className="text-amber-400 font-mono font-bold">{visa?.visaNumber || 'Délivrance en attente'}</span>
              </p>
            </div>
          </div>

          {/* Group & Guide */}
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Users2 className="w-4 h-4 text-amber-400" /> Groupe & Encadrement
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {group?.name || 'Groupe 1 - Médine'}
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
              <p className="text-slate-400">
                Guide Référent : <span className="text-white font-bold">{group?.guideName || 'Oustaz Oumar Sall'}</span>
              </p>
              <p className="text-slate-400">
                Autocar Attribué : <span className="text-amber-300 font-bold">{group?.busNumber || 'Bus n° 04'}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Rooming & Hotels Info */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Bed className="w-4 h-4 text-amber-400" />
            Mes Hébergements Réservés
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300">
                MAKKAH
              </span>
              <p className="font-bold text-white text-sm mt-1">Hôtel Pullman Zamzam</p>
              <p className="text-slate-400 text-[11px]">En face du Haram (Tour de l'Horloge)</p>
              <p className="text-emerald-400 font-medium text-[11px] mt-2">
                Chambre 412 • Lit réservé
              </p>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300">
                MÉDINE
              </span>
              <p className="font-bold text-white text-sm mt-1">Mövenpick Anwar Al Madinah</p>
              <p className="text-slate-400 text-[11px]">Esplanade Nord de la Mosquée du Prophète</p>
              <p className="text-emerald-400 font-medium text-[11px] mt-2">
                Chambre 205 • Lit réservé
              </p>
            </div>
          </div>
        </div>

        {/* Direct Contact & Support */}
        <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-white">Assistance Pèlerins 24h/24</p>
              <p className="text-slate-400">{settings?.phone || '+221 33 824 55 00'}</p>
            </div>
          </div>

          <a
            href={`tel:${settings?.phone || '+221338245500'}`}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Appeler l'Agence
          </a>
        </div>
      </main>
    </div>
  );
};
