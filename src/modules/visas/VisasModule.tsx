import React, { useState } from 'react';
import {
  Stamp,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  Edit2,
  FileCheck,
} from 'lucide-react';
import { Visa, Client, Voyage, AgencySettings } from '../../types.js';
import { formatDate, getVisaStatusBadge } from '../../utils/format.js';

interface VisasModuleProps {
  visas: Visa[];
  clients: Client[];
  voyages: Voyage[];
  settings?: AgencySettings;
  onRefresh: () => void;
  onUpdateVisa: (id: string, updates: Partial<Visa>) => Promise<Visa>;
}

export const VisasModule: React.FC<VisasModuleProps> = ({
  visas,
  clients,
  voyages,
  settings,
  onRefresh,
  onUpdateVisa,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [editingVisa, setEditingVisa] = useState<Visa | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState<Partial<Visa>>({
    status: 'APPROUVE',
    visaNumber: '',
    nusukApplicationNumber: '',
    issueDate: '',
    expiryDate: '',
    rejectionReason: '',
  });

  const filteredVisas = visas.filter((v) => {
    const client = clients.find((c) => c.id === v.clientId);
    const clientName = client ? `${client.firstName} ${client.lastName}`.toLowerCase() : '';
    const term = searchTerm.toLowerCase();

    const matchesSearch =
      clientName.includes(term) ||
      (v.visaNumber && v.visaNumber.toLowerCase().includes(term)) ||
      (v.nusukApplicationNumber && v.nusukApplicationNumber.toLowerCase().includes(term));

    const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVisa) return;
    try {
      await onUpdateVisa(editingVisa.id, editForm);
      setEditingVisa(null);
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
            <Stamp className="w-5 h-5 text-amber-600" />
            Suivi des Visas & Plateforme Nusuk
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pilotage des demandes d'e-Visas Hajj & Oumrah auprès des autorités consulaires saoudiennes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
            {visas.filter((v) => v.status === 'APPROUVE').length} Visas Délivrés
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold">
            {visas.filter((v) => v.status === 'DEMANDE' || v.status === 'EN_TRAITEMENT').length} En Traitement
          </span>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Rechercher visa, n° Nusuk, pèlerin..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-2.5 focus:outline-hidden focus:border-amber-500 cursor-pointer"
          >
            <option value="ALL">Tous les statuts de visa</option>
            <option value="APPROUVE">Visas Approuvés</option>
            <option value="EN_TRAITEMENT">En traitement consulaire</option>
            <option value="DEMANDE">Demande déposée</option>
            <option value="DOSSIER_EN_PREPARATION">En préparation</option>
            <option value="REFUSE">Refusés</option>
          </select>
          <span className="text-xs text-slate-500 font-medium ml-2">
            {filteredVisas.length} dossier{filteredVisas.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Visas List: Mobile Cards + Desktop Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {/* Mobile Cards View */}
        <div className="block md:hidden p-3 space-y-3 bg-slate-50/50">
          {filteredVisas.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-lg border border-slate-200 p-4">
              Aucune fiche visa ne correspond à vos critères.
            </div>
          ) : (
            filteredVisas.map((visa) => {
              const client = clients.find((c) => c.id === visa.clientId);
              const badge = getVisaStatusBadge(visa.status);
              return (
                <div
                  key={visa.id}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {visa.nusukApplicationNumber ? `Nusuk : ${visa.nusukApplicationNumber}` : 'Demande non déposée'}
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
                      <span>N° Passeport :</span>
                      <span className="font-mono font-bold text-slate-800">{client?.passportNumber || 'Non renseigné'}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>N° Visa Délivré :</span>
                      <span className="font-mono font-bold text-slate-900">{visa.visaNumber || 'En attente'}</span>
                    </div>
                    {visa.issueDate && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Validité :</span>
                        <span className="font-medium text-slate-700">Du {formatDate(visa.issueDate)} au {formatDate(visa.expiryDate)}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setEditingVisa(visa);
                      setEditForm({
                        status: visa.status,
                        visaNumber: visa.visaNumber || '',
                        nusukApplicationNumber: visa.nusukApplicationNumber || '',
                        issueDate: visa.issueDate || '',
                        expiryDate: visa.expiryDate || '',
                        rejectionReason: visa.rejectionReason || '',
                      });
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                    Mettre à jour le visa
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
                <th className="py-3 px-4">N° Passeport</th>
                <th className="py-3 px-4">Réf. Demande Nusuk</th>
                <th className="py-3 px-4">N° Visa Délivré</th>
                <th className="py-3 px-4">Validité</th>
                <th className="py-3 px-4 text-center">Statut Actuel</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVisas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Aucune fiche visa ne correspond à vos critères.
                  </td>
                </tr>
              ) : (
                filteredVisas.map((visa) => {
                  const client = clients.find((c) => c.id === visa.clientId);
                  const badge = getVisaStatusBadge(visa.status);
                  return (
                    <tr key={visa.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">
                          {client?.civility} {client?.lastName} {client?.firstName}
                        </p>
                        <p className="text-[10px] text-slate-400">{client?.phone}</p>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                        {client?.passportNumber || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {visa.nusukApplicationNumber || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {visa.visaNumber || 'En attente'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {visa.issueDate ? (
                          <span>
                            Du {formatDate(visa.issueDate)} au {formatDate(visa.expiryDate)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setEditingVisa(visa);
                            setEditForm({
                              status: visa.status,
                              visaNumber: visa.visaNumber || '',
                              nusukApplicationNumber: visa.nusukApplicationNumber || '',
                              issueDate: visa.issueDate || '',
                              expiryDate: visa.expiryDate || '',
                              rejectionReason: visa.rejectionReason || '',
                            });
                          }}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" /> Mettre à jour
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

      {/* Edit Visa Modal */}
      {editingVisa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Stamp className="w-4 h-4 text-amber-400" />
                Mise à Jour Visa Pèlerin
              </h3>
              <button onClick={() => setEditingVisa(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Statut Nusuk *</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5"
                >
                  <option value="DOSSIER_EN_PREPARATION">Dossier en préparation</option>
                  <option value="DEMANDE">Demande déposée</option>
                  <option value="EN_TRAITEMENT">En cours de traitement</option>
                  <option value="APPROUVE">Visa Approuvé & Délivré</option>
                  <option value="REFUSE">Visa Refusé</option>
                  <option value="EXPIRE">Expiré</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">N° Dossier Nusuk</label>
                <input
                  type="text"
                  placeholder="Ex: NSK-2027-HAJ-0987"
                  value={editForm.nusukApplicationNumber}
                  onChange={(e) => setEditForm({ ...editForm, nusukApplicationNumber: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">N° Visa Officiel</label>
                <input
                  type="text"
                  placeholder="Ex: VSA-SA-2027-483921"
                  value={editForm.visaNumber}
                  onChange={(e) => setEditForm({ ...editForm, visaNumber: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Date d'Émission</label>
                  <input
                    type="date"
                    value={editForm.issueDate}
                    onChange={(e) => setEditForm({ ...editForm, issueDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Date d'Expiration</label>
                  <input
                    type="date"
                    value={editForm.expiryDate}
                    onChange={(e) => setEditForm({ ...editForm, expiryDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              {editForm.status === 'REFUSE' && (
                <div>
                  <label className="font-semibold text-rose-700 block mb-1">Motif du Refus Consulaire</label>
                  <input
                    type="text"
                    value={editForm.rejectionReason}
                    onChange={(e) => setEditForm({ ...editForm, rejectionReason: e.target.value })}
                    className="w-full bg-rose-50 border border-rose-300 rounded-lg p-2 text-rose-900"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingVisa(null)}
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
