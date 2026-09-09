import React, { useState, useMemo } from 'react';
import {
  Layers,
  Plus,
  History,
  TrendingUp,
  Tag,
  CheckCircle,
  AlertCircle,
  X,
  Trash2,
  Edit2,
  Filter,
  Users,
  Building,
  Calendar,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Info,
  Check,
  Award,
  Crown,
  Bed,
} from 'lucide-react';
import { VoyagePackage, Voyage, Inscription, PackageVersion, AgencySettings } from '../../types.js';
import { formatFCFA, formatDate } from '../../utils/format.js';
import { ConfirmModal } from '../../components/ui/ConfirmModal.js';
import { useAuth } from '../../auth/AuthContext.js';
import { logPackageAudit } from '../../services/audit.service.js';

export interface PackagesModuleProps {
  packages: VoyagePackage[];
  voyages: Voyage[];
  inscriptions?: Inscription[];
  settings?: AgencySettings;
  onRefresh: () => void;
  onCreatePackage: (pkg: Partial<VoyagePackage>) => Promise<VoyagePackage>;
  onUpdatePackage?: (id: string, updates: Partial<VoyagePackage>) => Promise<VoyagePackage>;
  onCreateNewPriceVersion: (
    packageId: string,
    data: { newPrice: number; status: 'PROVISOIRE' | 'DEFINITIF'; effectiveFrom: string; note?: string }
  ) => Promise<VoyagePackage>;
  onDeletePackage: (id: string) => Promise<{ success: boolean; message: string }>;
  onNavigateToVoyages?: () => void;
}

const PRESET_SERVICES = [
  'Vol direct aller-retour Dakar - Médine / Djeddah - Dakar',
  'Visa officiel Hajj Nusuk & assurance médicale saoudienne',
  'Hébergement en hôtel étoilé à proximité des Harams',
  'Restauration en pension complète (3 repas buffet par jour)',
  'Restauration en demi-pension (petit-déjeuner + dîner)',
  'Tentes climatisées à Mina et Arafat (camp sénégalais)',
  'Transferts en bus VIP climatisés entre les Lieux Saints',
  'Transfert TGV Haramain High Speed Rail Makkah - Médine',
  'Visites pieuses guidées (Ziaras Médine : Uhud, Quba)',
  'Encadrement religieux continu et médecin dédié GIE TAIBA',
  'Kit complet du pèlerin (sacoche, guide rituel, étiquettes)',
  'Service conciergerie privée 24h/24 et portage bagages',
];

