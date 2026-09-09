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
import { AlertTriangle, RefreshCw } from 'lucide-react';
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

export default function ErpApp() {
  const [activeModule, setActiveModule] = useState<string>('dashboard');
  const [loading, setLoading] = useState<boolean>(true);

  // Core entities state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
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
    setActiveModule('paiements');
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
          onExitPortal={() => setActiveModule('dashboard')}
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
        setActiveModule(mod);
      }}
      onSelectModule={(mod) => {
        if (mod === 'espace-pelerin' && clients.length > 0 && !activePilgrimId) {
          setActivePilgrimId(clients[0].id);
        }
        setActiveModule(mod);
      }}
      onOpenPilgrimPortal={() => {
        if (clients.length > 0 && !activePilgrimId) {
          setActivePilgrimId(clients[0].id);
        }
        setActiveModule('espace-pelerin');
      }}
      currentUser={currentUser || users[0] || null}
      allUsers={users}
      users={users}
      onSwitchUser={(user) => {
        setCurrentUser(user);
        api.setCurrentUserId(user.id);
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
        setActiveModule('clients');
      }}
      onSelectVoyage={(voyage) => {
        setActiveModule('voyages');
      }}
      onSelectInscription={(inscription) => {
        setSearchInscriptionCode(inscription.code);
        setActiveModule('inscriptions');
      }}
    >
      {/* 1. DASHBOARD */}
      {activeModule === 'dashboard' && (
        <DashboardModule
          stats={dashboardStats}
          clients={clients}
          inscriptions={inscriptions}
          payments={payments}
          voyages={voyages}
          packages={packages}
          settings={settings}
          onNavigate={(mod) => setActiveModule(mod)}
          onOpenReceipt={handleOpenReceipt}
        />
      )}

      {/* 2. CLIENTS */}
      {activeModule === 'clients' && (
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
      {activeModule === 'inscriptions' && (
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
      {activeModule === 'packages' && (
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
          onNavigateToVoyages={() => setActiveModule('voyages')}
        />
      )}

      {/* 5. PAIEMENTS */}
      {activeModule === 'paiements' && (
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
      {activeModule === 'recouvrement' && (
        <RecouvrementModule
          inscriptions={inscriptions}
          clients={clients}
          voyages={voyages}
          settings={settings}
          onNavigateToPayment={handleNavigateToPayment}
        />
      )}

      {/* 7. DOCUMENTS GED */}
      {activeModule === 'documents' && (
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
      {activeModule === 'visas' && (
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
      {activeModule === 'logistique' && (
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
      {activeModule === 'depenses' && (
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
      {activeModule === 'voyages' && (
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
          onNavigateToPackages={() => setActiveModule('packages')}
        />
      )}

      {/* 12. RAPPORTS & EXPORTS */}
      {activeModule === 'rapports' && (
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
      {activeModule === 'audit' && (
        <AuditLogsModule logs={auditLogs} users={users} settings={settings} />
      )}

      {/* 14. SETTINGS */}
      {activeModule === 'settings' && (
        <SettingsModule
          settings={settings}
          onRefresh={refreshAllData}
          onUpdateSettings={(s) => api.updateSettings(s)}
        />
      )}

      {/* 15. USERS & ROLES */}
      {activeModule === 'users-roles' && (
        <UsersRolesModule />
      )}

      {/* 16. WORKSPACE INTEGRATIONS */}
      {activeModule === 'workspace' && (
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
