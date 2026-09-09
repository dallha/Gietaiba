import React, { useState, useEffect, useMemo } from 'react';
import { useNotifications } from '../hooks/useNotifications.js';
import { markAsRead, markAllAsRead } from '../services/notification.service.js';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Clock, 
  ShieldCheck, 
  LogOut, 
  Phone, 
  Mail, 
  AlertCircle 
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext.js';
import { api } from '../services/api.js';
import { 
  Client, 
  Inscription, 
  Payment, 
  PilgrimDocument, 
  Visa, 
  Flight, 
  Hotel, 
  Room, 
  Group, 
  Voyage, 
  VoyagePackage,
  AgencySettings 
} from '../types.js';

import { PilgrimTab, PilgrimDossierProgress } from '../components/pilgrim/PilgrimTypes.js';
import { PilgrimHeader } from '../components/pilgrim/PilgrimHeader.js';
import { PilgrimNav } from '../components/pilgrim/PilgrimNav.js';
import { PilgrimHomeView } from '../components/pilgrim/PilgrimHomeView.js';
import { PilgrimVoyagesView } from '../components/pilgrim/PilgrimVoyagesView.js';
import { PilgrimDossierDetailView } from '../components/pilgrim/PilgrimDossierDetailView.js';
import { PilgrimFinancesView } from '../components/pilgrim/PilgrimFinancesView.js';
import { PilgrimDocumentsView } from '../components/pilgrim/PilgrimDocumentsView.js';
import { PilgrimBadgeView } from '../components/pilgrim/PilgrimBadgeView.js';
import { PilgrimProfileView } from '../components/pilgrim/PilgrimProfileView.js';
import { PilgrimLogisticsView } from '../components/pilgrim/PilgrimLogisticsView.js';
import { PilgrimNotificationsView } from '../components/pilgrim/PilgrimNotificationsView.js';

