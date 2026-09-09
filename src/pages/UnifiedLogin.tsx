import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Lock, 
  Mail, 
  AlertCircle, 
  Shield, 
  ArrowRight, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Loader2,
  Phone,
  UserCheck,
  Building2
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext.js';
import { neonAuthClient } from '../auth/neonClient.js';
import { api } from '../services/api.js';
import { TaibaLogo } from '../components/brand/TaibaLogo.js';

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

  const handleNeonLogin = async () => {
    try {
      setError(null);
      await neonAuthClient.signIn.social({ provider: "google" });
      // Neon Auth redirigera automatiquement après le succès
    } catch (e: any) {
      setError(e.message || "Erreur de connexion Neon Auth");
    }
  };

  // Auto-redirect if already authenticated & capture OAuth errors
  useEffect(() => {
    if (!authLoading && currentUser) {
      const authorizedPath = getAuthorizedPath();
      navigate(authorizedPath, { replace: true });
      return;
    }

    // Capture des erreurs transmises par callback OAuth (ex: compte inconnu)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlError = urlParams.get('error');
      if (urlError) {
        setError(decodeURIComponent(urlError));
        urlParams.delete('error');
        const remainingQuery = urlParams.toString();
        const cleanUrl = window.location.pathname + (remainingQuery ? `?${remainingQuery}` : '') + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
      }
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
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden selection:bg-amber-500 selection:text-white">
      {/* Subtle ambient decorative background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-amber-600/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="mb-4">
            <TaibaLogo size="xl" withContainer />
          </div>
          <h1 className="text-2xl font-black text-white tracking-wider uppercase font-serif">
            GIE TAIBA VOYAGES
          </h1>
          <p className="text-xs font-medium text-amber-300/90 tracking-widest mt-1.5 uppercase">
            Votre voyage spirituel, notre engagement.
          </p>
        </div>

        {/* Tab Selector: Espace Équipe / Espace Pèlerin */}
        <div className="flex bg-slate-900/90 p-1 rounded-2xl border border-slate-800 shadow-inner mb-5">
          <button
            type="button"
            onClick={() => {
              setTab('STAFF');
              setError(null);
            }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              tab === 'STAFF'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Espace Équipe</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('PILGRIM');
              setError(null);
            }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              tab === 'PILGRIM'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Espace Pèlerin</span>
          </button>
        </div>

        {/* Main Card */}
        <div className="bg-white py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-slate-200/80">
          {/* Alerts */}
          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span className="font-medium">{successMsg}</span>
            </div>
          )}

          {/* TAB 1: Connexion Équipe */}
          {tab === 'STAFF' && (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Adresse e-mail professionnelle
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-900 text-xs font-medium bg-slate-50 transition"
                    placeholder="votre.email@exemple.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-900 text-xs font-medium bg-slate-50 transition"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connexion en cours...</span>
                  </>
                ) : (
                  <>
                    <span>Accéder à l'espace de gestion</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: Connexion Rapide Pèlerin */}
          {tab === 'PILGRIM' && (
            <form onSubmit={handlePilgrimQuickLogin} className="space-y-4">
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed">
                Consultez immédiatement l'avancement de votre dossier Hajj ou Oumrah, vos reçus de versement et vos convocations de départ.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Code dossier ou Téléphone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={pilgrimIdentifier}
                    onChange={(e) => setPilgrimIdentifier(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 text-xs font-medium bg-slate-50 transition"
                    placeholder="ex: GT-2027-00001 ou +221 77 000 00 00"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Recherche de votre dossier...</span>
                  </>
                ) : (
                  <>
                    <span>Consulter mon dossier</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Séparateur & Bouton Google OAuth */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <button
      type="button"
      onClick={handleNeonLogin}
      className="w-full mb-3 py-2.5 px-4 border-2 border-indigo-500 hover:bg-indigo-50 text-indigo-700 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-3 cursor-pointer group"
    >
      <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      <span>Connexion Neon Auth (Beta)</span>
    </button>
    <div className="relative mb-4 text-center">
              <span className="bg-white px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Ou authentification directe
              </span>
            </div>
            <a
              href="/api/auth/google"
              className="w-full py-2.5 px-4 border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-3 cursor-pointer group"
            >
              <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continuer avec Google</span>
            </a>
          </div>

          {/* Assistance contact footer */}
          <div className="mt-5 pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-500">
              Assistance & renseignements pèlerins :
            </p>
            <p className="text-xs font-bold text-slate-700 mt-0.5">
              kabaye73@gmail.com • +221 77 292 77 77
            </p>
          </div>
        </div>

        {/* Security badge footer */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-1.5 text-slate-500 text-[11px] font-medium">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Plateforme sécurisée • Dakar • Sénégal</span>
          </div>
        </div>
      </div>
    </div>
  );
};
