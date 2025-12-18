"use client";

import { CheckCircle2 } from 'lucide-react';

interface PostActionReportProps {
  onClose: () => void;
}

export function PostActionReport({ onClose }: PostActionReportProps) {
  return (
    <div className="fixed inset-0 z-[90] bg-slate-950 flex flex-col p-4 animate-in slide-in-from-bottom duration-300">
      <div className="flex-1 max-w-md mx-auto w-full space-y-6 pt-10">
        <div className="text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">Mission Complete</h1>
          <p className="text-slate-400 text-sm">Debriefing required for Agent C analysis.</p>
        </div>

        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-4">
          <div>
            <label className="block text-xs font-bold text-blue-400 uppercase mb-2">GI Distress (Gut Check)</label>
            <div className="flex justify-between text-xs text-slate-500 mb-2">
              <span>Iron Stomach</span>
              <span>Emergency Stop</span>
            </div>
            <input type="range" min="1" max="10" defaultValue="1" className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
          </div>

          <div>
            <label className="block text-xs font-bold text-emerald-400 uppercase mb-2">Actual Carbs Ingested</label>
            <div className="flex items-center gap-2">
              <input type="number" placeholder="60" className="bg-slate-950 border border-slate-700 text-white p-3 rounded-lg w-full text-center font-mono text-lg" />
              <span className="text-slate-500 text-sm">g/hr</span>
            </div>
          </div>
          
           <div>
            <label className="block text-xs font-bold text-amber-400 uppercase mb-2">RPE (Exertion)</label>
            <div className="grid grid-cols-5 gap-2">
              {[6,7,8,9,10].map(n => (
                <button key={n} className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg font-mono text-sm border border-slate-700 focus:border-amber-500 focus:text-amber-500">
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-4 rounded-xl shadow-lg shadow-emerald-900/20"
        >
          SUBMIT LOG
        </button>
      </div>
    </div>
  );
}

