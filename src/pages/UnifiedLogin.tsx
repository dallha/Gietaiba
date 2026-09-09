import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Lock, 
  Mail, 
  AlertCircle, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Loader2,
  Info,
  Phone,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext.js';
import { api } from '../services/api.js';

// Compatibility stub for Workspace APIs
export const getWorkspaceAccessToken = () => null;

export const UnifiedLogin: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, loading: authLoading, getAuthorizedPath, loginWithSession } = useAuth();

  const [tab, setTab] = useState<'STAFF' | 'PILGRIM'>('STAFF');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pilgrimIdentifier, setPilgrimIdentifier] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showRbacInfo, setShowRbacInfo] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (!authLoading && currentUser) {
      const authorizedPath = getAuthorizedPath();
      navigate(authorizedPath, { replace: true });
    }
  }, [authLoading, currentUser, navigate, getAuthorizedPath]);

  // Connexion Collaborateur / Admin / Staff / Pèlerin par Email et Mot de passe
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.login(email.trim(), password);
      if (res?.user && res.token) {
        loginWithSession(res.user);
        const userRole = (res.user.role || '').toUpperCase();
        if (userRole === 'PELERIN' || userRole === 'PILGRIM') {
          navigate('/portail', { replace: true });
        } else {
          navigate('/erp', { replace: true });
        }
        return;
      }
      throw new Error('Réponse de connexion invalide du serveur.');
    } catch (apiErr: any) {
      console.error('Login error:', apiErr);
      setError(apiErr?.message || 'Identifiants incorrects ou compte inactif.');
    } finally {
      setSubmitting(false);
    }
  };

  // Connexion Rapide Pèlerin par Téléphone ou Matricule Dossier
  const handlePilgrimQuickLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.pilgrimLogin(pilgrimIdentifier.trim());
      if (res?.user && res.token) {
        loginWithSession(res.user);
        navigate('/portail', { replace: true });
        return;
      }
      throw new Error('Aucun dossier trouvé pour cet identifiant.');
    } catch (apiErr: any) {
      console.error('Pilgrim login error:', apiErr);
      setError(apiErr?.message || 'Identifiant pèlerin non reconnu. Vérifiez votre numéro ou code.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Subtle decorative background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-amber-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[250px] bg-emerald-600/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 font-serif font-black text-2xl shadow-xl shadow-amber-600/20 border border-amber-300/40 mb-4">
            TV
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase">
            GIE TAIBA VOYAGES
          </h1>
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mt-1">
            Plateforme Unifiée Sécurisée • Hajj & Oumrah
          </p>
          <p className="text-xs text-slate-400 mt-2 max-w-sm">
            Espace d'authentification centralisé. Vos droits d'accès sont automatiquement résolus selon votre profil officiel dans Neon PostgreSQL.
          </p>
        </div>

        {/* Tab Selector: Staff / Espace Pèlerin */}
        <div className="flex bg-slate-900/80 p-1 rounded-2xl border border-slate-800 mb-4">
          <button
            type="button"
            onClick={() => {
              setTab('STAFF');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
              tab === 'STAFF'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Compte & Mot de passe</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('PILGRIM');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
              tab === 'PILGRIM'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Accès Direct Pèlerin</span>
          </button>
        </div>

        {/* Main Card */}
        <div className="bg-white py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-slate-200">
          {/* Alerts */}
          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex items-start gap-2.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-start gap-2.5 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span className="font-medium">{successMsg}</span>
            </div>
          )}

          {/* TAB 1: Connexion par Email & Mot de passe */}
          {tab === 'STAFF' && (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Adresse E-mail ou Téléphone
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-900 text-xs font-medium bg-slate-50"
                    placeholder="ex: mr.niass@gmail.com ou admin@taiba-voyages.sn"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-slate-700">Mot de passe</label>
                  <button
                    type="button"
                    onClick={() => setShowHelpModal(true)}
                    className="text-[11px] font-bold text-amber-600 hover:text-amber-700 hover:underline cursor-pointer"
                  >
                    Besoin d'aide ?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-900 text-xs font-medium bg-slate-50"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connexion sécurisée en cours...</span>
                  </>
                ) : (
                  <>
                    <span>Se connecter</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: Accès Rapide Pèlerin */}
          {tab === 'PILGRIM' && (
            <form onSubmit={handlePilgrimQuickLogin} className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 mb-2">
                Pèlerins enregistrés : saisissez votre numéro de téléphone ou votre code dossier pour consulter immédiatement vos pièces, paiements et convocations.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Code Pèlerin ou Numéro de Téléphone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={pilgrimIdentifier}
                    onChange={(e) => setPilgrimIdentifier(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 text-xs font-medium bg-slate-50"
                    placeholder="ex: GT-TEST-000001 ou +221770000000"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Accès à votre espace...</span>
                  </>
                ) : (
                  <>
                    <span>Accéder à mon Portail Pèlerin</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Assistance contact footer */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Assistance technique ou réinitialisation d'accès :
            </p>
            <p className="text-xs font-bold text-slate-700 mt-0.5">
              direction@taiba-voyages.sn • +221 33 824 00 00
            </p>
          </div>
        </div>

        {/* Modal d'aide */}
        {showHelpModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 max-w-sm w-full rounded-2xl p-6 text-white text-xs space-y-4 shadow-2xl">
              <h3 className="font-black text-sm uppercase tracking-wider text-amber-400">
                Aide à la Connexion
              </h3>
              <p className="text-slate-300 leading-relaxed">
                Les comptes de la plateforme GIE TAIBA VOYAGES sont administrés directement sur la base centrale Neon PostgreSQL.
              </p>
              <ul className="space-y-2 text-slate-400 list-disc list-inside">
                <li><strong className="text-white">Direction / Staff</strong> : Utilisez votre adresse e-mail professionnelle et mot de passe attribué.</li>
                <li><strong className="text-white">Pèlerin</strong> : Vous pouvez vous connecter via l'onglet <em>Accès Direct Pèlerin</em> avec votre matricule ou téléphone.</li>
              </ul>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition"
              >
                Fermer
              </button>
            </div>
          </div>
        )}

        {/* RBAC Security Policy Badge */}
        <div className="mt-6 text-center">
          <button
            onClick={() => setShowRbacInfo(!showRbacInfo)}
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-xs font-medium transition cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Architecture RBAC & Séparation Stricte des Espaces</span>
            <Info className="w-3.5 h-3.5 text-slate-500" />
          </button>

          {showRbacInfo && (
            <div className="mt-3 p-4 bg-slate-900/90 border border-slate-800 rounded-2xl text-left text-xs text-slate-300 space-y-2 animate-fade-in shadow-xl">
              <p className="font-bold text-white uppercase text-[11px] tracking-wider pb-1 border-b border-slate-800">
                Politique d'Habilitation Stricte
              </p>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1 shrink-0" />
                  <span>
                    <strong className="text-emerald-300">PELERIN</strong> : Accès automatique au <em>Portail Pèlerin</em> (/portail). Accès ERP = <strong>DENIED</strong>.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 mt-1 shrink-0" />
                  <span>
                    <strong className="text-amber-300">STAFF</strong> : Accès automatique à l'<em>Espace Équipe</em> (/erp). Accès portail pèlerin = <strong>DENIED</strong>.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 mt-1 shrink-0" />
                  <span>
                    <strong className="text-indigo-300">SUPER_ADMIN</strong> : Accès complet à l'<em>Administration</em> et gouvernance système (/erp) = <strong>ALLOW</strong>.
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                La session est sécurisée par jeton cryptographique Bearer signé HMAC-SHA256 validé par le serveur Node/Express.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
