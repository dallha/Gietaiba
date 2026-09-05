import React, { useState } from 'react';
import {
  Plane,
  Building,
  Users2,
  Bed,
  Plus,
  Search,
  UserPlus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  X,
  Compass,
} from 'lucide-react';
import {
  Flight,
  Ticket,
  Hotel,
  Room,
  Group,
  Accompagnateur,
  Client,
  Inscription,
  AgencySettings,
} from '../../types.js';
import { formatDate, formatDateTime } from '../../utils/format.js';
import { SeatMap } from './SeatMap.js';

interface LogistiqueModuleProps {
  flights: Flight[];
  tickets: Ticket[];
  hotels: Hotel[];
  rooms: (Room & { occupants: Client[] })[];
  groups: (Group & { members: Client[] })[];
  accompagnateurs: Accompagnateur[];
  clients: Client[];
  inscriptions: Inscription[];
  settings?: AgencySettings;
  onRefresh: () => void;
  onAssignClientToRoom: (roomId: string, clientId: string, inscriptionId: string) => Promise<any>;
  onRemoveClientFromRoom: (roomId: string, clientId: string) => Promise<any>;
  onAddClientToGroup: (groupId: string, clientId: string, inscriptionId: string) => Promise<any>;
  onCreateFlight: (data: Partial<Flight>) => Promise<Flight>;
}

