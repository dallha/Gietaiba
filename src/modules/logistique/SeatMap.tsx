import React from 'react';
import { Client } from '../../types.js';

interface SeatMapProps {
  flightId: string;
  onClose: () => void;
  clients: Client[];
}

export const SeatMap: React.FC<SeatMapProps> = ({ flightId, onClose, clients }) => {
  // Simple 6-seat grid as a placeholder
  const seats = Array.from({ length: 6 }, (_, i) => ({ id: `seat-${i + 1}`, number: `A${i + 1}`, occupant: null }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <h3 className="text-sm font-bold">Plan de cabine - Vol {flightId}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">Fermer</button>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-3 gap-4">
            {seats.map((seat) => (
              <div 
                key={seat.id} 
                className="p-4 border rounded-lg text-center bg-slate-50 border-slate-200 hover:border-amber-300 cursor-pointer"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const clientId = e.dataTransfer.getData('clientId');
                  alert(`Assigning client ${clientId} to seat ${seat.number}`);
                }}
              >
                {seat.number}
              </div>
            ))}
          </div>
          <div className="mt-6 border-t pt-4">
            <h4 className="text-xs font-bold mb-2">Pèlerins à assigner (glissez-déposez)</h4>
            <div className="flex gap-2">
              {clients.slice(0, 5).map(c => (
                <div 
                  key={c.id} 
                  className="px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-bold cursor-grab"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('clientId', c.id)}
                >
                  {c.firstName} {c.lastName}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
