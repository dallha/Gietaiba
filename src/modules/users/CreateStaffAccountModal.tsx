import React, { useState, useCallback, useRef, useEffect } from 'react';
import { UserPlus, Check, Search, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../../services/api.js';
import { PROVISIONED_STAFF_ROLES } from '../../../contracts/provisioning.js';
import type { ProvisionResult, ProvisionPartialResult } from '../../../contracts/provisioning.js';
import { TempPasswordScreen } from './TempPasswordScreen.js';

const STAFF_ROLE_LABELS: Record<string, string> = {
  AGENT: 'AGENT (Grand Agent Polyvalent)',
  COMPTABLE: 'Comptable (Finances & Caisse)',
  DIRECTION: 'Gérant / Direction Générale',
};

interface CreateStaffAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ModalScreen = 'form' | 'tempPassword' | 'partialError';

interface PartialErrorInfo {
  message: string;
  correlationId: string;
}

export const CreateStaffAccountModal: React.FC<CreateStaffAccountModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [screen, setScreen] = useState<ModalScreen>('form');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Email check state
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [emailErrorMsg, setEmailErrorMsg] = useState('');

  // Result state
  const [tempPasswordResult, setTempPasswordResult] = useState<ProvisionResult | null>(null);
  const [partialError, setPartialError] = useState<PartialErrorInfo | null>(null);

  // Ref to track if email was already checked for current value
  const lastCheckedEmail = useRef('');

  const resetForm = useCallback(() => {
    setEmail('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setRoleId('');
    setEmailAvailable(null);
    setEmailErrorMsg('');
    setTempPasswordResult(null);
    setPartialError(null);
    setScreen('form');
    lastCheckedEmail.current = '';
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleEmailBlur = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || trimmed === lastCheckedEmail.current) return;
    if (!trimmed.includes('@')) {
      setEmailAvailable(false);
      setEmailErrorMsg('Adresse email invalide.');
      return;
    }

    setEmailChecking(true);
    setEmailErrorMsg('');
    try {
      const result = await api.checkEmailAvailability(trimmed);
      setEmailAvailable(result.available);
      if (!result.available) {
        setEmailErrorMsg('Cette adresse email est déjà utilisée.');
      }
      lastCheckedEmail.current = trimmed;
    } catch {
      // On network error, don't block the form — just clear the check state
      setEmailAvailable(null);
      setEmailErrorMsg('');
    } finally {
      setEmailChecking(false);
    }
  }, [email]);

  // Reset email check state when email changes
  useEffect(() => {
    const trimmed = email.trim().toLowerCase();
    if (trimmed !== lastCheckedEmail.current) {
      setEmailAvailable(null);
      setEmailErrorMsg('');
    }
  }, [email]);

  const canSubmit =
    email.trim() &&
    firstName.trim() &&
    lastName.trim() &&
    roleId &&
    emailAvailable !== false &&
    !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const result = await api.provisionStaff({
        email: email.trim().toLowerCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        roleId,
      });

      if ('tempPassword' in result) {
        setTempPasswordResult(result as ProvisionResult);
        setScreen('tempPassword');
        onSuccess();
      } else if ('status' in result && (result as ProvisionPartialResult).status === 'partial') {
        const partial = result as ProvisionPartialResult;
        setPartialError({ message: partial.message, correlationId: partial.correlationId });
        setScreen('partialError');
        onSuccess();
      }
    } catch (e: any) {
      setEmailErrorMsg(e.message || 'Erreur lors de la création du compte.');
      setEmailAvailable(false);
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, email, firstName, lastName, phone, roleId, onSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        {screen === 'form' && (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-amber-600" />
                  <span>Nouveau Compte Personnel</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Créez un compte utilisateur avec un accès Neon Auth sécurisé.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Email with availability check */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Adresse E-mail de Connexion *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onBlur={handleEmailBlur}
                    placeholder="utilisateur@exemple.com"
                    className={`w-full bg-slate-50 border rounded-xl p-2.5 pr-10 text-xs text-slate-900 font-medium outline-none transition-colors ${
                      emailAvailable === false
                        ? 'border-red-400 focus:border-red-500'
                        : emailAvailable === true
                          ? 'border-emerald-400 focus:border-emerald-500'
                          : 'border-slate-300 focus:border-amber-500'
                    }`}
                  />
                  <div className="absolute right-2.5 top-2.5">
                    {emailChecking && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
                    {!emailChecking && emailAvailable === true && (
                      <Check className="w-4 h-4 text-emerald-500" />
                    )}
                    {!emailChecking && emailAvailable === false && (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                </div>
                {emailErrorMsg && (
                  <p className="text-[11px] text-red-600 mt-1">{emailErrorMsg}</p>
                )}
                {emailAvailable === true && !emailErrorMsg && (
                  <p className="text-[11px] text-emerald-600 mt-1">Email disponible</p>
                )}
              </div>

              {/* Identity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Prénom *
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="Prénom"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nom *
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Nom de famille"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Numéro de Téléphone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+221 ..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus:border-amber-500 outline-none"
                />
              </div>

              {/* Role selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Rôle *
                </label>
                <select
                  value={roleId}
                  onChange={e => setRoleId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus:border-amber-500 outline-none"
                >
                  <option value="">-- Sélectionner un rôle --</option>
                  {PROVISIONED_STAFF_ROLES.map(role => (
                    <option key={role} value={role}>
                      {STAFF_ROLE_LABELS[role] || role}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Créer le Compte</span>
              </button>
            </div>
          </>
        )}

        {screen === 'tempPassword' && tempPasswordResult && (
          <TempPasswordScreen
            email={tempPasswordResult.email}
            tempPassword={tempPasswordResult.tempPassword}
            roleLabel={STAFF_ROLE_LABELS[tempPasswordResult.role] || tempPasswordResult.role}
            onClose={handleClose}
          />
        )}

        {screen === 'partialError' && partialError && (
          <div className="space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-7 h-7 text-amber-600" />
              </div>
              <h2 className="text-lg font-black text-slate-900">Intervention requise</h2>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900">
              <p className="font-bold mb-1">Compte partiellement créé.</p>
              <p>Intervention manuelle requise.</p>
              <p className="mt-2 font-mono text-[11px] text-amber-700">
                Référence : {partialError.correlationId}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleClose}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
