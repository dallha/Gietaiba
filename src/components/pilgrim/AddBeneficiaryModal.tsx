import React, { useState } from 'react';
import { X, UserPlus, Shield, HeartHandshake, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../services/api.js';

interface AddBeneficiaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newClient: any) => void;
}

export const AddBeneficiaryModal: React.FC<AddBeneficiaryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [relationshipType, setRelationshipType] = useState<'TUTEUR_FAMILLE' | 'PAYEUR_TIERS' | 'GESTIONNAIRE'>('TUTEUR_FAMILLE');
  const [subscribeHajj, setSubscribeHajj] = useState(true);
  const [packageId, setPackageId] = useState('pkg-std-2027');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setError('Prénom, Nom et Téléphone sont obligatoires.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await api.addPilgrimBeneficiary({
        firstName,
        lastName,
        gender,
        phone,
        birthDate: birthDate || undefined,
        passportNumber: passportNumber || undefined,
        relationshipType,
        campaignId: subscribeHajj ? 'voy-haj2027-01' : undefined,
        packageId: subscribeHajj ? packageId : undefined,
      });

      onSuccess(res.client);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement du bénéficiaire');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-emerald-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Ajouter un Proche / Bénéficiaire</h3>
              <p className="text-xs text-emerald-200">Gestion familiale & sous tutelle (Hajj / Oumrah)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-emerald-300 hover:text-white p-1 rounded-lg hover:bg-emerald-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2 border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Relation Type */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Lien avec vous (Titulaire du compte)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'TUTEUR_FAMILLE', label: 'Tuteur Famille' },
                { id: 'PAYEUR_TIERS', label: 'Payeur Tiers' },
                { id: 'GESTIONNAIRE', label: 'Délégation' },
              ].map((rel) => (
                <button
                  type="button"
                  key={rel.id}
                  onClick={() => setRelationshipType(rel.id as any)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                    relationshipType === rel.id
                      ? 'bg-amber-50 text-amber-900 border-amber-500 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {rel.label}
                </button>
              ))}
            </div>
          </div>

          {/* Identity Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Prénom *</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ex: Fatou"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nom de famille *</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Ex: Diop"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Genre</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as 'M' | 'F')}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
              >
                <option value="M">Masculin (Homme)</option>
                <option value="F">Féminin (Femme)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Téléphone *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex: 77 123 45 67"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date de naissance</label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">N° Passeport (optionnel)</label>
              <input
                type="text"
                value={passportNumber}
                onChange={(e) => setPassportNumber(e.target.value)}
                placeholder="Ex: P01234567"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm uppercase focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Inscription Option */}
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={subscribeHajj}
                onChange={(e) => setSubscribeHajj(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
              />
              <span className="text-xs font-bold text-emerald-950">
                Inscrire immédiatement à la Campagne Hajj 2027
              </span>
            </label>

            {subscribeHajj && (
              <div className="pt-1.5 pl-6">
                <label className="block text-[11px] font-medium text-emerald-800 mb-1">Package sélectionné :</label>
                <select
                  value={packageId}
                  onChange={(e) => setPackageId(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-emerald-300 rounded-lg text-xs bg-white text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                >
                  <option value="pkg-std-2027">Standard (5 100 000 FCFA)</option>
                  <option value="pkg-conf-2027">Confort (5 500 000 FCFA)</option>
                  <option value="pkg-vip-2027">VIP (6 200 000 FCFA)</option>
                </select>
              </div>
            )}
          </div>

          {/* Submit Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? 'Création en cours...' : 'Valider le Proche'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
