import React, { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Filter,
  Eye,
  Edit2,
  FileText,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  CheckCircle,
  AlertCircle,
  X,
  Printer,
  ChevronRight,
  Trash2,
  Upload,
  Download,
} from 'lucide-react';
import { Client, Inscription, Payment, PilgrimDocument, AgencySettings } from '../../types.js';
import { formatFCFA, formatDate, getDocStatusBadge, getPaymentStatusBadge } from '../../utils/format.js';
import { ConfirmModal } from '../../components/ui/ConfirmModal.js';
import { exportToCSV, parseCSV } from '../../utils/csv.js';

interface ClientsModuleProps {
  clients: Client[];
  inscriptions: Inscription[];
  payments: Payment[];
  documents: PilgrimDocument[];
  settings?: AgencySettings;
  initialSelectedClientId?: string | null;
  onRefresh: () => void;
  onCreateClient: (client: Partial<Client>) => Promise<Client>;
  onUpdateClient: (id: string, updates: Partial<Client>) => Promise<Client>;
  onDeleteClient: (id: string) => Promise<{ success: boolean; message: string }>;
  onOpenReceipt: (payment: Payment, inscription?: Inscription) => void;
  onNavigateToPayment: (clientId: string, inscriptionId?: string) => void;
}

export const ClientsModule: React.FC<ClientsModuleProps> = ({
  clients,
  inscriptions,
  payments,
  documents,
  settings,
  initialSelectedClientId,
  onRefresh,
  onCreateClient,
  onUpdateClient,
  onDeleteClient,
  onOpenReceipt,
  onNavigateToPayment,
}) => {
  console.log('[ClientsModule] Received clients length:', clients.length);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'inscriptions' | 'paiements' | 'documents'>('info');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const confirmDeleteClient = async () => {
    if (!selectedClient) return;
    try {
      await onDeleteClient(selectedClient.id);
      setSelectedClient(null);
      setShowDeleteConfirm(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la suppression');
    }
  };

  React.useEffect(() => {
    if (initialSelectedClientId) {
      const found = clients.find((c) => c.id === initialSelectedClientId);
      if (found) {
        setSelectedClient(found);
      }
    }
  }, [initialSelectedClientId, clients]);

  // New Client Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newClientData, setNewClientData] = useState<Partial<Client>>({
    civility: 'M.',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    nationality: 'Sénégalaise',
    passportNumber: '',
    passportExpiryDate: '',
    birthDate: '',
    gender: 'M',
    notes: '',
  });

  const filteredClients = clients.filter((client) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      client.firstName.toLowerCase().includes(term) ||
      client.lastName.toLowerCase().includes(term) ||
      client.code.toLowerCase().includes(term) ||
      client.phone.toLowerCase().includes(term) ||
      (client.passportNumber && client.passportNumber.toLowerCase().includes(term));

    const matchesStatus = statusFilter === 'ALL' || client.status === statusFilter;
    console.log(`[ClientsModule] Client: ${client.lastName}, matchesSearch: ${matchesSearch}, matchesStatus: ${matchesStatus}`);
    return matchesSearch && matchesStatus;
  });

  const handleSaveNewClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientData.firstName || !newClientData.lastName || !newClientData.phone) {
      alert('Veuillez renseigner le prénom, le nom et le numéro de téléphone.');
      return;
    }
    try {
      await onCreateClient(newClientData);
      setShowAddModal(false);
      setNewClientData({
        civility: 'M.',
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        nationality: 'Sénégalaise',
        passportNumber: '',
        passportExpiryDate: '',
        birthDate: '',
        gender: 'M',
        notes: '',
      });
      onRefresh();
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    }
  };

  // Get Inscriptions and financials for selected client
  const clientInscriptions = selectedClient
    ? inscriptions.filter((i) => i.clientId === selectedClient.id)
    : [];

  const clientPayments = selectedClient
    ? payments.filter((p) => p.clientId === selectedClient.id)
    : [];

  const clientDocuments = selectedClient
    ? documents.filter((d) => d.clientId === selectedClient.id)
    : [];

  const handleExport = () => {
    const exportData = filteredClients.map(c => ({
      Code: c.code,
      Civilité: c.civility,
      Prénom: c.firstName,
      Nom: c.lastName,
      Téléphone: c.phone,
      Email: c.email || '',
      Nationalité: c.nationality || '',
      Passeport: c.passportNumber || '',
      'Date Exp Passeport': c.passportExpiryDate || '',
      'Date Naissance': c.birthDate || '',
      Statut: c.status
    }));
    exportToCSV(exportData, `Clients_TAIBA_${new Date().toISOString().split('T')[0]}`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
      const data = await parseCSV(e.target.files[0]);
      // Process import (in a real app, this would validate and batch create)
      alert(`${data.length} clients trouvés dans le fichier CSV. Fonctionnalité d'import en masse à finaliser (nécessite l'API batch).`);
    } catch (err: any) {
      alert(`Erreur lors de la lecture du fichier CSV: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-600" />
            Répertoire des Pèlerins & Clients
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Gestion centrale des identités, passeports biométriques et historiques financiers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            Enregistrer un Pèlerin
          </button>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Rechercher par nom, code, tél, passeport..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-2.5 focus:outline-hidden focus:border-amber-500 cursor-pointer"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="ACTIF">Pèlerins Actifs</option>
            <option value="PROSPECT">Prospects</option>
            <option value="ARCHIVE">Archivés</option>
          </select>
          <span className="text-xs text-slate-500 font-medium ml-2">
            {filteredClients.length} résultat{filteredClients.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Main Clients List: Mobile Cards + Desktop Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {/* Mobile Cards View */}
        <div className="block md:hidden p-3 space-y-3 bg-slate-50/50">
          {filteredClients.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-lg border border-slate-200 p-4">
              Aucun pèlerin trouvé correspondant à votre recherche.
            </div>
          ) : (
            filteredClients.map((client) => {
              const clientIns = inscriptions.filter((i) => i.clientId === client.id);
              return (
                <div
                  key={client.id}
                  onClick={() => setSelectedClient(client)}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3 cursor-pointer hover:border-amber-400 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {client.code}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium bg-slate-100/70 px-2 py-0.5 rounded">
                      {client.nationality}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <span>{client.civility}</span>
                      <span>{client.lastName}</span>
                      <span>{client.firstName}</span>
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">{client.phone}</p>
                    {client.email && <p className="text-[11px] text-slate-400">{client.email}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Passeport</span>
                      {client.passportNumber ? (
                        <span className="font-mono font-bold text-slate-800 text-[11px] block truncate">
                          {client.passportNumber}
                        </span>
                      ) : (
                        <span className="text-rose-600 font-semibold text-[10px] block">Non renseigné</span>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Campagne</span>
                      {clientIns.length > 0 ? (
                        <span className="font-semibold text-slate-800 text-[11px] block truncate">
                          {clientIns[0].voyage?.code || 'HAJ2027'}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[10px] block">Aucune</span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedClient(client);
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Consulter le dossier complet
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
                <th className="py-3 px-4">Code / ID</th>
                <th className="py-3 px-4">Nom & Prénom</th>
                <th className="py-3 px-4">Téléphone & Email</th>
                <th className="py-3 px-4">N° Passeport</th>
                <th className="py-3 px-4">Inscriptions & Formule</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Aucun pèlerin trouvé correspondant à votre recherche.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const clientIns = inscriptions.filter((i) => i.clientId === client.id);
                  return (
                    <tr
                      key={client.id}
                      onClick={() => setSelectedClient(client)}
                      className="hover:bg-amber-50/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {client.code}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{client.civility}</span>
                          <span>{client.lastName}</span>
                          <span>{client.firstName}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{client.nationality}</span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-800">{client.phone}</p>
                        {client.email && <p className="text-[11px] text-slate-400">{client.email}</p>}
                      </td>
                      <td className="py-3 px-4">
                        {client.passportNumber ? (
                          <div>
                            <span className="font-mono font-semibold text-slate-800">
                              {client.passportNumber}
                            </span>
                            {client.passportExpiryDate && (
                              <p className="text-[10px] text-slate-400">
                                Exp: {formatDate(client.passportExpiryDate)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-rose-600 font-medium text-[11px]">Non renseigné</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {clientIns.length > 0 ? (
                          clientIns.map((ins) => (
                            <div key={ins.id} className="text-[11px]">
                              <span className="font-semibold text-slate-900">{ins.voyage?.code || 'HAJ2027'}</span>{' '}
                              <span className="text-amber-800">({ins.package?.name})</span>
                            </div>
                          ))
                        ) : (
                          <span className="text-slate-400 italic">Sans inscription</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClient(client);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Consulter
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

      {/* Pilgrim Profile Drawer / Modal */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="bg-slate-900 text-white p-5 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    FICHE PÈLERIN
                  </span>
                  <span className="font-mono text-xs text-slate-400">ID: {selectedClient.code}</span>
                </div>
                <h2 className="text-lg font-black text-white">
                  {selectedClient.civility} {selectedClient.firstName} {selectedClient.lastName}
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  {selectedClient.phone} • {selectedClient.nationality}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-600 text-slate-200 text-xs transition-colors cursor-pointer"
                  title="Supprimer le pèlerin"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => window.print()}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors cursor-pointer"
                  title="Imprimer la fiche"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center border-b border-slate-200 bg-slate-50 px-5 text-xs font-semibold text-slate-600">
              <button
                onClick={() => setActiveTab('info')}
                className={`py-3 px-3 border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'info'
                    ? 'border-amber-600 text-amber-900 font-bold bg-white'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                Informations & Passeport
              </button>
              <button
                onClick={() => setActiveTab('inscriptions')}
                className={`py-3 px-3 border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'inscriptions'
                    ? 'border-amber-600 text-amber-900 font-bold bg-white'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                Inscriptions ({clientInscriptions.length})
              </button>
              <button
                onClick={() => setActiveTab('paiements')}
                className={`py-3 px-3 border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'paiements'
                    ? 'border-amber-600 text-amber-900 font-bold bg-white'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                Paiements & Reçus ({clientPayments.length})
              </button>
              <button
                onClick={() => setActiveTab('documents')}
                className={`py-3 px-3 border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'documents'
                    ? 'border-amber-600 text-amber-900 font-bold bg-white'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                Documents GED ({clientDocuments.length})
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 flex-1 overflow-y-auto space-y-6 text-xs text-slate-700">
              {activeTab === 'info' && (
                <div className="space-y-6">
                  {/* Passeport Section */}
                  <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-3">
                    <h3 className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
                      <FileText className="w-4 h-4" /> Données Passeport Biométrique
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-slate-500 font-medium">N° de Passeport</span>
                        <p className="font-mono font-bold text-slate-900 text-sm">
                          {selectedClient.passportNumber || 'Non renseigné'}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Date d'Expiration</span>
                        <p className="font-semibold text-slate-900">
                          {formatDate(selectedClient.passportExpiryDate)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Nationalité</span>
                        <p className="font-semibold text-slate-900">{selectedClient.nationality}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Date de Naissance</span>
                        <p className="font-semibold text-slate-900">
                          {formatDate(selectedClient.birthDate)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Coordonnées */}
                  <div className="p-4 rounded-xl border border-slate-200 space-y-3">
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <Phone className="w-4 h-4 text-slate-500" /> Coordonnées & Contacts
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-slate-500 font-medium">Téléphone Principal</span>
                        <p className="font-semibold text-slate-900">{selectedClient.phone}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Email</span>
                        <p className="font-semibold text-slate-900">{selectedClient.email || '—'}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-500 font-medium">Adresse de résidence</span>
                        <p className="font-semibold text-slate-900">{selectedClient.address || 'Dakar, Sénégal'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Contact Urgence & Notes */}
                  <div className="p-4 rounded-xl border border-slate-200 space-y-3">
                    <h3 className="font-bold text-slate-900 text-sm">Contact d'Urgence & Accompagnement</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-slate-500 font-medium">Contact d'urgence</span>
                        <p className="font-semibold text-slate-900">{selectedClient.emergencyContact || '—'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Tuteur / Mahram</span>
                        <p className="font-semibold text-slate-900">{selectedClient.mahramName || 'Non spécifié'}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-500 font-medium">Notes & Antécédents médicaux</span>
                        <p className="text-slate-700 bg-slate-50 p-2 rounded border border-slate-200 mt-1">
                          {selectedClient.notes || 'Aucune note particulière'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'inscriptions' && (
                <div className="space-y-4">
                  {clientInscriptions.length === 0 ? (
                    <p className="text-slate-400 text-center py-6">Aucune inscription pour ce pèlerin.</p>
                  ) : (
                    clientInscriptions.map((ins) => {
                      const badge = getPaymentStatusBadge(ins.paymentStatus);
                      return (
                        <div key={ins.id} className="p-4 rounded-xl border border-slate-200 space-y-3 bg-white">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-bold text-slate-900 text-sm">
                                {ins.voyage?.title || 'Campagne Hajj 2027'}
                              </span>
                              <p className="text-xs text-amber-800 font-medium">
                                Package : {ins.package?.name}
                              </p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.bg}`}>
                              {badge.label}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-lg text-center">
                            <div>
                              <span className="text-[10px] text-slate-500 block">Tarif convenu</span>
                              <span className="font-bold text-slate-900">{formatFCFA(ins.appliedPrice)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">Versé</span>
                              <span className="font-bold text-emerald-700">{formatFCFA(ins.totalPaid)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">Solde Restant</span>
                              <span className="font-bold text-amber-700">{formatFCFA(ins.balance)}</span>
                            </div>
                          </div>

                          <div className="flex justify-end pt-2">
                            <button
                              onClick={() => {
                                onNavigateToPayment(selectedClient.id, ins.id);
                                setSelectedClient(null);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs cursor-pointer inline-flex items-center gap-1"
                            >
                              <CreditCard className="w-3.5 h-3.5" /> Encaisser un Versement
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {activeTab === 'paiements' && (
                <div className="space-y-4">
                  {clientPayments.length === 0 ? (
                    <p className="text-slate-400 text-center py-6">Aucun versement enregistré pour ce pèlerin.</p>
                  ) : (
                    <div className="space-y-3">
                      {clientPayments.map((p) => (
                        <div
                          key={p.id}
                          className="p-3.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-900">{p.receiptNumber}</span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium">
                                {p.paymentMethod}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {formatDate(p.paymentDate)} • Encaissé par {p.agentName}
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-black text-sm text-slate-900">
                              {formatFCFA(p.amount, p.currency)}
                            </span>
                            <button
                              onClick={() => onOpenReceipt(p, clientInscriptions[0])}
                              className="p-1.5 rounded-md bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300 transition-colors cursor-pointer"
                              title="Afficher & Imprimer le Reçu"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'documents' && (
                <div className="space-y-3">
                  {clientDocuments.length === 0 ? (
                    <p className="text-slate-400 text-center py-6">Aucun document rattaché.</p>
                  ) : (
                    clientDocuments.map((doc) => {
                      const badge = getDocStatusBadge(doc.status);
                      return (
                        <div
                          key={doc.id}
                          className="p-3 rounded-lg border border-slate-200 flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-slate-800">{doc.type}</span>
                            <p className="text-[10px] text-slate-500">Mis à jour le {formatDate(doc.updatedAt)}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.bg}`}>
                            {badge.label}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                Nouveau Dossier Pèlerin / Client
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewClient} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Civilité</label>
                  <select
                    value={newClientData.civility}
                    onChange={(e) => setNewClientData({ ...newClientData, civility: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  >
                    <option value="M.">M.</option>
                    <option value="Mme">Mme</option>
                    <option value="El Hadj">El Hadj</option>
                    <option value="Adja">Adja</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Prénom *</label>
                  <input
                    type="text"
                    required
                    value={newClientData.firstName}
                    onChange={(e) => setNewClientData({ ...newClientData, firstName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                    placeholder="Ex: Ibrahima"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Nom *</label>
                  <input
                    type="text"
                    required
                    value={newClientData.lastName}
                    onChange={(e) => setNewClientData({ ...newClientData, lastName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                    placeholder="Ex: DIALLO"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Téléphone Principal *</label>
                  <input
                    type="text"
                    required
                    value={newClientData.phone}
                    onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                    placeholder="+221 77 000 00 00"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Email</label>
                  <input
                    type="email"
                    value={newClientData.email}
                    onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                    placeholder="contact@exemple.sn"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">N° Passeport</label>
                  <input
                    type="text"
                    value={newClientData.passportNumber}
                    onChange={(e) => setNewClientData({ ...newClientData, passportNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 uppercase"
                    placeholder="N0123456"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Date Expiration</label>
                  <input
                    type="date"
                    value={newClientData.passportExpiryDate}
                    onChange={(e) => setNewClientData({ ...newClientData, passportExpiryDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Nationalité</label>
                  <input
                    type="text"
                    value={newClientData.nationality}
                    onChange={(e) => setNewClientData({ ...newClientData, nationality: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Notes / Remarques Internes</label>
                <textarea
                  rows={2}
                  value={newClientData.notes}
                  onChange={(e) => setNewClientData({ ...newClientData, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  placeholder="Informations médicales, préférences alimentaires..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold"
                >
                  Enregistrer le Pèlerin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmation de Suppression */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Confirmer la suppression"
        message={
          <>
            Êtes-vous sûr de vouloir supprimer définitivement le pèlerin <span className="font-bold text-slate-900">{selectedClient?.firstName} {selectedClient?.lastName}</span> ? 
            Toutes ses données (inscriptions, paiements, visas) seront effacées.
          </>
        }
        onConfirm={confirmDeleteClient}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
};
