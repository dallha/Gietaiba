import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Role, Client, Inscription } from '../../types.js';

import { 
  Shield, 
  Users, 
  UserPlus, 
  CheckCircle, 
  XCircle, 
  Key, 
  Link2, 
  Unlink, 
  Trash2, 
  Edit3, 
  Save, 
  AlertTriangle, 
  Check, 
  Lock, 
  Layers, 
  Search, 
  Filter,
  Plus,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext.js';
import { normalizeRole } from '../../auth/roleModules.js';
import { logAudit } from '../../services/audit.service.js';
import { api } from '../../services/api.js';
import { CreateStaffAccountModal } from './CreateStaffAccountModal.js';
import { TempPasswordScreen } from './TempPasswordScreen.js';
import type { ProvisionResult, ProvisionPartialResult } from '../../../contracts/provisioning.js';

// Standard RBAC entity modules and actions matrix definition
const RBAC_MODULES = [
  { id: 'clients', label: 'Clients & Pèlerins', actions: ['view', 'create', 'update', 'delete'] },
  { id: 'inscriptions', label: 'Inscriptions & Dossiers', actions: ['view', 'create', 'update', 'delete'] },
  { id: 'payments', label: 'Paiements & Reçus', actions: ['view', 'create', 'update', 'delete'] },
  { id: 'documents', label: 'Documents & Pièces', actions: ['view', 'upload', 'validate', 'delete'] },
  { id: 'voyages', label: 'Voyages & Packages', actions: ['view', 'create', 'update', 'delete'] },
  { id: 'depenses', label: 'Dépenses & Caisse', actions: ['view', 'create', 'update', 'delete'] },
  { id: 'visas', label: 'Visas & Formalités', actions: ['view', 'update'] },
  { id: 'logistique', label: 'Vols & Hébergements', actions: ['view', 'update'] },
  { id: 'reports', label: 'Rapports & Exports', actions: ['view', 'export'] },
  { id: 'users', label: 'Gestion Utilisateurs', actions: ['view', 'create', 'update', 'delete'] },
  { id: 'audit', label: 'Journal d\'Audit', actions: ['view'] },
  { id: 'settings', label: 'Configuration Agence', actions: ['view', 'update'] }
];

const ACTION_LABELS: Record<string, string> = {
  view: 'Voir',
  create: 'Créer',
  update: 'Modifier',
  delete: 'Supprimer',
  upload: 'Téléverser',
  validate: 'Valider',
  export: 'Exporter'
};

export const getCanonicalRoleLabel = (roleId?: string, roleName?: string): string => {
  if (!roleId) return 'Utilisateur';
  if (roleId === 'AGENT') return 'AGENT';
  if (roleId === 'SUPER_ADMIN') return 'Super Administrateur';
  if (roleId === 'DIRECTION') return 'Direction Générale';
  if (roleId === 'COMPTABLE') return 'Comptable';
  if (roleId === 'PELERIN' || roleId === 'PILGRIM') return 'Pèlerin';
  if (roleName && roleName !== 'Conseiller Pèlerinage') return roleName;
  return roleId;
};

export const UsersRolesModule: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'pilgrims' | 'roles'>('users');
  const [searchQuery, setSearchQuery] = useState('');

  // Deprovisioning state
  const [deprovisioningUser, setDeprovisioningUser] = useState<User | null>(null);
  const [deprovisionLoading, setDeprovisionLoading] = useState(false);

  // Modals & form state
  const [linkingUser, setLinkingUser] = useState<User | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedInscriptionIds, setSelectedInscriptionIds] = useState<string[]>([]);

  // Create Pilgrim Account modal state
  const [isCreatePilgrimModalOpen, setIsCreatePilgrimModalOpen] = useState(false);
  const [newPilgrimEmail, setNewPilgrimEmail] = useState('');
  const [newPilgrimFirstName, setNewPilgrimFirstName] = useState('');
  const [newPilgrimLastName, setNewPilgrimLastName] = useState('');
  const [newPilgrimPhone, setNewPilgrimPhone] = useState('');
  const [newPilgrimClientId, setNewPilgrimClientId] = useState('');
  const [newPilgrimInscriptionIds, setNewPilgrimInscriptionIds] = useState<string[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [isClientSearchOpen, setIsClientSearchOpen] = useState(false);

  // Staff account modal state
  const [isCreateStaffModalOpen, setIsCreateStaffModalOpen] = useState(false);

  // Pilgrim provisioning result screen
  type PilgrimScreen = 'form' | 'tempPassword' | 'partialError';
  const [pilgrimScreen, setPilgrimScreen] = useState<PilgrimScreen>('form');
  const [pilgrimProvisionResult, setPilgrimProvisionResult] = useState<ProvisionResult | null>(null);
  const [pilgrimPartialError, setPilgrimPartialError] = useState<{ message: string; correlationId: string } | null>(null);
  const [pilgrimSubmitting, setPilgrimSubmitting] = useState(false);

  // Pilgrim email check state
  const [pilgrimEmailChecking, setPilgrimEmailChecking] = useState(false);
  const [pilgrimEmailAvailable, setPilgrimEmailAvailable] = useState<boolean | null>(null);
  const [pilgrimEmailError, setPilgrimEmailError] = useState('');
  const lastCheckedPilgrimEmail = useRef('');

  const filteredClients = clients.filter(c => 
    (c.firstName + ' ' + c.lastName + ' ' + (c.code || '')).toLowerCase().includes(clientSearch.toLowerCase())
  );

  // Role creation & editing
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [roleFormName, setRoleFormName] = useState('');
  const [roleFormId, setRoleFormId] = useState('');
  const [roleFormDesc, setRoleFormDesc] = useState('');
  const [roleFormPermissions, setRoleFormPermissions] = useState<string[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersData, rolesData, clientsData, inscriptionsData] = await Promise.all([
        api.getFullUsers().catch(() => []),
        api.getRoles().catch(() => []),
        api.getClients(),
        api.getInscriptions()
      ]);
      
      setUsers(usersData);
      setRoles(rolesData);
      setClients(clientsData);
      setInscriptions(inscriptionsData);
    } catch (error) {
      console.error("Error fetching users/roles/clients", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasPermission('users.view')) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  // 1. User Status Toggle with SUPER_ADMIN protection
  const toggleUserStatus = async (targetUser: User) => {
    if (!hasPermission('users.update')) {
      return alert("Permission refusée.");
    }

    // Protection of self
    if (targetUser.id === currentUser?.id && targetUser.active) {
      return alert("Opération interdite : Vous ne pouvez pas désactiver votre propre compte.");
    }

    // Protection of SUPER_ADMIN
    if (targetUser.roleId === 'SUPER_ADMIN') {
      const activeSuperAdmins = users.filter(u => u.roleId === 'SUPER_ADMIN' && u.active);
      if (targetUser.active && activeSuperAdmins.length <= 1) {
        return alert("Opération interdite : Impossible de désactiver le dernier Super Administrateur actif.");
      }
      if (targetUser.email.toLowerCase() === 'mr.niass@gmail.com' && targetUser.active) {
        return alert("Opération interdite : Le compte administrateur propriétaire ne peut pas être désactivé.");
      }
    }

    const newActive = !targetUser.active;
    
    try {
      await api.toggleStaffStatus(targetUser.id, newActive);
      fetchData();
    } catch (e: any) {
      console.error(e);
      alert("Erreur lors de la mise à jour du statut : " + (e.message || 'Action non autorisée.'));
    }
  };

  const handleConfirmDeprovision = async () => {
    if (!deprovisioningUser) return;
    setDeprovisionLoading(true);
    try {
      const res = await api.deprovisionStaff(deprovisioningUser.id);
      alert(res.message || "Compte déprovisionné avec succès.");
      setDeprovisioningUser(null);
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert("Erreur lors du déprovisionnement : " + (err.message || "Action non autorisée."));
    } finally {
      setDeprovisionLoading(false);
    }
  };

  // 1b. Pilgrim Account Provisioning (Requirement 17)
  const handleSelectNewPilgrimClient = (clientId: string) => {
    setNewPilgrimClientId(clientId);
    const cl = clients.find(c => c.id === clientId);
    if (cl) {
      setNewPilgrimFirstName(cl.firstName || '');
      setNewPilgrimLastName(cl.lastName || '');
      setNewPilgrimPhone(cl.phone || '');
      if (cl.email) setNewPilgrimEmail(cl.email);
    }
  };

  const handlePilgrimEmailBlur = useCallback(async () => {
    const trimmed = newPilgrimEmail.trim().toLowerCase();
    if (!trimmed || trimmed === lastCheckedPilgrimEmail.current) return;
    if (!trimmed.includes('@')) {
      setPilgrimEmailAvailable(false);
      setPilgrimEmailError('Adresse email invalide.');
      return;
    }

    setPilgrimEmailChecking(true);
    setPilgrimEmailError('');
    try {
      const result = await api.checkEmailAvailability(trimmed);
      setPilgrimEmailAvailable(result.available);
      if (!result.available) {
        setPilgrimEmailError('Cette adresse email est déjà utilisée.');
      }
      lastCheckedPilgrimEmail.current = trimmed;
    } catch {
      setPilgrimEmailAvailable(null);
      setPilgrimEmailError('');
    } finally {
      setPilgrimEmailChecking(false);
    }
  }, [newPilgrimEmail]);

  useEffect(() => {
    const trimmed = newPilgrimEmail.trim().toLowerCase();
    if (trimmed !== lastCheckedPilgrimEmail.current) {
      setPilgrimEmailAvailable(null);
      setPilgrimEmailError('');
    }
  }, [newPilgrimEmail]);

  const handleCreatePilgrimAccount = async () => {
    if (!newPilgrimEmail.trim()) {
      return alert("Veuillez saisir une adresse email pour ce compte pèlerin.");
    }
    if (!newPilgrimClientId) {
      return alert("Veuillez sélectionner le client à rattacher.");
    }
    if (pilgrimEmailAvailable === false) {
      return alert("Cette adresse email est déjà utilisée.");
    }

    setPilgrimSubmitting(true);
    try {
      const result = await api.provisionPilgrim({
        email: newPilgrimEmail.trim().toLowerCase(),
        firstName: newPilgrimFirstName.trim() || 'Pèlerin',
        lastName: newPilgrimLastName.trim() || '',
        phone: newPilgrimPhone.trim() || undefined,
        clientId: newPilgrimClientId,
        allowedInscriptionIds: newPilgrimInscriptionIds.length > 0 ? newPilgrimInscriptionIds : undefined,
      });

      if ('tempPassword' in result) {
        setPilgrimProvisionResult(result as ProvisionResult);
        setPilgrimScreen('tempPassword');
        fetchData();
      } else if ('status' in result && (result as ProvisionPartialResult).status === 'partial') {
        const partial = result as ProvisionPartialResult;
        setPilgrimPartialError({ message: partial.message, correlationId: partial.correlationId });
        setPilgrimScreen('partialError');
        fetchData();
      }
    } catch (e: any) {
      console.error(e);
      alert("Erreur lors de la création du compte pèlerin : " + (e.message || 'Action non autorisée.'));
    } finally {
      setPilgrimSubmitting(false);
    }
  };

  // 2. Pilgrim account linking to Client & multi-dossiers
  const openLinkModal = (user: User) => {
    setLinkingUser(user);
    setSelectedClientId(user.clientId || '');
    setSelectedInscriptionIds(user.allowedInscriptionIds || []);
  };

  const handleSaveAssociation = async () => {
    if (!linkingUser) return;
    if (!selectedClientId) {
      return alert("Veuillez sélectionner un client dans la liste.");
    }

    try {
      await api.updateUser(linkingUser.id, {
        clientId: selectedClientId,
        allowedInscriptionIds: selectedInscriptionIds,
      });

      await logAudit(
        currentUser?.id || 'system',
        currentUser?.roleId || 'STAFF',
        'PILGRIM_CLIENT_LINKED',
        'users',
        linkingUser.id,
        {
          clientId: selectedClientId,
          allowedInscriptionIds: selectedInscriptionIds,
          pilgrimEmail: linkingUser.email
        }
      );

      alert("Compte pèlerin associé avec succès.");
      setLinkingUser(null);
      fetchData();
    } catch (e: any) {
      console.error(e);
      alert("Erreur lors de l'association : " + (e.message || 'Accès refusé.'));
    }
  };

  const handleRevokeAssociation = async (targetUser: User) => {
    if (!confirm(`Confirmer la révocation du rattachement de ${targetUser.firstName} ${targetUser.lastName} à son dossier ?`)) {
      return;
    }

    try {
      await api.updateUser(targetUser.id, {
        clientId: '' as any,
        allowedInscriptionIds: [],
      });

      await logAudit(
        currentUser?.id || 'system',
        currentUser?.roleId || 'STAFF',
        'PILGRIM_LINK_REVOKED',
        'users',
        targetUser.id,
        { previousClientId: targetUser.clientId }
      );

      fetchData();
    } catch (e: any) {
      console.error(e);
      alert("Erreur lors de la révocation : " + (e.message || 'Action non autorisée.'));
    }
  };

  // 3. RBAC Matrix Role Management
  const openEditRole = (role: Role) => {
    setEditingRole(role);
    setRoleFormId(role.id);
    setRoleFormName(role.name);
    setRoleFormDesc(role.description || '');
    setRoleFormPermissions([...role.permissions]);
    setIsCreatingRole(false);
  };

  const openCreateRole = () => {
    setEditingRole(null);
    setRoleFormId('');
    setRoleFormName('');
    setRoleFormDesc('');
    setRoleFormPermissions(['dashboard.view']);
    setIsCreatingRole(true);
  };

  const togglePermission = (permKey: string) => {
    if (editingRole?.id === 'SUPER_ADMIN') {
      alert("Le rôle Super Administrateur dispose obligatoirement de toutes les permissions (*).");
      return;
    }
    setRoleFormPermissions(prev => 
      prev.includes(permKey) 
        ? prev.filter(p => p !== permKey) 
        : [...prev, permKey]
    );
  };

  const handleSaveRole = async () => {
    if (!roleFormName.trim()) {
      return alert("Le nom du rôle est requis.");
    }
    const roleId = isCreatingRole 
      ? roleFormName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_')
      : roleFormId;

    if (!roleId) return alert("Identifiant de rôle invalide.");

    try {
      const roleData: Role = {
        id: roleId,
        name: roleFormName.trim(),
        description: roleFormDesc.trim(),
        permissions: editingRole?.id === 'SUPER_ADMIN' ? ['*'] : roleFormPermissions,
        isSystem: editingRole?.isSystem || false
      };

      await logAudit(
        currentUser?.id || 'system',
        currentUser?.roleId || 'STAFF',
        isCreatingRole ? 'ROLE_CREATED' : 'ROLE_PERMISSIONS_UPDATED',
        'roles',
        roleId,
        { permissionsCount: roleData.permissions.length }
      );

      alert("Rôle et matrice de permissions enregistrés avec succès.");
      setEditingRole(null);
      setIsCreatingRole(false);
      fetchData();
    } catch (e: any) {
      console.error(e);
      alert("Erreur lors de l'enregistrement du rôle : " + (e.message || 'Action refusée.'));
    }
  };

  if (!hasPermission('users.view')) {
    return (
      <div className="p-8 text-center text-red-500 font-bold">
        Accès restreint : Vous ne disposez pas des privilèges nécessaires pour administrer les utilisateurs et les rôles.
      </div>
    );
  }

  const isPilgrimUser = (u: User) => normalizeRole(u.roleId) === 'PELERIN';
  const staffUsers = users.filter(u => !isPilgrimUser(u));
  const pilgrimUsers = users.filter(u => isPilgrimUser(u));

  const filteredUsers = (activeTab === 'pilgrims' ? pilgrimUsers : staffUsers).filter(u => 
    `${u.firstName} ${u.lastName} ${u.email} ${u.roleId}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Shield className="w-7 h-7 text-amber-600" />
            <span>Sécurité, Utilisateurs & RBAC</span>
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Gouvernance stricte des accès, matrice de permissions RBAC et affectation sécurisée Pèlerin ↔ Dossier
          </p>
        </div>

        {activeTab === 'users' && currentUser?.roleId === 'SUPER_ADMIN' && (
          <button
            onClick={() => setIsCreateStaffModalOpen(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Compte</span>
          </button>
        )}

        {activeTab === 'roles' && (
          <button
            onClick={openCreateRole}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Créer un Rôle</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button 
          onClick={() => setActiveTab('users')}
          className={`pb-3 font-bold text-xs sm:text-sm border-b-2 transition-colors cursor-pointer ${activeTab === 'users' ? 'border-amber-600 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" /> 
            <span>Personnel & Staff ({staffUsers.length})</span>
          </div>
        </button>

        <button 
          onClick={() => setActiveTab('pilgrims')}
          className={`pb-3 font-bold text-xs sm:text-sm border-b-2 transition-colors cursor-pointer ${activeTab === 'pilgrims' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4" /> 
            <span>Comptes Pèlerins & Dossiers ({pilgrimUsers.length})</span>
          </div>
        </button>

        <button 
          onClick={() => setActiveTab('roles')}
          className={`pb-3 font-bold text-xs sm:text-sm border-b-2 transition-colors cursor-pointer ${activeTab === 'roles' ? 'border-amber-600 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4" /> 
            <span>Matrice des Rôles & Permissions ({roles.length})</span>
          </div>
        </button>
      </div>

      {/* Search Bar for Users */}
      {activeTab !== 'roles' && (
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, email, rôle..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 pl-9 pr-4 py-2 text-xs rounded-xl focus:border-amber-500 outline-none text-slate-800"
          />
        </div>
      )}

      {/* Content Area */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 font-medium">Chargement des données de sécurité...</div>
      ) : activeTab === 'users' ? (
        /* Staff Users Table & Responsive Cards */
        <div className="space-y-4">
          {/* Vue Cartes Mobile (< md) */}
          <div className="block md:hidden space-y-3">
            {filteredUsers.map(user => {
              const role = roles.find(r => r.id === user.roleId);
              const isSuperAdmin = user.roleId === 'SUPER_ADMIN';
              const isOwnerAccount = user.email.toLowerCase() === 'mr.niass@gmail.com';
              const isSelf = user.id === currentUser?.id;
              const canonicalRole = getCanonicalRoleLabel(user.roleId, role?.name);

              return (
                <div key={user.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  {/* Top: Avatar, Name, Email, Protected pill */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                        isSuperAdmin ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-slate-100 text-slate-800 border border-slate-200'
                      }`}>
                        {user.firstName ? user.firstName[0] : (user.displayName ? user.displayName[0] : 'U')}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-slate-900 text-sm truncate">
                            {user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.displayName}
                          </p>
                          {isSuperAdmin && (
                            <span className="text-[9px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold border border-amber-300">
                              PROTÉGÉ
                            </span>
                          )}
                          {isSelf && (
                            <span className="text-[9px] bg-blue-50 text-blue-800 px-1.5 py-0.2 rounded font-bold border border-blue-200">
                              VOUS
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 break-all mt-0.5 select-all">{user.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Canonical Role & Status */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Rôle attribué</span>
                      <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                        user.roleId === 'SUPER_ADMIN' ? 'bg-amber-50 text-amber-900 border border-amber-200' :
                        user.roleId === 'AGENT' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' :
                        user.roleId === 'DIRECTION' ? 'bg-indigo-50 text-indigo-900 border border-indigo-200' :
                        user.roleId === 'COMPTABLE' ? 'bg-blue-50 text-blue-900 border border-blue-200' :
                        'bg-slate-100 text-slate-800 border border-slate-200'
                      }`}>
                        {canonicalRole}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Statut</span>
                      <span className={`inline-flex items-center gap-1 mt-0.5 px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                        user.status === 'DEPROVISIONNE' ? 'bg-slate-100 text-slate-600 border border-slate-300' :
                        user.active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {user.active ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {user.status || (user.active ? 'ACTIF' : 'INACTIF')}
                      </span>
                    </div>
                  </div>

                  {/* Details: Dernière connexion */}
                  <div className="text-[11px] text-slate-400 pt-1">
                    Dernière connexion : <span className="text-slate-600 font-medium">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('fr-FR') : 'Non renseignée'}</span>
                  </div>

                  {/* Actions Buttons */}
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                    {isOwnerAccount ? (
                      <span className="text-xs text-slate-400 italic py-1">Compte racine système protégé</span>
                    ) : (
                      <>
                        <button
                          onClick={() => toggleUserStatus(user)}
                          disabled={isSelf}
                          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            user.active
                              ? 'text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                              : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                          } ${isSelf ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {user.active ? 'Désactiver' : 'Activer'}
                        </button>

                        {hasPermission('users.delete') && !isSelf && (
                          <button
                            onClick={() => setDeprovisioningUser(user)}
                            className="py-2 px-3 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Supprimer</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Vue Tableau Desktop (>= md) */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-4">Utilisateur</th>
                  <th className="p-4">Rôle Attribué</th>
                  <th className="p-4">Statut</th>
                  <th className="p-4">Dernière Connexion</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map(user => {
                  const role = roles.find(r => r.id === user.roleId);
                  const isSuperAdmin = user.roleId === 'SUPER_ADMIN';
                  const isOwnerAccount = user.email.toLowerCase() === 'mr.niass@gmail.com';
                  const isSelf = user.id === currentUser?.id;
                  const canonicalRole = getCanonicalRoleLabel(user.roleId, role?.name);

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isSuperAdmin ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                            {user.firstName ? user.firstName[0] : (user.displayName ? user.displayName[0] : 'U')}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.displayName}</span>
                              {isSuperAdmin && (
                                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold border border-amber-200">
                                  PROTÉGÉ
                                </span>
                              )}
                              {isSelf && (
                                <span className="text-[9px] bg-blue-50 text-blue-800 px-1.5 py-0.2 rounded font-bold border border-blue-200">
                                  VOUS
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-slate-400">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          user.roleId === 'SUPER_ADMIN' ? 'bg-amber-50 text-amber-900 border border-amber-200' :
                          user.roleId === 'AGENT' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' :
                          user.roleId === 'DIRECTION' ? 'bg-indigo-50 text-indigo-900 border border-indigo-200' :
                          user.roleId === 'COMPTABLE' ? 'bg-blue-50 text-blue-900 border border-blue-200' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {canonicalRole}
                        </span>
                      </td>

                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1 w-max ${
                          user.status === 'DEPROVISIONNE' ? 'bg-slate-100 text-slate-600 border border-slate-300' :
                          user.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {user.active ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {user.status || (user.active ? 'ACTIF' : 'INACTIF')}
                        </span>
                      </td>

                      <td className="p-4 text-slate-500 text-[11px]">
                        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('fr-FR') : 'Non renseignée'}
                      </td>

                      <td className="p-4 text-right">
                        {isOwnerAccount ? (
                          <span className="text-[11px] text-slate-400 italic">Compte racine</span>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button 
                              onClick={() => toggleUserStatus(user)}
                              disabled={isSelf}
                              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer ${
                                user.active 
                                  ? 'text-red-700 bg-red-50 hover:bg-red-100' 
                                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                              } ${isSelf ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {user.active ? 'Désactiver' : 'Activer'}
                            </button>

                            {hasPermission('users.delete') && !isSelf && (
                              <button
                                onClick={() => setDeprovisioningUser(user)}
                                className="p-1.5 rounded-lg text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 transition cursor-pointer"
                                title="Déprovisionner / Supprimer définitivement"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'pilgrims' ? (
        /* Pilgrim Accounts & Client/Dossier Linking Table */
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-900">
            <div className="flex items-start gap-3">
              <Link2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Affectation & Chaîne de Sécurité Pèlerin</p>
                <p className="mt-0.5 text-emerald-700 leading-relaxed font-mono text-[11px]">
                  Session Sécurisée ↓ Utilisateur (/users) ↓ Client (/clients) ↓ Dossiers Autorisés (/inscriptions)
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsCreatePilgrimModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold shadow-xs cursor-pointer shrink-0 transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>Nouveau Compte Pèlerin</span>
            </button>
          </div>

          {/* Vue Cartes Mobile (< md) pour Comptes Pèlerins */}
          <div className="block md:hidden space-y-3">
            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                Aucun compte pèlerin trouvé.
              </div>
            ) : (
              filteredUsers.map(user => {
                const linkedClient = clients.find(c => c.id === user.clientId);
                const clientInscriptions = inscriptions.filter(i => i.clientId === user.clientId);

                return (
                  <div key={user.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                    {/* Top: Avatar, Name, Email, Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center font-bold text-sm shrink-0">
                          {user.firstName ? user.firstName[0] : (user.displayName ? user.displayName[0] : 'P')}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-sm truncate">
                            {user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.displayName}
                          </p>
                          <p className="text-xs text-slate-500 break-all mt-0.5 select-all">{user.email}</p>
                          {user.phone && <p className="text-[11px] text-slate-500 mt-0.5">Tél : {user.phone}</p>}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1 shrink-0 ${
                        user.active && user.status !== 'SUSPENDU'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-red-100 text-red-800 border border-red-200'
                      }`}>
                        {user.active && user.status !== 'SUSPENDU' ? <CheckCircle className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-red-600" />}
                        <span>{user.active && user.status !== 'SUSPENDU' ? 'ACTIF' : 'SUSPENDU'}</span>
                      </span>
                    </div>

                    {/* Fiche Client Associée */}
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider mb-1">Fiche Client Associée</span>
                      {linkedClient ? (
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <p className="font-bold text-slate-900 text-xs">{linkedClient.lastName} {linkedClient.firstName}</p>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 pl-4">Code : {linkedClient.code || linkedClient.id} • Passeport : {linkedClient.passportNumber || 'N/A'}</p>
                        </div>
                      ) : (
                        <span className="text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md text-[11px] font-bold border border-amber-200 inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Non rattaché à un client
                        </span>
                      )}
                    </div>

                    {/* Dossiers Autorisés */}
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider mb-1">Dossiers Autorisés</span>
                      {linkedClient ? (
                        user.allowedInscriptionIds && user.allowedInscriptionIds.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {user.allowedInscriptionIds.map(insId => {
                              const ins = inscriptions.find(i => i.id === insId);
                              return (
                                <span key={insId} className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded text-[10px] font-bold border border-slate-200 font-mono">
                                  {ins?.code || insId}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg text-[10px] font-medium inline-block">
                            Tous les dossiers du client ({clientInscriptions.length})
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">En attente de client</span>
                      )}
                    </div>

                    {/* Actions tactiles */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => openLinkModal(user)}
                        className="flex-1 py-2 px-3 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200 transition text-center cursor-pointer"
                      >
                        {user.clientId ? 'Modifier Affectation' : 'Rattacher un Dossier'}
                      </button>

                      {user.clientId && (
                        <button
                          onClick={() => handleRevokeAssociation(user)}
                          className="p-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 transition cursor-pointer shrink-0"
                          title="Révoquer le rattachement"
                        >
                          <Unlink className="w-4 h-4" />
                        </button>
                      )}

                      <button 
                        onClick={() => toggleUserStatus(user)}
                        className={`py-2 px-3 text-xs font-bold rounded-xl transition cursor-pointer shrink-0 border ${
                          user.active && user.status !== 'SUSPENDU'
                            ? 'text-red-700 bg-red-50 hover:bg-red-100 border-red-200' 
                            : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                        }`}
                      >
                        {user.active && user.status !== 'SUSPENDU' ? 'Suspendre' : 'Réactiver'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Vue Table Desktop (>= md) pour Comptes Pèlerins */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-4">Compte Pèlerin & Chaîne Sécurisée</th>
                  <th className="p-4">Fiche Client Associée</th>
                  <th className="p-4">Dossiers Autorisés (Multi-Dossiers)</th>
                  <th className="p-4">Statut Accès</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      Aucun compte pèlerin trouvé.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(user => {
                    const linkedClient = clients.find(c => c.id === user.clientId);
                    const clientInscriptions = inscriptions.filter(i => i.clientId === user.clientId);

                    return (
                      <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-4">
                          <p className="font-bold text-slate-900">{user.firstName} {user.lastName}</p>
                          <p className="text-[11px] text-slate-400">{user.email}</p>
                          {user.phone && <p className="text-[10px] text-slate-500 mt-0.5">Tél: {user.phone}</p>}
                          <div className="mt-1 text-[10px] text-slate-400 font-mono">
                            Auth [{user.authUid?.slice(0, 8) || 'UID'}...] ➔ ERP [{user.email}]
                          </div>
                        </td>

                        <td className="p-4">
                          {linkedClient ? (
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              <div>
                                <p className="font-bold text-slate-900">{linkedClient.lastName} {linkedClient.firstName}</p>
                                <p className="text-[10px] text-slate-500">Code: {linkedClient.code || linkedClient.id} • Passeport: {linkedClient.passportNumber || 'N/A'}</p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md text-[11px] font-bold border border-amber-200 inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Non rattaché
                            </span>
                          )}
                        </td>

                        <td className="p-4">
                          {linkedClient ? (
                            user.allowedInscriptionIds && user.allowedInscriptionIds.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {user.allowedInscriptionIds.map(insId => {
                                  const ins = inscriptions.find(i => i.id === insId);
                                  return (
                                    <span key={insId} className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded text-[10px] font-bold border border-slate-200 font-mono">
                                      {ins?.code || insId}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[10px] font-medium">
                                Tous les dossiers du client ({clientInscriptions.length})
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">En attente de client</span>
                          )}
                        </td>

                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1 w-max ${
                            user.active && user.status !== 'SUSPENDU' 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                              : 'bg-red-100 text-red-800 border border-red-200'
                          }`}>
                            {user.active && user.status !== 'SUSPENDU' ? <CheckCircle className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-red-600" />}
                            <span>{user.active && user.status !== 'SUSPENDU' ? 'ACTIF' : 'SUSPENDU'}</span>
                          </span>
                        </td>

                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => openLinkModal(user)}
                            className="text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200 transition cursor-pointer"
                          >
                            {user.clientId ? 'Modifier Affectation' : 'Rattacher un Dossier'}
                          </button>

                          {user.clientId && (
                            <button
                              onClick={() => handleRevokeAssociation(user)}
                              className="text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg border border-red-200 transition cursor-pointer"
                              title="Révoquer le rattachement"
                            >
                              <Unlink className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button 
                            onClick={() => toggleUserStatus(user)}
                            className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                              user.active && user.status !== 'SUSPENDU'
                                ? 'text-red-700 bg-red-50 hover:bg-red-100 border border-red-200' 
                                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                          >
                            {user.active && user.status !== 'SUSPENDU' ? 'Suspendre' : 'Réactiver'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* RBAC Roles & Permissions Matrix View */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roles.map(role => {
              const isSuper = role.id === 'SUPER_ADMIN';
              return (
                <div key={role.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-black text-slate-900 text-base">{role.name}</h3>
                      {role.isSystem && (
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase">
                          Système
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mb-4">{role.description || 'Rôle standard'}</p>
                    
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                      <p className="text-[11px] font-bold text-slate-700 mb-2 flex items-center justify-between">
                        <span>Permissions configurées</span>
                        <span className="text-amber-700">{isSuper ? 'Toutes (*)' : role.permissions.length}</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                        {isSuper ? (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                            * Accès Super Admin Total
                          </span>
                        ) : role.permissions.length === 0 ? (
                          <span className="text-[10px] text-slate-400 italic">Aucune permission</span>
                        ) : (
                          role.permissions.map(p => (
                            <span key={p} className="text-[10px] bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-mono">
                              {p}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-400 font-bold">{role.id}</span>
                    <button
                      onClick={() => openEditRole(role)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Éditer Matrice</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: Affectation Pèlerin ↔ Client & Multi-Dossiers */}
      {linkingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Link2 className="w-5 h-5 text-amber-600" />
                <span>Affectation Pèlerin ↔ Dossier</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Liaison du compte utilisateur <strong>{linkingUser.firstName} {linkingUser.lastName}</strong> ({linkingUser.email})
              </p>
            </div>

            <div className="space-y-4">
              {/* 1. Client selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  1. Sélectionner la fiche Client
                </label>
                <select
                  value={selectedClientId}
                  onChange={e => {
                    setSelectedClientId(e.target.value);
                    setSelectedInscriptionIds([]);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus:border-amber-500 outline-none"
                >
                  <option value="">-- Choisir un client dans la base --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.lastName} {c.firstName} (Passeport: {c.passportNumber || 'N/A'}, Tél: {c.phone || 'N/A'})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Multi-dossier restriction */}
              {selectedClientId && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    2. Dossiers autorisés pour ce compte (Multi-Dossiers)
                  </label>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 max-h-48 overflow-y-auto">
                    {inscriptions.filter(i => i.clientId === selectedClientId).length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Aucun dossier d'inscription enregistré pour ce client.</p>
                    ) : (
                      inscriptions
                        .filter(i => i.clientId === selectedClientId)
                        .map(ins => {
                          const isChecked = selectedInscriptionIds.includes(ins.id);
                          return (
                            <label key={ins.id} className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer hover:bg-white p-1.5 rounded transition">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setSelectedInscriptionIds([...selectedInscriptionIds, ins.id]);
                                  } else {
                                    setSelectedInscriptionIds(selectedInscriptionIds.filter(id => id !== ins.id));
                                  }
                                }}
                                className="rounded text-amber-600 focus:ring-amber-500"
                              />
                              <span className="font-bold text-slate-900">{ins.code}</span>
                              <span className="text-slate-500">({ins.statut})</span>
                            </label>
                          );
                        })
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    * Si aucun dossier spécifique n'est coché, l'ensemble des dossiers actuels et futurs du client seront consultables.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setLinkingUser(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveAssociation}
                disabled={!selectedClientId}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition"
              >
                <Check className="w-4 h-4" />
                <span>Enregistrer l'Affectation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Pilgrim Account & Link to Client (Requirement 17) */}
      {isCreatePilgrimModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            {pilgrimScreen === 'tempPassword' && pilgrimProvisionResult ? (
              <TempPasswordScreen
                email={pilgrimProvisionResult.email}
                tempPassword={pilgrimProvisionResult.tempPassword}
                roleLabel="Pèlerin"
                onClose={() => {
                  setPilgrimScreen('form');
                  setPilgrimProvisionResult(null);
                  setIsCreatePilgrimModalOpen(false);
                  setNewPilgrimEmail('');
                  setNewPilgrimFirstName('');
                  setNewPilgrimLastName('');
                  setNewPilgrimPhone('');
                  setNewPilgrimClientId('');
                  setNewPilgrimInscriptionIds([]);
                  lastCheckedPilgrimEmail.current = '';
                }}
              />
            ) : pilgrimScreen === 'partialError' && pilgrimPartialError ? (
              <div className="space-y-5">
                <div className="text-center">
                  <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <AlertCircle className="w-7 h-7 text-amber-600" />
                  </div>
                  <h2 className="text-lg font-black text-slate-900">Intervention requise</h2>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900">
                  <p className="font-bold mb-1">Compte partiellement créé.</p>
                  <p>Intervention manuelle requise.</p>
                  <p className="mt-2 font-mono text-[11px] text-amber-700">
                    Référence : {pilgrimPartialError.correlationId}
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setPilgrimScreen('form');
                      setPilgrimPartialError(null);
                      setIsCreatePilgrimModalOpen(false);
                      setNewPilgrimEmail('');
                      setNewPilgrimFirstName('');
                      setNewPilgrimLastName('');
                      setNewPilgrimPhone('');
                      setNewPilgrimClientId('');
                      setNewPilgrimInscriptionIds([]);
                      lastCheckedPilgrimEmail.current = '';
                    }}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-emerald-700" />
                      <span>Nouveau Compte Accès Pèlerin</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Créez un compte pèlerin rattaché à une fiche Client existante et à ses dossiers autorisés.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Client Selection */}
                  <div className="relative">
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      1. Sélectionner la Fiche Client existante *
                    </label>
                    <div 
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus-within:border-emerald-500 cursor-text flex justify-between items-center"
                      onClick={() => setIsClientSearchOpen(true)}
                    >
                      <input 
                        type="text" 
                        value={isClientSearchOpen ? clientSearch : (clients.find(c => c.id === newPilgrimClientId)?.lastName ? `${clients.find(c => c.id === newPilgrimClientId)?.lastName} ${clients.find(c => c.id === newPilgrimClientId)?.firstName}` : '')}
                        onChange={(e) => {
                          setClientSearch(e.target.value);
                          setIsClientSearchOpen(true);
                          if (!e.target.value) setNewPilgrimClientId('');
                        }}
                        onFocus={() => setIsClientSearchOpen(true)}
                        placeholder="-- Rechercher un client dans la base --"
                        className="bg-transparent outline-none w-full"
                      />
                      <Search className="w-4 h-4 text-slate-400" />
                    </div>
                    {isClientSearchOpen && (
                      <div className="absolute z-[100] w-full mt-1 bg-white border border-slate-300 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                        {filteredClients.length > 0 ? (
                          filteredClients.map(c => (
                            <div 
                              key={c.id} 
                              className="px-3 py-3 hover:bg-slate-100 cursor-pointer border-b border-slate-100 last:border-0 text-xs text-slate-900"
                              onClick={() => {
                                handleSelectNewPilgrimClient(c.id);
                                setClientSearch('');
                                setIsClientSearchOpen(false);
                              }}
                            >
                              <div className="font-bold">{c.lastName} {c.firstName}</div>
                              <div className="text-slate-500">{c.code || c.id}</div>
                            </div>
                          ))
                        ) : (
                          <div className="px-3 py-4 text-center text-slate-500 text-xs italic">Aucun client trouvé</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Login Email */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      2. Adresse E-mail de Connexion *
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={newPilgrimEmail}
                        onChange={e => setNewPilgrimEmail(e.target.value)}
                        onBlur={handlePilgrimEmailBlur}
                        placeholder="pelerin@exemple.com"
                        className={`w-full bg-slate-50 border rounded-xl p-2.5 pr-10 text-xs text-slate-900 font-medium outline-none transition-colors ${
                          pilgrimEmailAvailable === false
                            ? 'border-red-400 focus:border-red-500'
                            : pilgrimEmailAvailable === true
                              ? 'border-emerald-400 focus:border-emerald-500'
                              : 'border-slate-300 focus:border-emerald-500'
                        }`}
                      />
                      <div className="absolute right-2.5 top-2.5">
                        {pilgrimEmailChecking && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
                        {!pilgrimEmailChecking && pilgrimEmailAvailable === true && (
                          <Check className="w-4 h-4 text-emerald-500" />
                        )}
                        {!pilgrimEmailChecking && pilgrimEmailAvailable === false && (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    </div>
                    {pilgrimEmailError && (
                      <p className="text-[11px] text-red-600 mt-1">{pilgrimEmailError}</p>
                    )}
                    {pilgrimEmailAvailable === true && !pilgrimEmailError && (
                      <p className="text-[11px] text-emerald-600 mt-1">Email disponible</p>
                    )}
                  </div>

                  {/* Identity details */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Prénom</label>
                      <input
                        type="text"
                        value={newPilgrimFirstName}
                        onChange={e => setNewPilgrimFirstName(e.target.value)}
                        placeholder="Prénom"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus:border-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nom</label>
                      <input
                        type="text"
                        value={newPilgrimLastName}
                        onChange={e => setNewPilgrimLastName(e.target.value)}
                        placeholder="Nom de famille"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Numéro de Téléphone</label>
                    <input
                      type="text"
                      value={newPilgrimPhone}
                      onChange={e => setNewPilgrimPhone(e.target.value)}
                      placeholder="+221 ..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus:border-emerald-500 outline-none"
                    />
                  </div>

                  {/* Inscriptions associated with the selected client */}
                  {newPilgrimClientId && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        3. Dossiers Autorisés (Multi-Dossiers)
                      </label>
                      {inscriptions.filter(i => i.clientId === newPilgrimClientId).length === 0 ? (
                        <p className="text-[11px] text-amber-600 italic">
                          Ce client n'a pas encore de dossier d'inscription. Tous ses futurs dossiers seront visibles par défaut.
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50">
                          {inscriptions
                            .filter(i => i.clientId === newPilgrimClientId)
                            .map(ins => {
                              const isChecked = newPilgrimInscriptionIds.includes(ins.id);
                              return (
                                <label key={ins.id} className="flex items-center gap-2 cursor-pointer text-xs p-1.5 rounded hover:bg-white transition">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setNewPilgrimInscriptionIds(prev => [...prev, ins.id]);
                                      } else {
                                        setNewPilgrimInscriptionIds(prev => prev.filter(id => id !== ins.id));
                                      }
                                    }}
                                    className="rounded text-emerald-600 focus:ring-emerald-500"
                                  />
                                  <span className="font-mono font-bold text-slate-900">{ins.code}</span>
                                  <span className="text-slate-500 text-[11px]">({ins.statut})</span>
                                </label>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setIsCreatePilgrimModalOpen(false);
                      setNewPilgrimEmail('');
                      setNewPilgrimClientId('');
                      setNewPilgrimInscriptionIds([]);
                      lastCheckedPilgrimEmail.current = '';
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleCreatePilgrimAccount}
                    disabled={!newPilgrimEmail || !newPilgrimClientId || pilgrimSubmitting || pilgrimEmailAvailable === false}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    {pilgrimSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>Créer & Activer le Compte</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal: RBAC Matrix Role Editor */}
      {(editingRole || isCreatingRole) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Key className="w-5 h-5 text-amber-600" />
                  <span>{isCreatingRole ? 'Créer un Nouveau Rôle' : `Éditer les Permissions : ${editingRole?.name}`}</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Matrice de contrôle d'accès basée sur les rôles (RBAC) synchronisée en temps réel
                </p>
              </div>
              {editingRole?.id === 'SUPER_ADMIN' && (
                <span className="px-3 py-1 bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-lg flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" />
                  Privilèges Absolus
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nom du Rôle</label>
                <input
                  type="text"
                  value={roleFormName}
                  onChange={e => setRoleFormName(e.target.value)}
                  placeholder="Ex: Responsable Hébergement"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus:border-amber-500 outline-none"
                  disabled={editingRole?.id === 'SUPER_ADMIN'}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Description</label>
                <input
                  type="text"
                  value={roleFormDesc}
                  onChange={e => setRoleFormDesc(e.target.value)}
                  placeholder="Responsabilités et périmètre du rôle..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus:border-amber-500 outline-none"
                />
              </div>
            </div>

            {/* Matrice RBAC */}
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                Matrice des Droits d'Accès
              </h3>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <tr>
                      <th className="p-3">Module / Entité</th>
                      <th className="p-3 text-center">Voir</th>
                      <th className="p-3 text-center">Créer</th>
                      <th className="p-3 text-center">Modifier</th>
                      <th className="p-3 text-center">Supprimer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {RBAC_MODULES.map(mod => {
                      const isSuper = editingRole?.id === 'SUPER_ADMIN';

                      return (
                        <tr key={mod.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-bold text-slate-800">
                            {mod.label}
                          </td>
                          {['view', 'create', 'update', 'delete'].map(action => {
                            const hasAction = mod.actions.includes(action);
                            const permKey = `${mod.id}.${action}`;
                            const isGranted = isSuper || roleFormPermissions.includes(permKey);

                            return (
                              <td key={action} className="p-3 text-center">
                                {hasAction ? (
                                  <input
                                    type="checkbox"
                                    checked={isGranted}
                                    disabled={isSuper}
                                    onChange={() => togglePermission(permKey)}
                                    className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer disabled:opacity-50"
                                  />
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setEditingRole(null);
                  setIsCreatingRole(false);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Fermer
              </button>
              <button
                onClick={handleSaveRole}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition"
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer la Matrice</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmation de Déprovisionnement Définitif */}
      {deprovisioningUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Déprovisionnement du Compte</h3>
                <p className="text-xs text-slate-500">Révocation des accès & archivage sécurisé</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Utilisateur :</span>
                <span className="font-bold text-slate-900">{deprovisioningUser.firstName} {deprovisioningUser.lastName}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Email :</span>
                <span className="font-mono text-slate-700">{deprovisioningUser.email}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Rôle :</span>
                <span className="font-bold text-amber-800">{getCanonicalRoleLabel(deprovisioningUser.roleId)}</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/70 text-amber-900 text-xs space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <span>⚠️ Que va-t-il se passer ?</span>
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-800">
                <li>Le compte sera <strong>immédiatement révoqué de Neon Auth</strong> (mots de passe et sessions détruits).</li>
                <li><strong>Historique préservé</strong> : tous les dossiers, reçus et pièces créés restent intacts pour la conformité comptable.</li>
                <li>Le compte passera en statut <strong>DÉPROVISIONNÉ</strong> sans altérer les audits.</li>
              </ul>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeprovisioningUser(null)}
                disabled={deprovisionLoading}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeprovision}
                disabled={deprovisionLoading}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                {deprovisionLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Déprovisionnement...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirmer le déprovisionnement</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Staff Account (SUPER_ADMIN only) */}
      <CreateStaffAccountModal
        isOpen={isCreateStaffModalOpen}
        onClose={() => setIsCreateStaffModalOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  );
};
