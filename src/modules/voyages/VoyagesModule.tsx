import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Plus,
  Search,
  Users,
  CheckCircle,
  AlertTriangle,
  X,
  Compass,
  LayoutGrid,
  Trash2,
  Edit2,
  Plane,
  Hotel as HotelIcon,
  Phone,
  UserCheck,
  TrendingUp,
  DollarSign,
  ArrowRight,
  Layers,
  PieChart,
  ShieldCheck,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { Voyage, Inscription, VoyagePackage, Expense, AgencySettings } from '../../types.js';
import { formatFCFA, formatDate } from '../../utils/format.js';
import { VoyagesCalendarView } from './VoyagesCalendarView.js';
import { ConfirmModal } from '../../components/ui/ConfirmModal.js';
import { useAuth } from '../../auth/AuthContext.js';
import { logCampaignAudit } from '../../services/audit.service.js';

export interface VoyagesModuleProps {
  voyages: Voyage[];
  inscriptions: Inscription[];
  packages?: VoyagePackage[];
  expenses?: Expense[];
  settings?: AgencySettings;
  onRefresh: () => void;
  onCreateVoyage: (voyage: Partial<Voyage>) => Promise<Voyage>;
  onUpdateVoyage: (id: string, updates: Partial<Voyage>) => Promise<Voyage>;
  onDeleteVoyage: (id: string) => Promise<{ success: boolean; message: string }>;
  onNavigateToPackages?: (voyageId?: string) => void;
}

