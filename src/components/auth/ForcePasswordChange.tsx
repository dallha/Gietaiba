import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, KeyRound, AlertCircle, Loader2, LogOut, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext.js';
import { api } from '../../services/api.js';
import { TaibaLogo } from '../brand/TaibaLogo.js';

// Full-screen forced password change — rendered by AuthGuard when
// currentUser.mustChangePassword is true. No route to bypass it: the guard
// renders this component INSTEAD of the requested page, and the backend
// enforces 403 PASSWORD_CHANGE_REQUIRED on every API call except the allowlist.
export const ForcePasswordChange: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, logoutUser, refreshUserData, getAuthorizedPath } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setCurrentPasswordError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setFormError('Veuillez remplir tous les champs.');
      return;
    }
    if (newPassword.length < 8) {
      setFormError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    try {
      setSubmitting(true);
      await api.changePassword(currentPassword, newPassword);
      // Rafraîchit la session : mustChangePassword repasse à false, le garde
      // laisse alors passer vers l'espace autorisé.
      await refreshUserData();
      navigate(getAuthorizedPath(), { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Une erreur est survenue.';
      if (message.includes('actuel') || message.includes('incorrect')) {
        // 400 — mot de passe actuel incorrect : erreur inline sous le champ
        setCurrentPasswordError(message);
      } else if (message.startsWith('Échec de connexion') || message.includes('Aucune réponse')) {
        // 502 / serveur injoignable : message générique
        setFormError('Le service est momentanément indisponible. Veuillez réessayer dans quelques instants.');
      } else {
        setFormError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

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
            Sécurisation de votre compte
          </p>
        </div>

        <div className="bg-white py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-slate-200/80">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-600 border border-amber-500/30 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Changement de mot de passe obligatoire
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Pour des raisons de sécurité, vous devez définir un nouveau mot de passe avant de continuer.
                {currentUser?.email ? (
                  <span className="block mt-1 font-semibold text-slate-700">Compte : {currentUser.email}</span>
                ) : null}
              </p>
            </div>
          </div>

          {formError && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span className="font-medium">{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Mot de passe actuel
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  disabled={submitting}
                  placeholder="Votre mot de passe actuel"
                  className={`block w-full pl-10 pr-10 py-2.5 border rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 disabled:bg-slate-50 disabled:text-slate-500 transition-colors ${
                    currentPasswordError ? 'border-red-400 bg-red-50/50' : 'border-slate-300'
                  }`}
                />
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 disabled:opacity-50"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {currentPasswordError && (
                <p className="mt-1.5 text-[11px] font-medium text-red-600 flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {currentPasswordError}
                </p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={submitting}
                  placeholder="8 caractères minimum"
                  className="block w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 disabled:bg-slate-50 disabled:text-slate-500 transition-colors"
                />
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowNew(!showNew)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 disabled:opacity-50"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Confirmer le nouveau mot de passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <ShieldCheck className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={submitting}
                  placeholder="Répétez le nouveau mot de passe"
                  className="block w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 disabled:bg-slate-50 disabled:text-slate-500 transition-colors"
                />
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 disabled:opacity-50"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              ) : (
                <>
                  <KeyRound className="w-4 h-4 text-amber-500" />
                  <span>Mettre à jour mon mot de passe</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => logoutUser()}
              disabled={submitting}
              className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-500 hover:text-red-600 transition-colors disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Se déconnecter</span>
            </button>
          </div>
        </div>

        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-1.5 text-slate-500 text-[11px] font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Plateforme sécurisée • Dakar • Sénégal</span>
          </div>
        </div>
      </div>
    </div>
  );
};