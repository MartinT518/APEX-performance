"use client";

import { useMonitorStore } from '@/modules/monitor/monitorStore';

export function AgentStatusGrid() {
  const { todayEntries } = useMonitorStore();
  const niggleScore = todayEntries.niggleScore || 0;

  return (
    <section className="col-span-1 md:col-span-2 bg-zinc-950 p-6 rounded-xl border border-zinc-800">
      <h2 className="text-xl font-bold mb-4">Agent Status</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Metabolic Agent */}
        <div className="p-4 rounded-lg bg-green-900/20 border border-green-900">
          <h3 className="text-sm text-green-400 font-bold uppercase tracking-wider">Metabolic</h3>
          <p className="text-2xl mt-2 font-mono">GREEN</p>
          <p className="text-xs text-zinc-500 mt-1">HRV Stable</p>
        </div>

        {/* Structural Agent */}
        <div className={`p-4 rounded-lg border transition-colors ${
          niggleScore > 5 ? 'bg-red-900/20 border-red-900' :
          niggleScore > 3 ? 'bg-yellow-900/20 border-yellow-900' :
          'bg-green-900/20 border-green-900'
        }`}>
          <h3 className={`text-sm font-bold uppercase tracking-wider ${
            niggleScore > 5 ? 'text-red-500' :
            niggleScore > 3 ? 'text-yellow-500' :
            'text-green-400'
          }`}>Structural</h3>
          <p className="text-2xl mt-2 font-mono">
            {niggleScore > 5 ? 'VETO' : 
             niggleScore > 3 ? 'AMBER' : 'GREEN'}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Niggle: {niggleScore}/10
          </p>
        </div>

        {/* Fueling Agent */}
        <div className={`p-4 rounded-lg border transition-colors ${
          todayEntries.fuelingLog?.giDistress && todayEntries.fuelingLog.giDistress > 5 ? 'bg-red-900/20 border-red-900' :
          todayEntries.fuelingLog ? 'bg-green-900/20 border-green-900' :
          'bg-zinc-900/50 border-zinc-800'
        }`}>
          <h3 className={`text-sm font-bold uppercase tracking-wider ${
            todayEntries.fuelingLog?.giDistress && todayEntries.fuelingLog.giDistress > 5 ? 'text-red-500' : 'text-zinc-400'
          }`}>Fueling</h3>
          <p className="text-2xl mt-2 font-mono">
            {todayEntries.fuelingLog?.giDistress && todayEntries.fuelingLog.giDistress > 5 ? 'RED' :
             todayEntries.fuelingLog ? 'GREEN' : 'PENDING'}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {todayEntries.fuelingLog ? `${todayEntries.fuelingLog.carbsPerHour}g/hr` : 'No Data'}
          </p>
        </div>
      </div>
    </section>
  );
}

