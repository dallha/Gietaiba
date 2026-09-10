import React, { useState, useEffect } from 'react';
import { eventBus } from './utils/eventBus.js';
import { AppLayout } from './components/layout/AppLayout.js';
import { TaibaLogo } from './components/brand/TaibaLogo.js';
import { ReceiptModal } from './components/receipt/ReceiptModal.js';
import { DashboardModule } from './modules/dashboard/DashboardModule.js';
import { ClientsModule } from './modules/clients/ClientsModule.js';
import { InscriptionsModule } from './modules/inscriptions/InscriptionsModule.js';
import { PackagesModule } from './modules/packages/PackagesModule.js';
import { PaiementsModule } from './modules/paiements/PaiementsModule.js';
import { RecouvrementModule } from './modules/recouvrement/RecouvrementModule.js';
import { DocumentsModule } from './modules/documents/DocumentsModule.js';
import { VisasModule } from './modules/visas/VisasModule.js';
import { LogistiqueModule } from './modules/logistique/LogistiqueModule.js';
import { DepensesModule } from './modules/depenses/DepensesModule.js';
import { VoyagesModule } from './modules/voyages/VoyagesModule.js';
import { RapportsModule } from './modules/rapports/RapportsModule.js';
import { EspacePelerinModule } from './modules/espace-pelerin/EspacePelerinModule.js';
import { AuditLogsModule } from './modules/audit/AuditLogsModule.js';
import { SettingsModule } from './modules/settings/SettingsModule.js';
import { UsersRolesModule } from './modules/users/UsersRolesModule.js';
import { WorkspaceModule } from './modules/workspace/WorkspaceModule.js';
import { api } from './services/api.js';
import { AlertTriangle, RefreshCw, ShieldAlert, ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.js';
import { isModuleAllowedForRole, normalizeRole, MODULE_LABELS } from './auth/roleModules.js';
import {
  User,
  Client,
  Voyage,
  Package,
  Inscription,
  Payment,
  PilgrimDocument,
  Visa,
  Flight,
  Ticket,
  Hotel,
  Room,
  Group,
  Accompagnateur,
  Expense,
  AuditLog,
  AgencySettings,
  DashboardStats,
} from './types.js';

export const MODULE_TO_ROUTE: Record<string, string> = {
  'dashboard': '/tableau-de-bord',
  'clients': '/clients',
  'inscriptions': '/inscriptions',
  'packages': '/programmes',
  'paiements': '/paiements',
  'recouvrement': '/recouvrement',
  'depenses': '/depenses',
  'voyages': '/voyages',
  'logistique': '/logistique',
  'hotels': '/hotels',
  'vols': '/vols',
  'groupes': '/groupes',
  'documents': '/documents',
  'visas': '/visas',
  'rapports': '/rapports',
  'users-roles': '/utilisateurs',
  'settings': '/parametres',
  'audit': '/audit',
  'workspace': '/workspace',
  'espace-pelerin': '/espace-pelerin',
};

export const ROUTE_TO_MODULE: Record<string, string> = {
  '/tableau-de-bord': 'dashboard',
  '/clients': 'clients',
  '/inscriptions': 'inscriptions',
  '/programmes': 'packages',
  '/packages': 'packages',
  '/paiements': 'paiements',
  '/recouvrement': 'recouvrement',
  '/depenses': 'depenses',
  '/voyages': 'voyages',
  '/logistique': 'logistique',
  '/hotels': 'hotels',
  '/vols': 'vols',
  '/groupes': 'groupes',
  '/documents': 'documents',
  '/visas': 'visas',
  '/rapports': 'rapports',
  '/utilisateurs': 'users-roles',
  '/users-roles': 'users-roles',
  '/parametres': 'settings',
  '/settings': 'settings',
  '/audit': 'audit',
  '/workspace': 'workspace',
  '/espace-pelerin': 'espace-pelerin',
};

export default function ErpApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser: authUser, role } = useAuth();

  // Résoudre le module actif directement depuis l'URL courante
  const activeModule = ROUTE_TO_MODULE[location.pathname] || 'dashboard';

  const navigateToModule = (mod: string) => {
    const route = MODULE_TO_ROUTE[mod] || (mod.startsWith('/') ? mod : `/${mod}`);
    navigate(route);
  };

  const [loading, setLoading] = useState<boolean>(true);

  // Core entities state
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const effectiveRoleId = normalizeRole(role?.id || authUser?.roleId || currentUser?.roleId);
  const isAllowed = isModuleAllowedForRole(effectiveRoleId, activeModule);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [documents, setDocuments] = useState<PilgrimDocument[]>([]);
  const [visas, setVisas] = useState<Visa[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [rooms, setRooms] = useState<(Room & { occupants: Client[] })[]>([]);
  const [groups, setGroups] = useState<(Group & { members: Client[] })[]>([]);
  const [accompagnateurs, setAccompagnateurs] = useState<Accompagnateur[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<AgencySettings>({
    agencyName: 'GIE TAIBA VOYAGES',
    licenseNumber: 'LIC-HAJJ-SN-2027-048',
    taxId: 'NINEA-002849182',
    address: 'Avenue Cheikh Anta Diop, Immeuble Taiba',
    city: 'Dakar',
    country: 'Sénégal',
    phone: '+221 33 824 55 00',
    email: 'contact@taibavoyages.sn',
    defaultCurrency: 'FCFA',
    receiptFooterTerms: 'Tout versement effectué fait l’objet d’un reçu officiel infalsifiable. Ce reçu tient lieu de pièce justificative pour la confirmation de l’inscription au pèlerinage.',
    bankDetails: {
      bankName: 'Banque Islamique du Sénégal (BIS)',
      iban: 'SN08 SN01 2010 0123 4567 8901 2345',
      bic: 'BISDSNDX',
    },
    mobileMoneyNumbers: {
      wave: '+221 77 500 20 20',
      orangeMoney: '+221 78 400 30 30',
    },
  });

  // Active Receipt Modal
  const [receiptModalData, setReceiptModalData] = useState<{
    payment: Payment;
    inscription?: Inscription;
  } | null>(null);

  // Selected Pilgrim for Espace Pelerin view
  const [activePilgrimId, setActivePilgrimId] = useState<string>('');

  // Selected client or inscription from Global Search Bar
  const [selectedClientIdForModule, setSelectedClientIdForModule] = useState<string | null>(null);
  const [searchInscriptionCode, setSearchInscriptionCode] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Function to load all data from backend API
  const refreshAllData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [
        statsData,
        usersData,
        clientsData,
        voyagesData,
        packagesData,
        inscriptionsData,
        paymentsData,
        documentsData,
        visasData,
        flightsData,
        ticketsData,
        hotelsData,
        roomsData,
        groupsData,
        accompagnateursData,
        expensesData,
        auditLogsData,
        settingsData,
      ] = await Promise.all([
        api.getDashboardStats().catch((err) => {
          console.warn('[ERP] Stats non disponibles:', err?.message || err);
          return null;
        }),
        api.getUsers().catch((err) => {
          console.warn('[ERP] Utilisateurs non disponibles:', err?.message || err);
          return [];
        }),
        api.getClients().catch((err) => {
          console.warn('[ERP] Clients non disponibles:', err?.message || err);
          return [];
        }),
        api.getVoyages().catch((err) => {
          console.warn('[ERP] Voyages non disponibles:', err?.message || err);
          return [];
        }),
        api.getPackages().catch((err) => {
          console.warn('[ERP] Packages non disponibles:', err?.message || err);
          return [];
        }),
        api.getInscriptions().catch((err) => {
          console.warn('[ERP] Inscriptions non disponibles:', err?.message || err);
          return [];
        }),
        api.getPayments().catch((err) => {
          console.warn('[ERP] Paiements non disponibles:', err?.message || err);
          return [];
        }),
        api.getDocuments().catch((err) => {
          console.warn('[ERP] Documents non disponibles:', err?.message || err);
          return [];
        }),
        api.getVisas().catch((err) => {
          console.warn('[ERP] Visas non disponibles:', err?.message || err);
          return [];
        }),
        api.getFlights().catch((err) => {
          console.warn('[ERP] Vols non disponibles:', err?.message || err);
          return [];
        }),
        api.getTickets().catch((err) => {
          console.warn('[ERP] Billets non disponibles:', err?.message || err);
          return [];
        }),
        api.getHotels().catch((err) => {
          console.warn('[ERP] Hôtels non disponibles:', err?.message || err);
          return [];
        }),
        api.getRooms().catch((err) => {
          console.warn('[ERP] Chambres non disponibles:', err?.message || err);
          return [];
        }),
        api.getGroups().catch((err) => {
          console.warn('[ERP] Groupes non disponibles:', err?.message || err);
          return [];
        }),
        api.getAccompagnateurs().catch((err) => {
          console.warn('[ERP] Accompagnateurs non disponibles:', err?.message || err);
          return [];
        }),
        api.getExpenses().catch((err) => {
          console.warn('[ERP] Dépenses non disponibles:', err?.message || err);
          return [];
        }),
        api.getAuditLogs().catch((err) => {
          console.warn('[ERP] Journal d\'audit non disponible:', err?.message || err);
          return [];
        }),
        api.getSettings().catch((err) => {
          console.warn('[ERP] Paramètres non disponibles:', err?.message || err);
          return null;
        }),
      ]);

      if (statsData) setDashboardStats(statsData);
      if (usersData && usersData.length > 0) setUsers(usersData);
      if (clientsData) {
        setClients(clientsData);
      }
      if (voyagesData) setVoyages(voyagesData);
      if (packagesData) setPackages(packagesData);
      if (inscriptionsData) {
        setInscriptions(inscriptionsData);
      }
      if (paymentsData) setPayments(paymentsData);
      if (documentsData) setDocuments(documentsData);
      if (visasData) setVisas(visasData);
      if (flightsData) setFlights(flightsData);
      if (ticketsData) setTickets(ticketsData);
      if (hotelsData) setHotels(hotelsData);
      if (roomsData) setRooms(roomsData);
      if (groupsData) setGroups(groupsData);
      if (accompagnateursData) setAccompagnateurs(accompagnateursData);
      if (expensesData) setExpenses(expensesData);
      if (auditLogsData) setAuditLogs(auditLogsData);
      if (settingsData) setSettings(settingsData);

      eventBus.emit('sync_success');

      if (!currentUser && usersData && usersData.length > 0) {
        setCurrentUser(usersData[0]);
      }
      if (!activePilgrimId && clientsData && clientsData.length > 0) {
        setActivePilgrimId(clientsData[0].id);
      }
    } catch (err: any) {
      console.error('Erreur lors du chargement des données ERP:', err);
      setLoadError(err?.message || 'Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  const handleOpenReceipt = (payment: Payment, inscription?: Inscription) => {
    const matchedIns =
      inscription ||
      inscriptions.find((i) => i.id === payment.inscriptionId) ||
      inscriptions.find((i) => i.clientId === payment.clientId);
    setReceiptModalData({ payment, inscription: matchedIns });
  };

  const handleNavigateToPayment = (clientId: string, inscriptionId: string) => {
    navigateToModule('paiements');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white space-y-6">
        <TaibaLogo size="xl" withContainer />
        <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <div className="text-center">
          <h2 className="text-xl font-black tracking-wider uppercase font-serif text-white">GIE TAIBA VOYAGES</h2>
          <p className="text-xs font-medium text-amber-300/90 tracking-widest mt-1.5 uppercase">
            Votre voyage spirituel, notre engagement.
          </p>
        </div>
      </div>
    );
  }

  if (loadError && clients.length === 0 && voyages.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
        <div className="bg-slate-900 border border-red-500/30 p-8 rounded-2xl max-w-md w-full text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/30 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white tracking-tight uppercase">Connexion au serveur sécurisé</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              {loadError}
            </p>
          </div>
          <button
            onClick={() => refreshAllData()}
            className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-lg cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Réessayer la synchronisation</span>
          </button>
        </div>
      </div>
    );
  }

  // IF ESPACE PÈLERIN IS ACTIVATED:
  if (activeModule === 'espace-pelerin') {
    return (
      <>
        <EspacePelerinModule
          currentClientId={activePilgrimId || clients[0]?.id || ''}
          clients={clients}
          settings={settings}
          onExitPortal={() => navigateToModule('dashboard')}
          onOpenReceipt={handleOpenReceipt}
          onSelectClient={(id) => setActivePilgrimId(id)}
        />
        {receiptModalData && (
          <ReceiptModal
            payment={receiptModalData.payment}
            inscription={receiptModalData.inscription}
            settings={settings}
            onClose={() => setReceiptModalData(null)}
          />
        )}
      </>
    );
  }

  // MAIN BACK-OFFICE LAYOUT:
  return (
    <AppLayout
      activeModule={activeModule}
      onNavigate={(mod) => {
        if (mod === 'espace-pelerin' && clients.length > 0 && !activePilgrimId) {
          setActivePilgrimId(clients[0].id);
        }
        navigateToModule(mod);
      }}
      onSelectModule={(mod) => {
        if (mod === 'espace-pelerin' && clients.length > 0 && !activePilgrimId) {
          setActivePilgrimId(clients[0].id);
        }
        navigateToModule(mod);
      }}
      onOpenPilgrimPortal={() => {
        if (clients.length > 0 && !activePilgrimId) {
          setActivePilgrimId(clients[0].id);
        }
        navigateToModule('espace-pelerin');
      }}
      currentUser={currentUser || users[0] || null}
      allUsers={users}
      users={users}
      onSwitchUser={(user) => {
        setCurrentUser(user);
      }}
      settings={settings}
      clients={clients}
      voyages={voyages}
      inscriptions={inscriptions}
      payments={payments}
      documents={documents}
      onOpenReceipt={handleOpenReceipt}
      onSelectClient={(client) => {
        setSelectedClientIdForModule(client.id);
        navigateToModule('clients');
      }}
      onSelectVoyage={(voyage) => {
        navigateToModule('voyages');
      }}
      onSelectInscription={(inscription) => {
        setSearchInscriptionCode(inscription.code);
        navigateToModule('inscriptions');
      }}
    >
      {/* 403 FORBIDDEN MODULE GUARD FOR DIRECT URL ACCESS */}
      {!isAllowed && (
        <div className="bg-white rounded-2xl border border-red-200/80 p-8 sm:p-12 shadow-sm text-center max-w-2xl mx-auto my-12">
          <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mx-auto mb-5">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="inline-block px-3 py-1 rounded-full bg-red-100 text-red-700 text-[11px] font-black uppercase tracking-wider mb-3">
            403 • Accès Non Autorisé
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-2 font-serif">
            Module Restreint pour votre Profil
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6 max-w-lg mx-auto">
            Votre profil d'authentification (<strong className="text-slate-900 font-bold">{role?.name || effectiveRoleId}</strong>) ne dispose pas des privilèges nécessaires pour accéder au module <strong className="text-slate-900 font-bold">« {MODULE_LABELS[activeModule] || activeModule} »</strong>. Veuillez vous référer à la Direction pour toute demande d'accès.
          </p>
          <button
            onClick={() => navigateToModule('dashboard')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retourner au Tableau de Bord</span>
          </button>
        </div>
      )}

      {/* 1. DASHBOARD */}
      {isAllowed && activeModule === 'dashboard' && (
        <DashboardModule
          stats={dashboardStats}
          clients={clients}
          inscriptions={inscriptions}
          payments={payments}
          voyages={voyages}
          packages={packages}
          settings={settings}
          onNavigate={(mod) => navigateToModule(mod)}
          onOpenReceipt={handleOpenReceipt}
        />
      )}

      {/* 2. CLIENTS */}
      {isAllowed && activeModule === 'clients' && (
        <ClientsModule
          clients={clients}
          inscriptions={inscriptions}
          payments={payments}
          documents={documents}
          settings={settings}
          initialSelectedClientId={selectedClientIdForModule}
          onRefresh={refreshAllData}
          onCreateClient={api.createClient}
          onUpdateClient={api.updateClient}
          onDeleteClient={api.deleteClient}
          onOpenReceipt={handleOpenReceipt}
          onNavigateToPayment={handleNavigateToPayment}
        />
      )}

      {/* 3. INSCRIPTIONS */}
      {isAllowed && activeModule === 'inscriptions' && (
        <InscriptionsModule
          inscriptions={inscriptions}
          clients={clients}
          voyages={voyages}
          packages={packages}
          settings={settings}
          initialSearchTerm={searchInscriptionCode}
          onRefresh={refreshAllData}
          onCreateInscription={api.createInscription}
          onNavigateToPayment={handleNavigateToPayment}
        />
      )}

      {/* 4. PACKAGES */}
      {isAllowed && activeModule === 'packages' && (
        <PackagesModule
          packages={packages}
          voyages={voyages}
          inscriptions={inscriptions}
          settings={settings}
          onRefresh={refreshAllData}
          onCreatePackage={api.createPackage}
          onUpdatePackage={api.updatePackage}
          onCreateNewPriceVersion={api.createNewPriceVersion}
          onDeletePackage={api.deletePackage}
          onNavigateToVoyages={() => navigateToModule('voyages')}
        />
      )}

      {/* 5. PAIEMENTS */}
      {isAllowed && activeModule === 'paiements' && (
        <PaiementsModule
          payments={payments}
          inscriptions={inscriptions}
          clients={clients}
          settings={settings}
          onRefresh={refreshAllData}
          onCreatePayment={api.createPayment}
          onCancelPayment={api.cancelPayment}
          onOpenReceipt={handleOpenReceipt}
        />
      )}

      {/* 6. RECOUVREMENT */}
      {isAllowed && activeModule === 'recouvrement' && (
        <RecouvrementModule
          inscriptions={inscriptions}
          clients={clients}
          voyages={voyages}
          settings={settings}
          onNavigateToPayment={handleNavigateToPayment}
        />
      )}

      {/* 7. DOCUMENTS GED */}
      {isAllowed && activeModule === 'documents' && (
        <DocumentsModule
          documents={documents}
          clients={clients}
          inscriptions={inscriptions}
          settings={settings}
          onRefresh={refreshAllData}
          onCreateDocument={api.createDocument}
          onUpdateDocumentStatus={api.updateDocumentStatus}
        />
      )}

      {/* 8. VISAS NUSUK */}
      {isAllowed && activeModule === 'visas' && (
        <VisasModule
          visas={visas}
          clients={clients}
          voyages={voyages}
          settings={settings}
          onRefresh={refreshAllData}
          onUpdateVisa={api.updateVisa}
        />
      )}

      {/* 9. LOGISTIQUE */}
      {isAllowed && (activeModule === 'logistique' || activeModule === 'hotels' || activeModule === 'vols' || activeModule === 'groupes') && (
        <LogistiqueModule
          flights={flights}
          tickets={tickets}
          hotels={hotels}
          rooms={rooms}
          groups={groups}
          accompagnateurs={accompagnateurs}
          clients={clients}
          inscriptions={inscriptions}
          settings={settings}
          onRefresh={refreshAllData}
          onAssignClientToRoom={api.assignClientToRoom}
          onRemoveClientFromRoom={api.removeClientFromRoom}
          onAddClientToGroup={api.addClientToGroup}
          onCreateFlight={api.createFlight}
        />
      )}

      {/* 10. DÉPENSES & RENTABILITÉ */}
      {isAllowed && activeModule === 'depenses' && (
        <DepensesModule
          expenses={expenses}
          voyages={voyages}
          inscriptions={inscriptions}
          settings={settings}
          onRefresh={refreshAllData}
          onCreateExpense={api.createExpense}
          onDeleteExpense={api.deleteExpense}
        />
      )}

      {/* 11. VOYAGES & CAMPAGNES */}
      {isAllowed && activeModule === 'voyages' && (
        <VoyagesModule
          voyages={voyages}
          inscriptions={inscriptions}
          packages={packages}
          expenses={expenses}
          settings={settings}
          onRefresh={refreshAllData}
          onCreateVoyage={api.createVoyage}
          onUpdateVoyage={api.updateVoyage}
          onDeleteVoyage={api.deleteVoyage}
          onNavigateToPackages={() => navigateToModule('packages')}
        />
      )}

      {/* 12. RAPPORTS & EXPORTS */}
      {isAllowed && activeModule === 'rapports' && (
        <RapportsModule
          clients={clients}
          inscriptions={inscriptions}
          payments={payments}
          voyages={voyages}
          rooms={rooms}
          hotels={hotels}
          settings={settings}
        />
      )}

      {/* 13. AUDIT LOGS */}
      {isAllowed && activeModule === 'audit' && (
        <AuditLogsModule logs={auditLogs} users={users} settings={settings} />
      )}

      {/* 14. SETTINGS */}
      {isAllowed && activeModule === 'settings' && (
        <SettingsModule
          settings={settings}
          onRefresh={refreshAllData}
          onUpdateSettings={(s) => api.updateSettings(s)}
        />
      )}

      {/* 15. USERS & ROLES */}
      {isAllowed && activeModule === 'users-roles' && (
        <UsersRolesModule />
      )}

      {/* 16. WORKSPACE INTEGRATIONS */}
      {isAllowed && activeModule === 'workspace' && (
        <WorkspaceModule />
      )}

      {/* MODAL REÇU OFFICIEL UNIVERSEL */}
      {receiptModalData && (
        <ReceiptModal
          payment={receiptModalData.payment}
          inscription={receiptModalData.inscription}
          settings={settings}
          onClose={() => setReceiptModalData(null)}
        />
      )}
    </AppLayout>
  );
}
