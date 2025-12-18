"use client";

import { AlertOctagon, CheckCircle2, RefreshCw } from 'lucide-react';

interface SubstitutionModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

export function SubstitutionModal({ 
  isOpen, 
  onAccept, 
  onCancel 
}: SubstitutionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 w-full max-w-md rounded-2xl border-2 border-red-500 shadow-2xl shadow-red-900/40 overflow-hidden">
        <div className="bg-red-500/10 p-4 border-b border-red-500/20 flex items-center gap-3">
          <AlertOctagon className="w-8 h-8 text-red-500 animate-pulse" />
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">INTERVENTION REQUIRED</h2>
            <p className="text-xs text-red-400 font-mono">STRUCTURAL AGENT VETO</p>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          <p className="text-slate-300 text-sm leading-relaxed">
            <strong className="text-white block mb-1">Acute Pain Detected (Score {'>'} 3).</strong>
            Continuing with impact loading (Running) presents an unacceptable risk of tissue failure. 
            The Engine is ready, but the Chassis is compromised.
          </p>
          
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-500 uppercase mb-2">Recommended Substitution</div>
            <div className="flex items-center gap-3">
              <RefreshCw className="w-8 h-8 text-amber-500" />
              <div>
                <div className="text-white font-bold">60min Cycling Intervals</div>
                <div className="text-xs text-slate-400">Maintains Metabolic Load • Zero Impact</div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-950 flex flex-col gap-3">
          <button 
            onClick={onAccept}
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-3.5 rounded-xl transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            ACCEPT SUBSTITUTION
          </button>
          <button 
            onClick={onCancel}
            className="w-full bg-transparent hover:bg-slate-900 text-slate-500 text-xs py-3 rounded-xl"
          >
            Ignore Risk (Not Recommended)
          </button>
        </div>
      </div>
    </div>
  );
}

