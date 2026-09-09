import React from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.js';
import { ShieldAlert, LogOut, ArrowLeft, Lock, ArrowRight } from 'lucide-react';

// Protects routes that require ANY authenticated user who is active
export const AuthGuard: React.FC = () => {
  const { currentUser, loading, logoutUser } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-3">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-300">Vérification de la session sécurisée...</p>
      </div>
    );
  }

  // Not signed in at all -> redirect to unified neutral login
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Signed in but explicitly marked inactive or suspended
  if (currentUser && (!currentUser.active || currentUser.status !== 'ACTIF')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="bg-slate-900 border border-red-500/30 p-8 rounded-2xl shadow-2xl max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div className="inline-block px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-wider mb-3">
            COMPTE DÉSACTIVÉ OU SUSPENDU
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight mb-2">Accès Refusé</h2>
          <p className="text-slate-400 text-xs leading-relaxed mb-6">
            Votre compte utilisateur a été désactivé ou suspendu par l'administration de GIE TAIBA VOYAGES. Vous ne disposez plus des droits d'accès à la plateforme.
          </p>
          <button
            onClick={() => logoutUser()}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

// Protects ERP routes from Pilgrims (PILGRIM -> ERP = DENIED)
export const ErpGuard: React.FC = () => {
  const { currentUser, loading, logoutUser } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-3">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-300">Chargement de votre espace de gestion...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Strict RBAC Separation: PELERIN -> ERP = DENIED
  if (currentUser && (currentUser.roleId === 'PELERIN' || currentUser.roleId === 'PILGRIM')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="bg-slate-900 border border-red-500/40 p-8 rounded-2xl shadow-2xl max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="inline-block px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-wider mb-3">
            DENIED • 403 ACCÈS INTERDIT
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight mb-2">Espace ERP Non Autorisé</h2>
          <p className="text-slate-400 text-xs leading-relaxed mb-6">
            Votre profil d'authentification est <strong className="text-emerald-400">Pèlerin</strong>. Conformément aux règles de sécurité RBAC de l'agence, l'Espace Équipe / ERP est strictement réservé aux collaborateurs de l'agence. Le changement d'espace par modification d'URL est bloqué.
          </p>
          <div className="space-y-2.5">
            <button
              onClick={() => navigate('/portail')}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-900/40"
            >
              <span>Accéder à mon Espace Pèlerin (/portail)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => logoutUser()}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Se déconnecter</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

// Protects Pilgrim routes from ERP staff (STAFF -> portail PILGRIM = DENIED)
export const PilgrimGuard: React.FC = () => {
  const { currentUser, role, loading, logoutUser } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-3">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-300">Chargement de votre portail pèlerin...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Strict RBAC Separation: STAFF -> portail PILGRIM = DENIED
  if (currentUser && currentUser.roleId !== 'PELERIN' && currentUser.roleId !== 'PILGRIM') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="bg-slate-900 border border-amber-500/40 p-8 rounded-2xl shadow-2xl max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <div className="inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-wider mb-3">
            DENIED • 403 ACCÈS INTERDIT
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight mb-2">Portail Réservé aux Pèlerins</h2>
          <p className="text-slate-400 text-xs leading-relaxed mb-6">
            Votre profil d'authentification est Collaborateur (<strong className="text-amber-400">{role?.name || currentUser.roleId}</strong>). Le Portail Pèlerin est strictement réservé aux pèlerins pour la consultation de leur dossier individuel. Vos outils métier se trouvent dans l'Espace Équipe.
          </p>
          <div className="space-y-2.5">
            <button
              onClick={() => navigate('/erp')}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-amber-900/40"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retourner à l'Espace Équipe (/erp)</span>
            </button>
            <button
              onClick={() => logoutUser()}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Se déconnecter</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

// Protects Super Admin modules (SUPER_ADMIN -> administration = ALLOW)
export const SuperAdminGuard: React.FC = () => {
  const { isSuperAdmin, loading, currentUser } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-3">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-300">Vérification des droits d'administration...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="bg-slate-900 border border-red-500/40 p-8 rounded-2xl shadow-2xl max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div className="inline-block px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-wider mb-3">
            403 • ACCÈS ADMINISTRATION REFUSÉ
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight mb-2">Gouvernance Système Restreinte</h2>
          <p className="text-slate-400 text-xs leading-relaxed mb-6">
            Ce module requiert les privilèges de Super Administrateur. Votre rôle actuel ne vous autorise pas à modifier ces paramètres de gouvernance.
          </p>
          <button
            onClick={() => navigate('/erp')}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Retourner au tableau de bord ERP
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

// Protects specific UI elements via dynamic permissions
export const PermissionGuard: React.FC<{ permission: string; children: React.ReactNode }> = ({ permission, children }) => {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission)) {
    return null;
  }
  return <>{children}</>;
};
