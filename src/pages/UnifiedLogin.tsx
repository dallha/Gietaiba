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

          {/* Assistance contact footer */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
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
