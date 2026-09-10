import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { UnifiedLogin } from './pages/UnifiedLogin.js';
import { ResetPassword } from './pages/ResetPassword.js';
import { PilgrimPortal } from './pages/PilgrimPortal.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { NeonAuthTest } from './pages/NeonAuthTest.js';
import ErpApp from './ErpApp.js';
import { AuthProvider } from './auth/AuthContext.js';
import { AuthGuard, ErpGuard, PilgrimGuard } from './components/auth/Guards.js';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* PoC Neon Auth Testing */}
        <Route path="/neon-test" element={<NeonAuthTest />} />

        {/* Auth Canonical Routes */}
        <Route path="/connexion" element={<UnifiedLogin />} />
        <Route path="/reinitialisation-mot-de-passe" element={<ResetPassword />} />

        {/* Auth Legacy / Alias Redirects */}
        <Route path="/" element={<Navigate to="/connexion" replace />} />
        <Route path="/login" element={<Navigate to="/connexion" replace />} />
        <Route path="/reset-password" element={<Navigate to="/reinitialisation-mot-de-passe" replace />} />
        <Route path="/erp/login" element={<Navigate to="/connexion" replace />} />
        <Route path="/pelerin/login" element={<Navigate to="/connexion" replace />} />
        <Route path="/portail/login" element={<Navigate to="/connexion" replace />} />

        {/* Business Routes (Staff & Super Admin only; Pilgrim -> Staff = DENIED) */}
        <Route element={<AuthGuard />}>
          <Route element={<ErpGuard />}>
            {/* Real Business URLs */}
            <Route path="/tableau-de-bord" element={<ErpApp />} />
            <Route path="/clients" element={<ErpApp />} />
            <Route path="/inscriptions" element={<ErpApp />} />
            <Route path="/programmes" element={<ErpApp />} />
            <Route path="/packages" element={<Navigate to="/programmes" replace />} />
            <Route path="/paiements" element={<ErpApp />} />
            <Route path="/recouvrement" element={<ErpApp />} />
            <Route path="/depenses" element={<ErpApp />} />
            <Route path="/voyages" element={<ErpApp />} />
            <Route path="/campagnes" element={<Navigate to="/voyages" replace />} />
            <Route path="/logistique" element={<ErpApp />} />
            <Route path="/hotels" element={<ErpApp />} />
            <Route path="/vols" element={<ErpApp />} />
            <Route path="/groupes" element={<ErpApp />} />
            <Route path="/documents" element={<ErpApp />} />
            <Route path="/visas" element={<ErpApp />} />
            <Route path="/rapports" element={<ErpApp />} />
            <Route path="/utilisateurs" element={<ErpApp />} />
            <Route path="/roles" element={<Navigate to="/utilisateurs" replace />} />
            <Route path="/users-roles" element={<Navigate to="/utilisateurs" replace />} />
            <Route path="/parametres" element={<ErpApp />} />
            <Route path="/settings" element={<Navigate to="/parametres" replace />} />
            <Route path="/audit" element={<ErpApp />} />
            <Route path="/workspace" element={<ErpApp />} />
            <Route path="/espace-pelerin" element={<ErpApp />} />

            {/* Legacy /erp Redirects (Preserves bookmarks without /erp in the new UI) */}
            <Route path="/erp" element={<Navigate to="/tableau-de-bord" replace />} />
            <Route path="/erp/tableau-de-bord" element={<Navigate to="/tableau-de-bord" replace />} />
            <Route path="/erp/dashboard" element={<Navigate to="/tableau-de-bord" replace />} />
            <Route path="/erp/clients" element={<Navigate to="/clients" replace />} />
            <Route path="/erp/inscriptions" element={<Navigate to="/inscriptions" replace />} />
            <Route path="/erp/programmes" element={<Navigate to="/programmes" replace />} />
            <Route path="/erp/packages" element={<Navigate to="/programmes" replace />} />
            <Route path="/erp/paiements" element={<Navigate to="/paiements" replace />} />
            <Route path="/erp/recouvrement" element={<Navigate to="/recouvrement" replace />} />
            <Route path="/erp/depenses" element={<Navigate to="/depenses" replace />} />
            <Route path="/erp/voyages" element={<Navigate to="/voyages" replace />} />
            <Route path="/erp/campagnes" element={<Navigate to="/voyages" replace />} />
            <Route path="/erp/logistique" element={<Navigate to="/logistique" replace />} />
            <Route path="/erp/hotels" element={<Navigate to="/hotels" replace />} />
            <Route path="/erp/vols" element={<Navigate to="/vols" replace />} />
            <Route path="/erp/groupes" element={<Navigate to="/groupes" replace />} />
            <Route path="/erp/documents" element={<Navigate to="/documents" replace />} />
            <Route path="/erp/visas" element={<Navigate to="/visas" replace />} />
            <Route path="/erp/rapports" element={<Navigate to="/rapports" replace />} />
            <Route path="/erp/utilisateurs" element={<Navigate to="/utilisateurs" replace />} />
            <Route path="/erp/roles" element={<Navigate to="/utilisateurs" replace />} />
            <Route path="/erp/users-roles" element={<Navigate to="/utilisateurs" replace />} />
            <Route path="/erp/parametres" element={<Navigate to="/parametres" replace />} />
            <Route path="/erp/settings" element={<Navigate to="/parametres" replace />} />
            <Route path="/erp/audit" element={<Navigate to="/audit" replace />} />
            <Route path="/erp/workspace" element={<Navigate to="/workspace" replace />} />
            <Route path="/erp/*" element={<Navigate to="/tableau-de-bord" replace />} />
          </Route>
        </Route>

        {/* Pilgrim Protected Routes (Pilgrim only; Staff -> Pilgrim Portal = DENIED) */}
        <Route element={<AuthGuard />}>
          <Route element={<PilgrimGuard />}>
            <Route path="/pelerin/*" element={<PilgrimPortal />} />
            <Route path="/portail/*" element={<PilgrimPortal />} />
          </Route>
        </Route>

        {/* 404 Controlled Route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}
