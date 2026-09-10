import React from 'react';
import { motion } from 'motion/react';
import {
  Users,
  Calendar,
  CreditCard,
  FileCheck2,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  Clock,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  Building,
  Target,
  ChevronRight,
  Compass,
  Boxes,
  Layers,
  Receipt,
  Wallet,
  ArrowRight,
  ShieldAlert,
  Check,
  FileText,
  Stamp,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext.js';
import { normalizeRole } from '../../auth/roleModules.js';
import { DashboardStats, AgencySettings, Client, Inscription, Payment, Voyage, VoyagePackage } from '../../types.js';
import { formatFCFA, formatDate } from '../../utils/format.js';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface DashboardModuleProps {
  stats?: DashboardStats | null;
  clients?: Client[];
  inscriptions?: Inscription[];
  payments?: Payment[];
  voyages?: Voyage[];
  packages?: VoyagePackage[];
  settings?: AgencySettings;
  onNavigate: (module: string) => void;
  onOpenReceipt?: (payment: Payment, inscription?: Inscription) => void;
}

const COLORS = ['#0f766e', '#d97706', '#dc2626', '#64748b'];

export const DashboardModule: React.FC<DashboardModuleProps> = ({
  stats,
  clients: rawClients = [],
  inscriptions: rawInscriptions = [],
  payments: rawPayments = [],
  voyages = [],
  packages = [],
  settings,
  onNavigate,
  onOpenReceipt,
}) => {
  const { currentUser: authUser, role } = useAuth();
  const currentRoleId = normalizeRole(role?.id || authUser?.roleId);
  const isAgent = currentRoleId === 'AGENT';

  // Enforce data hygiene on inputs (exclude test records from analytics)
  const clients = React.useMemo(() => rawClients.filter((c) => !c.isTest), [rawClients]);
  const inscriptions = React.useMemo(() => rawInscriptions.filter((i) => !i.isTest), [rawInscriptions]);
  const payments = React.useMemo(() => rawPayments.filter((p) => !p.isTest), [rawPayments]);

  // Derive real-time stats fallback in case server stats is loading or not yet provided
  const derivedStats: DashboardStats = React.useMemo(() => {
    const validPayments = payments.filter((p) => p.status === 'VALIDE');
    const totalCollected = validPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalRevenueExpected = inscriptions.reduce((sum, i) => sum + (i.appliedPrice || 0), 0);
    const totalRemaining = Math.max(0, totalRevenueExpected - totalCollected);
    const recoveryRate = totalRevenueExpected > 0 ? Math.round((totalCollected / totalRevenueExpected) * 100) : 0;

    let paidInFullCount = 0;
    let inProgressCount = 0;
    let overdueCount = 0;

    const debtorsList: {
      clientName: string;
      phone: string;
      voyageCode: string;
      appliedPrice: number;
      paid: number;
      remaining: number;
      priority: 'NORMAL' | 'IMPORTANT' | 'URGENT';
      lastPaymentDate?: string;
    }[] = [];

    inscriptions.forEach((ins) => {
      const client = clients.find((c) => c.id === ins.clientId);
      const voyage = voyages.find((v) => v.id === ins.voyageId);
      const clientPaid = validPayments
        .filter((p) => p.inscriptionId === ins.id || p.clientId === ins.clientId)
        .reduce((sum, p) => sum + p.amount, 0);
      const remaining = Math.max(0, (ins.appliedPrice || 0) - clientPaid);

      if (remaining <= 0 && (ins.appliedPrice || 0) > 0) {
        paidInFullCount++;
      } else if (clientPaid > 0) {
        inProgressCount++;
      } else {
        overdueCount++;
      }

      if (remaining > 0) {
        const priority: 'NORMAL' | 'IMPORTANT' | 'URGENT' =
          remaining > 3000000 ? 'URGENT' : remaining > 1000000 ? 'IMPORTANT' : 'NORMAL';
        debtorsList.push({
          clientName: client ? `${client.firstName} ${client.lastName}` : 'Pèlerin Inconnu',
          phone: client?.phone || '-',
          voyageCode: voyage?.code || 'HAJ2027-01',
          appliedPrice: ins.appliedPrice || 0,
          paid: clientPaid,
          remaining,
          priority,
        });
      }
    });

    debtorsList.sort((a, b) => b.remaining - a.remaining);

    const upcomingDepartures = voyages.map((v) => {
      const depDate = new Date(v.departureDate);
      const now = new Date();
      const diffTime = depDate.getTime() - now.getTime();
      const daysLeft = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      return {
        title: v.title,
        code: v.code,
        departureDate: v.departureDate,
        daysLeft,
      };
    });

    const pilgrimsByVoyage = voyages.map((v) => ({
      voyageName: v.title,
      voyageCode: v.code,
      count: inscriptions.filter((i) => i.voyageId === v.id).length,
      capacity: v.capacity,
    }));

    const profitability = voyages.map((v) => {
      const voyageInscriptions = inscriptions.filter((i) => i.voyageId === v.id);
      const rev = voyageInscriptions.reduce((sum, i) => sum + (i.appliedPrice || 0), 0);
      const exp = Math.round(rev * 0.77); // indicative 77% operating cost
      const net = rev - exp;
      return {
        voyageCode: v.code,
        voyageTitle: v.title,
        revenue: rev,
        expenses: exp,
        netResult: net,
        marginRate: rev > 0 ? Math.round((net / rev) * 100) : 0,
      };
    });

    return {
      activity: {
        totalPilgrims: clients.length || inscriptions.length,
        totalVoyages: voyages.length,
        totalHajj: voyages.filter((v) => v.type === 'HAJJ').length,
        totalUmrah: voyages.filter((v) => v.type === 'UMRAH').length,
        pilgrimsByVoyage,
        upcomingDepartures,
      },
      finance: {
        totalRevenueExpected,
        totalCollected,
        totalRemaining,
        recoveryRate,
        paidInFullCount,
        inProgressCount,
        overdueCount,
      },
      documents: {
        completeCount: inscriptions.filter((i) => (i.documentCompletenessRate || 0) >= 100).length,
        incompleteCount: inscriptions.filter((i) => (i.documentCompletenessRate || 0) < 100).length,
        missingPassports: inscriptions.filter((i) => !i.documents?.some((d) => d.type === 'Passeport' && d.status === 'VALIDE')).length,
        missingVisas: inscriptions.filter((i) => !i.visaStatus || (i.visaStatus !== 'VALIDE' && i.visaStatus !== 'APPROUVE')).length,
        missingTickets: inscriptions.length,
        expiredDocs: 0,
      },
      recouvrement: {
        topDebtors: debtorsList,
        urgentRemindersCount: debtorsList.filter((d) => d.priority === 'URGENT').length,
      },
      profitability,
    };
  }, [clients, inscriptions, payments, voyages]);

  // Use provided stats or derivedStats with safe fallback defaults
  const effectiveStats = stats || derivedStats;
  const activity = effectiveStats?.activity || derivedStats.activity;
  const finance = effectiveStats?.finance || derivedStats.finance;
  const documents = effectiveStats?.documents || derivedStats.documents;
  const recouvrement = effectiveStats?.recouvrement || derivedStats.recouvrement;
  const profitability = effectiveStats?.profitability || derivedStats.profitability;

  const paymentStatusData = [
    { name: 'Soldés', value: finance?.paidInFullCount || 0, color: '#10b981' },
    { name: 'En cours', value: finance?.inProgressCount || 0, color: '#0284c7' },
    { name: 'Impayés / Retard', value: finance?.overdueCount || 0, color: '#ef4444' },
  ];

  // Dynamic progress metrics calculations
  const totalCapacity = voyages.reduce((sum, v) => sum + (v.capacity || 0), 0) || (activity.totalPilgrims > 0 ? activity.totalPilgrims : 120);
  const occupancyRate = totalCapacity > 0 ? Math.min(100, Math.round((activity.totalPilgrims / totalCapacity) * 100)) : 0;
  const totalDossiers = activity.totalPilgrims || 1;
  const pctPaidInFull = Math.min(100, Math.round(((finance?.paidInFullCount || 0) / totalDossiers) * 100));
  const pctInProgress = Math.min(100 - pctPaidInFull, Math.round(((finance?.inProgressCount || 0) / totalDossiers) * 100));
  const pctOverdue = Math.max(0, 100 - pctPaidInFull - pctInProgress);
  const totalDocsDossiers = ((documents?.completeCount || 0) + (documents?.incompleteCount || 0)) || totalDossiers;
  const docCompletionRate = Math.min(100, Math.round(((documents?.completeCount || 0) / totalDocsDossiers) * 100));
  const remainingRate = Math.max(0, 100 - (finance?.recoveryRate || 0));

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.07,
        delayChildren: 0.05,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.55,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  const chartSectionVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.15,
      },
    },
  };

  const chartCardVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 18 },
    show: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.65,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  const chartCanvasVariants = {
    hidden: { opacity: 0, scale: 0.93 },
    show: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.75,
        ease: [0.16, 1, 0.3, 1],
        delay: 0.15,
      },
    },
  };

  // Dynamic countdown for Hajj 2027
  const hajjVoyage = voyages.find((v) => v.type === 'HAJJ' || v.code?.includes('HAJ')) || voyages[0];
  const departureDateStr = hajjVoyage?.departureDate || '2027-05-18';
  const daysLeftHajj = React.useMemo(() => {
    const depTime = new Date(departureDateStr).getTime();
    const diff = depTime - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [departureDateStr]);

  // Recent validated real payments
  const recentPayments = React.useMemo(() => {
    return [...payments]
      .filter((p) => p.status === 'VALIDE')
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
      .slice(0, 5);
  }, [payments]);

  // Dossiers à attention managériale
  const overdueDossiers = React.useMemo(() => {
    return inscriptions.filter((i) => i.status !== 'ANNULEE' && (i.totalPaid || 0) === 0);
  }, [inscriptions]);

  const highBalanceDossiers = React.useMemo(() => {
    return inscriptions.filter((i) => i.status !== 'ANNULEE' && (i.balance || 0) >= 2000000);
  }, [inscriptions]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Banner / Welcome */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="bg-slate-900 rounded-2xl p-4 sm:p-6 text-white border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
      >
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-2">
            Campagne Officielle {hajjVoyage?.title || 'Hajj 2027'} & Oumrah
          </div>
          <h1 className="text-xl sm:text-2xl font-serif font-black tracking-tight text-white">
            Bonjour, {authUser?.firstName || authUser?.displayName || 'Équipe Taiba'} 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            {isAgent
              ? 'Priorités opérationnelles et dossiers nécessitant votre attention aujourd’hui.'
              : 'Indicateurs certifiés en temps réel • Direction Générale GIE TAIBA VOYAGES'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => onNavigate('inscriptions')}
            className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>+ Nouveau Dossier</span>
          </button>
          {!isAgent && (
            <button
              onClick={() => onNavigate('paiements')}
              className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <CreditCard className="w-3.5 h-3.5 text-amber-400" />
              <span>Encaisser</span>
            </button>
          )}
        </div>
      </motion.div>

      {/* Puces d'urgences opérationnelles réelles pour AGENT (Scroll horizontal fluide sur mobile) */}
      {isAgent && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          <button
            onClick={() => onNavigate('inscriptions')}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-bold hover:bg-amber-100 active:scale-95 transition cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>{documents.incompleteCount} dossier(s) incomplet(s)</span>
          </button>
          <button
            onClick={() => onNavigate('documents')}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-900 font-bold hover:bg-red-100 active:scale-95 transition cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span>{documents.missingPassports} passeport(s) à récupérer</span>
          </button>
          <button
            onClick={() => onNavigate('visas')}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold hover:bg-indigo-100 active:scale-95 transition cursor-pointer"
          >
            <Stamp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>{documents.missingVisas} visa(s) en attente</span>
          </button>
          <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 font-medium">
            <Clock className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span>Départ Hajj dans {daysLeftHajj} j</span>
          </div>
        </div>
      )}

      {/* LIGNE 1 : LES 4 CHIFFRES ESSENTIELS */}
      {isAgent ? (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
        >
          {/* Operational KPI 1 : Dossiers Inscrits */}
          <motion.div
            variants={cardVariants}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                <span className="truncate">1. Dossiers Inscrits</span>
                <div className="p-1.5 sm:p-2 bg-slate-100 rounded-xl text-slate-700 shrink-0">
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-serif">
                {activity.totalPilgrims}
              </div>
              <div className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-slate-500 font-medium truncate">
                Campagne active
              </div>
            </div>
            <div className="mt-3 pt-2 sm:mt-4 sm:pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 mb-1 font-medium">
                <span>Quota</span>
                <span className="font-bold text-slate-800">{occupancyRate}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 sm:h-2 overflow-hidden">
                <motion.div
                  className="bg-slate-900 h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${occupancyRate}%` }}
                  transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                />
              </div>
            </div>
          </motion.div>

          {/* Operational KPI 2 : Dossiers GED Complets */}
          <motion.div
            variants={cardVariants}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                <span className="truncate">2. Pièces Conformes</span>
                <span className="text-[10px] sm:text-xs font-black text-emerald-800 bg-emerald-100/80 px-1.5 sm:px-2 py-0.5 rounded-full border border-emerald-300">
                  {docCompletionRate}%
                </span>
              </div>
              <div className="mt-2 text-xl sm:text-2xl font-black text-emerald-700 tracking-tight font-serif">
                {documents.completeCount} / {totalDocsDossiers}
              </div>
              <div className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-slate-500 font-medium truncate">
                Pièces 100% validées
              </div>
            </div>
            <div className="mt-3 pt-2 sm:mt-4 sm:pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 mb-1 font-medium">
                <span>Complétude</span>
                <span className="font-bold text-emerald-700">{docCompletionRate}%</span>
              </div>
              <div className="w-full bg-emerald-100/60 rounded-full h-1.5 sm:h-2 overflow-hidden">
                <motion.div
                  className="bg-emerald-600 h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${docCompletionRate}%` }}
                  transition={{ duration: 1.25, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
                />
              </div>
            </div>
          </motion.div>

          {/* Operational KPI 3 : Passeports Collectés */}
          <motion.div
            variants={cardVariants}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-amber-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                <span className="truncate">3. Passeports Reçus</span>
                <div className="p-1.5 sm:p-2 bg-amber-50 rounded-xl text-amber-600 shrink-0">
                  <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl sm:text-2xl font-black text-amber-600 tracking-tight font-serif">
                {Math.max(0, activity.totalPilgrims - documents.missingPassports)} / {activity.totalPilgrims}
              </div>
              <div className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-slate-500 flex items-center justify-between font-medium">
                <span className="truncate">{documents.missingPassports} restants</span>
                <button
                  onClick={() => onNavigate('documents')}
                  className="text-amber-700 font-bold hover:underline cursor-pointer text-[10px] sm:text-xs shrink-0"
                >
                  GED →
                </button>
              </div>
            </div>
            <div className="mt-3 pt-2 sm:mt-4 sm:pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 mb-1 font-medium">
                <span>En agence</span>
                <span className="font-bold text-amber-700">
                  {activity.totalPilgrims > 0 ? Math.round(((activity.totalPilgrims - documents.missingPassports) / activity.totalPilgrims) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-amber-100/60 rounded-full h-1.5 sm:h-2 overflow-hidden">
                <motion.div
                  className="bg-amber-500 h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${activity.totalPilgrims > 0 ? Math.round(((activity.totalPilgrims - documents.missingPassports) / activity.totalPilgrims) * 100) : 0}%` }}
                  transition={{ duration: 1.25, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
                />
              </div>
            </div>
          </motion.div>

          {/* Operational KPI 4 : Visas Nusuk */}
          <motion.div
            variants={cardVariants}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                <span className="truncate">4. Visas Nusuk</span>
                <div className="p-1.5 sm:p-2 bg-slate-100 rounded-xl text-slate-700 shrink-0">
                  <Stamp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-serif">
                  {Math.max(0, activity.totalPilgrims - documents.missingVisas)}
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-emerald-700">délivrés</span>
              </div>
              <div className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-slate-500 flex items-center justify-between font-medium">
                <span className="truncate">Nusuk</span>
                <button
                  onClick={() => onNavigate('visas')}
                  className="text-slate-800 font-bold hover:underline cursor-pointer text-[10px] sm:text-xs shrink-0"
                >
                  Visas →
                </button>
              </div>
            </div>
            <div className="mt-3 pt-2 sm:mt-4 sm:pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 mb-1 font-medium">
                <span>Statut</span>
                <span className="font-bold text-slate-700">En cours</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 sm:h-2 overflow-hidden">
                <motion.div
                  className="bg-teal-600 h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${activity.totalPilgrims > 0 ? Math.round(((activity.totalPilgrims - documents.missingVisas) / activity.totalPilgrims) * 100) : 0}%` }}
                  transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.45 }}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {/* KPI 1 : CA Prévisionnel */}
          <motion.div
            variants={cardVariants}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                <span>1. CA Prévisionnel</span>
                <div className="p-2 bg-slate-100 rounded-xl text-slate-700">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900 tracking-tight font-serif">
                {formatFCFA(finance.totalRevenueExpected)}
              </div>
              <div className="mt-1 text-xs text-slate-500 font-medium">
                {activity.totalPilgrims} dossiers engagés sur Hajj 2027
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1 font-medium">
                <span>Remplissage du quota</span>
                <span className="font-bold text-slate-800">{occupancyRate}% ({activity.totalPilgrims}/{totalCapacity})</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <motion.div
                  className="bg-slate-900 h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${occupancyRate}%` }}
                  transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                />
              </div>
            </div>
          </motion.div>

          {/* KPI 2 : Total Encaissé */}
          <motion.div
            variants={cardVariants}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                <span>2. Total Encaissé</span>
                <span className="text-xs font-black text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-300">
                  {finance.recoveryRate}%
                </span>
              </div>
              <div className="mt-2 text-2xl font-black text-emerald-700 tracking-tight font-serif">
                {formatFCFA(finance.totalCollected)}
              </div>
              <div className="mt-1 text-xs text-slate-500 font-medium">
                3 versements validés avec reçu officiel
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1 font-medium">
                <span>Taux d'encaissement</span>
                <span className="font-bold text-emerald-700">{finance.recoveryRate}% recouvré</span>
              </div>
              <div className="w-full bg-emerald-100/60 rounded-full h-2 overflow-hidden">
                <motion.div
                  className="bg-emerald-600 h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(0, finance.recoveryRate))}%` }}
                  transition={{ duration: 1.25, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
                />
              </div>
            </div>
          </motion.div>

          {/* KPI 3 : Soldes à Recouvrer */}
          <motion.div
            variants={cardVariants}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-amber-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                <span>3. Reste à Recouvrer</span>
                <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-2xl font-black text-amber-600 tracking-tight font-serif">
                {formatFCFA(finance.totalRemaining)}
              </div>
              <div className="mt-1 text-xs text-slate-500 flex items-center justify-between font-medium">
                <span>Créances sous échéancier</span>
                <button
                  onClick={() => onNavigate('recouvrement')}
                  className="text-amber-700 font-bold hover:underline cursor-pointer"
                >
                  Relancer →
                </button>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1 font-medium">
                <span>Part restante à recouvrer</span>
                <span className="font-bold text-amber-700">{remainingRate}%</span>
              </div>
              <div className="w-full bg-amber-100/60 rounded-full h-2 overflow-hidden">
                <motion.div
                  className="bg-amber-500 h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(0, remainingRate))}%` }}
                  transition={{ duration: 1.25, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
                />
              </div>
            </div>
          </motion.div>

          {/* KPI 4 : Pèlerins Engagés */}
          <motion.div
            variants={cardVariants}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                <span>4. Pèlerins Engagés</span>
                <div className="p-2 bg-slate-100 rounded-xl text-slate-700">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 font-serif">{activity.totalPilgrims}</span>
                <span className="text-xs font-bold text-emerald-700">pèlerins engagés</span>
              </div>
              <div className="mt-1 text-xs text-slate-500 flex items-center gap-3 font-medium">
                <span className="text-blue-600 font-bold">{finance.inProgressCount} avec acompte</span>
                <span className="text-rose-600 font-bold">{finance.overdueCount} sans acompte</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1 font-medium">
                <span>Répartition des dossiers</span>
                <span className="font-bold text-slate-700">{finance.inProgressCount} versants / {activity.totalPilgrims}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex gap-0.5">
                <motion.div
                  className="bg-sky-500 h-full rounded-l-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${pctInProgress}%` }}
                  transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
                />
                <motion.div
                  className="bg-rose-400 h-full rounded-r-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${pctOverdue}%` }}
                  transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.45 }}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* LIGNE 2 : SUIVI CAMPAGNE HAJJ 2027 (SYNTHÈSE OFFICIELLE) */}
      <motion.div
        variants={sectionVariants}
        initial="hidden"
        animate="show"
        className="bg-linear-to-br from-slate-900 via-slate-900 to-slate-950 rounded-2xl p-5 border border-slate-800 text-white shadow-xl"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-serif font-black">
              H27
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Campagne Officielle Hajj 2027 (1448H)
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-md">
                  Active & Ouverte
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Campagne Hajj 2027 • Préparatifs et gestion des dossiers d'inscription
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('voyages')}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition cursor-pointer"
            >
              Fiche Campagne
            </button>
            <button
              onClick={() => onNavigate('inscriptions')}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white shadow-sm transition cursor-pointer"
            >
              Voir les 6 Inscriptions
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
            <span className="text-[11px] font-medium text-slate-400 block">Dossiers Enregistrés</span>
            <span className="text-xl font-black text-white font-serif">{activity.totalPilgrims} dossiers</span>
            <span className="text-[10px] text-emerald-400 block mt-0.5">Campagne Hajj 2027</span>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
            <span className="text-[11px] font-medium text-slate-400 block">
              {isAgent ? 'Passeports Reçus' : 'Versements Encaissés'}
            </span>
            <span className="text-xl font-black text-emerald-400 font-serif">
              {isAgent ? `${activity.totalPilgrims - documents.missingPassports} / ${activity.totalPilgrims}` : formatFCFA(finance.totalCollected)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {isAgent ? 'Pièces d\'identité en agence' : '3 versements en caisse'}
            </span>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
            <span className="text-[11px] font-medium text-slate-400 block">
              {isAgent ? 'Dossiers GED Validés' : "Dépenses d'Exploitation"}
            </span>
            <span className="text-xl font-black text-slate-200 font-serif">
              {isAgent ? `${documents.completeCount} dossiers` : '0 FCFA'}
            </span>
            <span className="text-[10px] text-amber-300 block mt-0.5">
              {isAgent ? `${docCompletionRate}% de complétude` : 'Trésorerie nette préservée à 100%'}
            </span>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
            <span className="text-[11px] font-medium text-slate-400 block">Capacité Campagne</span>
            <span className="text-xl font-black text-amber-400 font-serif">{activity.totalPilgrims} / {totalCapacity} places</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">{occupancyRate}% engagé</span>
          </div>
        </div>
      </motion.div>

      {/* LIGNE 3 : ACTION "À VOTRE ATTENTION" (PILOTAGE RAPIDE - FINANCES SEULEMENT) */}
      {!isAgent && (
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate="show"
          className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-amber-950 uppercase tracking-wide">
                  À Votre Attention • Actions Prioritaires de Recouvrement
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                  {overdueDossiers.length + highBalanceDossiers.length} dossiers à suivre
                </span>
              </div>
              <p className="text-xs text-amber-900/90 mt-1 leading-relaxed">
                <strong>{overdueDossiers.length} dossiers sans aucun acompte</strong> (en attente du 1er versement de confirmation) et{' '}
                <strong>{highBalanceDossiers.length} dossiers avec solde élevé &gt; 2 000 000 FCFA</strong> nécessitent une relance avant l'échéance contractuelle.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('recouvrement')}
            className="px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-md transition flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <span>Voir les dossiers à régulariser</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* LIGNE 4 : PROCHAINS DÉPARTS & COMPTE À REBOURS DYNAMIQUE */}
      <motion.div
        variants={sectionVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {/* Countdown Hero Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                Compte à Rebours Hajj 2027
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">
                J-{daysLeftHajj}
              </span>
            </div>
            <h3 className="text-lg font-serif font-black text-slate-900">
              Départ Prévu le 18 Mai 2027
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Date prévisionnelle de départ • Préparatifs et suivi des formalités en cours.
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Temps restant avant départ :</span>
              <span className="font-mono font-black text-slate-900 text-sm">
                {daysLeftHajj} jours
              </span>
            </div>
          </div>
        </div>

        {/* Suivi documentaire et préparatifs de voyage */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-emerald-600" />
                Suivi Documentaire & Préparatifs de Voyage
              </h3>
              <p className="text-xs text-slate-500">Statut réel issu de la base de données</p>
            </div>
            <button
              onClick={() => onNavigate('documents')}
              className="text-xs text-amber-800 font-bold hover:underline cursor-pointer"
            >
              Gérer GED →
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <span className="text-[11px] font-medium text-slate-500 block">Passeports Reçus</span>
              <span className="text-xl font-black text-slate-900 block mt-1">
                {activity.totalPilgrims - documents.missingPassports} / {activity.totalPilgrims}
              </span>
              <span className="text-[10px] text-amber-700 font-medium block mt-0.5">
                {documents.missingPassports} à collecter
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <span className="text-[11px] font-medium text-slate-500 block">Visas Délivrés</span>
              <span className="text-xl font-black text-slate-700 block mt-1">
                {Math.max(0, activity.totalPilgrims - documents.missingVisas)} / {activity.totalPilgrims}
              </span>
              <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                Procédure non ouverte
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <span className="text-[11px] font-medium text-slate-500 block">Billets Émis</span>
              <span className="text-xl font-black text-slate-700 block mt-1">
                {Math.max(0, activity.totalPilgrims - documents.missingTickets)} / {activity.totalPilgrims}
              </span>
              <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                Plannings non engagés
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* SECTION ACTIVITÉ RÉCENTE */}
      {!isAgent ? (
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate="show"
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs"
        >
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                Activité Récente des Encaissements
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Derniers versements enregistrés et validés en caisse avec reçu officiel
              </p>
            </div>
            <button
              onClick={() => onNavigate('paiements')}
              className="text-xs text-amber-800 font-bold hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Toute la caisse ({recentPayments.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentPayments.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Aucun paiement enregistré pour l'instant.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
                    <th className="pb-2.5">Reçu N°</th>
                    <th className="pb-2.5">Date</th>
                    <th className="pb-2.5">Pèlerin</th>
                    <th className="pb-2.5">Mode</th>
                    <th className="pb-2.5 text-right">Montant Encaissé</th>
                    <th className="pb-2.5 text-right">Reçu Officiel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentPayments.map((p) => {
                    const ins = inscriptions.find((i) => i.id === p.inscriptionId);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 font-mono font-bold text-slate-900">
                          {p.receiptNumber}
                        </td>
                        <td className="py-3 text-slate-600 font-medium">
                          {formatDate(p.paymentDate)}
                        </td>
                        <td className="py-3 font-bold text-slate-900">
                          {p.clientName || 'Pèlerin'}
                        </td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {p.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 text-right font-serif font-black text-emerald-700 text-sm">
                          {formatFCFA(p.amount)}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => onOpenReceipt ? onOpenReceipt(p, ins) : onNavigate('paiements')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] border border-emerald-200 transition cursor-pointer"
                          >
                            Consulter le reçu
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate="show"
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs"
        >
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-amber-600" />
                Derniers Dossiers d'Inscription Enregistrés
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Dossiers récents de pèlerinage pour le suivi opérationnel
              </p>
            </div>
            <button
              onClick={() => onNavigate('inscriptions')}
              className="text-xs text-amber-800 font-bold hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Tous les dossiers ({inscriptions.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {inscriptions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Aucune inscription enregistrée.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
                    <th className="pb-2.5">Code Dossier</th>
                    <th className="pb-2.5">Date Inscription</th>
                    <th className="pb-2.5">Pèlerin</th>
                    <th className="pb-2.5">Formule / Chambre</th>
                    <th className="pb-2.5">Documents GED</th>
                    <th className="pb-2.5 text-right">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inscriptions.slice(0, 6).map((ins) => {
                    const client = clients.find((c) => c.id === ins.clientId);
                    const pkg = packages.find((p) => p.id === ins.packageId);
                    return (
                      <tr key={ins.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 font-mono font-bold text-slate-900">
                          {ins.code}
                        </td>
                        <td className="py-3 text-slate-600 font-medium">
                          {formatDate(ins.createdAt)}
                        </td>
                        <td className="py-3 font-bold text-slate-900">
                          {client ? `${client.firstName} ${client.lastName}` : 'Pèlerin'}
                        </td>
                        <td className="py-3 text-slate-600">
                          {pkg ? `${pkg.name} (${pkg.roomType})` : 'Formule Standard'}
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            (ins.documentCompletenessRate || 0) >= 100
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {ins.documentCompletenessRate || 0}% complet
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {ins.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {/* Rentabilité par Voyage & Répartition Statuts (Charts - Financiers seulement) */}
      {!isAgent && (
        <motion.div
          variants={chartSectionVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {/* Profitability Bar Chart */}
          <motion.div
            variants={chartCardVariants}
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-slate-300 hover:shadow-xs transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Rentabilité Financière par Voyage
                </h2>
                <p className="text-xs text-slate-500">Chiffre d'Affaires vs Dépenses = Marge Nette d'Exploitation</p>
              </div>
              <button
                onClick={() => onNavigate('depenses')}
                className="text-xs text-amber-800 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                Détail dépenses <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            <motion.div
              variants={chartCanvasVariants}
              className="h-64 w-full origin-bottom"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={profitability} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="voyageCode" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`}
                  />
                  <Tooltip
                    formatter={(value: any) => [formatFCFA(Number(value)), '']}
                    contentStyle={{ fontSize: '12px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar
                    dataKey="revenue"
                    name="Chiffre d'Affaires"
                    fill="#0f172a"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={true}
                    animationDuration={1300}
                    animationEasing="ease-out"
                  />
                  <Bar
                    dataKey="expenses"
                    name="Dépenses d'exploitation"
                    fill="#d97706"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={true}
                    animationDuration={1300}
                    animationEasing="ease-out"
                  />
                  <Bar
                    dataKey="netResult"
                    name="Marge Brute"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={true}
                    animationDuration={1300}
                    animationEasing="ease-out"
                  />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Quick margin badge strip */}
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
              {profitability.map((p) => (
                <div key={p.voyageCode} className="flex flex-wrap items-center gap-2 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-800">{p.voyageCode}:</span>
                  {p.expenses === 0 ? (
                    <>
                      <span className="text-slate-600 font-medium">Trésorerie nette encaissée : {formatFCFA(finance.totalCollected)}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200" title="Les coûts d'exploitation (vols, hôtels, Mina) ne sont pas encore engagés pour cette campagne">
                        Résultat / Marge : NON DÉTERMINÉ
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-slate-600 font-medium">{formatFCFA(p.netResult)}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {p.marginRate}% marge
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Dossiers Payments Breakdown Pie */}
          <motion.div
            variants={chartCardVariants}
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-slate-300 hover:shadow-xs transition-all"
          >
            <div>
              <h2 className="text-sm font-bold text-slate-900 mb-1">Ventilation des Règlements</h2>
              <p className="text-xs text-slate-500 mb-4">Statut des paiements sur les dossiers en cours</p>

              <motion.div
                variants={chartCanvasVariants}
                className="h-52 w-full flex items-center justify-center origin-center"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                      isAnimationActive={true}
                      animationDuration={1200}
                      animationEasing="ease-out"
                    >
                      {paymentStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </motion.div>
            </div>

            <div className="mt-2 space-y-2 border-t border-slate-100 pt-3 text-xs">
              {paymentStatusData.map((item) => {
                const itemPct = totalDossiers > 0 ? Math.round((item.value / totalDossiers) * 100) : 0;
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-600 font-medium">{item.name}</span>
                      </div>
                      <span className="font-bold text-slate-800">{item.value} ({itemPct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: item.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${itemPct}%` }}
                        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Campagnes & Packages V5.2 Quotas & Grille Tarifaire */}
      <motion.div
        variants={sectionVariants}
        initial="hidden"
        animate="show"
        className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Compass className="w-4 h-4 text-amber-600" />
              Campagnes Officielles & Quotas d'Occupation V5.2
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Suivi des quotas attribués, formules tarifaires actives et versions figées
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('voyages')}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
              Gérer Campagnes
            </button>
            <button
              onClick={() => onNavigate('packages')}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Boxes className="w-3.5 h-3.5" />
              Grille Packages
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {voyages.map((voyage) => {
            const voyageInscriptions = inscriptions.filter((i) => i.voyageId === voyage.id && i.status !== 'ANNULEE');
            const voyagePackages = packages.filter((p) => p.voyageId === voyage.id);
            const enrolled = voyageInscriptions.length;
            const cap = voyage.capacity || 1;
            const pct = Math.min(100, Math.round((enrolled / cap) * 100));

            return (
              <div
                key={voyage.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2 py-0.5 rounded">
                        {voyage.code}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{voyage.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Départ : {formatDate(voyage.departureDate)} • {voyage.type}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      voyage.status === 'OUVERT'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {voyage.status}
                  </span>
                </div>

                {/* Quota bar */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-600 font-medium">Occupation quota :</span>
                    <span className="font-bold text-slate-900">
                      {enrolled} / {cap} places ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        pct >= 90 ? 'bg-rose-500' : pct >= 60 ? 'bg-amber-500' : 'bg-emerald-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Packages strip */}
                <div className="pt-2 border-t border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-600 block mb-1.5">
                    Formules & Barèmes ({voyagePackages.length}) :
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {voyagePackages.map((pkg) => {
                      const pkgEnrolled = voyageInscriptions.filter((i) => i.packageId === pkg.id).length;
                      const price = pkg.currentPrice || pkg.price || 0;
                      return (
                        <div
                          key={pkg.id}
                          className="bg-white p-2 rounded-lg border border-slate-200 text-xs flex items-center justify-between shadow-2xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900 block">{pkg.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              V{pkg.activeVersionNumber || 1} • {pkg.roomType}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-amber-800 text-xs block">{formatFCFA(price)}</span>
                            <span className="text-[10px] text-slate-500">{pkgEnrolled} inscrits</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Recouvrement Prioritaire & Documents Incomplets */}
      <motion.div
        variants={sectionVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Recouvrement Top Débiteurs (ou Dossiers Récents pour AGENT) */}
        {!isAgent ? (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900">Priorités de Recouvrement</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                    {recouvrement.urgentRemindersCount} Urgences
                  </span>
                </div>
                <p className="text-xs text-slate-500">Pèlerins avec solde élevé à relancer en priorité</p>
              </div>
              <button
                onClick={() => onNavigate('recouvrement')}
                className="text-xs text-amber-800 font-semibold hover:underline cursor-pointer"
              >
                Voir tous ({recouvrement.topDebtors.length}) →
              </button>
            </div>

            {/* Mobile Cards View */}
            <div className="block sm:hidden space-y-2.5">
              {recouvrement.topDebtors.slice(0, 5).map((d, i) => (
                <div
                  key={i}
                  className="p-3 bg-slate-50/80 rounded-lg border border-slate-200/80 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900 text-xs">{d.clientName}</p>
                      <p className="text-[11px] text-slate-500">{d.phone}</p>
                    </div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        d.priority === 'URGENT'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : d.priority === 'IMPORTANT'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {d.priority}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                    <span className="font-medium text-slate-600">{d.voyageCode}</span>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 mr-1">Reste :</span>
                      <span className="font-bold text-amber-700">{formatFCFA(d.remaining)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 font-semibold">
                    <th className="pb-2">Pèlerin</th>
                    <th className="pb-2">Voyage</th>
                    <th className="pb-2 text-right">Reste Dû</th>
                    <th className="pb-2 text-right">Priorité</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recouvrement.topDebtors.slice(0, 5).map((d, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5">
                        <p className="font-bold text-slate-900">{d.clientName}</p>
                        <p className="text-[11px] text-slate-400">{d.phone}</p>
                      </td>
                      <td className="py-2.5 font-medium text-slate-600">{d.voyageCode}</td>
                      <td className="py-2.5 text-right font-bold text-amber-700">
                        {formatFCFA(d.remaining)}
                      </td>
                      <td className="py-2.5 text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            d.priority === 'URGENT'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : d.priority === 'IMPORTANT'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {d.priority}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900">Dossiers Récents & Formules</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                    {inscriptions.length} Inscriptions
                  </span>
                </div>
                <p className="text-xs text-slate-500">Pèlerins enregistrés et formules associées</p>
              </div>
              <button
                onClick={() => onNavigate('inscriptions')}
                className="text-xs text-amber-800 font-semibold hover:underline cursor-pointer"
              >
                Voir tous →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 font-semibold">
                    <th className="pb-2">Pèlerin</th>
                    <th className="pb-2">Téléphone</th>
                    <th className="pb-2">Code Dossier</th>
                    <th className="pb-2 text-right">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inscriptions.slice(0, 5).map((ins) => {
                    const client = clients.find((c) => c.id === ins.clientId);
                    return (
                      <tr key={ins.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5">
                          <p className="font-bold text-slate-900">
                            {client ? `${client.firstName} ${client.lastName}` : 'Pèlerin'}
                          </p>
                        </td>
                        <td className="py-2.5 font-medium text-slate-600">
                          {client?.phone || '—'}
                        </td>
                        <td className="py-2.5 font-mono text-slate-700">
                          {ins.code}
                        </td>
                        <td className="py-2.5 text-right">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {ins.status}
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

        {/* Suivi Documentaire & Alertes Départs */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-shadow">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Complétude des Dossiers & Visas</h2>
                <p className="text-xs text-slate-500">Contrôle des formalités requises avant émission des billets</p>
              </div>
              <button
                onClick={() => onNavigate('documents')}
                className="text-xs text-amber-800 font-semibold hover:underline cursor-pointer"
              >
                Gérer GED →
              </button>
            </div>

            {/* Overall completeness fluid progress indicator */}
            <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-700">Taux de complétude documentaire</span>
                <span className="font-bold text-slate-900">{docCompletionRate}% ({documents.completeCount}/{totalDocsDossiers})</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                <motion.div
                  className="bg-linear-to-r from-emerald-600 to-teal-500 h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${docCompletionRate}%` }}
                  transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-200/60">
                <span className="text-[11px] font-medium text-emerald-800 block">Dossiers 100% Complets</span>
                <span className="text-xl font-bold text-emerald-700">{documents.completeCount}</span>
              </div>
              <div className="p-3 rounded-lg bg-amber-50/50 border border-amber-200/60">
                <span className="text-[11px] font-medium text-amber-800 block">Dossiers Incomplets</span>
                <span className="text-xl font-bold text-amber-700">{documents.incompleteCount}</span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-amber-50/60 border border-amber-200/60">
                <span className="text-amber-900 font-medium">Passeports biométriques manquants</span>
                <span className="font-bold text-amber-900 px-2 py-0.5 bg-amber-100 rounded">{documents.missingPassports}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-blue-50/60 border border-blue-200/60">
                <span className="text-blue-900 font-medium">Visas Nusuk en attente de délivrance</span>
                <span className="font-bold text-blue-900 px-2 py-0.5 bg-blue-100 rounded">{documents.missingVisas}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200">
                <span className="text-slate-700 font-medium">Billets d'avion à attribuer</span>
                <span className="font-bold text-slate-900 px-2 py-0.5 bg-slate-200 rounded">{documents.missingTickets}</span>
              </div>
            </div>
          </div>

          {/* Prochains Départs */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              Prochaines Campagnes Programmées
            </span>
            <div className="space-y-2">
              {activity.upcomingDepartures.map((u, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-100/70 transition-colors">
                  <div>
                    <span className="font-bold text-slate-900">{u.code}</span> — <span className="text-slate-700">{u.title}</span>
                    <div className="text-[10px] text-amber-700 font-medium mt-0.5">
                      Départ dans {u.daysLeft} jours
                    </div>
                  </div>
                  <span className="text-slate-700 font-semibold bg-white px-2 py-1 rounded border border-slate-200 shadow-2xs">
                    {formatDate(u.departureDate)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
