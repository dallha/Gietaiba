import React, { useState } from 'react';
import { 
  User as UserIcon, 
  ShieldCheck, 
  Lock, 
  Save, 
  Phone, 
  MapPin, 
  AlertCircle, 
  CheckCircle2,
  Info
} from 'lucide-react';
import { Client, User } from '../../types.js';
import { api } from '../../services/api.js';

interface PilgrimProfileViewProps {
  client: Client;
  user: User | null;
  onClientUpdated?: (updated: Partial<Client>) => void;
}

export const PilgrimProfileView: React.FC<PilgrimProfileViewProps> = ({
  client,
  user,
  onClientUpdated,
}) => {
  // Allowed editable fields strictly limited to contact/residence (Requirement 15)
  const [contactPerson, setContactPerson] = useState(client.contactPerson || '');
  const [contactPhone, setContactPhone] = useState(client.contactPhone || '');
  const [address, setAddress] = useState(client.address || '');
  const [whatsapp, setWhatsapp] = useState(client.whatsapp || '');

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // STRICT SECURITY: We update ONLY authorized fields on the client document.
      // We NEVER modify roleId, clientId, allowedInscriptionIds, status, or active!
      const updatePayload = {
        contactPerson: contactPerson.trim(),
        contactPhone: contactPhone.trim(),
        address: address.trim(),
        whatsapp: whatsapp.trim(),
        updatedAt: new Date().toISOString()
      };

      await api.updateClient(client.id, updatePayload);

      setSuccess(true);
      if (onClientUpdated) {
        onClientUpdated(updatePayload);
      }
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Erreur lors de l’enregistrement de vos modifications.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <UserIcon className="w-6 h-6 text-emerald-700" />
          <span>Mon Profil & Coordonnées</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Consultez vos informations d'identité et mettez à jour votre contact d'urgence et coordonnées
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Fixed Identity & Security Overview (Read-Only) */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Lock className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                Identité Officielle (Verrouillée)
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Civilité & Nom</span>
                <span className="font-bold text-slate-900 text-sm">
                  {client.civility || ''} {client.firstName} {client.lastName}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Numéro de passeport</span>
                <span className="font-mono font-bold text-slate-900">
                  {client.passportNumber || 'En cours d’enregistrement'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Nationalité</span>
                <span className="font-bold text-slate-900">{client.nationality || 'Sénégalaise'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Date de naissance</span>
                <span className="font-bold text-slate-900">{client.birthDate || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Profession</span>
                <span className="font-bold text-slate-900">{client.profession || 'N/A'}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] text-slate-500 flex items-start gap-2">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                Pour modifier votre nom ou passeport officiel, veuillez vous adresser directement au guichet de l'agence Taiba.
              </span>
            </div>
          </div>

          {/* Account Security Invariants Box */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xs border border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h4 className="font-bold text-sm">Sécurité & Autorisations</h4>
            </div>
            <div className="text-xs space-y-1.5 text-slate-300">
              <div className="flex justify-between">
                <span>Rôle système :</span>
                <strong className="text-amber-400">PÈLERIN (Lecture Seule)</strong>
              </div>
              <div className="flex justify-between">
                <span>Statut du compte :</span>
                <strong className="text-emerald-400">ACTIF</strong>
              </div>
              <div className="flex justify-between">
                <span>Rattachement Client :</span>
                <strong className="font-mono text-white">{client.code}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Editable Authorized Fields */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSaveProfile} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-base font-black text-slate-900">
                Coordonnées & Personne à Contacter en Urgence
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Ces informations sont essentielles pour votre encadrement et la communication durant le voyage aux Lieux Saints.
              </p>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Vos informations ont été mises à jour avec succès dans votre dossier.</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
              {/* Emergency Contact Name */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Contact d'urgence (Nom complet) *
                </label>
                <input
                  type="text"
                  required
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Ex: Amadou Fall (Frère / Épouse)"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 font-medium bg-slate-50"
                />
              </div>

              {/* Emergency Contact Phone */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Téléphone du contact d'urgence *
                </label>
                <input
                  type="tel"
                  required
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+221 77 000 00 00"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 font-medium bg-slate-50"
                />
              </div>

              {/* Address / City */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Adresse de résidence / Ville
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Dakar, Médina / Thiès"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 font-medium bg-slate-50"
                />
              </div>

              {/* WhatsApp Phone */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Numéro WhatsApp (pour le groupe de pèlerins)
                </label>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+221 77 123 45 67"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 font-medium bg-slate-50"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Enregistrement...' : 'Mettre à jour mes coordonnées'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