export const PackagesModule: React.FC<PackagesModuleProps> = ({
  packages,
  voyages,
  inscriptions = [],
  settings,
  onRefresh,
  onCreatePackage,
  onUpdatePackage,
  onCreateNewPriceVersion,
  onDeletePackage,
  onNavigateToVoyages,
}) => {
  const [selectedVoyageFilter, setSelectedVoyageFilter] = useState<string>('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [selectedPkgForVersion, setSelectedPkgForVersion] = useState<VoyagePackage | null>(null);
  const [pkgToEdit, setPkgToEdit] = useState<VoyagePackage | null>(null);
  const [showAddPkgModal, setShowAddPkgModal] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<{ id: string; name: string } | null>(null);
  const { currentUser, role } = useAuth();

  // New Version Form
  const [versionForm, setVersionForm] = useState({
    newPrice: 5300000,
    status: 'DEFINITIF' as 'PROVISOIRE' | 'DEFINITIF',
    effectiveFrom: new Date().toISOString().split('T')[0],
    note: 'Ajustement officiel grille tarifaire Nusuk et hausses hôtelières',
  });

  // New Package Form State
  const [newPkgForm, setNewPkgForm] = useState<Partial<VoyagePackage>>({
    voyageId: voyages[0]?.id || '',
    code: 'PKG-HAJ27-CONF',
    name: 'Confort Plus',
    category: 'CONFORT',
    description: 'Chambres triples de standing, hôtels 5 étoiles à proximité immédiate des esplanades et pension complète.',
    price: 5500000,
    initialPrice: 5500000,
    currentPrice: 5500000,
    currency: 'FCFA',
    capacity: 30,
    roomType: 'TRIPLE',
    hotelMakkah: 'Swissôtel Al Maqam Makkah',
    hotelMedina: 'Pullman Al Aqeeq Madinah',
    status: 'PROVISOIRE',
    validFrom: new Date().toISOString().split('T')[0],
    conditions: 'Acompte 1 500 000 FCFA à la réservation. Solde 30 jours avant le départ. Annulation sans frais jusqu’à 45 jours du vol.',
    servicesIncluded: [
      'Vol direct aller-retour Dakar - Médine / Djeddah - Dakar',
      'Visa officiel Hajj Nusuk & assurance médicale saoudienne',
      'Hébergement en hôtel étoilé à proximité des Harams',
      'Restauration en pension complète (3 repas buffet par jour)',
      'Tentes climatisées à Mina et Arafat (camp sénégalais)',
      'Transferts en bus VIP climatisés entre les Lieux Saints',
      'Encadrement religieux continu et médecin dédié GIE TAIBA',
      'Kit complet du pèlerin (sacoche, guide rituel, étiquettes)',
    ],
  });

  // Custom service input buffer
  const [customServiceInput, setCustomServiceInput] = useState('');

  // Helper to extract versions array safely
  const getPackageVersions = (pkg: VoyagePackage): PackageVersion[] => {
    if (pkg.versions && pkg.versions.length > 0) {
      return [...pkg.versions].sort((a, b) => a.versionNumber - b.versionNumber);
    }
    const legacyHistory = (pkg as any).priceHistory;
    if (Array.isArray(legacyHistory) && legacyHistory.length > 0) {
      return legacyHistory.map((ph: any, idx: number) => ({
        id: `ver-${idx}`,
        packageId: pkg.id,
        versionNumber: ph.version || idx + 1,
        price: ph.price,
        status: ph.status || 'PROVISOIRE',
        effectiveFrom: ph.effectiveFrom || '2026-09-01',
        note: ph.note || 'Tarif indicatif',
        createdAt: ph.createdAt || '2026-09-01',
      }));
    }
    return [
      {
        id: `ver-${pkg.id}-1`,
        packageId: pkg.id,
        versionNumber: 1,
        price: pkg.price || pkg.currentPrice || 5000000,
        status: pkg.status === 'DEFINITIF' ? 'DEFINITIF' : 'PROVISOIRE',
        effectiveFrom: pkg.validFrom || '2026-09-01',
        note: 'Tarif initial de lancement',
        createdAt: pkg.createdAt || new Date().toISOString(),
      },
    ];
  };

  // Helper to get active price
  const getActivePrice = (pkg: VoyagePackage): number => {
    return pkg.currentPrice || pkg.price || 0;
  };

  // Category visual badge styling
  const getCategoryTheme = (cat?: string) => {
    switch (cat) {
      case 'VIP':
        return {
          badge: 'bg-purple-100 text-purple-900 border-purple-300',
          accent: 'border-t-4 border-t-purple-600',
          pill: 'bg-purple-900 text-white',
          icon: Crown,
        };
      case 'CONFORT':
        return {
          badge: 'bg-amber-100 text-amber-900 border-amber-300',
          accent: 'border-t-4 border-t-amber-600',
          pill: 'bg-amber-800 text-white',
          icon: Award,
        };
      case 'PREMIUM':
        return {
          badge: 'bg-blue-100 text-blue-900 border-blue-300',
          accent: 'border-t-4 border-t-blue-600',
          pill: 'bg-blue-800 text-white',
          icon: Sparkles,
        };
      case 'STANDARD':
      default:
        return {
          badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          accent: 'border-t-4 border-t-emerald-600',
          pill: 'bg-slate-900 text-white',
          icon: Layers,
        };
    }
  };

  // Aggregated KPIs
  const stats = useMemo(() => {
    const totalPackages = packages.length;
    const totalQuotas = packages.reduce((acc, p) => acc + (p.capacity || 0), 0);
    const totalEnrolled = inscriptions.length;
    const avgPrice =
      totalPackages > 0
        ? Math.round(packages.reduce((acc, p) => acc + getActivePrice(p), 0) / totalPackages)
        : 0;

    return {
      totalPackages,
      totalQuotas,
      totalEnrolled,
      avgPrice,
    };
  }, [packages, inscriptions]);

  // Filtered packages
  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      const matchesVoyage = selectedVoyageFilter === 'ALL' || pkg.voyageId === selectedVoyageFilter;
      const matchesCategory =
        selectedCategoryFilter === 'ALL' ||
        (pkg.category || 'STANDARD') === selectedCategoryFilter;
      return matchesVoyage && matchesCategory;
    });
  }, [packages, selectedVoyageFilter, selectedCategoryFilter]);

  // Handlers
  const handleDeleteClick = (id: string, name: string) => {
    setPackageToDelete({ id, name });
  };

  const confirmDeletePackage = async () => {
    if (!packageToDelete) return;
    try {
      await onDeletePackage(packageToDelete.id);
      if (currentUser) {
        await logPackageAudit(
          currentUser.id,
          role?.id || 'STAFF',
          'PACKAGE_DELETED',
          packageToDelete.id,
          { name: packageToDelete.name }
        );
      }
      setPackageToDelete(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la suppression');
    }
  };

  const handleApplyPriceVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPkgForVersion) return;
    const newPriceNum = Number(versionForm.newPrice);
    if (!newPriceNum || newPriceNum <= 0) {
      alert('Veuillez spécifier un tarif valide.');
      return;
    }
    if (!versionForm.note.trim()) {
      alert('Le motif de la nouvelle version tarifaire est obligatoire pour l’audit.');
      return;
    }

    try {
      const updated = await onCreateNewPriceVersion(selectedPkgForVersion.id, {
        newPrice: newPriceNum,
        status: versionForm.status,
        effectiveFrom: versionForm.effectiveFrom,
        note: versionForm.note.trim(),
      });

      if (currentUser) {
        await logPackageAudit(
          currentUser.id,
          role?.id || 'STAFF',
          'PACKAGE_PRICE_VERSIONED',
          selectedPkgForVersion.id,
          {
            packageName: selectedPkgForVersion.name,
            oldPrice: getActivePrice(selectedPkgForVersion),
            newPrice: newPriceNum,
            difference: newPriceNum - getActivePrice(selectedPkgForVersion),
            status: versionForm.status,
            effectiveFrom: versionForm.effectiveFrom,
            note: versionForm.note,
          }
        );
      }
      setSelectedPkgForVersion(null);
      onRefresh();
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    }
  };

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const priceNum = Number(newPkgForm.price || newPkgForm.currentPrice || 5000000);
      const pkgToSave = {
        ...newPkgForm,
        price: priceNum,
        initialPrice: priceNum,
        currentPrice: priceNum,
        status: newPkgForm.status || 'PROVISOIRE',
        capacity: Number(newPkgForm.capacity || 50),
      };

      const created = await onCreatePackage(pkgToSave);
      if (currentUser && created?.id) {
        await logPackageAudit(
          currentUser.id,
          role?.id || 'STAFF',
          'PACKAGE_CREATED',
          created.id,
          {
            name: created.name,
            code: created.code,
            initialPrice: priceNum,
            voyageId: created.voyageId,
          }
        );
      }
      setShowAddPkgModal(false);
      onRefresh();
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    }
  };

  const handleUpdatePackageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgToEdit || !onUpdatePackage) return;
    try {
      const updated = await onUpdatePackage(pkgToEdit.id, pkgToEdit);
      if (currentUser) {
        await logPackageAudit(
          currentUser.id,
          role?.id || 'STAFF',
          'PACKAGE_UPDATED',
          pkgToEdit.id,
          { name: pkgToEdit.name, code: pkgToEdit.code, capacity: pkgToEdit.capacity }
        );
      }
      setPkgToEdit(null);
      onRefresh();
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    }
  };

  // Toggle included service in newPkgForm
  const toggleNewService = (svc: string) => {
    const current = (newPkgForm.servicesIncluded as string[]) || [];
    if (current.includes(svc)) {
      setNewPkgForm({ ...newPkgForm, servicesIncluded: current.filter((s) => s !== svc) });
    } else {
      setNewPkgForm({ ...newPkgForm, servicesIncluded: [...current, svc] });
    }
  };

  // Toggle service in pkgToEdit
  const toggleEditService = (svc: string) => {
    if (!pkgToEdit) return;
    const current = (pkgToEdit.servicesIncluded as string[]) || [];
    if (current.includes(svc)) {
      setPkgToEdit({ ...pkgToEdit, servicesIncluded: current.filter((s) => s !== svc) });
    } else {
      setPkgToEdit({ ...pkgToEdit, servicesIncluded: [...current, svc] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
                Packages & Versions Tarifaires
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900">
                  V5.2
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Formules (Standard, Confort, VIP), services inclus, quotas spécifiques et traçabilité immuable des barèmes.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToVoyages && (
            <button
              onClick={onNavigateToVoyages}
              className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              ← Voir les Campagnes
            </button>
          )}

          <button
            id="btn-create-package"
            onClick={() => setShowAddPkgModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            Créer un Package
          </button>
        </div>
      </div>

      {/* Dynamic Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Formules Configurées
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-slate-900">{stats.totalPackages}</span>
            <span className="text-xs text-slate-400 font-medium">packages actifs</span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium mt-1 block">
            Standard, Confort & VIP
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Quota Alloué aux Packages
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-slate-900">{stats.totalQuotas}</span>
            <span className="text-xs text-slate-400 font-medium">places réparties</span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium mt-1 block">
            Sur l'ensemble des campagnes
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Pèlerins Inscrits
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-amber-800">{stats.totalEnrolled}</span>
            <span className="text-xs text-slate-400 font-medium">dossiers confirmés</span>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">
            Contrats protégés par snapshot
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Tarif Moyen
          </span>
          <div className="mt-1">
            <span className="text-lg font-black text-slate-900">{formatFCFA(stats.avgPrice)}</span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium mt-1 block">
            Prix unitaire moyen par pèlerin
          </span>
        </div>
      </div>

      {/* Contractual Invariance Notice Box */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-900">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <strong className="font-black block mb-0.5">
            Garantie d'Invariance des Contrats & Règle du Snapshot Historique :
          </strong>
          Le tarif convenu lors de l'inscription d'un pèlerin constitue un snapshot immuable. Lorsqu'une formule passe
          de 5,1 M à 5,3 M FCFA via une nouvelle version de prix,{' '}
          <span className="font-bold underline">les anciens dossiers restent rigoureusement à leur tarif convenu initial</span>.
          Aucun solde ou taux d'encaissement n'est jamais recalculé rétroactivement.
        </div>
      </div>

      {/* Filter Bar (By Campaign & Category) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 text-xs shadow-2xs">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <span className="text-slate-500 font-bold flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            Campagne :
          </span>
          <select
            value={selectedVoyageFilter}
            onChange={(e) => setSelectedVoyageFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
          >
            <option value="ALL">Toutes les Campagnes</option>
            {voyages.map((v) => (
              <option key={v.id} value={v.id}>
                {v.code} — {v.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setSelectedCategoryFilter('ALL')}
            className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-all ${
              selectedCategoryFilter === 'ALL'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Toutes formules
          </button>
          <button
            onClick={() => setSelectedCategoryFilter('STANDARD')}
            className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-all ${
              selectedCategoryFilter === 'STANDARD'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Standard
          </button>
          <button
            onClick={() => setSelectedCategoryFilter('CONFORT')}
            className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-all ${
              selectedCategoryFilter === 'CONFORT'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Confort
          </button>
          <button
            onClick={() => setSelectedCategoryFilter('VIP')}
            className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-all ${
              selectedCategoryFilter === 'VIP'
                ? 'bg-purple-800 text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            VIP
          </button>
        </div>
      </div>

      {/* Package Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredPackages.map((pkg) => {
          const voyage = voyages.find((v) => v.id === pkg.voyageId);
          const versionsList = getPackageVersions(pkg);
          const activePrice = getActivePrice(pkg);
          const theme = getCategoryTheme(pkg.category);
          const CategoryIcon = theme.icon;

          // Inscriptions count for this package
          const pkgInscriptions = inscriptions.filter((ins) => ins.packageId === pkg.id);
          const enrolledCount = pkgInscriptions.length;
          const quota = pkg.capacity || 50;
          const occupancyRate = quota > 0 ? Math.round((enrolledCount / quota) * 100) : 0;
          const remainingSpots = Math.max(0, quota - enrolledCount);

          return (
            <div
              key={pkg.id}
              className={`bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between ${theme.accent} hover:border-slate-300 transition-all`}
            >
              <div className="p-6">
                {/* Header: Voyage Code, Name, Price */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                        {voyage?.code || 'HAJ2027'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${theme.badge}`}>
                        <CategoryIcon className="w-3 h-3 inline mr-1" />
                        {pkg.category || 'STANDARD'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          pkg.status === 'DEFINITIF'
                            ? 'bg-emerald-100 text-emerald-800'
                            : pkg.status === 'UNKNOWN'
                            ? 'bg-purple-100 text-purple-800 border border-purple-300'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {pkg.status || 'PROVISOIRE'}
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-slate-900 mt-2">{pkg.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">
                      Code : <strong className="font-mono text-slate-700">{pkg.code || pkg.id}</strong> • Chambre{' '}
                      <strong className="text-slate-800">{pkg.roomType || 'QUADRUPLE'}</strong>
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                      Tarif Actuel Actif
                    </span>
                    <span className="text-2xl font-black text-slate-900 block mt-0.5">
                      {formatFCFA(activePrice, pkg.currency || 'FCFA')}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium block">
                      Version {pkg.activeVersionNumber || versionsList.length} en vigueur
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                  {pkg.description || 'Formule complète avec hébergement, restauration et accompagnement dédié.'}
                </p>

                {/* Quota & Capacity Gauge for this Package */}
                <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-slate-700 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      Quota spécifique de la formule
                    </span>
                    <div className="text-right">
                      <span className="font-black text-slate-900">{enrolledCount}</span>
                      <span className="text-slate-500"> / {quota} places</span>
                      <span className="font-bold text-amber-800 ml-1.5">({occupancyRate}%)</span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
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

                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5 font-medium">
                    <span>{remainingSpots} places restantes pour cette formule</span>
                    <span className="text-emerald-700 font-bold">
                      {enrolledCount > 0 ? `${enrolledCount} pèlerin(s) inscrit(s)` : 'Ouvert aux inscriptions'}
                    </span>
                  </div>
                </div>

                {/* Accommodations & Conditions */}
                <div className="mt-3 p-3 bg-slate-50 rounded-lg text-xs space-y-1.5 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Building className="w-3 h-3 text-slate-400" /> Hôtel Makkah :
                    </span>
                    <span className="font-bold text-slate-800">{pkg.hotelMakkah || 'Al Kiswah Towers'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Building className="w-3 h-3 text-slate-400" /> Hôtel Médine :
                    </span>
                    <span className="font-bold text-slate-800">{pkg.hotelMedina || 'Emaar Elite'}</span>
                  </div>
                  {pkg.conditions && (
                    <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-600">
                      <strong className="text-slate-800">Conditions :</strong> {pkg.conditions}
                    </div>
                  )}
                </div>

                {/* Included Services Tags */}
                <div className="mt-3">
                  <span className="text-[11px] font-bold text-slate-700 block mb-1.5">
                    Services & Prestations Inclus :
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {Array.isArray(pkg.servicesIncluded) && pkg.servicesIncluded.length > 0 ? (
                      pkg.servicesIncluded.map((s, idx) => {
                        const label = typeof s === 'string' ? s : s.label;
                        return (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-slate-50 text-[10px] font-medium text-slate-700 border border-slate-200 flex items-center gap-1"
                          >
                            <Check className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                            <span>{label}</span>
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Prestations standard incluses.</span>
                    )}
                  </div>
                </div>

                {/* Price History & Versioning Timeline */}
                <div className="mt-4 pt-3 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-amber-600" />
                      Historique Immuable des Versions Tarifaires
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {versionsList.length} version{versionsList.length > 1 ? 's' : ''} enregistrée{versionsList.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {versionsList.map((ver, i) => {
                      const isCurrent =
                        ver.versionNumber === (pkg.activeVersionNumber || versionsList.length);
                      return (
                        <div
                          key={ver.id || i}
                          className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors ${
                            isCurrent
                              ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-400/30'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-900">
                                Version {ver.versionNumber} : {formatFCFA(ver.price, pkg.currency)}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-black ${
                                  ver.status === 'DEFINITIF'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {ver.status}
                              </span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-slate-900 text-white">
                                  EN VIGUEUR
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Prise d'effet : {formatDate(ver.effectiveFrom)} •{' '}
                              <span className="italic">{ver.note || 'Barème'}</span>
                            </p>
                          </div>

                          <div className="text-right text-[10px] font-bold text-slate-400">
                            V{ver.versionNumber}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {onUpdatePackage && (
                    <button
                      onClick={() => setPkgToEdit(pkg)}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer flex items-center gap-1 transition-colors"
                      title="Modifier les prestations ou conditions"
                    >
                      <Edit2 className="w-3 h-3" />
                      Modifier
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteClick(pkg.id, pkg.name)}
                    className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-rose-50 hover:text-rose-600 text-slate-400 cursor-pointer transition-colors"
                    title="Supprimer la formule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => {
                    setSelectedPkgForVersion(pkg);
                    setVersionForm({
                      newPrice: activePrice + 200000,
                      status: 'DEFINITIF',
                      effectiveFrom: new Date().toISOString().split('T')[0],
                      note: 'Ajustement officiel grille tarifaire Nusuk',
                    });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs cursor-pointer shadow-2xs transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Nouvelle Version de Prix
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL 1: NEW PRICE VERSION */}
      {selectedPkgForVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <History className="w-4 h-4 text-amber-400" />
                Nouvelle Version de Prix : {selectedPkgForVersion.name}
              </h3>
              <button
                onClick={() => setSelectedPkgForVersion(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyPriceVersion} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] leading-relaxed">
                <strong>Règle d'invariance des soldes :</strong> Cette nouvelle version tarifaire deviendra le prix actif
                pour les <em>prochains</em> pèlerins inscrits. Les contrats déjà signés et enregistrés conservent leur
                prix convenu d'origine.
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Nouveau Tarif Contractuel (FCFA) *
                </label>
                <input
                  type="number"
                  step="50000"
                  required
                  value={versionForm.newPrice}
                  onChange={(e) => setVersionForm({ ...versionForm, newPrice: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-sm text-slate-900"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Ancien tarif : {formatFCFA(getActivePrice(selectedPkgForVersion))} FCFA
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Statut de la Version *</label>
                  <select
                    value={versionForm.status}
                    onChange={(e) =>
                      setVersionForm({ ...versionForm, status: e.target.value as 'PROVISOIRE' | 'DEFINITIF' })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold"
                  >
                    <option value="DEFINITIF">DÉFINITIF</option>
                    <option value="PROVISOIRE">PROVISOIRE</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Date d'Effet *</label>
                  <input
                    type="date"
                    required
                    value={versionForm.effectiveFrom}
                    onChange={(e) => setVersionForm({ ...versionForm, effectiveFrom: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Motif Obligatoire de la Modification (Audit) *
                </label>
                <textarea
                  required
                  rows={2}
                  value={versionForm.note}
                  onChange={(e) => setVersionForm({ ...versionForm, note: e.target.value })}
                  placeholder="Ex : Réévaluation officielle forfait transport et tentes Mina..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedPkgForVersion(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer"
                >
                  Valider la Version
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD PACKAGE */}
      {showAddPkgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-8">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                Créer une Nouvelle Formule de Package
              </h3>
              <button
                onClick={() => setShowAddPkgModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePackage} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Campagne Rattachée *</label>
                  <select
                    value={newPkgForm.voyageId}
                    onChange={(e) => setNewPkgForm({ ...newPkgForm, voyageId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold"
                  >
                    {voyages.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.code} — {v.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Code Package *</label>
                  <input
                    type="text"
                    required
                    value={newPkgForm.code}
                    onChange={(e) => setNewPkgForm({ ...newPkgForm, code: e.target.value.toUpperCase() })}
                    placeholder="PKG-HAJ27-CONF"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono uppercase font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Nom de la Formule *</label>
                  <input
                    type="text"
                    required
                    value={newPkgForm.name}
                    onChange={(e) => setNewPkgForm({ ...newPkgForm, name: e.target.value })}
                    placeholder="Confort / VIP / Standard"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Catégorie *</label>
                  <select
                    value={newPkgForm.category}
                    onChange={(e) => setNewPkgForm({ ...newPkgForm, category: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold"
                  >
                    <option value="STANDARD">STANDARD</option>
                    <option value="CONFORT">CONFORT</option>
                    <option value="PREMIUM">PREMIUM</option>
                    <option value="VIP">VIP</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Prix Initial (FCFA) *</label>
                  <input
                    type="number"
                    step="50000"
                    required
                    value={newPkgForm.price}
                    onChange={(e) =>
                      setNewPkgForm({
                        ...newPkgForm,
                        price: Number(e.target.value),
                        initialPrice: Number(e.target.value),
                        currentPrice: Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Quota Places *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newPkgForm.capacity}
                    onChange={(e) => setNewPkgForm({ ...newPkgForm, capacity: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Type de Chambre *</label>
                  <select
                    value={newPkgForm.roomType}
                    onChange={(e) => setNewPkgForm({ ...newPkgForm, roomType: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  >
                    <option value="QUADRUPLE">Quadruple (4 lits)</option>
                    <option value="TRIPLE">Triple (3 lits)</option>
                    <option value="DOUBLE">Double (2 lits)</option>
                    <option value="INDIVIDUELLE">Individuelle (1 lit)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Hôtel Makkah</label>
                  <input
                    type="text"
                    value={newPkgForm.hotelMakkah || ''}
                    onChange={(e) => setNewPkgForm({ ...newPkgForm, hotelMakkah: e.target.value })}
                    placeholder="Al Kiswah Towers / Pullman Zamzam"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Hôtel Médine</label>
                  <input
                    type="text"
                    value={newPkgForm.hotelMedina || ''}
                    onChange={(e) => setNewPkgForm({ ...newPkgForm, hotelMedina: e.target.value })}
                    placeholder="Emaar Elite / Anwar Al Madinah"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Conditions de Paiement & Annulation</label>
                <input
                  type="text"
                  value={newPkgForm.conditions || ''}
                  onChange={(e) => setNewPkgForm({ ...newPkgForm, conditions: e.target.value })}
                  placeholder="Acompte minimum 1 000 000 FCFA. Solde 30 jours avant le vol."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              {/* Prestations Incluses Selector */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Prestations & Services Inclus (Sélectionnez ou ajoutez)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                  {PRESET_SERVICES.map((svc, idx) => {
                    const isChecked = ((newPkgForm.servicesIncluded as string[]) || []).includes(svc);
                    return (
                      <label
                        key={idx}
                        className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-100 cursor-pointer text-[11px]"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleNewService(svc)}
                          className="rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span className={isChecked ? 'font-bold text-slate-900' : 'text-slate-600'}>{svc}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddPkgModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                >
                  Créer le Package
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT PACKAGE */}
      {pkgToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-8">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-400" />
                Modifier le Package : {pkgToEdit.name}
              </h3>
              <button
                onClick={() => setPkgToEdit(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdatePackageSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Nom de la Formule *</label>
                  <input
                    type="text"
                    required
                    value={pkgToEdit.name}
                    onChange={(e) => setPkgToEdit({ ...pkgToEdit, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Catégorie *</label>
                  <select
                    value={pkgToEdit.category}
                    onChange={(e) => setPkgToEdit({ ...pkgToEdit, category: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold"
                  >
                    <option value="STANDARD">STANDARD</option>
                    <option value="CONFORT">CONFORT</option>
                    <option value="PREMIUM">PREMIUM</option>
                    <option value="VIP">VIP</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Quota de Places *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={pkgToEdit.capacity || 50}
                    onChange={(e) => setPkgToEdit({ ...pkgToEdit, capacity: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Type de Chambre *</label>
                  <select
                    value={pkgToEdit.roomType || 'QUADRUPLE'}
                    onChange={(e) => setPkgToEdit({ ...pkgToEdit, roomType: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  >
                    <option value="QUADRUPLE">Quadruple (4 lits)</option>
                    <option value="TRIPLE">Triple (3 lits)</option>
                    <option value="DOUBLE">Double (2 lits)</option>
                    <option value="INDIVIDUELLE">Individuelle (1 lit)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Hôtel Makkah</label>
                  <input
                    type="text"
                    value={pkgToEdit.hotelMakkah || ''}
                    onChange={(e) => setPkgToEdit({ ...pkgToEdit, hotelMakkah: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Hôtel Médine</label>
                  <input
                    type="text"
                    value={pkgToEdit.hotelMedina || ''}
                    onChange={(e) => setPkgToEdit({ ...pkgToEdit, hotelMedina: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={pkgToEdit.description || ''}
                  onChange={(e) => setPkgToEdit({ ...pkgToEdit, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Conditions de Paiement & Annulation</label>
                <input
                  type="text"
                  value={pkgToEdit.conditions || ''}
                  onChange={(e) => setPkgToEdit({ ...pkgToEdit, conditions: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              {/* Prestations Incluses Selector */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Services Inclus</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                  {PRESET_SERVICES.map((svc, idx) => {
                    const isChecked = ((pkgToEdit.servicesIncluded as string[]) || []).includes(svc);
                    return (
                      <label
                        key={idx}
                        className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-100 cursor-pointer text-[11px]"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleEditService(svc)}
                          className="rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span className={isChecked ? 'font-bold text-slate-900' : 'text-slate-600'}>{svc}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPkgToEdit(null)}
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

      {/* MODAL 4: CONFIRM DELETE */}
      <ConfirmModal
        isOpen={!!packageToDelete}
        title="Confirmer la suppression"
        message={
          <>
            Êtes-vous sûr de vouloir supprimer le package{' '}
            <span className="font-bold text-slate-900">{packageToDelete?.name}</span> ?
          </>
        }
        onConfirm={confirmDeletePackage}
        onCancel={() => setPackageToDelete(null)}
      />
    </div>
  );
};
