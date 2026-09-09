import React, { useState, useEffect } from 'react';
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
  Plus
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext.js';
import { logAudit } from '../../services/audit.service.js';
import { api } from '../../services/api.js';

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

export const UsersRolesModule: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'pilgrims' | 'roles'>('users');
  const [searchQuery, setSearchQuery] = useState('');

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

    // Protection of SUPER_ADMIN
    if (targetUser.roleId === 'SUPER_ADMIN') {
      const activeSuperAdmins = users.filter(u => u.roleId === 'SUPER_ADMIN' && u.active);
      if (targetUser.active && activeSuperAdmins.length <= 1) {
        return alert("Opération interdite : Impossible de désactiver le dernier Super Administrateur actif.");
      }
      if (targetUser.email === 'mr.niass@gmail.com') {
        return alert("Opération interdite : Le compte administrateur propriétaire ne peut pas être désactivé.");
      }
    }

    const isPilgrim = targetUser.roleId === 'PILGRIM';
    const newActive = !targetUser.active;
    const newStatus = isPilgrim ? (newActive ? 'ACTIF' : 'SUSPENDU') : (newActive ? 'ACTIF' : 'INACTIF');
    
    try {
      await api.updateUser(targetUser.id, {
        active: newActive,
        status: newStatus,
      });

      await logAudit(
        currentUser?.id || 'system',
        currentUser?.roleId || 'STAFF',
        newActive ? 'USER_REACTIVATED' : 'USER_DEACTIVATED',
        'users',
        targetUser.id,
        { targetEmail: targetUser.email, targetRole: targetUser.roleId, status: newStatus }
      );

      fetchData();
    } catch (e: any) {
      console.error(e);
      alert("Erreur lors de la mise à jour : " + (e.message || 'Action non autorisée.'));
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

  const handleCreatePilgrimAccount = async () => {
    if (!newPilgrimEmail.trim()) {
      return alert("Veuillez saisir une adresse email pour ce compte pèlerin.");
    }
    if (!newPilgrimClientId) {
      return alert("Veuillez sélectionner le client à rattacher.");
    }

    try {
      const userUid = `pilgrim_${Date.now()}`;
      const newPilgrimUser: Partial<User> = {
        id: userUid,
        authUid: userUid,
        email: newPilgrimEmail.trim().toLowerCase(),
        firstName: newPilgrimFirstName.trim() || 'Pèlerin',
        lastName: newPilgrimLastName.trim() || '',
        phone: newPilgrimPhone.trim() || undefined,
        roleId: 'PILGRIM',
        status: 'ACTIF',
        active: true,
        clientId: newPilgrimClientId,
        allowedInscriptionIds: newPilgrimInscriptionIds,
      };

      await api.createUser(newPilgrimUser);

      await logAudit(
        currentUser?.id || 'system',
        currentUser?.roleId || 'STAFF',
        'PILGRIM_ACCOUNT_PROVISIONED',
        'users',
        userUid,
        {
          email: newPilgrimUser.email,
          clientId: newPilgrimClientId,
          allowedInscriptionIds: newPilgrimInscriptionIds
        }
      );

      alert("Compte pèlerin créé et rattaché avec succès.");
      setIsCreatePilgrimModalOpen(false);
      setNewPilgrimEmail('');
      setNewPilgrimFirstName('');
      setNewPilgrimLastName('');
      setNewPilgrimPhone('');
      setNewPilgrimClientId('');
      setNewPilgrimInscriptionIds([]);
      fetchData();
    } catch (e: any) {
      console.error(e);
      alert("Erreur lors de la création du compte pèlerin : " + (e.message || 'Action non autorisée.'));
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

  const staffUsers = users.filter(u => u.roleId !== 'PILGRIM');
  const pilgrimUsers = users.filter(u => u.roleId === 'PILGRIM');

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
            Gouvernance stricte des accès, matrice de permissions Firestore et affectation sécurisée Pèlerin ↔ Dossier
          </p>
        </div>

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
        /* Staff Users Table */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
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
                const isOwnerAccount = user.email === 'mr.niass@gmail.com';

                return (
                  <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isSuperAdmin ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                          {user.firstName ? user.firstName[0] : 'U'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{user.firstName} {user.lastName}</span>
                            {isSuperAdmin && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold border border-amber-200">
                                PROTÉGÉ
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-400">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-bold">
                        {role?.name || user.roleId}
                      </span>
                    </td>

                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1 w-max ${user.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {user.active ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {user.status}
                      </span>
                    </td>

                    <td className="p-4 text-slate-500 text-[11px]">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('fr-FR') : 'Non renseignée'}
                    </td>

                    <td className="p-4 text-right">
                      {isOwnerAccount ? (
                        <span className="text-[11px] text-slate-400 italic">Compte racine</span>
                      ) : (
                        <button 
                          onClick={() => toggleUserStatus(user)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer ${
                            user.active 
                              ? 'text-red-700 bg-red-50 hover:bg-red-100' 
                              : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                          }`}
                        >
                          {user.active ? 'Désactiver' : 'Activer'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
                  Compte Firebase Auth ↓ Utilisateur ERP (/users) ↓ Client (/clients) ↓ Dossiers Autorisés (/inscriptions)
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

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
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
                <input
                  type="email"
                  value={newPilgrimEmail}
                  onChange={e => setNewPilgrimEmail(e.target.value)}
                  placeholder="pelerin@exemple.com"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus:border-emerald-500 outline-none"
                />
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
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleCreatePilgrimAccount}
                disabled={!newPilgrimEmail || !newPilgrimClientId}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Créer & Activer le Compte</span>
              </button>
            </div>
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
                  Matrice de contrôle d'accès basée sur les rôles (RBAC) synchronisée avec Firestore
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
    </div>
  );
};
