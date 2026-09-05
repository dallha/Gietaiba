import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { User, Role } from '../types.js';

interface AuthContextType {
  currentUser: User | null;
  firebaseUser: FirebaseUser | null;
  role: Role | null;
  loading: boolean;
  isPilgrim: boolean;
  isStaff: boolean;
  isSuperAdmin: boolean;
  getAuthorizedPath: () => string;
  hasPermission: (permission: string) => boolean;
  refreshUserData: () => Promise<void>;
}

const DEFAULT_SUPER_ADMIN_ROLE: Role = {
  id: 'SUPER_ADMIN',
  name: 'Super Administrateur',
  permissions: ['*'],
  description: 'Accès absolu et gouvernance du système',
  isSystem: true
};

const DEFAULT_PILGRIM_ROLE: Role = {
  id: 'PILGRIM',
  name: 'Pèlerin',
  permissions: [],
  description: 'Accès strictement restreint à son dossier pèlerin personnel',
  isSystem: true
};

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  firebaseUser: null,
  role: null,
  loading: true,
  isPilgrim: false,
  isStaff: false,
  isSuperAdmin: false,
  getAuthorizedPath: () => '/login',
  hasPermission: () => false,
  refreshUserData: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrProvisionUser = async (user: FirebaseUser) => {
    console.log('fetchOrProvisionUser for:', user.uid, user.email);
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      console.log('userDoc exists:', userDoc.exists());

      const isKnownSuperAdmin = 
        user.email === 'mr.niass@gmail.com' || 
        user.email === 'admin@taibavoyages.sn';

      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        
        // Ensure root bootstrap admin retains SUPER_ADMIN & active
        if (isKnownSuperAdmin && (userData.roleId !== 'SUPER_ADMIN' || !userData.active)) {
          userData.roleId = 'SUPER_ADMIN';
          userData.status = 'ACTIF';
          userData.active = true;
          // Sync root admin status to Firestore
          await setDoc(userDocRef, { roleId: 'SUPER_ADMIN', status: 'ACTIF', active: true }, { merge: true }).catch(() => {});
        }
        
        setCurrentUser(userData);

        if (userData.roleId) {
          try {
            const roleDocRef = doc(db, 'roles', userData.roleId);
            const roleDoc = await getDoc(roleDocRef);
            
            if (roleDoc.exists()) {
              setRole(roleDoc.data() as Role);
            } else if (userData.roleId === 'SUPER_ADMIN') {
              // Provision the SUPER_ADMIN role in Firestore if it doesn't exist
              await setDoc(roleDocRef, DEFAULT_SUPER_ADMIN_ROLE);
              setRole(DEFAULT_SUPER_ADMIN_ROLE);
            } else if (userData.roleId === 'PILGRIM') {
              setRole(DEFAULT_PILGRIM_ROLE);
            } else {
              setRole({
                id: userData.roleId,
                name: userData.roleId,
                permissions: []
              });
            }
          } catch {
            setRole(userData.roleId === 'PILGRIM' ? DEFAULT_PILGRIM_ROLE : null);
          }
        }
      } else {
        // Principle of Least Privilege: New users default to PILGRIM unless root admin
        const nameParts = (user.displayName || (isKnownSuperAdmin ? 'Super Admin' : 'Nouveau Pèlerin')).split(' ');
        const initialRoleId = isKnownSuperAdmin ? 'SUPER_ADMIN' : 'PILGRIM';
        
        const autoUserData: User = {
          id: user.uid,
          authUid: user.uid,
          email: user.email || '',
          firstName: nameParts[0] || 'Utilisateur',
          lastName: nameParts.slice(1).join(' ') || '',
          roleId: initialRoleId,
          status: 'ACTIF',
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (user.photoURL) {
          autoUserData.photoUrl = user.photoURL;
        }

        setCurrentUser(autoUserData);
        setRole(isKnownSuperAdmin ? DEFAULT_SUPER_ADMIN_ROLE : DEFAULT_PILGRIM_ROLE);

        // Persist to Firestore
        try {
          await setDoc(userDocRef, autoUserData, { merge: true });
        } catch (saveErr) {
          console.warn('Initial user profile write note:', saveErr);
        }
      }
    } catch (err) {
      console.error('Error in fetchOrProvisionUser:', err);
      if (user) {
        const isKnownSuperAdmin = user.email === 'mr.niass@gmail.com' || user.email === 'admin@taibavoyages.sn';
        const fallbackUser: User = {
          id: user.uid,
          authUid: user.uid,
          email: user.email || '',
          firstName: isKnownSuperAdmin ? 'Super' : 'Pèlerin',
          lastName: isKnownSuperAdmin ? 'Admin' : 'Invité',
          roleId: isKnownSuperAdmin ? 'SUPER_ADMIN' : 'PILGRIM',
          status: 'ACTIF',
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setCurrentUser(fallbackUser);
        setRole(isKnownSuperAdmin ? DEFAULT_SUPER_ADMIN_ROLE : DEFAULT_PILGRIM_ROLE);
      }
    }
  };

  const refreshUserData = async () => {
    if (auth.currentUser) {
      await fetchOrProvisionUser(auth.currentUser);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await fetchOrProvisionUser(user);
      } else {
        setCurrentUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const hasPermission = (permission: string) => {
    const email = (firebaseUser?.email || currentUser?.email)?.toLowerCase();
    const isAdminEmail = email === 'mr.niass@gmail.com' || email === 'admin@taibavoyages.sn';
    
    console.log('RBAC Check:', { permission, email, isAdminEmail, roleId: currentUser?.roleId, active: currentUser?.active });

    // Absolute God Mode for root owner - rely on authenticated token email, not just firestore doc
    if (isAdminEmail) {
      console.log('RBAC Allowed: God Mode');
      return true;
    }
    
    if (!currentUser || !currentUser.active || currentUser.status !== 'ACTIF') {
      console.log('RBAC Denied: User inactive or missing');
      return false; // Inactive or blocked user has ZERO permissions
    }
    
    if (!role) {
      console.log('RBAC Denied: Role not loaded');
      return false;
    }
    if (role.permissions.includes('*')) {
      console.log('RBAC Allowed: Role has *');
      return true;
    }
    const allowed = role.permissions.includes(permission);
    console.log('RBAC Result:', allowed);
    return allowed;
  };

  const isSuperAdmin = Boolean(
    currentUser?.roleId === 'SUPER_ADMIN' ||
    currentUser?.email === 'mr.niass@gmail.com' ||
    currentUser?.email === 'admin@taibavoyages.sn'
  );

  const isPilgrim = Boolean(currentUser && currentUser.roleId === 'PILGRIM');

  const isStaff = Boolean(currentUser && currentUser.roleId !== 'PILGRIM');

  const getAuthorizedPath = (): string => {
    if (!currentUser || !currentUser.active || currentUser.status !== 'ACTIF') {
      return '/login';
    }
    if (currentUser.roleId === 'PILGRIM') {
      return '/portail';
    }
    // All staff roles (SUPER_ADMIN, DIRECTION, CAISSE, LOGISTIQUE, etc.) go to ERP Espace Équipe
    return '/erp';
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        firebaseUser,
        role,
        loading,
        isPilgrim,
        isStaff,
        isSuperAdmin,
        getAuthorizedPath,
        hasPermission,
        refreshUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
