import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Building2, 
  Lock, 
  Mail, 
  AlertCircle, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Loader2,
  Shield,
  UserCheck,
  Info
} from 'lucide-react';
import { auth, db } from '../firebase.js';
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext.js';
import { User } from '../types.js';

// In-memory token cache for Google Workspace APIs
let cachedAccessToken: string | null = null;
export const getWorkspaceAccessToken = () => cachedAccessToken;

export const UnifiedLogin: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, firebaseUser, loading: authLoading, getAuthorizedPath } = useAuth();

  const [mode, setMode] = useState<'LOGIN' | 'ACTIVATE' | 'RESET'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showRbacInfo, setShowRbacInfo] = useState(false);

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (!authLoading && firebaseUser && currentUser) {
      const authorizedPath = getAuthorizedPath();
      navigate(authorizedPath, { replace: true });
    }
  }, [authLoading, firebaseUser, currentUser, navigate, getAuthorizedPath]);

  // Handle post-login redirection based strictly on Firestore users/{uid} roleId
  const handlePostAuthRedirect = async (uid: string, userEmail?: string | null) => {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);

      const isKnownSuperAdmin = 
        userEmail === 'mr.niass@gmail.com' || 
        userEmail === 'admin@taibavoyages.sn';

      if (userSnap.exists()) {
        const userData = userSnap.data() as User;
        if (!userData.active || userData.status === 'SUSPENDU' || userData.status === 'INACTIF') {
          await auth.signOut();
          setError("Votre compte utilisateur est suspendu ou inactif. Veuillez contacter la direction de Taiba Voyages.");
          return;
        }

        // RBAC destination
        if (userData.roleId === 'PILGRIM' && !isKnownSuperAdmin) {
          navigate('/portail', { replace: true });
        } else {
          // STAFF or SUPER_ADMIN
          navigate('/erp', { replace: true });
        }
      } else {
        // Fallback to least-privilege or known super admin
        if (isKnownSuperAdmin) {
          navigate('/erp', { replace: true });
        } else {
          navigate('/portail', { replace: true });
        }
      }
    } catch (err: any) {
      console.warn('Post-auth lookup notice:', err);
      navigate('/portail', { replace: true });
    }
  };

  // 1. Email + Mot de passe
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await handlePostAuthRedirect(cred.user.uid, cred.user.email);
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Adresse email ou mot de passe incorrect.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Trop de tentatives infructueuses. Veuillez patienter un moment avant de réessayer.');
      } else {
        setError(err.message || 'Identifiants incorrects ou accès refusé.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Google OAuth
  const handleGoogleLogin = async () => {
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const provider = new GoogleAuthProvider();
      // Add requested Google Workspace scopes
      provider.addScope('https://www.googleapis.com/auth/drive');
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      provider.addScope('https://www.googleapis.com/auth/drive.readonly');
      provider.addScope('https://www.googleapis.com/auth/spreadsheets');
      provider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');
      provider.addScope('https://www.googleapis.com/auth/documents');
      provider.addScope('https://www.googleapis.com/auth/documents.readonly');
      provider.addScope('https://www.googleapis.com/auth/tasks');
      provider.addScope('https://www.googleapis.com/auth/tasks.readonly');
      provider.addScope('https://www.googleapis.com/auth/forms.body');
      provider.addScope('https://www.googleapis.com/auth/forms.body.readonly');
      provider.addScope('https://www.googleapis.com/auth/forms.responses.readonly');

      const cred = await signInWithPopup(auth, provider);
      
      const credential = GoogleAuthProvider.credentialFromResult(cred);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
      }

      await handlePostAuthRedirect(cred.user.uid, cred.user.email);
    } catch (err: any) {
      console.error('Google login error:', err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Erreur lors de la connexion avec Google.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Activation de compte initiale
  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Les deux mots de passe saisis ne sont pas identiques.');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await handlePostAuthRedirect(cred.user.uid, cred.user.email);
    } catch (err: any) {
      console.error('Activation error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Un compte existe déjà avec cette adresse email. Veuillez vous connecter ou réinitialiser votre mot de passe.');
      } else {
        setError(err.message || 'Impossible de créer le compte pour le moment.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Réinitialisation mot de passe
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccessMsg(`Un email de réinitialisation sécurisé a été envoyé à ${email}.`);
      setTimeout(() => setMode('LOGIN'), 4000);
    } catch (err: any) {
      console.error('Reset error:', err);
      setError(err.message || 'Impossible d’envoyer le lien de réinitialisation.');
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
            Espace d'authentification centralisé. Vos droits d'accès sont automatiquement résolus selon votre profil officiel dans Firestore.
          </p>
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

          {/* Mode 1: LOGIN */}
          {mode === 'LOGIN' && (
            <>
              {/* Google One-Click Button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={submitting}
                className="w-full mb-5 py-3 px-4 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 flex items-center justify-center gap-3 transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continuer avec Google</span>
              </button>

              <div className="relative mb-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-slate-400 font-medium">Ou avec votre adresse email</span>
                </div>
              </div>

              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Adresse E-mail
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-900 text-xs font-medium bg-slate-50"
                      placeholder="votre.email@domaine.com"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-slate-700">Mot de passe</label>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setSuccessMsg(null);
                        setMode('RESET');
                      }}
                      className="text-[11px] font-bold text-amber-600 hover:text-amber-700 hover:underline cursor-pointer"
                    >
                      Mot de passe oublié ?
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
                      <span>Authentification en cours...</span>
                    </>
                  ) : (
                    <>
                      <span>Se connecter</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-slate-100 text-center space-y-2">
                <p className="text-xs text-slate-500">Première connexion avec votre adresse ?</p>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSuccessMsg(null);
                    setMode('ACTIVATE');
                  }}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:border-amber-500 text-slate-700 hover:text-amber-700 font-bold text-xs hover:bg-amber-50/50 transition cursor-pointer"
                >
                  Activer mon compte en ligne
                </button>
              </div>
            </>
          )}

          {/* Mode 2: ACTIVATE */}
          {mode === 'ACTIVATE' && (
            <form onSubmit={handleActivate} className="space-y-4">
              <div className="text-center mb-4">
                <h3 className="font-black text-slate-900 text-base">Activer Votre Accès</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Créez votre mot de passe pour accéder à votre espace sécurisé
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Votre Adresse E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-900 text-xs font-medium bg-slate-50"
                  placeholder="votre.email@domaine.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Créer un mot de passe</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-900 text-xs font-medium bg-slate-50"
                  placeholder="Au moins 6 caractères"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Confirmer le mot de passe</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-900 text-xs font-medium bg-slate-50"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                {submitting ? 'Création en cours...' : 'Finaliser mon activation'}
              </button>

              <button
                type="button"
                onClick={() => setMode('LOGIN')}
                className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-800 pt-2 cursor-pointer"
              >
                ← Revenir à l'écran de connexion
              </button>
            </form>
          )}

          {/* Mode 3: RESET */}
          {mode === 'RESET' && (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="text-center mb-4">
                <h3 className="font-black text-slate-900 text-base">Réinitialiser Votre Mot de Passe</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Saisissez l'adresse email associée à votre inscription ou compte collaborateur
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Adresse E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-900 text-xs font-medium bg-slate-50"
                  placeholder="votre.email@domaine.com"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                {submitting ? 'Envoi en cours...' : 'Envoyer le lien de réinitialisation'}
              </button>

              <button
                type="button"
                onClick={() => setMode('LOGIN')}
                className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-800 pt-2 cursor-pointer"
              >
                ← Revenir à l'écran de connexion
              </button>
            </form>
          )}
        </div>

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
                    <strong className="text-emerald-300">PILGRIM</strong> : Accès automatique au <em>Portail Pèlerin</em> (/portail). Accès ERP = <strong>DENIED</strong>.
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
                La modification manuelle d'une URL est systématiquement interceptée par les gardiens de route.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
