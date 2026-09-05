import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  CheckCircle,
  Building2,
  DollarSign,
  FileText,
  Smartphone,
  Shield,
} from 'lucide-react';
import { AgencySettings } from '../../types.js';

interface SettingsModuleProps {
  settings: AgencySettings;
  onRefresh: () => void;
  onUpdateSettings: (settings: Partial<AgencySettings>) => Promise<AgencySettings>;
}

export const SettingsModule: React.FC<SettingsModuleProps> = ({
  settings,
  onRefresh,
  onUpdateSettings,
}) => {
  const [form, setForm] = useState<AgencySettings>(settings);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(false);
    try {
      await onUpdateSettings(form);
      setSuccessMessage(true);
      setTimeout(() => setSuccessMessage(false), 3000);
      onRefresh();
    } catch (err: any) {
      alert(`Erreur de sauvegarde: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-amber-600" />
            Paramétrage Général & Données Métier
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Gestion centralisée des coordonnées officielles, coordonnées bancaires, devises et mentions légales.
          </p>
        </div>

        {successMessage && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold animate-fade-in">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            Paramètres enregistrés avec succès !
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Agency Identity */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <Building2 className="w-4 h-4 text-amber-600" />
            Identité Juridique & Agréments de l'Agence
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Raison Sociale *</label>
              <input
                type="text"
                required
                value={form.agencyName}
                onChange={(e) => setForm({ ...form, agencyName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">N° d'Agrément Officiel Hajj *</label>
              <input
                type="text"
                required
                value={form.licenseNumber}
                onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Téléphone Principal Caisse *</label>
              <input
                type="text"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Email Officiel *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Adresse Siège Social *</label>
              <input
                type="text"
                required
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Ville & Pays *</label>
              <input
                type="text"
                required
                value={`${form.city}, ${form.country}`}
                onChange={(e) => {
                  const parts = e.target.value.split(',');
                  setForm({ ...form, city: parts[0]?.trim() || '', country: parts[1]?.trim() || '' });
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Financial & Mobile Money */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <DollarSign className="w-4 h-4 text-amber-600" />
            Paramètres Financiers & Coordonnées Bancaires
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Devise Principale</label>
              <select
                value={form.defaultCurrency}
                onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-bold"
              >
                <option value="FCFA">FCFA (Franc CFA - XOF)</option>
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="SAR">SAR (Riyal Saoudien)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Établissement Bancaire</label>
              <input
                type="text"
                value={form.bankDetails?.bankName || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    bankDetails: { ...(form.bankDetails || { iban: '', bic: '' }), bankName: e.target.value },
                  })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">IBAN / Compte Bancaire</label>
              <input
                type="text"
                value={form.bankDetails?.iban || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    bankDetails: { ...(form.bankDetails || { bankName: '', bic: '' }), iban: e.target.value },
                  })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">N° Compte Wave Business</label>
              <input
                type="text"
                value={form.mobileMoneyNumbers?.wave || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    mobileMoneyNumbers: { ...(form.mobileMoneyNumbers || {}), wave: e.target.value },
                  })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">N° Compte Orange Money</label>
              <input
                type="text"
                value={form.mobileMoneyNumbers?.orangeMoney || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    mobileMoneyNumbers: { ...(form.mobileMoneyNumbers || {}), orangeMoney: e.target.value },
                  })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Legal & Receipts clauses */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <FileText className="w-4 h-4 text-amber-600" />
            Mentions Légales & Conditions sur les Reçus de Caisse
          </h2>

          <div className="text-xs space-y-2">
            <label className="font-semibold text-slate-700 block">
              Clause Contractuelle Imprimée sur Tous les Reçus Officiels
            </label>
            <textarea
              rows={3}
              value={form.receiptFooterTerms || ''}
              onChange={(e) => setForm({ ...form, receiptFooterTerms: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-slate-800 leading-relaxed"
            />
            <p className="text-[11px] text-slate-400 italic">
              Cette mention est imprimée au bas de chaque reçu délivré aux pèlerins pour garantir la validité légale de l'encaissement.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Enregistrement...' : 'Enregistrer Tous les Paramètres'}
          </button>
        </div>
      </form>
    </div>
  );
};
