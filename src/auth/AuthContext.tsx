import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Role, UserSession } from '../types.js';
import { api } from '../services/api.js';

interface AuthContextType {
  currentUser: User | null;
  role: Role | null;
  loading: boolean;
  isPilgrim: boolean;
  isStaff: boolean;
  isSuperAdmin: boolean;
  getAuthorizedPath: () => string;
  hasPermission: (permission: string) => boolean;
  refreshUserData: () => Promise<void>;
  loginWithSession: (session: UserSession) => void;
  logoutUser: () => Promise<void>;
}

const DEFAULT_SUPER_ADMIN_ROLE: Role = {
  id: 'SUPER_ADMIN',
  name: 'Super Administrateur',
  permissions: ['*'],
  description: 'Accès absolu et gouvernance du système',
  isSystem: true
};

const DEFAULT_PILGRIM_ROLE: Role = {
  id: 'PELERIN',
  name: 'Pèlerin',
  permissions: [],
  description: 'Accès strictement restreint à son dossier pèlerin personnel',
  isSystem: true
};

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  role: null,
  loading: true,
  isPilgrim: false,
  isStaff: false,
  isSuperAdmin: false,
  getAuthorizedPath: () => '/login',
  hasPermission: () => false,
  refreshUserData: async () => {},
  loginWithSession: () => {},
  logoutUser: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  const applySessionUser = useCallback((userSession: UserSession) => {
    const rawName = (userSession.displayName || '').trim();
    const nameParts = rawName ? rawName.split(' ') : [];
    const userRole = (userSession.role || 'AGENT').toUpperCase();
    const isPelerin = userRole === 'PELERIN' || userRole === 'PILGRIM';
    const roleId = isPelerin ? 'PELERIN' : userRole;

    const u: User = {
      id: userSession.id,
      authUid: userSession.id,
      email: userSession.email,
      displayName: userSession.displayName,
      firstName: userSession.firstName || nameParts[0] || (userSession.email ? userSession.email.split('@')[0] : 'Utilisateur'),
      lastName: userSession.lastName || nameParts.slice(1).join(' ') || '',
      roleId: roleId,
      status: 'ACTIF',
      active: true,
      clientId: userSession.clientId,
      allowedInscriptionIds: userSession.allowedInscriptionIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCurrentUser(u);

    if (roleId === 'SUPER_ADMIN') {
      setRole(DEFAULT_SUPER_ADMIN_ROLE);
    } else if (isPelerin) {
      setRole(DEFAULT_PILGRIM_ROLE);
    } else {
      setRole({
        id: roleId,
        name: roleId,
        permissions: (userSession as any).permissions || ['*'],
      });
    }
  }, []);

  const loginWithSession = useCallback((session: UserSession) => {
    applySessionUser(session);
  }, [applySessionUser]);

  const logoutUser = useCallback(async () => {
    api.logout();
    setCurrentUser(null);
    setRole(null);
  }, []);

  const refreshUserData = useCallback(async () => {
    const token = api.getToken();
    if (!token) return;
    try {
      const u = await api.getCurrentUser();
      if (u) {
        applySessionUser(u);
      }
    } catch {
      api.logout();
      setCurrentUser(null);
      setRole(null);
    }
  }, [applySessionUser]);

  useEffect(() => {
    let active = true;

    async function initAuth() {
      // 1. Détection éventuelle d'un token transmis dans l'URL (ex: redirection Google OAuth)
      if (typeof window !== 'undefined') {
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const urlToken = urlParams.get('token');
          if (urlToken) {
            api.setToken(urlToken);
            urlParams.delete('token');
            const remainingQuery = urlParams.toString();
            const cleanUrl = window.location.pathname + (remainingQuery ? `?${remainingQuery}` : '') + window.location.hash;
            window.history.replaceState({}, document.title, cleanUrl);
          }
        } catch (urlErr) {
          console.warn('[AuthContext] Erreur lecture token URL:', urlErr);
        }
      }

      const token = api.getToken();
      if (token) {
        try {
          const userSession = await api.getCurrentUser();
          if (active && userSession) {
            applySessionUser(userSession);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('[AuthContext] Session REST expirée ou invalide:', e);
          api.logout();
        }
      }

      if (active) {
        setCurrentUser(null);
        setRole(null);
        setLoading(false);
      }
    }

    initAuth();

    const handleUnauthorized = () => {
      if (active) {
        api.logout();
        setCurrentUser(null);
        setRole(null);
      }
    };
    window.addEventListener('taiba:unauthorized', handleUnauthorized);

    return () => {
      active = false;
      window.removeEventListener('taiba:unauthorized', handleUnauthorized);
    };
  }, [applySessionUser]);

  const hasPermission = (permission: string) => {
    const email = currentUser?.email?.toLowerCase();
    const isSuperAdminEmail = email === 'mr.niass@gmail.com' || email === 'kabaye73@gmail.com';
    
    // Absolute privileges for Super Admins
    if (isSuperAdminEmail || currentUser?.roleId === 'SUPER_ADMIN') {
      return true;
    }
    
    if (!currentUser || !currentUser.active || currentUser.status !== 'ACTIF') {
      return false; // Inactive or blocked user has ZERO permissions
    }
    
    if (!role) {
      return false;
    }
    if (role.permissions.includes('*')) {
      return true;
    }
    return role.permissions.includes(permission);
  };

  const isSuperAdmin = Boolean(
    currentUser?.roleId === 'SUPER_ADMIN' ||
    currentUser?.email === 'mr.niass@gmail.com' ||
    currentUser?.email === 'kabaye73@gmail.com'
  );

  const isPilgrim = Boolean(currentUser && (currentUser.roleId === 'PELERIN' || currentUser.roleId === 'PILGRIM'));

  const isStaff = Boolean(currentUser && currentUser.roleId !== 'PELERIN' && currentUser.roleId !== 'PILGRIM');

  const getAuthorizedPath = (): string => {
    if (!currentUser || !currentUser.active || currentUser.status !== 'ACTIF') {
      return '/login';
    }
    if (currentUser.roleId === 'PELERIN' || currentUser.roleId === 'PILGRIM') {
      return '/portail';
    }
    return '/erp';
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role,
        loading,
        isPilgrim,
        isStaff,
        isSuperAdmin,
        getAuthorizedPath,
        hasPermission,
        refreshUserData,
        loginWithSession,
        logoutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
