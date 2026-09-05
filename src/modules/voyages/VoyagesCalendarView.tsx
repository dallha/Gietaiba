import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  PlaneTakeoff,
  PlaneLanding,
  CreditCard,
  FileCheck2,
  Calendar as CalendarIcon,
  Clock,
  Users,
  AlertTriangle,
  Info,
  X,
  Filter,
} from 'lucide-react';
import { Voyage, Inscription } from '../../types.js';
import { formatDate } from '../../utils/format.js';

interface CalendarEvent {
  id: string;
  voyageId: string;
  voyageCode: string;
  voyageTitle: string;
  voyageType: string;
  eventType: 'DEPART' | 'RETOUR' | 'PAYMENT_DEADLINE' | 'DOCS_DEADLINE';
  title: string;
  date: string; // YYYY-MM-DD
  voyage: Voyage;
}

interface VoyagesCalendarViewProps {
  voyages: Voyage[];
  inscriptions: Inscription[];
  onSelectVoyage?: (voyage: Voyage) => void;
}

export const VoyagesCalendarView: React.FC<VoyagesCalendarViewProps> = ({
  voyages,
  inscriptions,
  onSelectVoyage,
}) => {
  // Find initial month from first scheduled voyage or current date
  const initialDate = useMemo(() => {
    if (voyages.length > 0 && voyages[0].departureDate) {
      const d = new Date(voyages[0].departureDate);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  }, [voyages]);

  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth()); // 0-indexed
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState<'ALL' | 'FLIGHTS' | 'PAYMENT' | 'DOCS'>('ALL');
  const [voyageTypeFilter, setVoyageTypeFilter] = useState<'ALL' | 'HAJJ' | 'OUMRAH'>('ALL');

  // Compute all key events across voyages
  const allEvents: CalendarEvent[] = useMemo(() => {
    const events: CalendarEvent[] = [];

    voyages.forEach((voyage) => {
      // 1. Departure Date
      if (voyage.departureDate) {
        events.push({
          id: `dep-${voyage.id}`,
          voyageId: voyage.id,
          voyageCode: voyage.code,
          voyageTitle: voyage.title,
          voyageType: voyage.type,
          eventType: 'DEPART',
          title: `Départ : ${voyage.title}`,
          date: voyage.departureDate.split('T')[0],
          voyage,
        });
      }

      // 2. Return Date
      if (voyage.returnDate) {
        events.push({
          id: `ret-${voyage.id}`,
          voyageId: voyage.id,
          voyageCode: voyage.code,
          voyageTitle: voyage.title,
          voyageType: voyage.type,
          eventType: 'RETOUR',
          title: `Retour Dakar : ${voyage.title}`,
          date: voyage.returnDate.split('T')[0],
          voyage,
        });
      }

      // 3. Payment Deadline (15 days before departure or explicit)
      if (voyage.departureDate) {
        const depD = new Date(voyage.departureDate);
        if (!isNaN(depD.getTime())) {
          const payD = new Date(depD);
          payD.setDate(payD.getDate() - 15);
          const payDateStr = payD.toISOString().split('T')[0];

          events.push({
            id: `pay-${voyage.id}`,
            voyageId: voyage.id,
            voyageCode: voyage.code,
            voyageTitle: voyage.title,
            voyageType: voyage.type,
            eventType: 'PAYMENT_DEADLINE',
            title: `Date Limite Solde : ${voyage.code}`,
            date: payDateStr,
            voyage,
          });
        }
      }

      // 4. Documents & Visas Deadline (30 days before departure)
      if (voyage.departureDate) {
        const depD = new Date(voyage.departureDate);
        if (!isNaN(depD.getTime())) {
          const docD = new Date(depD);
          docD.setDate(docD.getDate() - 30);
          const docDateStr = docD.toISOString().split('T')[0];

          events.push({
            id: `doc-${voyage.id}`,
            voyageId: voyage.id,
            voyageCode: voyage.code,
            voyageTitle: voyage.title,
            voyageType: voyage.type,
            eventType: 'DOCS_DEADLINE',
            title: `Clôture Visas & GED : ${voyage.code}`,
            date: docDateStr,
            voyage,
          });
        }
      }
    });

    return events;
  }, [voyages]);

  // Filter events
  const filteredEvents = useMemo(() => {
    return allEvents.filter((ev) => {
      // Voyage type filter
      if (voyageTypeFilter !== 'ALL' && ev.voyageType !== voyageTypeFilter) {
        return false;
      }
      // Event type filter
      if (eventTypeFilter === 'FLIGHTS' && ev.eventType !== 'DEPART' && ev.eventType !== 'RETOUR') {
        return false;
      }
      if (eventTypeFilter === 'PAYMENT' && ev.eventType !== 'PAYMENT_DEADLINE') {
        return false;
      }
      if (eventTypeFilter === 'DOCS' && ev.eventType !== 'DOCS_DEADLINE') {
        return false;
      }
      return true;
    });
  }, [allEvents, eventTypeFilter, voyageTypeFilter]);

  // Navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const handleCurrentMonth = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  };

  // Month metadata
  const monthNames = [
    'Janvier',
    'Février',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Août',
    'Septembre',
    'Octobre',
    'Novembre',
    'Décembre',
  ];

  const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  // Calendar grid calculation
  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    // Days in current month
    const totalDays = lastDayOfMonth.getDate();

    // Day of week for 1st of month: JS getDay() gives 0 for Sunday, 1 for Monday...
    // Adjust so 0 = Monday, 6 = Sunday
    let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startingDayOfWeek === -1) startingDayOfWeek = 6;

    // Previous month filler days
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    const cells = [];

    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const monthStr = String(prevMonth + 1).padStart(2, '0');
      const dayStr = String(dayNum).padStart(2, '0');
      const dateStr = `${prevYear}-${monthStr}-${dayStr}`;

      cells.push({
        dayNum,
        dateStr,
        isCurrentMonth: false,
        isToday: false,
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const monthStr = String(currentMonth + 1).padStart(2, '0');
      const dayStr = String(i).padStart(2, '0');
      const dateStr = `${currentYear}-${monthStr}-${dayStr}`;

      cells.push({
        dayNum: i,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Next month filler days to complete 35 or 42 grid cells
    const remaining = 42 - cells.length;
    for (let i = 1; i <= (remaining >= 7 ? remaining - 7 : remaining); i++) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const monthStr = String(nextMonth + 1).padStart(2, '0');
      const dayStr = String(i).padStart(2, '0');
      const dateStr = `${nextYear}-${monthStr}-${dayStr}`;

      cells.push({
        dayNum: i,
        dateStr,
        isCurrentMonth: false,
        isToday: false,
      });
    }

    return cells;
  }, [currentYear, currentMonth]);

  // Style badge per event type
  const getEventBadgeStyle = (type: CalendarEvent['eventType']) => {
    switch (type) {
      case 'DEPART':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100',
          icon: PlaneTakeoff,
          label: 'Départ',
        };
      case 'RETOUR':
        return {
          bg: 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100',
          icon: PlaneLanding,
          label: 'Retour',
        };
      case 'PAYMENT_DEADLINE':
        return {
          bg: 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100',
          icon: CreditCard,
          label: 'Limite Solde',
        };
      case 'DOCS_DEADLINE':
      default:
        return {
          bg: 'bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-100',
          icon: FileCheck2,
          label: 'Clôture Visas',
        };
    }
  };

  // Jump directly to scheduled voyage months
  const voyageShortcuts = useMemo(() => {
    return voyages.filter((v) => v.departureDate).map((v) => {
      const d = new Date(v.departureDate);
      return {
        id: v.id,
        code: v.code,
        title: v.title,
        year: d.getFullYear(),
        month: d.getMonth(),
        monthLabel: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
      };
    });
  }, [voyages]);

  return (
    <div className="space-y-5">
      {/* Calendar Controls Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Month Navigation */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-white text-slate-700 hover:text-slate-900 transition-all cursor-pointer"
              title="Mois précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleCurrentMonth}
              className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer"
            >
              Aujourd'hui
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-white text-slate-700 hover:text-slate-900 transition-all cursor-pointer"
              title="Mois suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
            {monthNames[currentMonth]} {currentYear}
          </h2>
        </div>

        {/* Shortcuts to voyage seasons */}
        {voyageShortcuts.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <span className="text-[11px] font-semibold text-slate-400 shrink-0">Saisons :</span>
            {voyageShortcuts.map((sc) => (
              <button
                key={sc.id}
                onClick={() => {
                  setCurrentYear(sc.year);
                  setCurrentMonth(sc.month);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-colors cursor-pointer ${
                  currentYear === sc.year && currentMonth === sc.month
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {sc.code} ({sc.monthLabel})
              </button>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Event Filter */}
          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-2.5 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <option value="ALL">Tous les jalons</option>
            <option value="FLIGHTS">Départs & Retours</option>
            <option value="PAYMENT">Dates Limites de Paiement</option>
            <option value="DOCS">Clôture Visas & GED</option>
          </select>

          {/* Voyage Type Filter */}
          <select
            value={voyageTypeFilter}
            onChange={(e) => setVoyageTypeFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-2.5 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <option value="ALL">Hajj & Oumrah</option>
            <option value="HAJJ">Hajj Uniquement</option>
            <option value="OUMRAH">Oumrah Uniquement</option>
          </select>
        </div>
      </div>

      {/* Legend Bar */}
      <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
        <span className="font-bold text-slate-600 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          Légende officielle :
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-300">
          <PlaneTakeoff className="w-3 h-3 text-emerald-700" />
          Départs Officiels
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[11px] font-bold border border-blue-300">
          <PlaneLanding className="w-3 h-3 text-blue-700" />
          Retours Dakar
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[11px] font-bold border border-rose-300">
          <CreditCard className="w-3 h-3 text-rose-700" />
          Deadlines Paiement Solde (J-15)
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[11px] font-bold border border-purple-300">
          <FileCheck2 className="w-3 h-3 text-purple-700" />
          Clôture Dépôt Visas & Passeports (J-30)
        </span>
      </div>

      {/* Monthly Calendar Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Days of week header */}
        <div className="grid grid-cols-7 bg-slate-900 text-amber-400 text-center font-bold text-xs py-3 border-b border-slate-800">
          {daysOfWeek.map((day) => (
            <div key={day} className="tracking-wide uppercase text-[11px]">
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day.slice(0, 3)}</span>
            </div>
          ))}
        </div>

        {/* Calendar Day Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
          {calendarCells.map((cell, idx) => {
            const dayEvents = filteredEvents.filter((ev) => ev.date === cell.dateStr);

            return (
              <div
                key={idx}
                className={`min-h-24 sm:min-h-32 p-1.5 sm:p-2 transition-colors flex flex-col justify-between ${
                  cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/70 text-slate-400'
                } ${cell.isToday ? 'bg-amber-50/50' : ''}`}
              >
                {/* Day Number Header */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                      cell.isToday
                        ? 'bg-amber-600 text-white font-black shadow-xs'
                        : cell.isCurrentMonth
                        ? 'text-slate-800'
                        : 'text-slate-400'
                    }`}
                  >
                    {cell.dayNum}
                  </span>

                  {dayEvents.length > 0 && (
                    <span className="text-[10px] font-black text-amber-700 bg-amber-100/80 px-1 rounded">
                      {dayEvents.length}
                    </span>
                  )}
                </div>

                {/* Day Events Container */}
                <div className="space-y-1 mt-1 flex-1 overflow-y-auto max-h-20 sm:max-h-24">
                  {dayEvents.map((ev) => {
                    const style = getEventBadgeStyle(ev.eventType);
                    const Icon = style.icon;

                    return (
                      <button
                        key={ev.id}
                        onClick={() => setSelectedEvent(ev)}
                        className={`w-full text-left p-1 sm:p-1.5 rounded-md border text-[10px] sm:text-[11px] font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer truncate ${style.bg}`}
                        title={`${style.label} : ${ev.voyageTitle}`}
                      >
                        <Icon className="w-3 h-3 shrink-0" />
                        <span className="truncate">{ev.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Event Details Modal / Drawer */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-start justify-between border-b border-slate-800">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {selectedEvent.voyage.type} • {selectedEvent.voyage.year}
                    </span>
                    <span className="text-xs font-mono text-slate-300 font-bold">
                      {selectedEvent.voyage.code}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-white mt-1 leading-snug">
                    {selectedEvent.voyage.title}
                  </h3>
                </div>
              </div>

              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              {/* Event Badge Banner */}
              <div
                className={`p-3 rounded-xl border flex items-center gap-3 ${
                  getEventBadgeStyle(selectedEvent.eventType).bg
                }`}
              >
                <Clock className="w-5 h-5 shrink-0" />
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider">
                    {getEventBadgeStyle(selectedEvent.eventType).label}
                  </div>
                  <div className="text-sm font-black">
                    Date prévue : {formatDate(selectedEvent.date)}
                  </div>
                </div>
              </div>

              {/* Voyage Details Overview */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Départ Officiel</span>
                  <span className="font-bold text-slate-800">
                    {formatDate(selectedEvent.voyage.departureDate)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Retour Prévu</span>
                  <span className="font-bold text-slate-800">
                    {formatDate(selectedEvent.voyage.returnDate)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Capacité Totale</span>
                  <span className="font-bold text-slate-800">
                    {selectedEvent.voyage.capacity} pèlerins
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Inscriptions Actives</span>
                  <span className="font-bold text-emerald-700">
                    {inscriptions.filter((i) => i.voyageId === selectedEvent.voyage.id).length} inscrits
                  </span>
                </div>
              </div>

              {/* Explanation & Actionable instructions */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-amber-900 leading-relaxed text-[11px]">
                {selectedEvent.eventType === 'DEPART' && (
                  <p>
                    <strong>Convocation AIBD :</strong> Les pèlerins doivent se présenter au terminal pèlerinage 4 heures avant le décollage avec leurs passeports et visas biométriques imprimés.
                  </p>
                )}
                {selectedEvent.eventType === 'RETOUR' && (
                  <p>
                    <strong>Accueil des Pèlerins à Dakar :</strong> Accueil officiel de la délégation et logistique des bagages et eau de Zamzam à l'Aéroport International Blaise Diagne.
                  </p>
                )}
                {selectedEvent.eventType === 'PAYMENT_DEADLINE' && (
                  <p>
                    <strong>Échéance Comptable Critique :</strong> Tous les soldes débiteurs doivent impérativement être réglés à cette date sous peine de révocation de la réservation de vol.
                  </p>
                )}
                {selectedEvent.eventType === 'DOCS_DEADLINE' && (
                  <p>
                    <strong>Délai Consulaire Nusuk :</strong> Clôture définitive du dépôt des passeports physiques et attestations de vaccination auprès des services consulaires.
                  </p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
