import React, { useState } from 'react';
import {
  FileText,
  Upload,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  Filter,
  Eye,
  Check,
  X,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { PilgrimDocument, Client, Inscription, AgencySettings } from '../../types.js';
import { formatDate, getDocStatusBadge } from '../../utils/format.js';

interface DocumentsModuleProps {
  documents: PilgrimDocument[];
  clients: Client[];
  inscriptions: Inscription[];
  settings?: AgencySettings;
  onRefresh: () => void;
  onCreateDocument: (doc: Partial<PilgrimDocument>) => Promise<PilgrimDocument>;
  onUpdateDocumentStatus: (
    id: string,
    status: PilgrimDocument['status'],
    comment?: string
  ) => Promise<PilgrimDocument>;
}

export const DocumentsModule: React.FC<DocumentsModuleProps> = ({
  documents,
  clients,
  inscriptions,
  settings,
  onRefresh,
  onCreateDocument,
  onUpdateDocumentStatus,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Upload Form State
  const [uploadClientId, setUploadClientId] = useState(clients[0]?.id || '');
  const [uploadType, setUploadType] = useState<PilgrimDocument['type']>('PASSEPORT');
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadVisibleToClient, setUploadVisibleToClient] = useState(true);

  // Review status modal
  const [reviewingDoc, setReviewingDoc] = useState<PilgrimDocument | null>(null);
  const [reviewComment, setReviewComment] = useState('');

  // Calculate completeness per client
  const clientCompleteness = clients.map((c) => {
    const clientDocs = documents.filter((d) => d.clientId === c.id);
    const validCount = clientDocs.filter((d) => d.status === 'VALIDE').length;
    // Essential docs: Passeport, Vaccin, Photo, Visa
    const totalRequired = 4;
    const rate = Math.min(100, Math.round((validCount / totalRequired) * 100));
    return {
      client: c,
      totalDocs: clientDocs.length,
      validCount,
      rate,
    };
  });

  const filteredDocs = documents.filter((doc) => {
    const client = clients.find((c) => c.id === doc.clientId);
    const clientName = client ? `${client.firstName} ${client.lastName}`.toLowerCase() : '';
    const term = searchTerm.toLowerCase();

    const matchesSearch =
      clientName.includes(term) ||
      doc.fileName.toLowerCase().includes(term) ||
      doc.type.toLowerCase().includes(term);

    const matchesType = typeFilter === 'ALL' || doc.type === typeFilter;
    const matchesStatus = statusFilter === 'ALL' || doc.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadClientId || !uploadFileName) {
      alert('Veuillez sélectionner un client et nommer le fichier.');
      return;
    }
    const matchingIns = inscriptions.find((i) => i.clientId === uploadClientId);
    try {
      await onCreateDocument({
        clientId: uploadClientId,
        inscriptionId: matchingIns?.id,
        type: uploadType,
        fileName: uploadFileName,
        fileUrl: `/uploads/${uploadFileName.toLowerCase().replace(/\s+/g, '_')}.pdf`,
        fileSize: '1.8 Mo',
        status: 'RECU',
        isClientVisible: uploadVisibleToClient,
      });
      setShowUploadModal(false);
      setUploadFileName('');
      onRefresh();
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    }
  };

  const handleUpdateStatus = async (status: PilgrimDocument['status']) => {
    if (!reviewingDoc) return;
    try {
      await onUpdateDocumentStatus(reviewingDoc.id, status, reviewComment);
      setReviewingDoc(null);
      setReviewComment('');
      onRefresh();
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-600" />
            Gestion Électronique des Documents (GED)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Vérification, validation et traçabilité des pièces administratives et sanitaires obligatoires.
          </p>
        </div>

        <button
          onClick={() => setShowUploadModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Upload className="w-4 h-4 text-amber-400" />
          Ajouter un Document
        </button>
      </div>

      {/* Summary Cards: Dossier Completeness */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block">Dossiers 100% Complets</span>
          <span className="text-2xl font-black text-emerald-700 mt-1 block">
            {clientCompleteness.filter((c) => c.rate >= 100).length} / {clients.length}
          </span>
          <p className="text-[11px] text-slate-400 mt-1">Prêts pour émission du visa Nusuk</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block">En cours de vérification</span>
          <span className="text-2xl font-black text-amber-600 mt-1 block">
            {documents.filter((d) => d.status === 'EN_VERIFICATION' || d.status === 'RECU').length}
          </span>
          <p className="text-[11px] text-slate-400 mt-1">Pièces transmises nécessitant contrôle</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block">Pièces Validées en Base</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">
            {documents.filter((d) => d.status === 'VALIDE').length}
          </span>
          <p className="text-[11px] text-slate-400 mt-1">Certifiées conformes par l'équipe administrative</p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Rechercher document, pèlerin..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:border-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-2.5 focus:outline-hidden focus:border-amber-500 cursor-pointer"
          >
            <option value="ALL">Tous les types de document</option>
            <option value="PASSEPORT">Passeport Biométrique</option>
            <option value="PHOTO">Photo d'Identité</option>
            <option value="VACCIN">Carnet de Vaccination</option>
            <option value="VISA">Visa Délivré</option>
            <option value="BILLET">Billet d'Avion</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-2.5 focus:outline-hidden focus:border-amber-500 cursor-pointer"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="VALIDE">Validé</option>
            <option value="RECU">Reçu</option>
            <option value="EN_VERIFICATION">En vérification</option>
            <option value="REFUSE">Refusé</option>
            <option value="EXPIRE">Expiré</option>
          </select>
        </div>
      </div>

      {/* Documents List: Mobile Cards + Desktop Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {/* Mobile Cards View */}
        <div className="block md:hidden p-3 space-y-3 bg-slate-50/50">
          {filteredDocs.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-lg border border-slate-200 p-4">
              Aucun document trouvé correspondant à ces filtres.
            </div>
          ) : (
            filteredDocs.map((doc) => {
              const client = clients.find((c) => c.id === doc.clientId);
              const badge = getDocStatusBadge(doc.status);
              return (
                <div
                  key={doc.id}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-[10px] text-slate-800 border border-slate-200">
                      {doc.type}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.bg}`}>
                      {badge.label}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {client?.civility} {client?.lastName} {client?.firstName}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{client?.phone}</p>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Fichier :</span>
                      <span className="font-mono font-bold text-slate-800 truncate max-w-[180px]">{doc.fileName}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Date réception :</span>
                      <span className="font-medium text-slate-700">{formatDate(doc.uploadedAt)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Portail pèlerin :</span>
                      <span className={doc.isClientVisible ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                        {doc.isClientVisible ? 'Visible en ligne' : 'Usage interne agence'}
                      </span>
                    </div>
                    {doc.verificationComment && (
                      <div className="mt-1 pt-1 border-t border-slate-200/60 text-amber-800 text-[11px] italic">
                        Note : {doc.verificationComment}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setReviewingDoc(doc);
                      setReviewComment(doc.verificationComment || '');
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    Vérifier / Modifier le statut
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
                <th className="py-3 px-4">Pèlerin</th>
                <th className="py-3 px-4">Type de Document</th>
                <th className="py-3 px-4">Nom du Fichier</th>
                <th className="py-3 px-4">Date Réception</th>
                <th className="py-3 px-4 text-center">Visibilité Pèlerin</th>
                <th className="py-3 px-4 text-center">Statut GED</th>
                <th className="py-3 px-4 text-right">Actions Validation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Aucun document trouvé correspondant à ces filtres.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => {
                  const client = clients.find((c) => c.id === doc.clientId);
                  const badge = getDocStatusBadge(doc.status);
                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">
                          {client?.civility} {client?.lastName} {client?.firstName}
                        </p>
                        <p className="text-[10px] text-slate-400">{client?.phone}</p>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{doc.type}</td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-slate-700">{doc.fileName}</span>
                        {doc.verificationComment && (
                          <p className="text-[10px] text-amber-800 italic">{doc.verificationComment}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{formatDate(doc.uploadedAt)}</td>
                      <td className="py-3 px-4 text-center">
                        {doc.isClientVisible ? (
                          <span className="text-emerald-700 font-bold text-[11px]">Oui</span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Interne</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setReviewingDoc(doc);
                            setReviewComment(doc.verificationComment || '');
                          }}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition-colors cursor-pointer"
                        >
                          Vérifier / Statut
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

      {/* Review Modal */}
      {reviewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                Contrôle de Conformité Documentaire
              </h3>
              <button onClick={() => setReviewingDoc(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <p className="font-semibold text-slate-800">{reviewingDoc.type} — {reviewingDoc.fileName}</p>
                <p className="text-slate-500">Statut actuel : <span className="font-bold">{reviewingDoc.status}</span></p>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Commentaire / Motif de décision
                </label>
                <textarea
                  rows={2}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Ex: Image très nette, validité vérifiée auprès des autorités..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleUpdateStatus('VALIDE')}
                  className="flex-1 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold inline-flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Check className="w-4 h-4" /> Valider Conforme
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateStatus('EN_VERIFICATION')}
                  className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer"
                >
                  En Cours
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateStatus('REFUSE')}
                  className="flex-1 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-bold cursor-pointer"
                >
                  Refuser
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Upload className="w-4 h-4 text-amber-400" />
                Enregistrer un Document dans la GED
              </h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Pèlerin concerné *</label>
                <select
                  required
                  value={uploadClientId}
                  onChange={(e) => setUploadClientId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.lastName} {c.firstName} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Type de Document *</label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5"
                >
                  <option value="PASSEPORT">Passeport Biométrique</option>
                  <option value="PHOTO">Photo d'Identité Norme Saoudienne</option>
                  <option value="VACCIN">Certificat de Vaccination (Méningite ACYW135)</option>
                  <option value="VISA">Visa Électronique Nusuk</option>
                  <option value="BILLET">Billet d'Avion Électronique</option>
                  <option value="ATTESTATION">Attestation Médicale d'Aptitude</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nom / Description du Fichier *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Passeport_Diallo_Ibrahima.pdf"
                  value={uploadFileName}
                  onChange={(e) => setUploadFileName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="visClient"
                  checked={uploadVisibleToClient}
                  onChange={(e) => setUploadVisibleToClient(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <label htmlFor="visClient" className="text-slate-700 font-medium">
                  Rendre visible dans l'Espace Pèlerin (Téléchargeable)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
