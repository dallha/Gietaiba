import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Download,
  Calendar,
  Users,
  CreditCard,
  Building,
  CheckCircle,
  LayoutDashboard,
  Loader2,
  FileCheck,
  ShieldCheck,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import { Client, Inscription, Payment, Voyage, Room, Hotel, AgencySettings } from '../../types.js';
import { formatFCFA, formatDate } from '../../utils/format.js';
import { downloadStructuredPdfReport, ReportType } from '../../utils/pdfReportGenerator.js';

interface RapportsModuleProps {
  clients: Client[];
  inscriptions: Inscription[];
  payments: Payment[];
  voyages: Voyage[];
  rooms: (Room & { occupants: Client[] })[];
  hotels: Hotel[];
  settings?: AgencySettings;
}

export const RapportsModule: React.FC<RapportsModuleProps> = ({
  clients,
  inscriptions,
  payments,
  voyages,
  rooms,
  hotels,
  settings,
}) => {
  const [selectedReport, setSelectedReport] = useState<ReportType>('financier');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // Financial aggregates
  const totalCA = inscriptions.reduce((acc, i) => acc + (i.appliedPrice || 0), 0);
  const totalEncaissé = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
  const totalReste = inscriptions.reduce((acc, i) => acc + (i.balance || 0), 0);
  const tauxRecouvrement = totalCA > 0 ? Math.round((totalEncaissé / totalCA) * 100) : 0;

  // Logistics aggregates
  const totalRooms = rooms.length;
  const totalBeds = rooms.reduce((sum, r) => sum + r.capacity, 0);
  const totalOccupants = rooms.reduce((sum, r) => sum + (r.occupants?.length || 0), 0);
  const tauxRemplissage = totalBeds > 0 ? Math.round((totalOccupants / totalBeds) * 100) : 0;

  // Pilgrims aggregates
  const totalPelerins = inscriptions.length;
  const pelerinsSoldes = inscriptions.filter((i) => i.balance === 0).length;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadReport = async (reportTypeToDownload?: ReportType) => {
    const targetType = reportTypeToDownload || selectedReport;
    setIsDownloading(true);
    setDownloadSuccess(null);

    try {
      const fileName = await downloadStructuredPdfReport({
        reportType: targetType,
        clients,
        inscriptions,
        payments,
        voyages,
        rooms,
        hotels,
        settings,
      });

      setDownloadSuccess(`Rapport officiel téléchargé : ${fileName}`);
      setTimeout(() => {
        setDownloadSuccess(null);
      }, 4500);
    } catch (err: any) {
      console.error('Erreur de génération PDF :', err);
      alert('Impossible de générer le rapport PDF. Veuillez réessayer.');
    } finally {
      setIsDownloading(false);
    }
  };

  const reportTabs = [
    {
      id: 'financier' as ReportType,
      label: 'Bilan Financier & Caisse',
      icon: CreditCard,
      description: 'Encaissements, facturation et créances résiduelles',
    },
    {
      id: 'pelerins' as ReportType,
      label: 'Manifeste Officiel Pèlerins',
      icon: Users,
      description: 'Liste légale des pèlerins pour la Délégation Générale',
    },
    {
      id: 'rooming' as ReportType,
      label: 'Rooming List Makkah / Médine',
      icon: Building,
      description: 'Répartition des chambres et lits par hôtel',
    },
    {
      id: 'recouvrement' as ReportType,
      label: 'État Créances & Débiteurs',
      icon: Calendar,
      description: 'Relances des soldes impayés avant départ',
    },
    {
      id: 'dashboard_summary' as ReportType,
      label: 'Synthèse Dashboard & Campagnes',
      icon: LayoutDashboard,
      description: 'Vue exécutive consolidée de tous les modules',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Download Report Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs print:hidden">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-600" />
            Centre d'Édition des Rapports & États Officiels
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Génération et export PDF certifié des états consolidés financiers, rooming lists et manifestes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Main Download Report Button */}
          <button
            id="download-report-btn"
            onClick={() => handleDownloadReport()}
            disabled={isDownloading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Télécharger le rapport actif au format PDF structuré avec logo et en-tête officiel"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Génération du PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Télécharger le Rapport (PDF)</span>
              </>
            )}
          </button>

          {/* Quick Print Button */}
          <button
            id="print-report-btn"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Imprimer directement le rapport actif"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>Imprimer</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {downloadSuccess && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold shadow-2xs animate-in fade-in-0 duration-200 print:hidden">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{downloadSuccess}</span>
          </div>
          <span className="text-[11px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
            PDF Officiel Prêt
          </span>
        </div>
      )}

      {/* Report Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 print:hidden">
        {reportTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = selectedReport === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-report-${tab.id}`}
              onClick={() => setSelectedReport(tab.id)}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-slate-900 text-amber-400 shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Quick Download Toolbar for specific reports */}
      <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
        <div className="flex items-center gap-2 text-slate-700">
          <ShieldCheck className="w-4 h-4 text-amber-600" />
          <span className="font-semibold">
            Rapport sélectionné :{' '}
            <strong className="text-slate-900">
              {reportTabs.find((t) => t.id === selectedReport)?.label}
            </strong>
          </span>
          <span className="text-slate-400 hidden sm:inline">• Document certifié conforme aux normes ministérielles</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDownloadReport('dashboard_summary')}
            disabled={isDownloading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-[11px] font-semibold cursor-pointer transition-colors"
          >
            <Download className="w-3 h-3 text-amber-600" />
            Synthèse Dashboard PDF
          </button>
          <button
            onClick={() => handleDownloadReport('financier')}
            disabled={isDownloading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-[11px] font-semibold cursor-pointer transition-colors"
          >
            <Download className="w-3 h-3 text-emerald-600" />
            Bilan Caisse PDF
          </button>
        </div>
      </div>

      {/* Printable Sheet Canvas with Official Agency Branding & Logo */}
      <div
        id="official-report-canvas"
        className="bg-white p-8 md:p-10 rounded-xl border border-slate-200 shadow-sm space-y-6 text-slate-900"
      >
        {/* Official Header with Logo & Branding from Settings */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b-2 border-slate-900 pb-5 gap-4">
          <div className="flex items-start gap-3.5">
            {/* Agency Logo / Emblem from settings */}
            {settings?.logoUrl && settings.logoUrl !== '/logo.png' ? (
              <img
                src={settings.logoUrl}
                alt={settings.agencyName || 'Logo Agence'}
                className="w-14 h-14 rounded-lg object-contain border border-slate-200 p-1 bg-white shadow-2xs shrink-0"
              />
            ) : (
              <div className="w-13 h-13 rounded-xl bg-linear-to-br from-slate-900 to-slate-800 border-2 border-amber-500/80 text-amber-400 font-serif font-black flex flex-col items-center justify-center text-lg shadow-sm shrink-0">
                <span>TV</span>
                <span className="text-[7px] font-sans font-bold text-slate-300 tracking-wider">HAJJ</span>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-slate-900">
                  {settings?.agencyName || 'GIE TAIBA VOYAGES'}
                </h2>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-1.5 py-0.2 rounded">
                  AGENCE AGRÉÉE
                </span>
              </div>
              <p className="text-xs text-amber-800 font-bold mt-0.5">
                {settings?.subtitle || 'Régie Générale du Pèlerinage Hajj & Oumrah — Sénégal & Arabie Saoudite'}
              </p>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-500 mt-1">
                <span>NINEA : <strong className="text-slate-700">{settings?.ninea || '005421882 2V3'}</strong></span>
                <span>•</span>
                <span>RC : <strong className="text-slate-700">{settings?.rcNumber || 'SN.DKR.2014.B.1820'}</strong></span>
                <span>•</span>
                <span>Agrément : <strong className="text-slate-700">{settings?.licenseNumber || 'HAJJ-SN-2027-042'}</strong></span>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 text-[10px] text-slate-400 mt-0.5">
                <span className="flex items-center gap-1">
                  <MapPin className="w-2.5 h-2.5" />
                  {settings?.address || 'Avenue Cheikh Anta Diop, Dakar, Sénégal'}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="w-2.5 h-2.5" />
                  {settings?.phone || '+221 33 824 55 00'}
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="w-2.5 h-2.5" />
                  {settings?.email || 'contact@taiba-voyages.sn'}
                </span>
              </div>
            </div>
          </div>

          <div className="text-left sm:text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
            <span className="text-[10px] font-mono text-slate-400 block">Date d'édition</span>
            <span className="text-xs font-bold text-slate-800">{formatDate(new Date().toISOString())}</span>
            <div className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded mt-1">
              <CheckCircle className="w-3 h-3 text-emerald-600" />
              <span>Certifié Conforme ERP V4</span>
            </div>
          </div>
        </div>

        {/* 1. RAPPORT FINANCIER */}
        {selectedReport === 'financier' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase">
                  État Récapitulatif Financier — Campagne 2027
                </h3>
                <p className="text-xs text-slate-500">Synthèse des engagements, encaissements et soldes résiduels</p>
              </div>
              <button
                onClick={() => handleDownloadReport('financier')}
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold cursor-pointer print:hidden"
              >
                <Download className="w-3.5 h-3.5 text-amber-700" />
                Télécharger ce bilan
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-center">
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Total Facturé Contrats</span>
                <span className="text-lg font-black text-slate-900">{formatFCFA(totalCA)}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Total Encaissé en Caisse</span>
                <span className="text-lg font-black text-emerald-700">{formatFCFA(totalEncaissé)}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Créances Résiduelles</span>
                <span className="text-lg font-black text-amber-700">{formatFCFA(totalReste)}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Taux de Recouvrement</span>
                <span className="text-lg font-black text-blue-700">{tauxRecouvrement}%</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase">Journal des Écritures Récentes de Caisse</h4>
              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-100 text-slate-700 font-semibold">
                  <tr>
                    <th className="py-2 px-3 border-b">N° Reçu</th>
                    <th className="py-2 px-3 border-b">Date</th>
                    <th className="py-2 px-3 border-b">Pèlerin</th>
                    <th className="py-2 px-3 border-b">Mode</th>
                    <th className="py-2 px-3 border-b text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 px-3 font-mono font-bold">{p.receiptNumber}</td>
                      <td className="py-2 px-3 text-slate-600">{formatDate(p.paymentDate)}</td>
                      <td className="py-2 px-3 font-medium">{p.clientName}</td>
                      <td className="py-2 px-3">{p.paymentMethod}</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-700">{formatFCFA(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. RAPPORT PÈLERINS / MANIFESTE */}
        {selectedReport === 'pelerins' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase">
                  Manifeste Officiel des Pèlerins Inscrits
                </h3>
                <p className="text-xs text-slate-500">Document légal destiné à la Délégation Générale au Pèlerinage</p>
              </div>
              <button
                onClick={() => handleDownloadReport('pelerins')}
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold cursor-pointer print:hidden"
              >
                <Download className="w-3.5 h-3.5 text-amber-700" />
                Télécharger le manifeste
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-center">
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Effectif Total Pèlerins</span>
                <span className="text-lg font-black text-slate-900">{totalPelerins} Pèlerins</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Pèlerins Totalement Soldés</span>
                <span className="text-lg font-black text-emerald-700">{pelerinsSoldes}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">En Cours de Paiement</span>
                <span className="text-lg font-black text-amber-700">{totalPelerins - pelerinsSoldes}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Total Facturé</span>
                <span className="text-lg font-black text-blue-700">{formatFCFA(totalCA)}</span>
              </div>
            </div>

            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-slate-100 text-slate-700 font-semibold">
                <tr>
                  <th className="py-2 px-3 border-b">N°</th>
                  <th className="py-2 px-3 border-b">Nom & Prénom</th>
                  <th className="py-2 px-3 border-b">N° Passeport</th>
                  <th className="py-2 px-3 border-b">Nationalité</th>
                  <th className="py-2 px-3 border-b">Téléphone</th>
                  <th className="py-2 px-3 border-b">Package</th>
                  <th className="py-2 px-3 border-b text-center">Statut Solde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inscriptions.map((ins, i) => (
                  <tr key={ins.id}>
                    <td className="py-2 px-3 font-mono">{i + 1}</td>
                    <td className="py-2 px-3 font-bold">
                      {ins.client?.civility} {ins.client?.lastName} {ins.client?.firstName}
                    </td>
                    <td className="py-2 px-3 font-mono">{ins.client?.passportNumber || 'En attente'}</td>
                    <td className="py-2 px-3">{ins.client?.nationality}</td>
                    <td className="py-2 px-3">{ins.client?.phone}</td>
                    <td className="py-2 px-3 font-medium">{ins.package?.name}</td>
                    <td className="py-2 px-3 text-center font-bold text-[10px]">
                      {ins.balance === 0 ? (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          SOLDÉ (100%)
                        </span>
                      ) : (
                        <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          SOLDE : {formatFCFA(ins.balance)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. ROOMING LIST */}
        {selectedReport === 'rooming' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase">
                  Plan de Répartition des Chambres (Rooming List Officielle)
                </h3>
                <p className="text-xs text-slate-500">Attribution des lits transmise à l'hôtelier en Arabie Saoudite</p>
              </div>
              <button
                onClick={() => handleDownloadReport('rooming')}
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold cursor-pointer print:hidden"
              >
                <Download className="w-3.5 h-3.5 text-amber-700" />
                Télécharger la rooming list
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-center">
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Total Chambres</span>
                <span className="text-lg font-black text-slate-900">{totalRooms}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Capacité Totale</span>
                <span className="text-lg font-black text-blue-700">{totalBeds} Lits</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Pèlerins Logés</span>
                <span className="text-lg font-black text-emerald-700">{totalOccupants}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Taux d'Occupation</span>
                <span className="text-lg font-black text-amber-700">{tauxRemplissage}%</span>
              </div>
            </div>

            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-slate-100 text-slate-700 font-semibold">
                <tr>
                  <th className="py-2 px-3 border-b">Chambre</th>
                  <th className="py-2 px-3 border-b">Hôtel & Ville</th>
                  <th className="py-2 px-3 border-b">Type</th>
                  <th className="py-2 px-3 border-b">Pèlerins Occupants</th>
                  <th className="py-2 px-3 border-b text-right">Remplissage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rooms.map((room) => {
                  const hotel = hotels.find((h) => h.id === room.hotelId);
                  return (
                    <tr key={room.id}>
                      <td className="py-2 px-3 font-mono font-bold">N° {room.roomNumber}</td>
                      <td className="py-2 px-3">
                        {hotel?.name} ({hotel?.city})
                      </td>
                      <td className="py-2 px-3 font-medium">{room.roomType || 'Standard'}</td>
                      <td className="py-2 px-3">
                        {room.occupants && room.occupants.length > 0 ? (
                          room.occupants.map((o) => (
                            <span key={o.id} className="inline-block mr-2 font-medium text-slate-800">
                              • {o.civility} {o.lastName} {o.firstName}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic">Vide</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-bold">
                        {room.occupants?.length || 0} / {room.capacity}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. ÉTAT RECOUVREMENT */}
        {selectedReport === 'recouvrement' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase">
                  Bordereau de Recouvrement des Créances Pèlerins
                </h3>
                <p className="text-xs text-slate-500">Listing prioritaire des soldes à régulariser avant émission des billets</p>
              </div>
              <button
                onClick={() => handleDownloadReport('recouvrement')}
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold cursor-pointer print:hidden"
              >
                <Download className="w-3.5 h-3.5 text-amber-700" />
                Télécharger les créances
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-center">
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Dossiers avec Solde Impayé</span>
                <span className="text-lg font-black text-rose-700">
                  {inscriptions.filter((i) => i.balance > 0).length} Pèlerins
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Acomptes Déjà Versés</span>
                <span className="text-lg font-black text-emerald-700">{formatFCFA(totalEncaissé)}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Montant Total à Recouvrer</span>
                <span className="text-lg font-black text-rose-700">{formatFCFA(totalReste)}</span>
              </div>
            </div>

            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-slate-100 text-slate-700 font-semibold">
                <tr>
                  <th className="py-2 px-3 border-b">Pèlerin</th>
                  <th className="py-2 px-3 border-b">Téléphone</th>
                  <th className="py-2 px-3 border-b">Dossier</th>
                  <th className="py-2 px-3 border-b text-right">Prix Convenu</th>
                  <th className="py-2 px-3 border-b text-right">Acomptes Encaissés</th>
                  <th className="py-2 px-3 border-b text-right">Reste à Recouvrer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inscriptions
                  .filter((i) => i.balance > 0)
                  .map((ins) => (
                    <tr key={ins.id}>
                      <td className="py-2 px-3 font-bold">
                        {ins.client?.civility} {ins.client?.lastName} {ins.client?.firstName}
                      </td>
                      <td className="py-2 px-3">{ins.client?.phone}</td>
                      <td className="py-2 px-3 font-mono">{ins.code}</td>
                      <td className="py-2 px-3 text-right">{formatFCFA(ins.appliedPrice)}</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-700">
                        {formatFCFA(ins.totalPaid)}
                      </td>
                      <td className="py-2 px-3 text-right font-black text-rose-700 text-sm">
                        {formatFCFA(ins.balance)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. SYNTHÈSE GLOBALE & TABLEAU DE BORD (DASHBOARD SUMMARY) */}
        {selectedReport === 'dashboard_summary' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase">
                  Synthèse Consolidée du Tableau de Bord & Campagnes
                </h3>
                <p className="text-xs text-slate-500">Vue macroscopique des opérations, de la trésorerie et des voyages</p>
              </div>
              <button
                onClick={() => handleDownloadReport('dashboard_summary')}
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold cursor-pointer print:hidden"
              >
                <Download className="w-3.5 h-3.5 text-amber-700" />
                Télécharger la synthèse
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-center">
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Total Engagements CA</span>
                <span className="text-lg font-black text-slate-900">{formatFCFA(totalCA)}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Total Encaissé</span>
                <span className="text-lg font-black text-emerald-700">{formatFCFA(totalEncaissé)}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Créances Résiduelles</span>
                <span className="text-lg font-black text-amber-700">{formatFCFA(totalReste)}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Effectif Global Pèlerins</span>
                <span className="text-lg font-black text-blue-700">{totalPelerins}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase">Répartition par Campagne & Voyage</h4>
              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-100 text-slate-700 font-semibold">
                  <tr>
                    <th className="py-2 px-3 border-b">Code</th>
                    <th className="py-2 px-3 border-b">Campagne</th>
                    <th className="py-2 px-3 border-b">Type</th>
                    <th className="py-2 px-3 border-b">Date Départ</th>
                    <th className="py-2 px-3 border-b text-center">Inscriptions / Capacité</th>
                    <th className="py-2 px-3 border-b text-right">CA Facturé</th>
                    <th className="py-2 px-3 border-b text-right">Encaissé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {voyages.map((v) => {
                    const vInscriptions = inscriptions.filter((i) => i.voyageId === v.id);
                    const vCA = vInscriptions.reduce((acc, i) => acc + (i.appliedPrice || 0), 0);
                    const vPaid = vInscriptions.reduce((acc, i) => acc + (i.totalPaid || 0), 0);

                    return (
                      <tr key={v.id}>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900">{v.code}</td>
                        <td className="py-2 px-3 font-semibold">{v.title}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              v.type === 'HAJJ'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                            }`}
                          >
                            {v.type}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-600">{formatDate(v.departureDate)}</td>
                        <td className="py-2 px-3 text-center font-bold">
                          {vInscriptions.length} / {v.capacity}
                        </td>
                        <td className="py-2 px-3 text-right font-medium">{formatFCFA(vCA)}</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-700">{formatFCFA(vPaid)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Official Footer Signature & Stamp Block */}
        <div className="pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <p className="font-bold text-slate-900">{settings?.agencyName || 'GIE TAIBA VOYAGES'}</p>
            <p className="text-[11px] text-slate-600 font-medium">
              Document officiel certifié conforme pour valoir ce que de droit
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Régie du Pèlerinage • NINEA : {settings?.ninea || '005421882 2V3'} • RC : {settings?.rcNumber || 'SN.DKR.2014.B.1820'}
            </p>
          </div>

          <div className="text-right">
            <div className="w-48 h-18 border-2 border-dashed border-amber-600/70 bg-amber-50/40 rounded-lg p-2 flex flex-col items-center justify-center text-center">
              <span className="text-[9px] font-black uppercase text-amber-800 tracking-wider">
                Cachet Officiel & Visa
              </span>
              <span className="text-[8px] font-bold text-slate-700 mt-0.5">
                {settings?.agencyName || 'GIE TAIBA VOYAGES'}
              </span>
              <span className="text-[7px] text-slate-400">Direction Générale — Dakar</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
