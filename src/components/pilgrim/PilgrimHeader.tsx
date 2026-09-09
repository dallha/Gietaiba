import React from 'react';
import { 
  Building2, 
  LogOut, 
  Bell, 
  Layers, 
  Check, 
  ShieldCheck, 
  ChevronDown,
  User as UserIcon
} from 'lucide-react';
import { Client, Inscription } from '../../types.js';
import { PilgrimTab } from './PilgrimTypes.js';
import { BeneficiarySelector, AccessibleBeneficiary } from './BeneficiarySelector.js';
import { TaibaLogo } from '../brand/TaibaLogo.js';

interface PilgrimHeaderProps {
  client: Client | null;
  inscriptions: Inscription[];
  activeInscription: Inscription | null;
  onSelectInscription: (id: string) => void;
  activeTab: PilgrimTab;
  onSelectTab: (tab: PilgrimTab) => void;
  unreadNotificationsCount: number;
  onLogout: () => void;
  beneficiaries?: AccessibleBeneficiary[];
  selectedBeneficiaryId?: string | null;
  onSelectBeneficiary?: (id: string) => void;
  onOpenAddBeneficiary?: () => void;
}

export const PilgrimHeader: React.FC<PilgrimHeaderProps> = ({
  client,
  inscriptions,
  activeInscription,
  onSelectInscription,
  activeTab,
  onSelectTab,
  unreadNotificationsCount,
  onLogout,
  beneficiaries,
  selectedBeneficiaryId,
  onSelectBeneficiary,
  onOpenAddBeneficiary,
}) => {
  return (
    <header className="bg-emerald-900 text-white shadow-md sticky top-0 z-30">
      {/* Primary Top Bar */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
        {/* Brand & Agency */}
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-xl shadow-xs border border-amber-400/30 flex items-center justify-center shrink-0">
            <TaibaLogo size="xs" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm tracking-wide">GIE TAIBA VOYAGES</span>
              <span className="text-[10px] uppercase font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                Portail Pèlerin
              </span>
            </div>
            <p className="text-[11px] text-emerald-200/90 font-medium">
              Votre voyage spirituel, notre engagement.
            </p>
          </div>
        </div>

        {/* User Badge & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Pilgrim Identity / Multi-Client Selector */}
          {beneficiaries && beneficiaries.length > 0 && onSelectBeneficiary && onOpenAddBeneficiary ? (
            <BeneficiarySelector
              beneficiaries={beneficiaries}
              selectedBeneficiaryId={selectedBeneficiaryId || null}
              onSelectBeneficiary={onSelectBeneficiary}
              onOpenAddModal={onOpenAddBeneficiary}
            />
          ) : (
            <button
              onClick={() => onSelectTab('profil')}
              className={`hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition cursor-pointer ${
                activeTab === 'profil'
                  ? 'bg-white text-emerald-950 border-white'
                  : 'bg-emerald-800/80 hover:bg-emerald-800 text-white border-emerald-700/60'
              }`}
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-700 text-amber-300 flex items-center justify-center font-bold text-xs">
                {client?.firstName ? client.firstName[0] : 'P'}
              </div>
              <div className="text-left">
                <p className="text-xs font-bold leading-tight line-clamp-1">
                  {client?.firstName} {client?.lastName}
                </p>
                <p className="text-[10px] text-emerald-200 font-mono">
                  {client?.code || 'PÈLERIN'}
                </p>
              </div>
            </button>
          )}

          {/* Notifications Shortcut */}
          <button
            onClick={() => onSelectTab('notifications')}
            className={`relative p-2 rounded-xl transition cursor-pointer ${
              activeTab === 'notifications'
                ? 'bg-amber-400 text-slate-950'
                : 'bg-emerald-800/80 hover:bg-emerald-800 text-emerald-100 hover:text-white'
            }`}
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 text-slate-950 text-[10px] font-black rounded-full flex items-center justify-center shadow-xs">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="p-2 bg-emerald-800/80 hover:bg-red-700/80 text-emerald-200 hover:text-white rounded-xl transition cursor-pointer"
            title="Déconnexion sécurisée"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Multi-Dossiers Selector Strip (Requirement 5: Strict Multi-dossier navigation) */}
      {inscriptions.length > 1 && (
        <div className="bg-emerald-950/90 border-t border-emerald-800/60 px-4 py-2">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-300 font-bold">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Dossiers autorisés ({inscriptions.length}) :</span>
              <span className="text-[11px] text-emerald-400 font-normal hidden sm:inline">
                Sélectionnez le voyage à consulter
              </span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
              {inscriptions.map((ins) => {
                const isSelected = activeInscription?.id === ins.id;
                return (
                  <button
                    key={ins.id}
                    onClick={() => onSelectInscription(ins.id)}
                    className={`px-3 py-1 rounded-lg font-bold text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950 shadow-xs'
                        : 'bg-emerald-800 text-emerald-200 hover:bg-emerald-700'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    <span>{ins.code}</span>
                    <span className="text-[10px] opacity-75">
                      ({ins.voyage?.title || 'Voyage'})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