export const VoyagesModule: React.FC<VoyagesModuleProps> = ({
  voyages,
  inscriptions,
  packages = [],
  expenses = [],
  settings,
  onRefresh,
  onCreateVoyage,
  onUpdateVoyage,
  onDeleteVoyage,
  onNavigateToPackages,
}) => {
  const [activeView, setActiveView] = useState<'GRID' | 'CALENDAR' | 'FINANCIAL'>('GRID');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'HAJJ' | 'OUMRAH'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [voyageToDelete, setVoyageToDelete] = useState<{ id: string; title: string } | null>(null);
  const [voyageToEdit, setVoyageToEdit] = useState<Voyage | null>(null);
  const { currentUser, role } = useAuth();

  // New Voyage Form State
  const [newVoyage, setNewVoyage] = useState<Partial<Voyage>>({
    code: 'HAJ2027-02',
    title: 'Hajj 2027 — Deuxième Rotation Confort',
    type: 'HAJJ',
    year: 2027,
    startDate: '2027-05-22',
    endDate: '2027-06-19',
    departureDate: '2027-05-22',
    returnDate: '2027-06-19',
    capacity: 100,
    status: 'OUVERT',
    responsable: 'Oustaz Ibrahima Diop',
    responsablePhone: '+221 77 555 44 33',
    volsSummary: 'Air Sénégal / Saudia (Vols Directs AIBD)',
    hotelsSummary: 'Al Kiswah Towers (Makkah) & Emaar Elite (Médine)',
    description: 'Campagne officielle homologuée avec encadrement religieux et médical permanent.',
    logisticsNotes: 'Rassemblement à l’AIBD 4h avant le départ prévu.',
  });

  // Calculate duration in days between two dates
  const calculateDuration = (dep: string, ret: string): number => {
    if (!dep || !ret) return 0;
    const d1 = new Date(dep);
    const d2 = new Date(ret);
    const diffTime = d2.getTime() - d1.getTime();
    if (isNaN(diffTime) || diffTime < 0) return 0;
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  };

  // Aggregated global statistics
  const stats = useMemo(() => {
    const totalCampagnes = voyages.length;
    const openCampagnes = voyages.filter((v) => v.status === 'OUVERT').length;
    const totalCapacity = voyages.reduce((acc, v) => acc + (v.capacity || 0), 0);
    const totalEnrolled = inscriptions.length;
    const remainingSpots = Math.max(0, totalCapacity - totalEnrolled);
    const occupancyRate = totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0;

    // Projected revenue = sum of inscriptions snapshot appliedPrice
    const totalProjectedRevenue = inscriptions.reduce((acc, ins) => acc + (ins.appliedPrice || 0), 0);
    // Total collected
    const totalCollected = inscriptions.reduce((acc, ins) => acc + (ins.totalPaid || 0), 0);
    // Total expenses committed
    const totalExpenses = expenses.reduce((acc, exp) => acc + (exp.amount || 0), 0);
    // Net gross margin
    const netMargin = totalProjectedRevenue - totalExpenses;
    const marginRate = totalProjectedRevenue > 0 ? Math.round((netMargin / totalProjectedRevenue) * 100) : 0;

    return {
      totalCampagnes,
      openCampagnes,
      totalCapacity,
      totalEnrolled,
      remainingSpots,
      occupancyRate,
      totalProjectedRevenue,
      totalCollected,
      totalExpenses,
      netMargin,
      marginRate,
    };
  }, [voyages, inscriptions, expenses]);

  // Filtered voyages
  const filteredVoyages = useMemo(() => {
    return voyages.filter((v) => {
      const matchesType = typeFilter === 'ALL' || v.type === typeFilter;
      const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        v.title.toLowerCase().includes(term) ||
        v.code.toLowerCase().includes(term) ||
        (v.responsable && v.responsable.toLowerCase().includes(term));
      return matchesType && matchesStatus && matchesSearch;
    });
  }, [voyages, typeFilter, statusFilter, searchTerm]);

  // Handlers
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await onCreateVoyage(newVoyage);
      if (currentUser && created?.id) {
        await logCampaignAudit(
          currentUser.id,
          role?.id || 'STAFF',
          'CAMPAIGN_CREATED',
          created.id,
          { code: created.code, title: created.title, type: created.type }
        );
      }
      setShowAddModal(false);
      onRefresh();
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voyageToEdit) return;
    try {
      const updated = await onUpdateVoyage(voyageToEdit.id, voyageToEdit);
      if (currentUser) {
        await logCampaignAudit(
          currentUser.id,
          role?.id || 'STAFF',
          'CAMPAIGN_UPDATED',
          voyageToEdit.id,
          { code: updated.code, title: updated.title, status: updated.status }
        );
      }
      setVoyageToEdit(null);
      onRefresh();
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    }
  };

  const handleDeleteClick = (id: string, title: string) => {
    setVoyageToDelete({ id, title });
  };

  const confirmDelete = async () => {
    if (!voyageToDelete) return;
    try {
      await onDeleteVoyage(voyageToDelete.id);
      if (currentUser) {
        await logCampaignAudit(
          currentUser.id,
          role?.id || 'STAFF',
          'CAMPAIGN_DELETED',
          voyageToDelete.id,
          { title: voyageToDelete.title }
        );
      }
      setVoyageToDelete(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/20">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
                Campagnes Officielles Hajj & Oumrah
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900">
                  V5.2
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Programmation des saisons, quotas de pèlerins, logistique vols/hôtels, rentabilité et statuts d'ouverture.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              id="view-voyages-grid-btn"
              onClick={() => setActiveView('GRID')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeView === 'GRID'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Campagnes & Quotas</span>
            </button>
            <button
              id="view-voyages-calendar-btn"
              onClick={() => setActiveView('CALENDAR')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeView === 'CALENDAR'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Calendrier des Départs</span>
            </button>
            <button
              id="view-voyages-financial-btn"
              onClick={() => setActiveView('FINANCIAL')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeView === 'FINANCIAL'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Rentabilité & Marges</span>
            </button>
          </div>

          <button
            id="btn-create-campaign"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            Créer une Campagne
          </button>
        </div>
      </div>

      {/* Dynamic Summary Strip (KPIs) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Campagnes Actives
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-slate-900">{stats.openCampagnes}</span>
            <span className="text-xs text-slate-400 font-medium">/ {stats.totalCampagnes} totales</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
            <CheckCircle className="w-3 h-3" />
            Homologation valide
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Capacité Globale (Quotas)
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-slate-900">{stats.totalCapacity}</span>
            <span className="text-xs text-slate-400 font-medium">places allouées</span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium mt-1 block">
            {stats.remainingSpots} places disponibles
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Pèlerins Inscrits
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-amber-800">{stats.totalEnrolled}</span>
            <span className="text-xs font-bold text-slate-600">({stats.occupancyRate} % rempli)</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
            <div
              className={`h-full rounded-full transition-all ${
                stats.occupancyRate >= 90
                  ? 'bg-rose-500'
                  : stats.occupancyRate >= 70
                  ? 'bg-amber-500'
                  : 'bg-emerald-600'
              }`}
              style={{ width: `${Math.min(100, stats.occupancyRate)}%` }}
            />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            CA Attendu (Contrats)
          </span>
          <div className="mt-1">
            <span className="text-lg font-black text-slate-900">{formatFCFA(stats.totalProjectedRevenue)}</span>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold block mt-1">
            Encaissé : {formatFCFA(stats.totalCollected)}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs col-span-2 lg:col-span-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Marge Nette Prévisionnelle
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className={`text-lg font-black ${stats.netMargin >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              {formatFCFA(stats.netMargin)}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium block mt-1">
            Taux de marge : <strong className="text-slate-800">{stats.marginRate}%</strong> (Dépenses : {formatFCFA(stats.totalExpenses)})
          </span>
        </div>
      </div>

      {/* FILTER BAR (Search + Type + Status) */}
      {activeView !== 'CALENDAR' && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 text-xs shadow-2xs">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par code, nom, responsable..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setTypeFilter('ALL')}
                className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-all ${
                  typeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Tous
              </button>
              <button
                onClick={() => setTypeFilter('HAJJ')}
                className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-all ${
                  typeFilter === 'HAJJ' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Hajj
              </button>
              <button
                onClick={() => setTypeFilter('OUMRAH')}
                className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-all ${
                  typeFilter === 'OUMRAH' ? 'bg-emerald-700 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Oumrah
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <span className="text-slate-500 font-medium">Statut :</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
            >
              <option value="ALL">Tous les statuts</option>
              <option value="OUVERT">OUVERT</option>
              <option value="PLANIFIE">PLANIFIÉ</option>
              <option value="EN_COURS">EN COURS</option>
              <option value="CLOTURE">CLÔTURÉ</option>
              <option value="ARCHIVE">ARCHIVÉ</option>
            </select>
          </div>
        </div>
      )}

      {/* VIEW 1: CALENDAR */}
      {activeView === 'CALENDAR' && (
        <VoyagesCalendarView voyages={filteredVoyages} inscriptions={inscriptions} />
      )}

      {/* VIEW 2: FINANCIAL & PROFITABILITY DASHBOARD */}
      {activeView === 'FINANCIAL' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div>
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Tableau de Rentabilité & Marges par Campagne
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Comparatif du chiffre d'affaires projeté (inscriptions contractuelles), dépenses réelles engagées et marge nette.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-3 px-4">Campagne</th>
                  <th className="py-3 px-4 text-center">Quota & Inscrits</th>
                  <th className="py-3 px-4 text-right">CA Attendu</th>
                  <th className="py-3 px-4 text-right">CA Encaissé</th>
                  <th className="py-3 px-4 text-right">Dépenses Réelles</th>
                  <th className="py-3 px-4 text-right">Marge Nette</th>
                  <th className="py-3 px-4 text-center">Taux de Marge</th>
                  <th className="py-3 px-4 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredVoyages.map((voyage) => {
                  const voyageIns = inscriptions.filter((i) => i.voyageId === voyage.id);
                  const enrolled = voyageIns.length;
                  const caAttendu = voyageIns.reduce((sum, ins) => sum + (ins.appliedPrice || 0), 0);
                  const caEncaisse = voyageIns.reduce((sum, ins) => sum + (ins.totalPaid || 0), 0);
                  const depenses = expenses
                    .filter((e) => e.voyageId === voyage.id)
                    .reduce((sum, e) => sum + (e.amount || 0), 0);
                  const marge = caAttendu - depenses;
                  const tauxMarge = caAttendu > 0 ? Math.round((marge / caAttendu) * 100) : 0;

                  return (
                    <tr key={voyage.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{voyage.title}</div>
                        <div className="font-mono text-[11px] text-amber-800">{voyage.code} • {voyage.year}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-slate-800">{enrolled}</span>
                        <span className="text-slate-400"> / {voyage.capacity} places</span>
                        <div className="text-[10px] text-slate-500">
                          {voyage.capacity > 0 ? Math.round((enrolled / voyage.capacity) * 100) : 0}% rempli
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatFCFA(caAttendu)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-700">
                        {formatFCFA(caEncaisse)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-600">
                        {formatFCFA(depenses)}
                      </td>
                      <td className="py-3 px-4 text-right font-black">
                        <span className={marge >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                          {formatFCFA(marge)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            tauxMarge >= 20
                              ? 'bg-emerald-100 text-emerald-800'
                              : tauxMarge >= 10
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {tauxMarge}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            voyage.status === 'OUVERT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : voyage.status === 'PLANIFIE'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {voyage.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: GRID (Core Campagnes & Quotas Cards) */}
      {activeView === 'GRID' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {filteredVoyages.map((voyage) => {
            const voyageIns = inscriptions.filter((i) => i.voyageId === voyage.id);
            const enrolledCount = voyageIns.length;
            const occupancyRate =
              voyage.capacity > 0 ? Math.round((enrolledCount / voyage.capacity) * 100) : 0;
            const remainingSpots = Math.max(0, voyage.capacity - enrolledCount);
            const durationDays = calculateDuration(voyage.departureDate, voyage.returnDate);

            // Associated packages
            const linkedPackages = packages.filter((p) => p.voyageId === voyage.id);

            // Finances
            const caAttendu = voyageIns.reduce((sum, ins) => sum + (ins.appliedPrice || 0), 0);
            const caEncaisse = voyageIns.reduce((sum, ins) => sum + (ins.totalPaid || 0), 0);
            const voyageExpenses = expenses
              .filter((e) => e.voyageId === voyage.id)
              .reduce((sum, e) => sum + (e.amount || 0), 0);
            const netMargin = caAttendu - voyageExpenses;
            const marginRate = caAttendu > 0 ? Math.round((netMargin / caAttendu) * 100) : 0;

            const isNearFull = remainingSpots > 0 && remainingSpots <= 10;
            const isFull = remainingSpots === 0 && voyage.capacity > 0;

            return (
              <div
                key={voyage.id}
                className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between hover:border-slate-300 transition-all"
              >
                {/* Top Card Section */}
                <div className="p-6">
                  {/* Header badges + actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`px-2.5 py-0.5 rounded text-[10px] font-black tracking-wide border ${
                            voyage.type === 'HAJJ'
                              ? 'bg-amber-50 text-amber-900 border-amber-300'
                              : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                          }`}
                        >
                          {voyage.type} • {voyage.year}
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            voyage.status === 'OUVERT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : voyage.status === 'PLANIFIE'
                              ? 'bg-amber-100 text-amber-800'
                              : voyage.status === 'EN_COURS'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {voyage.status}
                        </span>

                        {durationDays > 0 && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {durationDays} jours
                          </span>
                        )}

                        {isFull ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white animate-pulse">
                            QUOTA COMPLET
                          </span>
                        ) : isNearFull ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500 text-white">
                            DERNIÈRES PLACES ({remainingSpots})
                          </span>
                        ) : null}
                      </div>

                      <h3 className="text-base font-black text-slate-900 mt-2 leading-snug">
                        {voyage.title}
                      </h3>
                      <p className="font-mono text-xs text-amber-800 font-bold mt-0.5">
                        Code officiel : {voyage.code}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setVoyageToEdit(voyage)}
                        className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-amber-600 rounded-lg transition-colors cursor-pointer"
                        title="Modifier la campagne"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(voyage.id, voyage.title)}
                        className="p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                        title="Supprimer la campagne"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                    {voyage.description || 'Campagne officielle de pèlerinage encadrée par GIE TAIBA VOYAGES.'}
                  </p>

                  {/* Quota & Live Saturation Gauge */}
                  <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        Remplissage du quota
                      </span>
                      <div className="text-right">
                        <span className="text-sm font-black text-slate-900">{enrolledCount}</span>
                        <span className="text-xs text-slate-500 font-medium"> / {voyage.capacity} inscrits</span>
                        <span className="font-bold text-amber-800 ml-1.5">({occupancyRate}%)</span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          occupancyRate >= 95
                            ? 'bg-rose-500'
                            : occupancyRate >= 75
                            ? 'bg-amber-500'
                            : 'bg-emerald-600'
                        }`}
                        style={{ width: `${Math.min(100, occupancyRate)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] mt-2 pt-1.5 border-t border-slate-200/60">
                      <span className="text-slate-500 font-medium">
                        Places restantes : <strong className="text-slate-800">{remainingSpots} places</strong>
                      </span>
                      <span className="text-emerald-700 font-bold">
                        Homologation Ministère : <strong className="text-emerald-900 font-black">SN-HAJJ-2027</strong>
                      </span>
                    </div>
                  </div>

                  {/* Logistics Bento: Dates, Flights, Hotels, Mission Leader */}
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {/* Dates Box */}
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-500 font-medium text-[11px]">
                        <Calendar className="w-3.5 h-3.5 text-amber-600" />
                        <span>Dates de Déplacement</span>
                      </div>
                      <div className="text-[11px] text-slate-800 font-semibold">
                        Départ : {formatDate(voyage.departureDate)}
                      </div>
                      <div className="text-[11px] text-slate-800 font-semibold">
                        Retour : {formatDate(voyage.returnDate)}
                      </div>
                    </div>

                    {/* Mission Leader Box */}
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-500 font-medium text-[11px]">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Chef de Mission / Responsable</span>
                      </div>
                      <div className="text-[11px] text-slate-900 font-bold truncate">
                        {voyage.responsable || 'El Hadj Amadou Niang'}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {voyage.responsablePhone || '+221 77 600 00 01'}
                      </div>
                    </div>

                    {/* Flights Summary */}
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-500 font-medium text-[11px]">
                        <Plane className="w-3.5 h-3.5 text-blue-600" />
                        <span>Vols & Acheminement</span>
                      </div>
                      <div className="text-[11px] text-slate-800 font-medium truncate">
                        {voyage.volsSummary || 'Air Sénégal / Saudia (AIBD - JED/MED)'}
                      </div>
                    </div>

                    {/* Hotels Summary */}
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-500 font-medium text-[11px]">
                        <HotelIcon className="w-3.5 h-3.5 text-amber-700" />
                        <span>Hébergements Lieux Saints</span>
                      </div>
                      <div className="text-[11px] text-slate-800 font-medium truncate">
                        {voyage.hotelsSummary || 'Al Kiswah Towers (Makkah) & Emaar Elite'}
                      </div>
                    </div>
                  </div>

                  {/* Financial & Rentability Mini-Bar */}
                  <div className="mt-3 p-3 bg-slate-900 text-white rounded-xl text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-amber-400" />
                        Bilan Financier Prévisionnel
                      </span>
                      <span className="font-mono text-amber-300">
                        {marginRate >= 0 ? `Marge +${marginRate}%` : `Déficit ${marginRate}%`}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800 text-center">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-normal">CA Attendu</span>
                        <span className="font-bold text-white text-xs">{formatFCFA(caAttendu)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-normal">Encaissé</span>
                        <span className="font-bold text-emerald-400 text-xs">{formatFCFA(caEncaisse)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-normal">Marge Nette</span>
                        <span className={`font-bold text-xs ${netMargin >= 0 ? 'text-amber-300' : 'text-rose-400'}`}>
                          {formatFCFA(netMargin)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Linked Packages Preview */}
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <Layers className="w-3 h-3 text-amber-600" />
                        Packages rattachés ({linkedPackages.length})
                      </span>
                      {onNavigateToPackages && (
                        <button
                          onClick={() => onNavigateToPackages(voyage.id)}
                          className="text-[11px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-0.5 cursor-pointer"
                        >
                          Gérer les packages <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {linkedPackages.length === 0 ? (
                      <div className="p-2 bg-slate-50 rounded-lg text-center text-[11px] text-slate-400">
                        Aucun package configuré pour cette campagne.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {linkedPackages.map((pkg) => (
                          <div
                            key={pkg.id}
                            className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-center gap-2"
                          >
                            <span className="font-bold text-slate-800">{pkg.name}</span>
                            <span className="font-mono text-amber-800 font-bold">
                              {formatFCFA(pkg.price || pkg.currentPrice || 0)}
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                pkg.status === 'DEFINITIF'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {pkg.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">
                    {voyageIns.length} dossier{voyageIns.length > 1 ? 's' : ''} actif{voyageIns.length > 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center gap-2">
                    {onNavigateToPackages && (
                      <button
                        onClick={() => onNavigateToPackages(voyage.id)}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-bold border border-slate-300 shadow-2xs transition-colors cursor-pointer"
                      >
                        Voir Formules & Tarifs
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: ADD VOYAGE */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-8">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                Créer une Nouvelle Campagne Officielle
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Code Campagne *</label>
                  <input
                    type="text"
                    required
                    value={newVoyage.code}
                    onChange={(e) => setNewVoyage({ ...newVoyage, code: e.target.value.toUpperCase() })}
                    placeholder="HAJ2027-02"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono uppercase font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Type *</label>
                  <select
                    value={newVoyage.type}
                    onChange={(e) => setNewVoyage({ ...newVoyage, type: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold"
                  >
                    <option value="HAJJ">HAJJ</option>
                    <option value="OUMRAH">OUMRAH</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Année *</label>
                  <input
                    type="number"
                    required
                    value={newVoyage.year}
                    onChange={(e) => setNewVoyage({ ...newVoyage, year: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Intitulé Officiel de la Campagne *</label>
                <input
                  type="text"
                  required
                  value={newVoyage.title}
                  onChange={(e) => setNewVoyage({ ...newVoyage, title: e.target.value })}
                  placeholder="Hajj 2027 — Vol Direct Dakar / Médine"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Date Départ (Vol Aller) *</label>
                  <input
                    type="date"
                    required
                    value={newVoyage.departureDate}
                    onChange={(e) =>
                      setNewVoyage({
                        ...newVoyage,
                        departureDate: e.target.value,
                        startDate: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Date Retour (Vol Retour) *</label>
                  <input
                    type="date"
                    required
                    value={newVoyage.returnDate}
                    onChange={(e) =>
                      setNewVoyage({
                        ...newVoyage,
                        returnDate: e.target.value,
                        endDate: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Capacité Quota Pèlerins *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newVoyage.capacity}
                    onChange={(e) => setNewVoyage({ ...newVoyage, capacity: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Statut d'Ouverture *</label>
                  <select
                    value={newVoyage.status}
                    onChange={(e) => setNewVoyage({ ...newVoyage, status: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold"
                  >
                    <option value="PLANIFIE">PLANIFIÉ</option>
                    <option value="OUVERT">OUVERT</option>
                    <option value="EN_COURS">EN COURS</option>
                    <option value="CLOTURE">CLÔTURÉ</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Chef de Mission / Responsable</label>
                  <input
                    type="text"
                    value={newVoyage.responsable || ''}
                    onChange={(e) => setNewVoyage({ ...newVoyage, responsable: e.target.value })}
                    placeholder="El Hadj Amadou Niang"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Téléphone Responsable</label>
                  <input
                    type="tel"
                    value={newVoyage.responsablePhone || ''}
                    onChange={(e) => setNewVoyage({ ...newVoyage, responsablePhone: e.target.value })}
                    placeholder="+221 77 600 00 01"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Synthèse Vols (Compagnie & Liaisons)</label>
                  <input
                    type="text"
                    value={newVoyage.volsSummary || ''}
                    onChange={(e) => setNewVoyage({ ...newVoyage, volsSummary: e.target.value })}
                    placeholder="Air Sénégal / Saudia (AIBD - JED)"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Synthèse Hôtels (Makkah & Médine)</label>
                  <input
                    type="text"
                    value={newVoyage.hotelsSummary || ''}
                    onChange={(e) => setNewVoyage({ ...newVoyage, hotelsSummary: e.target.value })}
                    placeholder="Al Kiswah Towers & Emaar Elite"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Description & Programme</label>
                <textarea
                  rows={2}
                  value={newVoyage.description || ''}
                  onChange={(e) => setNewVoyage({ ...newVoyage, description: e.target.value })}
                  placeholder="Présentation générale du séjour spirituel et de l'encadrement..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                >
                  Créer la Campagne
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT VOYAGE */}
      {voyageToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-8">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-400" />
                Modifier la Campagne : {voyageToEdit.code}
              </h3>
              <button
                onClick={() => setVoyageToEdit(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Code Campagne *</label>
                  <input
                    type="text"
                    required
                    value={voyageToEdit.code}
                    onChange={(e) => setVoyageToEdit({ ...voyageToEdit, code: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono uppercase font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Type *</label>
                  <select
                    value={voyageToEdit.type}
                    onChange={(e) => setVoyageToEdit({ ...voyageToEdit, type: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold"
                  >
                    <option value="HAJJ">HAJJ</option>
                    <option value="OUMRAH">OUMRAH</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Année *</label>
                  <input
                    type="number"
                    required
                    value={voyageToEdit.year}
                    onChange={(e) => setVoyageToEdit({ ...voyageToEdit, year: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Intitulé Officiel *</label>
                <input
                  type="text"
                  required
                  value={voyageToEdit.title}
                  onChange={(e) => setVoyageToEdit({ ...voyageToEdit, title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Date Départ *</label>
                  <input
                    type="date"
                    required
                    value={voyageToEdit.departureDate}
                    onChange={(e) =>
                      setVoyageToEdit({
                        ...voyageToEdit,
                        departureDate: e.target.value,
                        startDate: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Date Retour *</label>
                  <input
                    type="date"
                    required
                    value={voyageToEdit.returnDate}
                    onChange={(e) =>
                      setVoyageToEdit({
                        ...voyageToEdit,
                        returnDate: e.target.value,
                        endDate: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Capacité Quota Pèlerins *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={voyageToEdit.capacity}
                    onChange={(e) => setVoyageToEdit({ ...voyageToEdit, capacity: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Statut *</label>
                  <select
                    value={voyageToEdit.status}
                    onChange={(e) => setVoyageToEdit({ ...voyageToEdit, status: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold"
                  >
                    <option value="PLANIFIE">PLANIFIÉ</option>
                    <option value="OUVERT">OUVERT</option>
                    <option value="EN_COURS">EN COURS</option>
                    <option value="CLOTURE">CLÔTURÉ</option>
                    <option value="ARCHIVE">ARCHIVÉ</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Chef de Mission / Responsable</label>
                  <input
                    type="text"
                    value={voyageToEdit.responsable || ''}
                    onChange={(e) => setVoyageToEdit({ ...voyageToEdit, responsable: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Téléphone Responsable</label>
                  <input
                    type="tel"
                    value={voyageToEdit.responsablePhone || ''}
                    onChange={(e) => setVoyageToEdit({ ...voyageToEdit, responsablePhone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Synthèse Vols</label>
                  <input
                    type="text"
                    value={voyageToEdit.volsSummary || ''}
                    onChange={(e) => setVoyageToEdit({ ...voyageToEdit, volsSummary: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Synthèse Hôtels</label>
                  <input
                    type="text"
                    value={voyageToEdit.hotelsSummary || ''}
                    onChange={(e) => setVoyageToEdit({ ...voyageToEdit, hotelsSummary: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Description / Programme</label>
                <textarea
                  rows={2}
                  value={voyageToEdit.description || ''}
                  onChange={(e) => setVoyageToEdit({ ...voyageToEdit, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setVoyageToEdit(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                >
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFIRM DELETE */}
      <ConfirmModal
        isOpen={!!voyageToDelete}
        title="Confirmer la suppression"
        message={
          <>
            Êtes-vous sûr de vouloir supprimer la campagne{' '}
            <span className="font-bold text-slate-900">{voyageToDelete?.title}</span> ? Cette action est{' '}
            <span className="font-bold text-red-600">irréversible</span> et entraînera la suppression en cascade de toutes
            les inscriptions, paiements et données associées.
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => setVoyageToDelete(null)}
      />
    </div>
  );
};
