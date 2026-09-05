import React from 'react';
import { 
  Plane, 
  Building, 
  MapPin, 
  Calendar, 
  Clock, 
  Users, 
  ShieldCheck, 
  Bed, 
  Phone
} from 'lucide-react';
import { Inscription, Flight, Hotel, Room, Group } from '../../types.js';
import { formatDate } from '../../utils/format.js';

interface PilgrimLogisticsViewProps {
  activeInscription: Inscription | null;
  flight: Flight | null;
  hotelMakkah: Hotel | null;
  hotelMadinah: Hotel | null;
  room: Room | null;
  group: Group | null;
}

export const PilgrimLogisticsView: React.FC<PilgrimLogisticsViewProps> = ({
  activeInscription,
  flight,
  hotelMakkah,
  hotelMadinah,
  room,
  group,
}) => {
  if (!activeInscription) {
    return (
      <div className="bg-white rounded-3xl p-8 text-center border border-slate-200">
        <p className="text-slate-500 text-xs">Veuillez d'abord sélectionner un dossier actif.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Plane className="w-6 h-6 text-blue-600" />
          <span>Vols, Hébergements & Encadrement</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Organisation logistique et attributions officielles pour votre séjour aux Lieux Saints
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Flight Logistics */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2 border-b border-slate-100 pb-3">
            <Plane className="w-4 h-4 text-blue-600" />
            <span>Transport Aérien & Vols</span>
          </h3>

          {flight ? (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-blue-950 text-sm">
                    {flight.airline || 'Compagnie Aérienne Agréée'}
                  </span>
                  <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-800">
                    {flight.flightNumber || 'DIRECT'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Aéroport de Départ</span>
                    <span className="font-bold text-slate-800">{flight.departureAirport || 'Dakar (AIBD)'}</span>
                    <span className="text-slate-500 text-[10px] block">
                      {flight.departureDate ? formatDate(flight.departureDate) : 'Date fixée'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Aéroport d'Arrivée</span>
                    <span className="font-bold text-slate-800">{flight.arrivalAirport || 'Jeddah (JED)'}</span>
                    <span className="text-slate-500 text-[10px] block">
                      {flight.arrivalDate ? formatDate(flight.arrivalDate) : 'Date fixée'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-600">
                Poids bagages autorisés : <strong>2 x 23 kg en soute + 7 kg en cabine</strong> (selon réglementation IATA et Taiba).
              </div>
            </div>
          ) : (
            <div className="p-6 bg-slate-50 rounded-2xl text-center text-slate-400 text-xs space-y-1">
              <p className="font-bold text-slate-700">Attribution des vols en cours</p>
              <p>Votre convocation officielle avec numéro de vol et terminal vous sera notifiée dès validation du plan de vol.</p>
            </div>
          )}
        </div>

        {/* Accommodation Logistics */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building className="w-4 h-4 text-amber-600" />
            <span>Hôtels aux Lieux Saints</span>
          </h3>

          <div className="space-y-3 text-xs">
            {/* Makkah */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                Makkah Al-Mukarramah
              </span>
              <p className="font-black text-slate-900 text-sm">
                {hotelMakkah?.name || 'Hôtel Standing Makkah (Proximité Haram)'}
              </p>
              <p className="text-slate-500 text-[11px]">
                {hotelMakkah?.address || 'Couronne proche du Sanctuaire sacré'}
              </p>
            </div>

            {/* Madinah */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                Madinah Al-Munawwarah
              </span>
              <p className="font-black text-slate-900 text-sm">
                {hotelMadinah?.name || 'Hôtel Standing Madinah (Proximité Al-Masjid An-Nabawi)'}
              </p>
              <p className="text-slate-500 text-[11px]">
                {hotelMadinah?.address || 'Zone centrale Nord / Sud'}
              </p>
            </div>

            {/* Room type if any */}
            {room && (
              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 flex items-center gap-2 text-emerald-950 font-medium">
                <Bed className="w-4 h-4 text-emerald-700" />
                <span>Chambre attribuée : {room.roomNumber} ({room.type || 'Standard'})</span>
              </div>
            )}
          </div>
        </div>

        {/* Group and Guidance Logistics */}
        <div className="md:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2 border-b border-slate-100 pb-3">
            <Users className="w-4 h-4 text-emerald-700" />
            <span>Encadrement Religieux & Médical</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="font-bold text-slate-900">Guide Religieux & Rites</p>
              <p className="text-slate-500 mt-1">
                {group?.leaderName || 'Oustaz / Guide officiel Taiba Voyages'}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">Conférences et séances d'orientation programmées.</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="font-bold text-slate-900">Assistance Médicale</p>
              <p className="text-slate-500 mt-1">
                Médecin de mission Taiba Voyages disponible 24h/24
              </p>
              <p className="text-[10px] text-slate-400 mt-1">Pharmacie de secours et suivi sanitaire.</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="font-bold text-slate-900">Commission Logistique</p>
              <p className="text-slate-500 mt-1">
                Accueil et transfert sécurisé aéroport - hôtels
              </p>
              <p className="text-[10px] text-slate-400 mt-1">Bus climatisés agréés Commission Hajj.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
