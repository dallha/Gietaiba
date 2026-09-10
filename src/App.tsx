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

        {/* Auth Routes */}
        <Route path="/" element={<UnifiedLogin />} />
        <Route path="/login" element={<UnifiedLogin />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/erp/login" element={<UnifiedLogin />} />
        <Route path="/pelerin/login" element={<UnifiedLogin />} />
        <Route path="/portail/login" element={<UnifiedLogin />} />

        {/* ERP Protected Routes (Staff & Super Admin only; Pilgrim -> ERP = DENIED) */}
        <Route element={<AuthGuard />}>
          <Route element={<ErpGuard />}>
            <Route path="/erp/*" element={<ErpApp />} />
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
