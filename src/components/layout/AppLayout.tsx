import React, { useState, useEffect } from 'react';
import { eventBus } from '../../utils/eventBus.js';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Layers,
  FileCheck,
  CreditCard,
  AlertCircle,
  FileText,
  Stamp,
  Plane,
  Building,
  Users2,
  TrendingDown,
  FileSpreadsheet,
  History,
  Settings,
  ShieldCheck,
  LogOut,
  UserCheck,
  Menu,
  X,
  Compass,
  ChevronRight,
  Building2,
  CalendarDays
} from 'lucide-react';
import { TaibaLogo } from '../brand/TaibaLogo.js';
import { UserSession, AgencySettings, Client, Voyage, Inscription, Payment, PilgrimDocument } from '../../types.js';
import { GlobalSearchBar } from './GlobalSearchBar.js';
import { NotificationBell } from '../notifications/NotificationBell.js';

import { useAuth } from '../../auth/AuthContext.js';

interface AppLayoutProps {
  currentUser?: any;
  settings?: AgencySettings;
  activeModule: string;
  onNavigate?: (module: string) => void;
  onSelectModule?: (module: string) => void;
  onSwitchUser?: (user: any) => void;
  allUsers?: any[];
  users?: any[];
  children: React.ReactNode;
  onGlobalSearch?: (query: string) => void;
  clients?: Client[];
  voyages?: Voyage[];
  inscriptions?: Inscription[];
  payments?: Payment[];
  documents?: PilgrimDocument[];
  onOpenReceipt?: (payment: Payment) => void;
  onSelectClient?: (client: Client) => void;
  onSelectVoyage?: (voyage: Voyage) => void;
  onSelectInscription?: (inscription: Inscription) => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentUser,
  settings,
  activeModule,
  onNavigate,
  onSelectModule,
  onSwitchUser,
  allUsers,
  users,
  children,
  onGlobalSearch,
  clients = [],
  voyages = [],
  inscriptions = [],
  payments = [],
  documents = [],
  onOpenReceipt,
  onSelectClient,
  onSelectVoyage,
  onSelectInscription,
}) => {
  const { currentUser: authUser, role, hasPermission, logoutUser } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing'>('synced');
  
  useEffect(() => {
    const onSync = () => {
      setSyncStatus('syncing');
      setTimeout(() => setSyncStatus('synced'), 2000);
    };
    eventBus.on('sync_success', onSync);
  }, []);
  const navigate = onNavigate || onSelectModule || (() => {});

  const effectiveUser = authUser || {
    id: 'usr-admin',
    email: 'admin',
    displayName: 'Direction Générale',
    roleId: 'SUPER_ADMIN',
  };
  
  const handleLogout = async () => {
    await logoutUser();
    navigate('/login');
  };

  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord exécutif', icon: LayoutDashboard, category: 'ACCUEIL' },
    
    { id: 'clients', label: 'Pèlerins & Contacts', icon: Users, category: 'PÈLERINS' },
    { id: 'inscriptions', label: 'Dossiers d’Inscription', icon: FileCheck, category: 'PÈLERINS' },
    
    { id: 'paiements', label: 'Caisse & Versements', icon: CreditCard, category: 'FINANCES' },
    { id: 'recouvrement', label: 'Recouvrement & Soldes', icon: AlertCircle, category: 'FINANCES' },
    { id: 'depenses', label: 'Dépenses & Rentabilité', icon: TrendingDown, category: 'FINANCES' },
    
    { id: 'voyages', label: 'Campagnes Hajj & Oumrah', icon: Calendar, category: 'VOYAGES' },
    { id: 'packages', label: 'Packages & Tarifs', icon: Layers, category: 'VOYAGES' },
    { id: 'hotels', label: 'Hôtels Makkah & Médine', icon: Building, category: 'VOYAGES' },
    { id: 'vols', label: 'Vols & Billetterie', icon: Plane, category: 'VOYAGES' },
    { id: 'groupes', label: 'Groupes & Encadreurs', icon: Users2, category: 'VOYAGES' },
    
    { id: 'documents', label: 'GED Documents', icon: FileText, category: 'DOCUMENTS' },
    { id: 'visas', label: 'Visas Nusuk & Statuts', icon: Stamp, category: 'DOCUMENTS' },
    
    { id: 'rapports', label: 'Rapports & Exports', icon: FileSpreadsheet, category: 'RAPPORTS' },
    
    { id: 'users-roles', label: 'Utilisateurs & Droits', icon: ShieldCheck, category: 'ADMINISTRATION' },
    { id: 'settings', label: 'Paramètres Agence', icon: Settings, category: 'ADMINISTRATION' },
    { id: 'audit', label: 'Journal d’Audit', icon: History, category: 'ADMINISTRATION' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 antialiased">
      {/* Top Header Bar */}
      <header className="bg-slate-900 text-white sticky top-0 z-40 border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          {/* Brand Left */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-hidden"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('dashboard')}>
              <div className="bg-white p-1 rounded-xl shadow-xs border border-amber-400/30 flex items-center justify-center">
                <TaibaLogo size="sm" />
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-black tracking-tight text-white uppercase">
                  {settings?.agencyName || 'GIE TAIBA VOYAGES'}
                </div>
                <div className="text-[11px] text-slate-400 font-medium truncate max-w-xs">
                  Votre voyage spirituel, notre engagement.
                </div>
              </div>
            </div>
          </div>

          {/* Global Real-Time Search Bar (Clients, Voyages, Inscriptions) */}
          <GlobalSearchBar
            clients={clients}
            voyages={voyages}
            inscriptions={inscriptions}
            onSelectClient={onSelectClient}
            onSelectVoyage={onSelectVoyage}
            onSelectInscription={onSelectInscription}
            onNavigate={navigate}
          />

          {/* Right Actions & User Info */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Real-time Notification Bell */}
            <NotificationBell
              onNavigate={navigate}
            />

            {/* Authenticated User Info & Logout */}
            <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-white leading-tight">
                  {effectiveUser.displayName || `${effectiveUser.firstName} ${effectiveUser.lastName}`.trim() || effectiveUser.email}
                </p>
                <p className="text-[10px] text-amber-400 font-medium">
                  {role?.name || effectiveUser.roleId}
                </p>
              </div>

              <button
                onClick={handleLogout}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-red-400 hover:text-red-300 rounded-lg py-1.5 px-2.5 sm:px-3 flex items-center gap-1.5 transition-colors font-bold cursor-pointer"
                title="Déconnexion sécurisée"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Body container: Sidebar + Main Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex gap-6">
        {/* Sidebar Navigation for Desktop */}
        <aside className="hidden lg:block w-64 shrink-0">
          <nav className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-3 space-y-4 sticky top-22 max-h-[calc(100vh-6.5rem)] overflow-y-auto">
            {['ACCUEIL', 'PÈLERINS', 'FINANCES', 'VOYAGES', 'DOCUMENTS', 'RAPPORTS', 'ADMINISTRATION'].map(
              (category) => {
                const items = navItems.filter((i) => i.category === category);
                if (items.length === 0) return null;

                return (
                  <div key={category} className="space-y-1">
                    <div className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {category}
                    </div>
                    {items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeModule === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => navigate(item.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                            isActive
                              ? 'bg-slate-900 text-amber-400 shadow-sm font-bold'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                          }`}
                        >
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              }
            )}
          </nav>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative bg-white w-72 max-w-full p-4 flex flex-col h-full shadow-2xl overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <span className="font-bold text-sm text-slate-900 font-serif">Navigation ERP</span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="py-3 space-y-4">
                {['ACCUEIL', 'PÈLERINS', 'FINANCES', 'VOYAGES', 'DOCUMENTS', 'RAPPORTS', 'ADMINISTRATION'].map((category) => {
                  const items = navItems.filter((i) => i.category === category);
                  if (items.length === 0) return null;
                  return (
                    <div key={category} className="space-y-1">
                      <div className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        {category}
                      </div>
                      {items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeModule === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              navigate(item.id);
                              setMobileMenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-colors text-left ${
                              isActive ? 'bg-slate-900 text-amber-400 font-bold' : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>

      {/* Simple Institutional Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <p>© {new Date().getFullYear()} {settings?.agencyName || 'GIE TAIBA VOYAGES'}. Organisation Agréée Hajj & Oumrah. Tous droits réservés.</p>
          <div className="flex items-center gap-4">
            <span className={`font-medium flex items-center gap-1 ${syncStatus === 'syncing' ? 'text-amber-600' : 'text-emerald-700'}`}>
               {syncStatus === 'syncing' ? '● Synchronisation...' : '● Base de données synchronisée'}
            </span>
            <span className="text-slate-400">Devise : {settings?.currency || 'FCFA'}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
