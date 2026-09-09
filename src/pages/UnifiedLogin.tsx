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

// Compatibility stub for Workspace APIs
export const getWorkspaceAccessToken = () => null;

export const UnifiedLogin: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, loading: authLoading, getAuthorizedPath } = useAuth();

  const [tab, setTab] = useState<'STAFF' | 'PILGRIM'>('STAFF');

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

          <div className="mt-5">
            <p className="mb-4 text-center text-xs text-slate-600">
              {tab === 'STAFF' ? 'Accès équipe sécurisé par Neon Auth.' : 'Accès pèlerin sécurisé par Neon Auth.'}
            </p>
            <button
      type="button"
      onClick={handleNeonLogin}
      className="w-full mb-3 py-2.5 px-4 border-2 border-indigo-500 hover:bg-indigo-50 text-indigo-700 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-3 cursor-pointer group"
    >
      <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      <span>Continuer avec Neon Auth</span>
    </button>
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
