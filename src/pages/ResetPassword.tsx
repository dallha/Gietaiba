import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { neonAuthClient } from '../auth/neonClient.js';
import { TaibaLogo } from '../components/brand/TaibaLogo.js';

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Token de réinitialisation invalide ou manquant.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const { error: apiError } = await (neonAuthClient.resetPassword as any)({
        newPassword: password,
        token: token || undefined
      });

      if (apiError) {
        throw new Error(apiError.message || "Erreur lors de la réinitialisation.");
      }

      setSuccess(true);
      setTimeout(() => navigate('/connexion'), 3000);
    } catch (err: any) {
      setError(err.message || "Impossible de réinitialiser le mot de passe.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden selection:bg-amber-500 selection:text-white">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-amber-600/10 blur-[130px] rounded-full pointer-events-none" />
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="mb-4">
            <TaibaLogo size="xl" withContainer />
          </div>
          <h1 className="text-2xl font-black text-white tracking-wider uppercase font-serif">
            GIE TAIBA VOYAGES
          </h1>
          <p className="text-xs font-medium text-amber-300/90 tracking-widest mt-1.5 uppercase">
            Réinitialisation du mot de passe
          </p>
        </div>

        <div className="bg-white py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-slate-200/80">
          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {success ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-800 mb-2">Mot de passe modifié !</h3>
              <p className="text-sm text-slate-600">Vous allez être redirigé vers l'écran de connexion.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={!token || loading}
                    className="block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-amber-500 focus:ring-amber-500 disabled:bg-slate-50 disabled:text-slate-500 outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirmer le mot de passe
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={!token || loading}
                  className="block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-amber-500 focus:ring-amber-500 disabled:bg-slate-50 outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={!token || loading}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? 'Modification...' : 'Enregistrer'}
              </button>
            </form>
          )}
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
