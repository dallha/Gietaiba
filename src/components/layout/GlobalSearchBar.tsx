import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  Users,
  Calendar,
  FileCheck,
  ChevronRight,
  Plane,
  Phone,
  CreditCard,
  CornerDownLeft,
  ArrowRight,
  ShieldCheck,
  Building,
} from 'lucide-react';
import { Client, Voyage, Inscription } from '../../types.js';
import { formatFCFA, formatDate, getPaymentStatusBadge } from '../../utils/format.js';

interface GlobalSearchBarProps {
  clients?: Client[];
  voyages?: Voyage[];
  inscriptions?: Inscription[];
  onSelectClient?: (client: Client) => void;
  onSelectVoyage?: (voyage: Voyage) => void;
  onSelectInscription?: (inscription: Inscription) => void;
  onNavigate?: (module: string) => void;
}

type SearchResultItem =
  | { type: 'client'; data: Client; id: string }
  | { type: 'voyage'; data: Voyage; id: string }
  | { type: 'inscription'; data: Inscription; id: string };

function normalizeText(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({
  clients = [],
  voyages = [],
  inscriptions = [],
  onSelectClient,
  onSelectVoyage,
  onSelectInscription,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'CLIENT' | 'VOYAGE' | 'INSCRIPTION'>('ALL');

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  // Global shortcut Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setIsMobileModalOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter logic across Clients, Voyages, Inscriptions
  const searchResults = useMemo(() => {
    const norm = normalizeText(query);
    if (!norm) {
      return {
        clients: [],
        voyages: [],
        inscriptions: [],
        total: 0,
      };
    }

    const matchedClients = clients
      .filter((c) => {
        const fullName = `${c.firstName} ${c.lastName}`;
        const reverseName = `${c.lastName} ${c.firstName}`;
        return (
          normalizeText(fullName).includes(norm) ||
          normalizeText(reverseName).includes(norm) ||
          normalizeText(c.code).includes(norm) ||
          (c.phone && normalizeText(c.phone).includes(norm)) ||
          (c.whatsapp && normalizeText(c.whatsapp).includes(norm)) ||
          (c.passportNumber && normalizeText(c.passportNumber).includes(norm)) ||
          (c.email && normalizeText(c.email).includes(norm)) ||
          (c.nationality && normalizeText(c.nationality).includes(norm))
        );
      })
      .slice(0, 6);

    const matchedVoyages = voyages
      .filter((v) => {
        return (
          normalizeText(v.title).includes(norm) ||
          normalizeText(v.code).includes(norm) ||
          normalizeText(v.type).includes(norm) ||
          (v.description && normalizeText(v.description).includes(norm)) ||
          (v.year && v.year.toString().includes(norm))
        );
      })
      .slice(0, 5);

    const matchedInscriptions = inscriptions
      .filter((ins) => {
        const clientName = `${ins.client?.firstName || ''} ${ins.client?.lastName || ''}`;
        const clientReverse = `${ins.client?.lastName || ''} ${ins.client?.firstName || ''}`;
        return (
          normalizeText(ins.code).includes(norm) ||
          normalizeText(clientName).includes(norm) ||
          normalizeText(clientReverse).includes(norm) ||
          (ins.client?.phone && normalizeText(ins.client.phone).includes(norm)) ||
          (ins.voyage?.code && normalizeText(ins.voyage.code).includes(norm)) ||
          (ins.voyage?.title && normalizeText(ins.voyage.title).includes(norm)) ||
          (ins.package?.name && normalizeText(ins.package.name).includes(norm)) ||
          (ins.paymentStatus && normalizeText(ins.paymentStatus).includes(norm))
        );
      })
      .slice(0, 6);

    const total = matchedClients.length + matchedVoyages.length + matchedInscriptions.length;

    return {
      clients: matchedClients,
      voyages: matchedVoyages,
      inscriptions: matchedInscriptions,
      total,
    };
  }, [query, clients, voyages, inscriptions]);

  // Flattened results based on active category for keyboard navigation
  const flatResults = useMemo<SearchResultItem[]>(() => {
    const list: SearchResultItem[] = [];

    if (activeCategory === 'ALL' || activeCategory === 'CLIENT') {
      searchResults.clients.forEach((c) => list.push({ type: 'client', data: c, id: c.id }));
    }
    if (activeCategory === 'ALL' || activeCategory === 'VOYAGE') {
      searchResults.voyages.forEach((v) => list.push({ type: 'voyage', data: v, id: v.id }));
    }
    if (activeCategory === 'ALL' || activeCategory === 'INSCRIPTION') {
      searchResults.inscriptions.forEach((i) => list.push({ type: 'inscription', data: i, id: i.id }));
    }

    return list;
  }, [searchResults, activeCategory]);

  // Reset selected index when flatResults change
  useEffect(() => {
    setSelectedIndex(0);
  }, [flatResults.length, activeCategory]);

  const handleSelect = (item: SearchResultItem) => {
    setIsOpen(false);
    setIsMobileModalOpen(false);

    if (item.type === 'client') {
      if (onSelectClient) {
        onSelectClient(item.data);
      } else if (onNavigate) {
        onNavigate('clients');
      }
    } else if (item.type === 'voyage') {
      if (onSelectVoyage) {
        onSelectVoyage(item.data);
      } else if (onNavigate) {
        onNavigate('voyages');
      }
    } else if (item.type === 'inscription') {
      if (onSelectInscription) {
        onSelectInscription(item.data);
      } else if (onNavigate) {
        onNavigate('inscriptions');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < flatResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : flatResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatResults[selectedIndex]) {
        handleSelect(flatResults[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const clearSearch = () => {
    setQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Render Result Content helper
  const renderDropdownContent = () => {
    if (!query.trim()) {
      return (
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs">
            <span className="font-bold text-slate-800">Recherche rapide ERP</span>
            <span className="text-[11px] text-slate-400">Raccourci : ⌘K ou Ctrl+K</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              onClick={() => {
                setQuery('HAJ');
                setIsOpen(true);
              }}
              className="p-3 text-left rounded-xl bg-slate-50 hover:bg-amber-50/60 border border-slate-200/80 hover:border-amber-300 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2 text-amber-700 font-bold text-xs mb-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Campagnes Hajj</span>
              </div>
              <p className="text-[11px] text-slate-500">Rechercher les éditions et rotations Hajj</p>
            </button>

            <button
              onClick={() => {
                setQuery('OUM');
                setIsOpen(true);
              }}
              className="p-3 text-left rounded-xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-300 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs mb-1">
                <Plane className="w-3.5 h-3.5" />
                <span>Oumrah Ramadan</span>
              </div>
              <p className="text-[11px] text-slate-500">Explorer les programmes Oumrah</p>
            </button>

            <button
              onClick={() => {
                setQuery('INS-');
                setIsOpen(true);
              }}
              className="p-3 text-left rounded-xl bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-300 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs mb-1">
                <FileCheck className="w-3.5 h-3.5" />
                <span>Inscriptions</span>
              </div>
              <p className="text-[11px] text-slate-500">Trouver un dossier par référence</p>
            </button>
          </div>

          {/* Active Campaigns Quick List */}
          {voyages.length > 0 && (
            <div className="pt-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Campagnes Actives
              </div>
              <div className="space-y-1">
                {voyages.slice(0, 3).map((v) => (
                  <div
                    key={v.id}
                    onClick={() => handleSelect({ type: 'voyage', data: v, id: v.id })}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 text-xs cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="font-semibold text-slate-800">{v.title}</span>
                      <span className="font-mono text-[10px] bg-slate-200/70 text-slate-700 px-1.5 py-0.5 rounded">
                        {v.code}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">{formatDate(v.departureDate)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (searchResults.total === 0) {
      return (
        <div className="p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <Search className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Aucun résultat trouvé</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Aucun pèlerin, voyage ou dossier d'inscription ne correspond à «{' '}
              <strong className="text-slate-700">{query}</strong> ».
            </p>
          </div>
          <div className="pt-2 text-[11px] text-slate-400">
            💡 Astuce : Essayez avec un prénom, nom de famille, numéro de téléphone (+221), N° de passeport ou code (ex:{' '}
            <span className="font-mono">CLI-</span>, <span className="font-mono">HAJ</span>,{' '}
            <span className="font-mono">INS-</span>).
          </div>
        </div>
      );
    }

    let runningIndex = 0;

    return (
      <div className="flex flex-col max-h-[70vh] sm:max-h-[500px]">
        {/* Results Category Pills */}
        <div className="p-2.5 bg-slate-50/90 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto text-xs shrink-0">
          <button
            onClick={() => setActiveCategory('ALL')}
            className={`px-2.5 py-1 rounded-full font-bold text-[11px] transition-all cursor-pointer ${
              activeCategory === 'ALL'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            Tous ({searchResults.total})
          </button>

          {searchResults.clients.length > 0 && (
            <button
              onClick={() => setActiveCategory('CLIENT')}
              className={`px-2.5 py-1 rounded-full font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategory === 'CLIENT'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Users className="w-3 h-3" />
              Pèlerins ({searchResults.clients.length})
            </button>
          )}

          {searchResults.voyages.length > 0 && (
            <button
              onClick={() => setActiveCategory('VOYAGE')}
              className={`px-2.5 py-1 rounded-full font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategory === 'VOYAGE'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Calendar className="w-3 h-3" />
              Voyages ({searchResults.voyages.length})
            </button>
          )}

          {searchResults.inscriptions.length > 0 && (
            <button
              onClick={() => setActiveCategory('INSCRIPTION')}
              className={`px-2.5 py-1 rounded-full font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategory === 'INSCRIPTION'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <FileCheck className="w-3 h-3" />
              Inscriptions ({searchResults.inscriptions.length})
            </button>
          )}
        </div>

        {/* Scrollable Items */}
        <div className="overflow-y-auto p-2 space-y-4 divide-y divide-slate-100">
          {/* 1. CLIENTS / PÈLERINS */}
          {(activeCategory === 'ALL' || activeCategory === 'CLIENT') &&
            searchResults.clients.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 pt-1 pb-1 text-[10px] font-black uppercase tracking-wider text-amber-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3 h-3" />
                    Pèlerins & Clients
                  </span>
                  <span className="text-slate-400 font-medium lowercase">
                    {searchResults.clients.length} pèlerin(s)
                  </span>
                </div>

                {searchResults.clients.map((client) => {
                  const currentIndex = runningIndex++;
                  const isSelected = currentIndex === selectedIndex;
                  return (
                    <div
                      key={client.id}
                      onClick={() => handleSelect({ type: 'client', data: client, id: client.id })}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-amber-50/80 border-amber-300 text-slate-900 shadow-2xs'
                          : 'border-transparent hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-linear-to-br from-amber-500/20 to-amber-700/20 text-amber-800 font-bold flex items-center justify-center text-xs shrink-0 border border-amber-300/40">
                          {client.firstName ? client.firstName[0] : 'P'}
                          {client.lastName ? client.lastName[0] : ''}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs truncate">
                              {client.civility} {client.lastName} {client.firstName}
                            </span>
                            <span className="font-mono text-[10px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                              {client.code}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5 truncate">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {client.phone}
                            </span>
                            {client.passportNumber ? (
                              <span className="font-mono text-slate-600">
                                Pass : <strong className="text-slate-800">{client.passportNumber}</strong>
                              </span>
                            ) : (
                              <span className="text-rose-500 italic text-[10px]">Passeport en attente</span>
                            )}
                            <span className="text-slate-400 hidden sm:inline">{client.nationality}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100/70 text-amber-900 border border-amber-200">
                          Consulter fiche
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          {/* 2. CAMPAGNES & VOYAGES */}
          {(activeCategory === 'ALL' || activeCategory === 'VOYAGE') &&
            searchResults.voyages.length > 0 && (
              <div className="space-y-1 pt-2">
                <div className="px-2 pt-1 pb-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    Campagnes & Voyages
                  </span>
                  <span className="text-slate-400 font-medium lowercase">
                    {searchResults.voyages.length} voyage(s)
                  </span>
                </div>

                {searchResults.voyages.map((voyage) => {
                  const currentIndex = runningIndex++;
                  const isSelected = currentIndex === selectedIndex;
                  const isHajj = voyage.type === 'HAJJ';
                  return (
                    <div
                      key={voyage.id}
                      onClick={() => handleSelect({ type: 'voyage', data: voyage, id: voyage.id })}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-emerald-50/80 border-emerald-300 text-slate-900 shadow-2xs'
                          : 'border-transparent hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs shrink-0 font-bold border ${
                            isHajj
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-indigo-100 text-indigo-800 border-indigo-300'
                          }`}
                        >
                          {isHajj ? <Calendar className="w-4 h-4" /> : <Plane className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs truncate">{voyage.title}</span>
                            <span className="font-mono text-[10px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                              {voyage.code}
                            </span>
                            <span
                              className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded border ${
                                isHajj
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                              }`}
                            >
                              {voyage.type}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                            <span>Départ : {formatDate(voyage.departureDate)}</span>
                            <span>•</span>
                            <span>Capacité : {voyage.capacity} places</span>
                            <span className="hidden sm:inline">• Statut : {voyage.status}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100/70 text-emerald-900 border border-emerald-200">
                          Voir campagne
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          {/* 3. INSCRIPTIONS */}
          {(activeCategory === 'ALL' || activeCategory === 'INSCRIPTION') &&
            searchResults.inscriptions.length > 0 && (
              <div className="space-y-1 pt-2">
                <div className="px-2 pt-1 pb-1 text-[10px] font-black uppercase tracking-wider text-indigo-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FileCheck className="w-3 h-3" />
                    Dossiers d'Inscription
                  </span>
                  <span className="text-slate-400 font-medium lowercase">
                    {searchResults.inscriptions.length} dossier(s)
                  </span>
                </div>

                {searchResults.inscriptions.map((ins) => {
                  const currentIndex = runningIndex++;
                  const isSelected = currentIndex === selectedIndex;
                  const payBadge = getPaymentStatusBadge(ins.paymentStatus);
                  const remaining =
                    ins.balance !== undefined
                      ? ins.balance
                      : Math.max(0, ins.appliedPrice - (ins.totalPaid || 0));

                  return (
                    <div
                      key={ins.id}
                      onClick={() => handleSelect({ type: 'inscription', data: ins, id: ins.id })}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-indigo-50/80 border-indigo-300 text-slate-900 shadow-2xs'
                          : 'border-transparent hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center text-xs shrink-0 border border-indigo-300">
                          <FileCheck className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-indigo-950 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                              {ins.code}
                            </span>
                            <span className="font-bold text-slate-900 text-xs truncate">
                              {ins.client?.lastName} {ins.client?.firstName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5 text-[11px] text-slate-500 mt-0.5 truncate">
                            <span className="text-slate-700 font-medium">
                              {ins.voyage?.code || 'Campagne'}
                            </span>
                            {ins.package && (
                              <>
                                <span>•</span>
                                <span className="text-amber-800 font-medium">{ins.package.name}</span>
                              </>
                            )}
                            <span>•</span>
                            <span className="font-medium text-slate-600">
                              Reste : <strong className="text-rose-700">{formatFCFA(remaining)}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${payBadge.bg}`}>
                          {payBadge.label}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>

        {/* Footer shortcuts */}
        <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-slate-700 font-bold">
                ↑↓
              </kbd>{' '}
              Naviguer
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-slate-700 font-bold">
                ↵
              </kbd>{' '}
              Sélectionner
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-slate-700 font-bold">
                Échap
              </kbd>{' '}
              Fermer
            </span>
          </div>
          <span className="font-medium text-slate-600">
            {searchResults.total} résultat{searchResults.total > 1 ? 's' : ''} au total
          </span>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Search Bar */}
      <div ref={containerRef} className="relative hidden md:block w-full max-w-xs lg:max-w-md mx-3">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Rechercher pèlerins, voyages, dossiers..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            className="w-full pl-9 pr-16 py-1.5 bg-slate-800/90 hover:bg-slate-800 focus:bg-slate-900 border border-slate-700 text-xs rounded-lg text-white placeholder-slate-400 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-inner"
          />

          <div className="absolute right-2.5 flex items-center gap-1">
            {query ? (
              <button
                type="button"
                onClick={clearSearch}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700 cursor-pointer"
                title="Effacer la recherche"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-700/60 rounded border border-slate-600/50">
                ⌘K
              </kbd>
            )}
          </div>
        </div>

        {/* Real-time dropdown */}
        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in-0 zoom-in-95 duration-100">
            {renderDropdownContent()}
          </div>
        )}
      </div>

      {/* Mobile Search Button Trigger */}
      <button
        onClick={() => {
          setIsMobileModalOpen(true);
          setTimeout(() => mobileInputRef.current?.focus(), 50);
        }}
        className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        title="Recherche globale"
        aria-label="Recherche globale"
      >
        <Search className="w-5 h-5" />
      </button>

      {/* Mobile Search Overlay Modal */}
      {isMobileModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex flex-col p-3 md:hidden">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-full overflow-hidden">
            {/* Input Header */}
            <div className="p-3 border-b border-slate-200 flex items-center gap-2">
              <Search className="w-4 h-4 text-amber-600 shrink-0" />
              <input
                ref={mobileInputRef}
                type="text"
                placeholder="Rechercher pèlerins, voyages, inscriptions..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden"
              />
              {query && (
                <button onClick={() => setQuery('')} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsMobileModalOpen(false)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold shrink-0 cursor-pointer"
              >
                Fermer
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">{renderDropdownContent()}</div>
          </div>
        </div>
      )}
    </>
  );
};
