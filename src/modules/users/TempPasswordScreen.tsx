import React, { useState, useCallback } from 'react';
import { Eye, EyeOff, Copy, Check, AlertTriangle, ShieldCheck } from 'lucide-react';

interface TempPasswordScreenProps {
  email: string;
  tempPassword: string;
  roleLabel?: string;
  onClose: () => void;
}

export const TempPasswordScreen: React.FC<TempPasswordScreenProps> = ({
  email,
  tempPassword,
  roleLabel,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = tempPassword;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [tempPassword]);

  return (
    <div className="space-y-5">
      {/* Success header */}
      <div className="text-center">
        <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <ShieldCheck className="w-7 h-7 text-emerald-600" />
        </div>
        <h2 className="text-lg font-black text-slate-900">Compte créé avec succès</h2>
        <p className="text-xs text-slate-500 mt-1">
          {roleLabel ? `Compte ${roleLabel}` : 'Nouveau compte'} : <strong>{email}</strong>
        </p>
      </div>

      {/* Temp password display */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <label className="block text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-2">
          Mot de passe temporaire
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white border border-amber-300 rounded-lg px-3 py-2.5 font-mono text-sm text-slate-900 break-all">
            {revealed ? tempPassword : '••••••••••••'}
          </div>
          <button
            onClick={() => setRevealed(!revealed)}
            className="p-2 bg-white border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer"
            title={revealed ? 'Masquer' : 'Afficher'}
          >
            {revealed ? (
              <EyeOff className="w-4 h-4 text-amber-700" />
            ) : (
              <Eye className="w-4 h-4 text-amber-700" />
            )}
          </button>
          <button
            onClick={handleCopy}
            className={`p-2 border rounded-lg transition-colors cursor-pointer ${
              copied
                ? 'bg-emerald-100 border-emerald-300'
                : 'bg-white border-amber-300 hover:bg-amber-100'
            }`}
            title="Copier le mot de passe"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Copy className="w-4 h-4 text-amber-700" />
            )}
          </button>
        </div>
      </div>

      {/* Security warning */}
      <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3.5">
        <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
        <div className="text-[11px] text-red-800 leading-relaxed">
          <p className="font-bold">Ce mot de passe ne sera plus affiché.</p>
          <p className="mt-0.5">
            Communiquez-le de manière sécurisée à l'utilisateur. Il devra le changer à la première connexion.
          </p>
        </div>
      </div>

      {/* Close */}
      <div className="flex justify-end pt-2">
        <button
          onClick={onClose}
          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
        >
          Fermer
        </button>
      </div>
    </div>
  );
};
