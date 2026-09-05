import React, { useState } from 'react';
import {
  FileCheck,
  Plus,
  Search,
  CreditCard,
  Building,
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
  QrCode,
  Edit2,
  ShieldAlert,
  Upload,
  Download,
} from 'lucide-react';
import { Inscription, Client, Voyage, VoyagePackage, AgencySettings } from '../../types.js';
import { formatFCFA, formatDate, getPaymentStatusBadge } from '../../utils/format.js';
import { QrScannerModal } from '../../components/inscriptions/QrScannerModal.js';
import { useAuth } from '../../auth/AuthContext.js';
import { api } from '../../services/api.js';
import { exportToCSV, parseCSV } from '../../utils/csv.js';
import { logPriceModificationAudit } from '../../services/audit.service.js';

interface InscriptionsModuleProps {
  inscriptions: Inscription[];
  clients: Client[];
  voyages: Voyage[];
  packages: VoyagePackage[];
  settings?: AgencySettings;
  initialSearchTerm?: string | null;
  onRefresh: () => void;
  onCreateInscription: (data: {
    clientId: string;
    voyageId: string;
    packageId: string;
    status?: 'CONFIRMEE' | 'EN_ATTENTE';
  }) => Promise<Inscription>;
  onNavigateToPayment: (clientId: string, inscriptionId: string) => void;
}

