import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Database } from 'lucide-react';

interface ServiceStatus {
  name: string;
  status: 'online' | 'offline';
  latency: string;
}

export const DiagnosticPanel: React.FC<{ dataCounts: Record<string, number> }> = ({ dataCounts }) => {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'Auth API', status: 'online', latency: '45ms' },
    { name: 'Firestore Database', status: 'online', latency: '12ms' },
    { name: 'Storage Service', status: 'online', latency: '28ms' },
  ]);

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-700">
      <h2 className="text-lg font-black mb-4 flex items-center gap-2">
        <Database className="w-5 h-5 text-amber-500" />
        Diagnostic Panel
      </h2>
      
      <div className="space-y-4">
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Connection Status</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {services.map((service) => (
              <div key={service.name} className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">{service.name}</span>
                  {service.status === 'online' ? <CheckCircle className="w-3 h-3 text-emerald-500" /> : <AlertCircle className="w-3 h-3 text-red-500" />}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">{service.latency}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Raw Data Counts</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(dataCounts).map(([key, count]) => (
              <div key={key} className="bg-slate-800 p-2 rounded border border-slate-700">
                <div className="text-[10px] text-slate-400 capitalize">{key}</div>
                <div className="text-sm font-black text-amber-400">{count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