export const PilgrimPortal: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logoutUser } = useAuth();

  const [activeTab, setActiveTab] = useState<PilgrimTab>('accueil');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real Database Entities
  const [clientData, setClientData] = useState<Client | null>(null);
  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const [selectedInscriptionId, setSelectedInscriptionId] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [documents, setDocuments] = useState<PilgrimDocument[]>([]);
  const [visas, setVisas] = useState<Visa[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [group, setGroup] = useState<Group | null>(null);
  const [agencySettings, setAgencySettings] = useState<AgencySettings | undefined>(undefined);
  const [isDeniedDossier, setIsDeniedDossier] = useState(false);

  // Sync URL route with active tab and inscription ID (Requirement 6: Secure Routing)
  useEffect(() => {
    const path = location.pathname;
    
    // Check for specific dossier URL: /portail/dossiers/:id or /pelerin/dossiers/:id
    const dossierMatch = path.match(/\/(portail|pelerin)\/dossiers\/([^/]+)/);
    if (dossierMatch) {
      const targetId = dossierMatch[2];
      // Will be evaluated once inscriptions are loaded
      setActiveTab('dossier');
      if (inscriptions.length > 0) {
        const found = inscriptions.find(i => i.id === targetId || i.code === targetId);
        if (found) {
          setSelectedInscriptionId(found.id);
          setIsDeniedDossier(false);
        } else {
          // IDOR Defense: User attempted accessing an unauthorized dossier!
          setIsDeniedDossier(true);
        }
      }
      return;
    }

    if (path.includes('/dossiers')) {
      setActiveTab('voyages');
    } else if (path.includes('/documents')) {
      setActiveTab('documents');
    } else if (path.includes('/paiements') || path.includes('/finances')) {
      setActiveTab('finances');
    } else if (path.includes('/logistique')) {
      setActiveTab('logistique');
    } else if (path.includes('/badge')) {
      setActiveTab('badge');
    } else if (path.includes('/profil')) {
      setActiveTab('profil');
    } else if (path.includes('/notifications')) {
      setActiveTab('notifications');
    } else {
      setActiveTab('accueil');
    }
  }, [location.pathname, inscriptions]);

  // Tab navigation helper keeping URL clean
  const handleSelectTab = (tab: PilgrimTab) => {
    setActiveTab(tab);
    setIsDeniedDossier(false);
    
    // Smooth URL navigation for bookmarks / deep linking
    const prefix = location.pathname.startsWith('/pelerin') ? '/pelerin' : '/portail';
    switch (tab) {
      case 'accueil':
        navigate(`${prefix}`, { replace: true });
        break;
      case 'voyages':
        navigate(`${prefix}/dossiers`, { replace: true });
        break;
      case 'dossier':
        if (selectedInscriptionId) {
          navigate(`${prefix}/dossiers/${selectedInscriptionId}`, { replace: true });
        } else {
          navigate(`${prefix}/dossiers`, { replace: true });
        }
        break;
      case 'documents':
        navigate(`${prefix}/documents`, { replace: true });
        break;
      case 'finances':
        navigate(`${prefix}/paiements`, { replace: true });
        break;
      case 'logistique':
        navigate(`${prefix}/logistique`, { replace: true });
        break;
      case 'badge':
        navigate(`${prefix}/badge`, { replace: true });
        break;
      case 'profil':
        navigate(`${prefix}/profil`, { replace: true });
        break;
      case 'notifications':
        navigate(`${prefix}/notifications`, { replace: true });
        break;
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    navigate('/login');
  };

  // Main Data Loader
  useEffect(() => {
    async function loadPilgrimData() {
      if (!currentUser?.clientId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [dossier, hotelList, settings] = await Promise.all([
          api.getPilgrimDossier(currentUser.clientId),
          api.getHotels().catch(() => []),
          api.getSettings().catch(() => undefined),
        ]);

        if (dossier.client) {
          setClientData(dossier.client as Client);
        }

        let insList: Inscription[] = (dossier as any).inscriptions || (dossier.inscription ? [dossier.inscription] : []);
        if (currentUser.allowedInscriptionIds && currentUser.allowedInscriptionIds.length > 0) {
          insList = insList.filter(ins => currentUser.allowedInscriptionIds?.includes(ins.id));
        }

        setInscriptions(insList);
        if (insList.length > 0) {
          setSelectedInscriptionId((prev) => prev || insList[0].id);
        }

        setPayments(dossier.payments || []);
        setDocuments(dossier.documents || []);
        setVisas(dossier.visa ? [dossier.visa] : []);
        setFlights(dossier.flights || []);
        setHotels(hotelList || []);
        if (settings) {
          setAgencySettings(settings);
        }
      } catch (err: any) {
        console.error('Error loading pilgrim portal data via API:', err);
        setError('Impossible de charger les données de votre dossier.');
      } finally {
        setLoading(false);
      }
    }

    loadPilgrimData();
  }, [currentUser]);

  // Active Inscription Resolution
  const activeInscription = useMemo(() => {
    return inscriptions.find(i => i.id === selectedInscriptionId) || inscriptions[0] || null;
  }, [inscriptions, selectedInscriptionId]);

  // Associated Flight & Hotels for current dossier
  const activeFlight = useMemo(() => {
    if (!activeInscription?.voyageId) return null;
    return flights.find(f => f.voyageId === activeInscription.voyageId) || flights[0] || null;
  }, [flights, activeInscription]);

  const hotelMakkah = useMemo(() => {
    return hotels.find(h => h.city === 'MAKKAH' || h.name?.toLowerCase().includes('makkah')) || hotels[0] || null;
  }, [hotels]);

  const hotelMadinah = useMemo(() => {
    return hotels.find(h => h.city === 'MEDINA' || h.city === 'MADINAH' || h.name?.toLowerCase().includes('madin')) || null;
  }, [hotels]);

  const activeVisa = useMemo(() => {
    return visas.find(v => v.clientId === currentUser?.clientId) || null;
  }, [visas, currentUser]);

  // Dynamic Progression Calculation (Requirement 12: Real Progression Tracker)
  const progress: PilgrimDossierProgress = useMemo(() => {
    if (!activeInscription) {
      return {
        dossierComplete: false,
        documentsComplete: false,
        documentsRatio: { validated: 0, total: 0 },
        visaComplete: false,
        flightComplete: false,
        hotelComplete: false,
        financeComplete: false,
        readyForDeparture: false,
        overallPercentage: 0,
      };
    }

    const insPayments = payments.filter(p => !p.inscriptionId || p.inscriptionId === activeInscription.id);
    const agreedPrice = activeInscription.agreedPrice || activeInscription.appliedPrice || 0;
    const totalPaid = activeInscription.totalPaid !== undefined
      ? activeInscription.totalPaid
      : insPayments.filter(p => p.status === 'VALIDE' || p.status === 'VALIDATED').reduce((s, p) => s + p.amount, 0);

    const isFinanceComplete = agreedPrice > 0 && totalPaid >= agreedPrice;
    const insDocs = documents.filter(d => !d.inscriptionId || d.inscriptionId === activeInscription.id);
    const validatedDocs = insDocs.filter(d => d.status === 'VALIDE' || d.status === 'VALIDATED');
    const isDocumentsComplete = insDocs.length > 0 && validatedDocs.length >= insDocs.length;
    const isVisaComplete = activeVisa?.statut === 'VALIDE' || activeVisa?.statut === 'EMIS';
    const isFlightComplete = !!activeFlight;
    const isHotelComplete = !!hotelMakkah;
    const isDossierComplete = activeInscription.statut === 'CONFIRMEE' || !!activeInscription.code;

    let score = 0;
    if (isDossierComplete) score += 20;
    if (isDocumentsComplete) score += 20;
    else if (validatedDocs.length > 0) score += 10;
    if (isFinanceComplete) score += 20;
    else if (totalPaid > 0) score += 10;
    if (isVisaComplete) score += 20;
    if (isFlightComplete) score += 10;
    if (isHotelComplete) score += 10;

    const readyForDeparture = isFinanceComplete && isVisaComplete && isFlightComplete && isDocumentsComplete;

    return {
      dossierComplete: isDossierComplete,
      documentsComplete: isDocumentsComplete,
      documentsRatio: { validated: validatedDocs.length, total: insDocs.length },
      visaComplete: isVisaComplete,
      flightComplete: isFlightComplete,
      hotelComplete: isHotelComplete,
      financeComplete: isFinanceComplete,
      readyForDeparture,
      overallPercentage: Math.min(readyForDeparture ? 100 : 95, Math.round(score)),
    };
  }, [activeInscription, payments, documents, activeVisa, activeFlight, hotelMakkah]);

  // Real Events & Notifications (Firestore synced)
  const { notifications: portalNotifications, unreadCount } = useNotifications();


  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center text-white space-y-4">
          <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto shadow-lg" />
          <p className="text-sm font-bold text-slate-200">Connexion sécurisée à votre Espace Pèlerin...</p>
          <p className="text-xs text-slate-400">GIE TAIBA VOYAGES • Chiffrement & Contrôle d'Accès</p>
        </div>
      </div>
    );
  }

  // Waiting screen if user is authenticated but not yet linked to an ERP client (Requirement 17)
  if (!currentUser?.clientId || inscriptions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
        {/* Top bar */}
        <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-black text-sm tracking-wide text-white">GIE TAIBA VOYAGES</h1>
              <p className="text-[11px] text-amber-400">Portail Pèlerin • Activation en cours</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Déconnexion</span>
          </button>
        </header>

        {/* Content */}
        <main className="max-w-md mx-auto w-full p-6 text-center space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto shadow-xl">
            <Clock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-white uppercase tracking-tight">
              Compte Pèlerin en Cours d'Activation
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Bienvenue, <strong>{currentUser?.firstName} {currentUser?.lastName}</strong>. Votre compte d'accès est authentifié avec succès.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Pour des raisons strictes de sécurité et de confidentialité, l'administration de <strong>GIE TAIBA VOYAGES</strong> procède actuellement au rattachement de votre numéro de dossier.
            </p>
          </div>

          {/* Contact Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-xs text-slate-300 text-left space-y-3 shadow-md">
            <div className="flex items-center gap-2 font-bold text-amber-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Assistance & Activation Rapide</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Veuillez communiquer votre adresse email (<strong>{currentUser?.email}</strong>) ou votre nom à votre agent de voyage pour activer l'accès immédiat à vos pièces et reçus.
            </p>
            <div className="pt-2 border-t border-slate-800 space-y-1 text-slate-300 font-medium">
              <p className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                <span>+221 33 821 00 00 / +221 77 000 00 00</span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-amber-400" />
                <span>contact@taibavoyages.sn</span>
              </p>
            </div>
          </div>
        </main>

        <footer className="p-4 text-center text-xs text-slate-600 border-t border-slate-900">
          GIE TAIBA VOYAGES • Plateforme ERP V5.3 Sécurisée
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col pb-20 sm:pb-8">
      {/* 1. Header (Agency, User Identity & Multi-Dossier Selector) */}
      <PilgrimHeader
        client={clientData}
        inscriptions={inscriptions}
        activeInscription={activeInscription}
        onSelectInscription={(id) => {
          setSelectedInscriptionId(id);
          setIsDeniedDossier(false);
        }}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        unreadNotificationsCount={unreadCount}
        onLogout={handleLogout}
      />

      {/* 2. Navigation Tabs (Desktop Strip + Mobile Touch Bar) */}
      <PilgrimNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        unreadCount={unreadCount}
      />

      {/* 3. Main Dynamic Content Body */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 flex-1">
        {/* Error notification if any */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Dynamic View Switching */}
        {activeTab === 'accueil' && clientData && (
          <PilgrimHomeView
            client={clientData}
            activeInscription={activeInscription}
            allInscriptions={inscriptions}
            payments={payments}
            documents={documents}
            visa={activeVisa}
            flight={activeFlight}
            hotelMakkah={hotelMakkah}
            hotelMadinah={hotelMadinah}
            progress={progress}
            onNavigateTab={handleSelectTab}
            onSelectInscription={setSelectedInscriptionId}
          />
        )}

        {activeTab === 'voyages' && (
          <PilgrimVoyagesView
            inscriptions={inscriptions}
            activeInscriptionId={selectedInscriptionId || ''}
            payments={payments}
            documents={documents}
            onSelectInscription={(id) => {
              setSelectedInscriptionId(id);
              setIsDeniedDossier(false);
            }}
            onNavigateTab={handleSelectTab}
          />
        )}

        {activeTab === 'dossier' && clientData && (
          <PilgrimDossierDetailView
            client={clientData}
            activeInscription={activeInscription}
            payments={payments}
            documents={documents}
            visa={activeVisa}
            flight={activeFlight}
            hotelMakkah={hotelMakkah}
            hotelMadinah={hotelMadinah}
            group={group}
            isDenied={isDeniedDossier}
            onNavigateTab={handleSelectTab}
          />
        )}

        {activeTab === 'finances' && (
          <PilgrimFinancesView
            activeInscription={activeInscription}
            payments={payments}
            settings={agencySettings}
          />
        )}

        {activeTab === 'documents' && (
          <PilgrimDocumentsView
            documents={documents}
          />
        )}

        {activeTab === 'logistique' && (
          <PilgrimLogisticsView
            activeInscription={activeInscription}
            flight={activeFlight}
            hotelMakkah={hotelMakkah}
            hotelMadinah={hotelMadinah}
            room={null}
            group={group}
          />
        )}

        {activeTab === 'badge' && clientData && (
          <PilgrimBadgeView
            client={clientData}
            activeInscription={activeInscription}
          />
        )}

        {activeTab === 'profil' && clientData && (
          <PilgrimProfileView
            client={clientData}
            user={currentUser}
            onClientUpdated={(updated) => {
              setClientData(prev => prev ? { ...prev, ...updated } : null);
            }}
          />
        )}

        {activeTab === 'notifications' && (
          <PilgrimNotificationsView
            notifications={portalNotifications}
            onNavigateTab={handleSelectTab}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={() => currentUser && markAllAsRead(currentUser.id, currentUser.clientId)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-4 text-center text-xs text-slate-400 border-t border-slate-200/80 mt-auto">
        <p className="font-semibold text-slate-600">
          GIE TAIBA VOYAGES • Agence Agréée Hajj & Oumrah
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Espace Pèlerin Certifié Conforme • Toutes les données financières et documents sont horodatés et authentifiés.
        </p>
      </footer>
    </div>
  );
};
