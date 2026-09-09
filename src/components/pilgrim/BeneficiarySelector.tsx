import React, { useState } from 'react';
import { Users, ChevronDown, Check, UserPlus, Shield } from 'lucide-react';

export interface AccessibleBeneficiary {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  gender: string;
  phone: string;
  email?: string;
  photoUrl?: string;
  relationshipType: 'TITULAIRE' | 'TUTEUR_FAMILLE' | 'PAYEUR_TIERS' | 'GESTIONNAIRE';
  canView: boolean;
  canPay: boolean;
  canUploadDocs: boolean;
  isTest?: boolean;
}

interface BeneficiarySelectorProps {
  beneficiaries: AccessibleBeneficiary[];
  selectedBeneficiaryId: string | null;
  onSelectBeneficiary: (clientId: string) => void;
  onOpenAddModal: () => void;
}

export const BeneficiarySelector: React.FC<BeneficiarySelectorProps> = ({
  beneficiaries,
  selectedBeneficiaryId,
  onSelectBeneficiary,
  onOpenAddModal,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const activeBeneficiary = beneficiaries.find((b) => b.id === selectedBeneficiaryId) || beneficiaries[0];

  const getRelationBadge = (rel: string) => {
    switch (rel) {
      case 'TITULAIRE':
        return <span className="bg-emerald-800/80 text-emerald-200 border border-emerald-700/60 px-2 py-0.5 rounded-full text-[10px] font-bold">Titulaire</span>;
      case 'TUTEUR_FAMILLE':
        return <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">Tuteur Famille</span>;
      case 'PAYEUR_TIERS':
        return <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">Payeur Tiers</span>;
      default:
        return <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full text-[10px] font-bold">{rel}</span>;
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {/* Selector Button */}
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-emerald-950/70 hover:bg-emerald-950 text-white border border-emerald-700/60 transition cursor-pointer shadow-xs"
        >
          <div className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs">
            {activeBeneficiary?.firstName ? activeBeneficiary.firstName[0] : 'P'}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold leading-tight">
                {activeBeneficiary ? `${activeBeneficiary.firstName} ${activeBeneficiary.lastName}` : 'Chargement...'}
              </span>
              {activeBeneficiary && getRelationBadge(activeBeneficiary.relationshipType)}
            </div>
            <p className="text-[10px] text-emerald-300/80 font-mono">
              {activeBeneficiary?.code || ''}
            </p>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-emerald-300 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Quick Add Beneficiary Button */}
        <button
          type="button"
          onClick={onOpenAddModal}
          className="p-1.5 px-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          title="Ajouter un membre de la famille ou proche"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Ajouter un proche</span>
        </button>
      </div>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setDropdownOpen(false)}
          />
          <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden text-slate-900 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-3 bg-emerald-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Dossiers Pèlerins ({beneficiaries.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  onOpenAddModal();
                }}
                className="text-amber-300 hover:text-white text-[11px] font-bold flex items-center gap-1"
              >
                <UserPlus className="w-3 h-3" />
                <span>+ Proche</span>
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 p-1">
              {beneficiaries.map((beneficiary) => {
                const isSelected = activeBeneficiary?.id === beneficiary.id;
                return (
                  <button
                    key={beneficiary.id}
                    type="button"
                    onClick={() => {
                      onSelectBeneficiary(beneficiary.id);
                      setDropdownOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-xl flex items-center justify-between text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-950 font-bold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                        isSelected ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {beneficiary.firstName[0]}
                      </div>
                      <div>
                        <p className="text-xs font-bold leading-snug">
                          {beneficiary.firstName} {beneficiary.lastName}
                        </p>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                          <span>{beneficiary.code}</span>
                          <span>•</span>
                          <span className="capitalize">{beneficiary.relationshipType.toLowerCase().replace('_', ' ')}</span>
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-emerald-700" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
