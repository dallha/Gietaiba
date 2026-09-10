import React, { useEffect } from 'react';
import {
  X,
  UserPlus,
  FilePlus,
  UploadCloud,
  CreditCard,
  TrendingDown,
  Stamp,
  AlertCircle
} from 'lucide-react';
import { normalizeRole } from '../../auth/roleModules.js';

interface MobileQuickActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (module: string) => void;
  roleId?: string;
  onTriggerAction?: (actionId: string) => void;
}

export const MobileQuickActionSheet: React.FC<MobileQuickActionSheetProps> = ({
  isOpen,
  onClose,
  onNavigate,
  roleId,
  onTriggerAction,
}) => {
  const normRole = normalizeRole(roleId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAction = (module: string, actionId?: string) => {
    onClose();
    if (onTriggerAction && actionId) {
      onTriggerAction(actionId);
    }
    onNavigate(module);
  };

  const isAgent = normRole === 'AGENT';
  const isComptable = normRole === 'COMPTABLE';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Content */}
      <div
        className="relative w-full max-w-lg bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 p-5 safe-bottom-pad animate-in slide-in-from-bottom duration-200 z-10"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-action-title"
      >
        {/* Drag handle pill */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 id="quick-action-title" className="text-base font-bold font-serif text-slate-900">
              Actions Rapides
            </h2>
            <p className="text-xs text-slate-500">
              {isAgent
                ? 'Opérations pèlerins & inscriptions'
                : isComptable
                ? 'Opérations financières & caisse'
                : 'Opérations courantes'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200 cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-2 gap-3 pt-4">
          {/* AGENT Actions */}
          {isAgent && (
            <>
              <button
                onClick={() => handleAction('clients', 'NEW_CLIENT')}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 hover:bg-amber-100/70 active:scale-95 transition cursor-pointer text-center"
              >
                <div className="w-11 h-11 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-sm mb-2">
                  <UserPlus className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-amber-950">Nouveau Pèlerin</span>
                <span className="text-[10px] text-amber-800/80 mt-0.5">Enregistrer fiche</span>
              </button>

              <button
                onClick={() => handleAction('inscriptions', 'NEW_INSCRIPTION')}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 active:scale-95 transition cursor-pointer text-center"
              >
                <div className="w-11 h-11 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center shadow-sm mb-2">
                  <FilePlus className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-900">Nouveau Dossier</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Inscrire pèlerin</span>
              </button>

              <button
                onClick={() => handleAction('documents', 'UPLOAD_DOC')}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 hover:bg-emerald-100/70 active:scale-95 transition cursor-pointer text-center"
              >
                <div className="w-11 h-11 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-sm mb-2">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-emerald-950">Ajouter Document</span>
                <span className="text-[10px] text-emerald-800/80 mt-0.5">Passeport, photo, reçu</span>
              </button>

              <button
                onClick={() => handleAction('visas')}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200/80 hover:bg-indigo-100/70 active:scale-95 transition cursor-pointer text-center"
              >
                <div className="w-11 h-11 rounded-xl bg-indigo-700 text-white flex items-center justify-center shadow-sm mb-2">
                  <Stamp className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-indigo-950">Suivi des Visas</span>
                <span className="text-[10px] text-indigo-800/80 mt-0.5">Statuts Nusuk</span>
              </button>
            </>
          )}

          {/* COMPTABLE Actions */}
          {isComptable && (
            <>
              <button
                onClick={() => handleAction('paiements', 'NEW_PAYMENT')}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 hover:bg-emerald-100/70 active:scale-95 transition cursor-pointer text-center"
              >
                <div className="w-11 h-11 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-sm mb-2">
                  <CreditCard className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-emerald-950">Encaisser Versement</span>
                <span className="text-[10px] text-emerald-800/80 mt-0.5">Reçu automatique</span>
              </button>

              <button
                onClick={() => handleAction('depenses', 'NEW_EXPENSE')}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-rose-50/80 border border-rose-200/80 hover:bg-rose-100/70 active:scale-95 transition cursor-pointer text-center"
              >
                <div className="w-11 h-11 rounded-xl bg-rose-700 text-white flex items-center justify-center shadow-sm mb-2">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-rose-950">Nouvelle Dépense</span>
                <span className="text-[10px] text-rose-800/80 mt-0.5">Saisir sortie caisse</span>
              </button>

              <button
                onClick={() => handleAction('recouvrement')}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 hover:bg-amber-100/70 active:scale-95 transition cursor-pointer text-center"
              >
                <div className="w-11 h-11 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-sm mb-2">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-amber-950">Relances & Soldes</span>
                <span className="text-[10px] text-amber-800/80 mt-0.5">Dossiers débiteurs</span>
              </button>

              <button
                onClick={() => handleAction('paiements')}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 active:scale-95 transition cursor-pointer text-center"
              >
                <div className="w-11 h-11 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center shadow-sm mb-2">
                  <CreditCard className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-900">Journal de Caisse</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Historique des reçus</span>
              </button>
            </>
          )}

          {/* DIRECTION / SUPER_ADMIN Actions */}
          {!isAgent && !isComptable && (
            <>
              <button
                onClick={() => handleAction('clients', 'NEW_CLIENT')}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 hover:bg-amber-100/70 active:scale-95 transition cursor-pointer text-center"
              >
                <div className="w-11 h-11 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-sm mb-2">
                  <UserPlus className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-amber-950">Nouveau Pèlerin</span>
                <span className="text-[10px] text-amber-800/80 mt-0.5">Fiche pèlerin</span>
              </button>

              <button
                onClick={() => handleAction('inscriptions', 'NEW_INSCRIPTION')}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 active:scale-95 transition cursor-pointer text-center"
              >
                <div className="w-11 h-11 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center shadow-sm mb-2">
                  <FilePlus className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-900">Nouveau Dossier</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Inscription voyage</span>
              </button>

              <button
                onClick={() => handleAction('paiements', 'NEW_PAYMENT')}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 hover:bg-emerald-100/70 active:scale-95 transition cursor-pointer text-center"
              >
                <div className="w-11 h-11 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-sm mb-2">
                  <CreditCard className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-emerald-950">Encaisser Versement</span>
                <span className="text-[10px] text-emerald-800/80 mt-0.5">Caisse & reçu</span>
              </button>

              <button
                onClick={() => handleAction('documents', 'UPLOAD_DOC')}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200/80 hover:bg-indigo-100/70 active:scale-95 transition cursor-pointer text-center"
              >
                <div className="w-11 h-11 rounded-xl bg-indigo-700 text-white flex items-center justify-center shadow-sm mb-2">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-indigo-950">Ajouter Document</span>
                <span className="text-[10px] text-indigo-800/80 mt-0.5">GED centrale</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
