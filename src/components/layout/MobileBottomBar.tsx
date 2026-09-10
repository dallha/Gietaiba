import React from 'react';
import {
  LayoutDashboard,
  Users,
  FileCheck,
  Stamp,
  CreditCard,
  AlertCircle,
  TrendingDown,
  Plus
} from 'lucide-react';
import { normalizeRole } from '../../auth/roleModules.js';

interface MobileBottomBarProps {
  activeModule: string;
  onNavigate: (module: string) => void;
  roleId?: string;
  onOpenQuickAction: () => void;
}

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  activeModule,
  onNavigate,
  roleId,
  onOpenQuickAction,
}) => {
  const normRole = normalizeRole(roleId);
  const isAgent = normRole === 'AGENT';
  const isComptable = normRole === 'COMPTABLE';

  // Navigation items based on role (4 tabs around the central FAB)
  const tabs = isAgent
    ? [
        { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
        { id: 'clients', label: 'Pèlerins', icon: Users },
        // FAB in center
        { id: 'inscriptions', label: 'Dossiers', icon: FileCheck },
        { id: 'visas', label: 'Visas', icon: Stamp },
      ]
    : isComptable
    ? [
        { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
        { id: 'paiements', label: 'Finances', icon: CreditCard },
        // FAB in center
        { id: 'recouvrement', label: 'Recouvr.', icon: AlertCircle },
        { id: 'depenses', label: 'Dépenses', icon: TrendingDown },
      ]
    : [
        { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
        { id: 'clients', label: 'Pèlerins', icon: Users },
        // FAB in center
        { id: 'inscriptions', label: 'Dossiers', icon: FileCheck },
        { id: 'paiements', label: 'Finances', icon: CreditCard },
      ];

  const leftTabs = tabs.slice(0, 2);
  const rightTabs = tabs.slice(2, 4);

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 shadow-2xl safe-bottom-pad">
      <div className="max-w-md mx-auto px-3 py-1.5 flex items-center justify-between relative">
        {/* Left 2 Tabs */}
        <div className="flex items-center justify-around flex-1">
          {leftTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeModule === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onNavigate(tab.id)}
                className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all duration-150 cursor-pointer min-w-[56px] ${
                  isActive
                    ? 'text-amber-400 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                aria-label={tab.label}
              >
                <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-amber-400 stroke-[2.4]' : 'text-slate-400 stroke-[1.8]'}`} />
                <span className={`text-[10px] tracking-tight ${isActive ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Center Prominent FAB (+) */}
        <div className="px-2 shrink-0 flex items-center justify-center -mt-5">
          <button
            onClick={onOpenQuickAction}
            className="w-13 h-13 rounded-full bg-gradient-to-tr from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 active:scale-95 text-slate-950 font-black shadow-lg shadow-amber-900/40 border-4 border-slate-900 flex items-center justify-center cursor-pointer transition-all duration-150"
            aria-label="Nouvelle Action Rapide"
            title="Action Rapide"
          >
            <Plus className="w-6 h-6 stroke-[3] text-slate-950" />
          </button>
        </div>

        {/* Right 2 Tabs */}
        <div className="flex items-center justify-around flex-1">
          {rightTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeModule === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onNavigate(tab.id)}
                className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all duration-150 cursor-pointer min-w-[56px] ${
                  isActive
                    ? 'text-amber-400 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                aria-label={tab.label}
              >
                <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-amber-400 stroke-[2.4]' : 'text-slate-400 stroke-[1.8]'}`} />
                <span className={`text-[10px] tracking-tight ${isActive ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
