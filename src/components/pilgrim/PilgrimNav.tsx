import React from 'react';
import { 
  Home, 
  Compass, 
  FileText, 
  CreditCard, 
  FileCheck2, 
  Plane, 
  QrCode, 
  User as UserIcon,
  Bell
} from 'lucide-react';
import { PilgrimTab } from './PilgrimTypes.js';

interface PilgrimNavProps {
  activeTab: PilgrimTab;
  onSelectTab: (tab: PilgrimTab) => void;
  unreadCount?: number;
}

const NAV_ITEMS: { id: PilgrimTab; label: string; shortLabel: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'accueil', label: 'Mon Espace', shortLabel: 'Accueil', icon: Home },
  { id: 'voyages', label: 'Mes Voyages', shortLabel: 'Voyages', icon: Compass },
  { id: 'dossier', label: 'Dossier Actif', shortLabel: 'Dossier', icon: FileText },
  { id: 'finances', label: 'Paiements & Reçus', shortLabel: 'Finances', icon: CreditCard },
  { id: 'documents', label: 'Pièces & GED', shortLabel: 'GED', icon: FileCheck2 },
  { id: 'logistique', label: 'Vols & Séjour', shortLabel: 'Logistique', icon: Plane },
  { id: 'badge', label: 'Badge & QR', shortLabel: 'Badge', icon: QrCode },
  { id: 'profil', label: 'Mon Profil', shortLabel: 'Profil', icon: UserIcon },
];

export const PilgrimNav: React.FC<PilgrimNavProps> = ({
  activeTab,
  onSelectTab,
}) => {
  return (
    <>
      {/* Desktop & Tablet Navigation Strip */}
      <div className="bg-white border-b border-slate-200 sticky top-14 z-20 shadow-xs hidden sm:block">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-2.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    isActive
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-200 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-700' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Floating Bottom Bar (Requirement 18: Mobile-first ergonomic navigation) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-xl px-2 py-1.5 flex items-center justify-around safe-area-bottom">
        {[
          { id: 'accueil' as PilgrimTab, label: 'Accueil', icon: Home },
          { id: 'voyages' as PilgrimTab, label: 'Voyages', icon: Compass },
          { id: 'finances' as PilgrimTab, label: 'Finances', icon: CreditCard },
          { id: 'documents' as PilgrimTab, label: 'GED', icon: FileCheck2 },
          { id: 'badge' as PilgrimTab, label: 'Badge', icon: QrCode },
          { id: 'profil' as PilgrimTab, label: 'Profil', icon: UserIcon },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition-colors cursor-pointer min-w-12 ${
                isActive ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-700' : 'text-slate-400'}`} />
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
};