export const LogistiqueModule: React.FC<LogistiqueModuleProps> = ({
  flights,
  tickets,
  hotels,
  rooms,
  groups,
  accompagnateurs,
  clients,
  inscriptions,
  settings,
  onRefresh,
  onAssignClientToRoom,
  onRemoveClientFromRoom,
  onAddClientToGroup,
  onCreateFlight,
}) => {
  const [subTab, setSubTab] = useState<'hotels' | 'vols' | 'groupes'>('hotels');

  // Room Assignment Modal
  const [selectedRoomForAssign, setSelectedRoomForAssign] = useState<Room | null>(null);
  const [assignClientId, setAssignClientId] = useState('');

  // Group Assignment Modal
  const [selectedGroupForAssign, setSelectedGroupForAssign] = useState<Group | null>(null);
  const [groupAssignClientId, setGroupAssignClientId] = useState('');

  // Flight Seat Map
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [showSeatMap, setShowSeatMap] = useState(false);

  const handleAssignRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomForAssign || !assignClientId) return;
    const matchingIns = inscriptions.find((i) => i.clientId === assignClientId);
    try {
      await onAssignClientToRoom(selectedRoomForAssign.id, assignClientId, matchingIns?.id || '');
      setSelectedRoomForAssign(null);
      setAssignClientId('');
      onRefresh();
    } catch (err: any) {
      alert(`Erreur d'attribution : ${err.message}`);
    }
  };

  const handleRemoveFromRoom = async (roomId: string, clientId: string) => {
    if (!confirm('Désassigner ce pèlerin de cette chambre ?')) return;
    try {
      await onRemoveClientFromRoom(roomId, clientId);
      onRefresh();
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    }
  };

  const handleAssignGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupForAssign || !groupAssignClientId) return;
    const matchingIns = inscriptions.find((i) => i.clientId === groupAssignClientId);
    try {
      await onAddClientToGroup(selectedGroupForAssign.id, groupAssignClientId, matchingIns?.id || '');
      setSelectedGroupForAssign(null);
      setGroupAssignClientId('');
      onRefresh();
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Compass className="w-5 h-5 text-amber-600" />
            Logistique Séjour, Hôtels & Transports
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Gestion du plan de chambre (rooming list), vols charters/réguliers et groupes d'encadrement.
          </p>
        </div>

        {/* Sub-tab pills */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setSubTab('hotels')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              subTab === 'hotels' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hôtels & Chambres
          </button>
          <button
            onClick={() => setSubTab('vols')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              subTab === 'vols' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Vols & Billets
          </button>
          <button
            onClick={() => setSubTab('groupes')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              subTab === 'groupes' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Groupes & Encadrement
          </button>
        </div>
      </div>

      {/* SUBTAB 1: Hôtels & Chambres (Rooming List) */}
      {subTab === 'hotels' && (
        <div className="space-y-6">
          {/* Hotels Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hotels.map((hotel) => {
              const hotelRooms = rooms.filter((r) => r.hotelId === hotel.id);
              const totalBeds = hotelRooms.reduce((acc, r) => acc + r.capacity, 0);
              const occupiedBeds = hotelRooms.reduce((acc, r) => acc + (r.occupantIds?.length || 0), 0);
              return (
                <div key={hotel.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                        {hotel.city}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-1">{hotel.name}</h3>
                      <p className="text-xs text-slate-500">{hotel.distanceToHaram} du Haram</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block">Taux d'occupation</span>
                      <span className="text-base font-black text-emerald-700">
                        {totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0}%
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                    <span>{hotelRooms.length} chambres réservées</span>
                    <span>
                      {occupiedBeds} / {totalBeds} lits occupés
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rooms Grid with Visual Occupants */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Plan de Répartition des Chambres (Rooming)</h3>
                <p className="text-xs text-slate-500">Contrôle strict anti-dépassement de capacité par type de chambre</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map((room) => {
                const hotel = hotels.find((h) => h.id === room.hotelId);
                const isFull = (room.occupants?.length || 0) >= room.capacity;
                return (
                  <div
                    key={room.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isFull
                        ? 'bg-slate-50 border-slate-300'
                        : 'bg-white border-amber-200 hover:border-amber-300'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div>
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          Chambre {room.roomNumber}
                        </span>
                        <p className="text-[10px] text-slate-400">
                          {hotel?.city} — {hotel?.name}
                        </p>
                      </div>

                      <div className="text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isFull ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {room.occupants?.length || 0} / {room.capacity} Lits
                        </span>
                        <p className="text-[10px] text-slate-500 mt-0.5">{room.type}</p>
                      </div>
                    </div>

                    {/* Occupants list */}
                    <div className="py-3 space-y-1.5 min-h-[70px]">
                      {room.occupants && room.occupants.length > 0 ? (
                        room.occupants.map((occ) => (
                          <div
                            key={occ.id}
                            className="flex items-center justify-between bg-white px-2 py-1 rounded border border-slate-200 text-xs"
                          >
                            <span className="font-medium text-slate-800 truncate max-w-[170px]">
                              {occ.civility} {occ.lastName} {occ.firstName}
                            </span>
                            <button
                              onClick={() => handleRemoveFromRoom(room.id, occ.id)}
                              className="text-slate-400 hover:text-rose-600 p-0.5"
                              title="Retirer de la chambre"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-slate-400 italic py-2">Chambre entièrement libre</p>
                      )}
                    </div>

                    {/* Assign button */}
                    {!isFull && (
                      <button
                        onClick={() => setSelectedRoomForAssign(room)}
                        className="w-full mt-2 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold cursor-pointer transition-colors inline-flex items-center justify-center gap-1"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Attribuer un Lit
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: Vols & Billets */}
      {subTab === 'vols' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Programme des Vols Internationaux</h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <th className="py-3 px-4">N° Vol</th>
                    <th className="py-3 px-4">Compagnie</th>
                    <th className="py-3 px-4">Trajet / Itinéraire</th>
                    <th className="py-3 px-4">Départ</th>
                    <th className="py-3 px-4">Arrivée</th>
                    <th className="py-3 px-4 text-center">Places Allouées</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {flights.map((flight) => (
                    <tr key={flight.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{flight.flightNumber}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{flight.airline}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold">{flight.departureCity} ({flight.departureAirport})</span>
                        <span className="text-slate-400 mx-1.5">→</span>
                        <span className="font-bold">{flight.arrivalCity} ({flight.arrivalAirport})</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{formatDateTime(flight.departureDate)}</td>
                      <td className="py-3 px-4 text-slate-600">{formatDateTime(flight.arrivalDate)}</td>
                      <td className="py-3 px-4 text-center font-bold text-slate-900">{flight.capacity} sièges</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedFlightId(flight.id);
                            setShowSeatMap(true);
                          }}
                          className="px-2 py-1 bg-amber-100 text-amber-900 rounded text-[10px] font-bold hover:bg-amber-200"
                        >
                          Gérer les sièges
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {showSeatMap && selectedFlightId && (
            <SeatMap 
              flightId={selectedFlightId} 
              onClose={() => setShowSeatMap(false)} 
              clients={clients} 
            />
          )}

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Billets Émis aux Pèlerins</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <th className="py-3 px-4">N° Billet</th>
                    <th className="py-3 px-4">Pèlerin</th>
                    <th className="py-3 px-4">PNR / Réf</th>
                    <th className="py-3 px-4">Vol</th>
                    <th className="py-3 px-4">Siège</th>
                    <th className="py-3 px-4">Classe</th>
                    <th className="py-3 px-4 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tickets.map((t) => {
                    const client = clients.find((c) => c.id === t.clientId);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{t.ticketNumber}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {client ? `${client.civility} ${client.lastName} ${client.firstName}` : 'Pèlerin'}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">{t.pnr}</td>
                        <td className="py-3 px-4 font-medium text-slate-700">{t.flight?.flightNumber || 'SV342'}</td>
                        <td className="py-3 px-4 font-bold text-amber-800">{t.seatNumber}</td>
                        <td className="py-3 px-4 text-slate-600">{t.cabinClass}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: Groupes & Accompagnateurs */}
      {subTab === 'groupes' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {groups.map((group) => (
              <div key={group.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{group.name}</h3>
                    <p className="text-xs text-amber-800 font-medium">Guide référent : {group.guideName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Autocar n° {group.busNumber}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded text-xs font-bold bg-slate-100 text-slate-800">
                    {group.members?.length || 0} pèlerins
                  </span>
                </div>

                <div className="space-y-1.5 border-t border-slate-100 pt-3 max-h-48 overflow-y-auto">
                  {group.members && group.members.length > 0 ? (
                    group.members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-2 rounded bg-slate-50 text-xs">
                        <span className="font-semibold text-slate-800">
                          {m.civility} {m.lastName} {m.firstName}
                        </span>
                        <span className="text-slate-500 font-mono text-[11px]">{m.phone}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">Aucun pèlerin assigné à ce groupe.</p>
                  )}
                </div>

                <button
                  onClick={() => setSelectedGroupForAssign(group)}
                  className="w-full py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                  Ajouter un Pèlerin au Groupe
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Assign Pilgrim to Room */}
      {selectedRoomForAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Bed className="w-4 h-4 text-amber-400" />
                Attribution Lit — Chambre {selectedRoomForAssign.roomNumber}
              </h3>
              <button onClick={() => setSelectedRoomForAssign(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignRoom} className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <p className="text-slate-500">Capacité chambre :</p>
                <p className="font-bold text-slate-900">
                  {selectedRoomForAssign.type} ({selectedRoomForAssign.capacity} lits)
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Actuellement occupé par {selectedRoomForAssign.occupants?.length || 0} personne(s).
                </p>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Sélectionner le pèlerin *</label>
                <select
                  required
                  value={assignClientId}
                  onChange={(e) => setAssignClientId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5"
                >
                  <option value="">-- Choisir un pèlerin --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.lastName} {c.firstName} ({c.gender === 'F' ? 'Femme' : 'Homme'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedRoomForAssign(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                >
                  Valider l'Attribution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Assign Pilgrim to Group */}
      {selectedGroupForAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Users2 className="w-4 h-4 text-amber-400" />
                Assigner au {selectedGroupForAssign.name}
              </h3>
              <button onClick={() => setSelectedGroupForAssign(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignGroup} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Sélectionner le pèlerin *</label>
                <select
                  required
                  value={groupAssignClientId}
                  onChange={(e) => setGroupAssignClientId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5"
                >
                  <option value="">-- Choisir un pèlerin --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.lastName} {c.firstName} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedGroupForAssign(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                >
                  Confirmer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
