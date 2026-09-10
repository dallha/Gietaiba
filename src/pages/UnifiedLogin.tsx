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
import { TaibaLogo } from '../components/brand/TaibaLogo.js';

export const getWorkspaceAccessToken = () => null;

export const UnifiedLogin: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, loading: authLoading, getAuthorizedPath, refreshUserData } = useAuth();

  const [tab, setTab] = useState<'STAFF' | 'PILGRIM'>('STAFF');
  const [view, setView] = useState<'LOGIN' | 'FORGOT_PASSWORD'>('LOGIN');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      await neonAuthClient.signIn.social({ provider: "google" });
    } catch (e: any) {
      setError(e.message || "Erreur de connexion Neon Auth");
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    try {
      setSubmitting(true);
      setError(null);
      // Le wrapper SDK omet parfois le type `email()`, on force via `any` sachant qu'elle existe au runtime
      const { data, error: apiError } = await (neonAuthClient.signIn as any).email({ email, password });
      
      if (apiError) {
        throw new Error(apiError.message || "Email ou mot de passe incorrect.");
      }

      // Succès sur Neon Auth, on force le rafraîchissement GIE TAIBA
      try {
        await refreshUserData();
        // Le useEffect global prendra le relai pour la redirection si currentUser est trouvé
      } catch (gieErr) {
        // En cas d'échec de vérification (ex: 403 pas de compte lié), on nettoie la session Neon
        await neonAuthClient.signOut();
        setError("Identité validée mais aucun compte GIE TAIBA autorisé. Veuillez contacter l'administrateur.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur de connexion.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Veuillez saisir votre adresse email.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const { error: apiError } = await (neonAuthClient.requestPasswordReset as any)({
        email,
        redirectTo: window.location.origin + '/reset-password'
      });

      if (apiError) {
        throw new Error(apiError.message || "Impossible d'envoyer l'email.");
      }

      setSuccessMsg("Si cet email existe, un lien de réinitialisation vous a été envoyé.");
      setTimeout(() => setView('LOGIN'), 3000);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la demande de réinitialisation.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!authLoading && currentUser) {
      const authorizedPath = getAuthorizedPath();
      navigate(authorizedPath, { replace: true });
      return;
    }

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

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden selection:bg-amber-500 selection:text-white">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-amber-600/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
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

        <div className="bg-white py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-slate-200/80">
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

          {view === 'LOGIN' ? (
            <div className="mt-2">
              <p className="mb-4 text-center text-xs text-slate-600">
                {tab === 'STAFF' ? 'Accès équipe sécurisé par Neon Auth.' : 'Accès pèlerin sécurisé par Neon Auth.'}
              </p>
              
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={submitting}
                className="w-full mb-5 py-2.5 px-4 border-2 border-indigo-500 hover:bg-indigo-50 text-indigo-700 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-3 cursor-pointer group disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Continuer avec Google</span>
              </button>

              <div className="flex items-center mb-5">
                <div className="flex-1 border-t border-slate-200"></div>
                <span className="px-3 text-xs text-slate-400 font-medium uppercase tracking-wider">ou</span>
                <div className="flex-1 border-t border-slate-200"></div>
              </div>

              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={submitting}
                      placeholder="Adresse email"
                      className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 disabled:bg-slate-50 disabled:text-slate-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={submitting}
                      placeholder="Mot de passe"
                      className="block w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 disabled:bg-slate-50 disabled:text-slate-500 transition-colors"
                    />
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 disabled:opacity-50"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="mt-1.5 flex justify-end">
                    <button
                      type="button"
                      onClick={() => { setView('FORGOT_PASSWORD'); setError(null); setSuccessMsg(null); }}
                      className="text-[11px] font-medium text-slate-500 hover:text-amber-600 transition-colors"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed group"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                  ) : (
                    <>
                      <span>Se connecter</span>
                      <ArrowRight className="w-4 h-4 text-amber-500 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="mt-2">
              <h3 className="text-sm font-bold text-slate-800 mb-2">Réinitialiser le mot de passe</h3>
              <p className="text-xs text-slate-600 mb-5">
                Entrez votre adresse email. Si elle correspond à un compte autorisé, vous recevrez un lien de réinitialisation.
              </p>
              
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={submitting}
                      placeholder="Adresse email"
                      className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 disabled:bg-slate-50 disabled:text-slate-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => { setView('LOGIN'); setError(null); setSuccessMsg(null); }}
                    disabled={submitting}
                    className="flex-1 py-2.5 px-4 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-xl transition-all disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> : 'Envoyer'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-500">
              Assistance & renseignements pèlerins :
            </p>
            <p className="text-xs font-bold text-slate-700 mt-0.5">
              kabaye73@gmail.com • +221 77 292 77 77
            </p>
          </div>
        </div>

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