export const InscriptionsModule: React.FC<InscriptionsModuleProps> = ({
  inscriptions,
  clients,
  voyages,
  packages,
  settings,
  initialSearchTerm,
  onRefresh,
  onCreateInscription,
  onNavigateToPayment,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [voyageFilter, setVoyageFilter] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);

  const { currentUser, role, hasPermission } = useAuth();
  const canEditPrice = hasPermission('inscriptions.update');

  // Price adjustment modal state
  const [editingPriceInscription, setEditingPriceInscription] = useState<Inscription | null>(null);
  const [newPriceInput, setNewPriceInput] = useState('');
  const [priceChangeReason, setPriceChangeReason] = useState('');
  const [priceChangeLoading, setPriceChangeLoading] = useState(false);
  const [priceChangeError, setPriceChangeError] = useState<string | null>(null);

  const openPriceEditModal = (ins: Inscription) => {
    setEditingPriceInscription(ins);
    setNewPriceInput(ins.appliedPrice.toString());
    setPriceChangeReason('');
    setPriceChangeError(null);
  };

  const handlePriceUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPriceInscription) return;
    const priceNum = Number(newPriceInput);
    if (!priceNum || priceNum <= 0) {
      setPriceChangeError('Veuillez indiquer un tarif supérieur à 0.');
      return;
    }
    if (!priceChangeReason.trim() || priceChangeReason.trim().length < 4) {
      setPriceChangeError('Le motif du changement de prix est obligatoire (min 4 caractères) pour conformité d\'audit.');
      return;
    }

    setPriceChangeLoading(true);
    setPriceChangeError(null);
    try {
      await api.updateInscriptionPrice(editingPriceInscription.id, priceNum, priceChangeReason.trim());
      
      // Also log audit event in Firestore
      if (currentUser) {
        const clientName = `${editingPriceInscription.client?.firstName || ''} ${editingPriceInscription.client?.lastName || ''}`.trim();
        await logPriceModificationAudit(
          currentUser.id,
          role?.id || 'STAFF',
          editingPriceInscription.id,
          editingPriceInscription.code,
          editingPriceInscription.appliedPrice,
          priceNum,
          priceChangeReason.trim(),
          clientName
        );
      }

      onRefresh();
      setEditingPriceInscription(null);
    } catch (err: any) {
      console.error('Failed to update price', err);
      setPriceChangeError(err.message || 'Échec de la mise à jour du prix');
    } finally {
      setPriceChangeLoading(false);
    }
  };

  React.useEffect(() => {
    if (initialSearchTerm) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm]);

  // New Inscription form state
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedVoyageId, setSelectedVoyageId] = useState(voyages[0]?.id || '');
  const [selectedPackageId, setSelectedPackageId] = useState('');

  // Packages available for selected voyage
  const availablePackages = packages.filter((p) => !selectedVoyageId || p.voyageId === selectedVoyageId);

  const filteredInscriptions = inscriptions.filter((ins) => {
    const term = searchTerm.toLowerCase();
    const clientName = `${ins.client?.firstName || ''} ${ins.client?.lastName || ''}`.toLowerCase();
    const matchesSearch =
      clientName.includes(term) ||
      ins.code.toLowerCase().includes(term) ||
      (ins.client?.phone && ins.client.phone.includes(term));

    const matchesVoyage = voyageFilter === 'ALL' || ins.voyageId === voyageFilter;
    return matchesSearch && matchesVoyage;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !selectedVoyageId || !selectedPackageId) {
      alert('Veuillez sélectionner un pèlerin, un voyage et un package.');
      return;
    }
    try {
      await onCreateInscription({
        clientId: selectedClientId,
        voyageId: selectedVoyageId,
        packageId: selectedPackageId,
        status: 'CONFIRMEE',
      });
      setShowModal(false);
      setSelectedClientId('');
      onRefresh();
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    }
  };

  const handleExport = () => {
    const exportData = filteredInscriptions.map(ins => {
      const client = clients.find(c => c.id === ins.clientId);
      const voyage = voyages.find(v => v.id === ins.voyageId);
      const pkg = packages.find(p => p.id === ins.packageId);
      return {
        'N° Dossier': ins.dossierNumber,
        Date: new Date(ins.createdAt).toLocaleDateString(),
        Client: client ? `${client.firstName} ${client.lastName}` : 'Inconnu',
        Téléphone: client?.phone || '',
        Voyage: voyage?.title || 'Inconnu',
        Package: pkg?.name || 'Inconnu',
        Statut: ins.status,
        'Prix Appliqué': ins.appliedPrice,
        'Payé': ins.paidAmount,
        'Reste à Payer': ins.appliedPrice - ins.paidAmount,
        'Statut Paiement': ins.paymentStatus
      };
    });
    exportToCSV(exportData, `Inscriptions_TAIBA_${new Date().toISOString().split('T')[0]}`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
      const data = await parseCSV(e.target.files[0]);
      alert(`${data.length} inscriptions trouvées dans le fichier CSV. L'import en masse est à relier à l'API backend.`);
    } catch (err: any) {
      alert(`Erreur lors de la lecture du fichier CSV: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-amber-600" />
            Inscriptions & Dossiers de Voyage
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Liaison contractuelle Pèlerin + Voyage + Package avec figeage du tarif convenu.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-colors cursor-pointer">
            <Upload className="w-4 h-4" />
            Importer CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
          </label>
          
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Exporter CSV
          </button>

          {/* QR Code Scanner Button */}
          <button
            id="open-qr-scanner-btn"
            onClick={() => setShowQrScanner(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>Scanner QR Code</span>
          </button>

          <button
            onClick={() => {
              if (voyages.length > 0 && !selectedVoyageId) setSelectedVoyageId(voyages[0].id);
              setShowModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Inscrire un Pèlerin</span>
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Rechercher par nom, code dossier, téléphone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={voyageFilter}
            onChange={(e) => setVoyageFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-2.5 focus:outline-hidden focus:border-amber-500 cursor-pointer"
          >
            <option value="ALL">Toutes les campagnes</option>
            {voyages.map((v) => (
              <option key={v.id} value={v.id}>
                {v.code} — {v.title}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500 font-medium ml-2">
            {filteredInscriptions.length} dossier{filteredInscriptions.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Inscriptions Content: Mobile Cards + Desktop Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {/* Mobile Cards View */}
        <div className="block md:hidden p-3 space-y-3 bg-slate-50/50">
          {filteredInscriptions.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-lg border border-slate-200 p-4">
              Aucun dossier d'inscription trouvé.
            </div>
          ) : (
            filteredInscriptions.map((ins) => {
              const badge = getPaymentStatusBadge(ins.paymentStatus);
              return (
                <div
                  key={ins.id}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {ins.code}
                    </span>
                    <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold border ${badge.bg}`}>
                      {badge.label}
                    </span>
                  </div>

                  <div>
                    <p className="font-bold text-slate-900 text-sm">
                      {ins.client?.civility} {ins.client?.lastName} {ins.client?.firstName}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{ins.client?.phone}</p>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Campagne :</span>
                      <span className="font-bold text-slate-800">{ins.voyage?.code}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Formule :</span>
                      <span className="font-semibold text-amber-800">{ins.package?.name}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 text-center">
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 block font-medium">Snapshot V{ins.priceVersionSnapshotted || 1}</span>
                      <span className="text-xs font-bold text-slate-800 block truncate">
                        {formatFCFA(ins.appliedPrice)}
                      </span>
                    </div>
                    <div className="bg-emerald-50/60 p-2 rounded-lg border border-emerald-100/60">
                      <span className="text-[10px] text-emerald-700 block font-medium">Versé</span>
                      <span className="text-xs font-bold text-emerald-700 block truncate">
                        {formatFCFA(ins.totalPaid)}
                      </span>
                    </div>
                    <div className="bg-amber-50/60 p-2 rounded-lg border border-amber-100/60">
                      <span className="text-[10px] text-amber-800 block font-medium">Reste</span>
                      <span className="text-xs font-bold text-amber-800 block truncate">
                        {formatFCFA(ins.balance)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onNavigateToPayment(ins.clientId, ins.id)}
                    className="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <CreditCard className="w-4 h-4" />
                    Encaisser un versement
                  </button>
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
                <th className="py-3 px-4">Dossier</th>
                <th className="py-3 px-4">Pèlerin</th>
                <th className="py-3 px-4">Campagne & Formule</th>
                <th className="py-3 px-4 text-right">Tarif Convenu (Snapshot)</th>
                <th className="py-3 px-4 text-right">Total Versé</th>
                <th className="py-3 px-4 text-right">Reste Dû</th>
                <th className="py-3 px-4 text-center">Statut Paiement</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInscriptions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Aucun dossier d'inscription trouvé.
                  </td>
                </tr>
              ) : (
                filteredInscriptions.map((ins) => {
                  const badge = getPaymentStatusBadge(ins.paymentStatus);
                  return (
                    <tr key={ins.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {ins.code}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">
                          {ins.client?.civility} {ins.client?.lastName} {ins.client?.firstName}
                        </p>
                        <p className="text-[11px] text-slate-400">{ins.client?.phone}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{ins.voyage?.code}</span>
                        <div className="text-[11px] text-amber-800 font-medium">
                          Package : {ins.package?.name}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-800">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="font-bold text-slate-900">{formatFCFA(ins.appliedPrice)}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-slate-100 text-slate-700 border border-slate-200" title="Version du tarif enregistrée lors de l'inscription">
                            V{ins.priceVersionSnapshotted || 1}
                          </span>
                          {canEditPrice && (
                            <button
                              onClick={() => openPriceEditModal(ins)}
                              title="Ajuster le tarif convenu (Dérogation / Remise / Surclassement)"
                              className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 cursor-pointer transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">Snapshot contractuel</div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-700">
                        {formatFCFA(ins.totalPaid)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-amber-700">
                        {formatFCFA(ins.balance)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold border ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onNavigateToPayment(ins.clientId, ins.id)}
                          className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          Encaisser
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Inscription Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-amber-400" />
                Nouvelle Inscription Pèlerin
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Pèlerin / Client *</label>
                <select
                  required
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
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
                <label className="font-semibold text-slate-700 block mb-1">Campagne Voyage *</label>
                <select
                  required
                  value={selectedVoyageId}
                  onChange={(e) => {
                    setSelectedVoyageId(e.target.value);
                    setSelectedPackageId('');
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5"
                >
                  {voyages.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.code} — {v.title} ({v.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Package & Formule Tarifaire *</label>
                <select
                  required
                  value={selectedPackageId}
                  onChange={(e) => setSelectedPackageId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5"
                >
                  <option value="">-- Sélectionner un package --</option>
                  {availablePackages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatFCFA(p.currentPrice)} ({p.roomType})
                    </option>
                  ))}
                </select>
              </div>

              {selectedPackageId && (() => {
                const selPkg = packages.find((p) => p.id === selectedPackageId);
                if (!selPkg) return null;
                const price = selPkg.currentPrice || selPkg.price || 0;
                return (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold">{selPkg.name} ({selPkg.category || 'STANDARD'})</span>
                      <span className="font-black text-sm">{formatFCFA(price)}</span>
                    </div>
                    <div className="text-[11px] text-amber-800 flex items-center justify-between border-t border-amber-200/60 pt-1">
                      <span>Version tarifaire active : <strong>Version {selPkg.activeVersionNumber || 1}</strong></span>
                      <span>Chambre : <strong>{selPkg.roomType || 'QUADRUPLE'}</strong></span>
                    </div>
                    <div className="text-[10px] text-amber-700 bg-amber-100/60 p-1.5 rounded">
                      🛡️ <strong>Règle d'invariance contractuelle :</strong> Ce montant de {formatFCFA(price)} constituera le snapshot financier historique immuable de ce dossier. Toute hausse future de la grille tarifaire de l'agence ne sera jamais répercutée sur ce pèlerin.
                    </div>
                  </div>
                );
              })()}

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
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                >
                  Valider l'Inscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Scanner Modal */}
      <QrScannerModal
        isOpen={showQrScanner}
        onClose={() => setShowQrScanner(false)}
        inscriptions={inscriptions}
        clients={clients}
        voyages={voyages}
        packages={packages}
        onSelectInscription={(selectedIns) => {
          setSearchTerm(selectedIns.code);
        }}
        onNavigateToPayment={onNavigateToPayment}
      />

      {/* Price Adjustment Modal with Mandatory Reason & Audit Trail */}
      {editingPriceInscription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Ajustement du Tarif Convenu
              </h3>
              <button 
                onClick={() => setEditingPriceInscription(null)} 
                disabled={priceChangeLoading}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePriceUpdateSubmit} className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Dossier :</span>
                  <span className="font-mono font-bold text-slate-800">{editingPriceInscription.code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Pèlerin :</span>
                  <span className="font-bold text-slate-800">
                    {editingPriceInscription.client?.lastName} {editingPriceInscription.client?.firstName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Tarif actuel :</span>
                  <span className="font-bold text-slate-900">{formatFCFA(editingPriceInscription.appliedPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Déjà versé :</span>
                  <span className="font-bold text-emerald-700">{formatFCFA(editingPriceInscription.totalPaid)}</span>
                </div>
              </div>

              {priceChangeError && (
                <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r text-xs">
                  {priceChangeError}
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Nouveau Tarif Convenu (FCFA) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1000"
                  value={newPriceInput}
                  onChange={(e) => setNewPriceInput(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="Ex: 5000000"
                />
                {newPriceInput && Number(newPriceInput) !== editingPriceInscription.appliedPrice && (
                  <p className="mt-1 text-[11px] font-medium text-slate-500">
                    Écart : {Number(newPriceInput) - editingPriceInscription.appliedPrice > 0 ? '+' : ''}
                    {formatFCFA(Number(newPriceInput) - editingPriceInscription.appliedPrice)}
                  </p>
                )}
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Motif Obligatoire du Changement (Audit) *
                </label>
                <textarea
                  required
                  rows={3}
                  value={priceChangeReason}
                  onChange={(e) => setPriceChangeReason(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 placeholder:text-slate-400"
                  placeholder="Ex: Remise commerciale validée par la Direction, surclassement chambre double, tarif dérogatoire..."
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Ce motif, l'ancien montant et le nouveau montant seront inscrits de manière inaltérable dans les journaux d'audit.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  disabled={priceChangeLoading}
                  onClick={() => setEditingPriceInscription(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={priceChangeLoading}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {priceChangeLoading ? 'Enregistrement...' : 'Valider le Nouveau Tarif'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
