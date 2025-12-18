"use client";

import { 
  ChevronLeft, 
  Clock, 
  Dumbbell, 
  Activity, 
  AlertTriangle, 
  PlayCircle,
  FileBarChart,
  Target
} from 'lucide-react';
import type { PrototypeSessionDetail } from '@/types/prototype';

interface SessionDetailViewProps {
  session: PrototypeSessionDetail;
  onBack: () => void;
  onComplete?: () => void;
}

export function SessionDetailView({ session, onBack, onComplete }: SessionDetailViewProps) {
  const isStrength = session.type === 'STR';
  const isPast = !!session.agentFeedback; // Logic to detect if it's history
  const headerColor = isStrength ? 'text-violet-400' : 'text-emerald-400';
  const badgeColor = isStrength ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20';
  const mainSetBorder = isStrength ? 'border-violet-500' : 'border-emerald-500';
  const mainSetBg = isStrength ? 'bg-violet-500/5' : 'bg-emerald-500/5';
  const mainSetText = isStrength ? 'text-violet-400' : 'text-emerald-400';

  return (
    <div className="space-y-6 pb-24 animate-in slide-in-from-right duration-300">
      <button 
        onClick={onBack}
        className="flex items-center text-slate-400 hover:text-white transition-colors text-sm font-medium mb-2"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Back to {isPast ? 'Log' : 'Tactical Map'}
      </button>

      {/* HEADER */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded uppercase font-mono tracking-wide">
            {session.day}
          </span>
          {isPast ? (
            <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${
              session.integrity === 'VALID' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}>
              DATA: {session.integrity}
            </span>
          ) : (
            session.type !== 'REC' && session.type !== 'REST' && (
              <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${badgeColor}`}>
                {session.type === 'STR' ? 'CHASSIS ARCHITECTURE' : 'KEY OPERATION'}
              </span>
            )
          )}
        </div>
        <h1 className="text-2xl font-bold text-white mb-2 leading-tight">{session.title}</h1>
        <div className="flex gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {session.duration}</span>
          <span className="flex items-center gap-1"><Dumbbell className="w-3 h-3" /> Load: {session.load}</span>
        </div>
      </div>

      {/* MISSION OBJECTIVE / OUTCOME */}
      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
        <h3 className={`text-xs font-bold uppercase mb-2 flex items-center gap-2 ${headerColor}`}>
          <Activity className="w-3 h-3" /> {isPast ? 'Mission Outcome' : 'Mission Objective'}
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed mb-3">
          {session.objective}
        </p>
        {isPast && (
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800">
            {session.distance && (
              <div>
                <div className="text-[10px] text-slate-500 uppercase mb-0.5">Distance</div>
                <div className="text-sm font-bold text-white">{session.distance.toFixed(1)} km</div>
              </div>
            )}
            {session.pace && (
              <div>
                <div className="text-[10px] text-slate-500 uppercase mb-0.5">Pace</div>
                <div className={`text-sm font-bold ${
                  session.integrity === 'SUSPECT' 
                    ? 'text-red-400' 
                    : 'text-white'
                }`}>
                  {session.integrity === 'SUSPECT' 
                    ? 'INVALID (Cadence Lock)' 
                    : session.pace}
                </div>
              </div>
            )}
            {session.trainingType && (
              <div>
                <div className="text-[10px] text-slate-500 uppercase mb-0.5">Type</div>
                <div className="text-sm font-bold text-white">{session.trainingType}</div>
              </div>
            )}
            {session.compliance && (
              <div>
                <div className="text-[10px] text-slate-500 uppercase mb-0.5">Compliance</div>
                <div className={`text-sm font-bold ${
                  session.compliance === 'COMPLIANT' ? 'text-emerald-400' :
                  session.compliance === 'SUBSTITUTED' ? 'text-amber-400' :
                  'text-red-400'
                }`}>
                  {session.compliance}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* IF PAST: SHOW POST-MORTEM DATA */}
      {isPast && session.agentFeedback ? (
        <div className="space-y-4">
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
              <FileBarChart className="w-3 h-3" /> Agent Post-Mortem
            </h3>
            <div className="space-y-3 font-mono text-xs">
              <div className="flex gap-2">
                <span className="text-slate-500">STRUCT:</span>
                <span className={session.agentFeedback.structural.includes('GREEN') ? 'text-emerald-400' : 'text-red-400'}>
                  {session.agentFeedback.structural}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-500">META:</span>
                <span className={session.agentFeedback.metabolic.includes('GREEN') ? 'text-emerald-400' : 'text-amber-400'}>
                  {session.agentFeedback.metabolic}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
              <Target className="w-3 h-3" /> Hidden Variables Log
            </h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-950 p-2 rounded">
                <div className="text-[10px] text-slate-500">NIGGLE</div>
                <div className="text-lg font-bold text-white">{session.hiddenVariables?.niggle}/10</div>
              </div>
              <div className="bg-slate-950 p-2 rounded">
                <div className="text-[10px] text-slate-500">GI RISK</div>
                <div className="text-lg font-bold text-white">{session.hiddenVariables?.giDistress || '-'}/10</div>
              </div>
              <div className="bg-slate-950 p-2 rounded">
                <div className="text-[10px] text-slate-500">LIFT</div>
                <div className="text-lg font-bold text-white text-[10px] pt-1">{session.hiddenVariables?.strengthTier || '-'}</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* IF FUTURE: SHOW PROTOCOL */
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase ml-1">Execution Protocol</h3>
          
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="p-3 border-b border-slate-800 bg-slate-800/30 flex justify-between items-center">
              <span className="text-xs font-medium text-slate-300">WARMUP</span>
              <span className="text-[10px] font-mono text-slate-500">INITIATION</span>
            </div>
            <div className="p-3 text-sm text-slate-300">
              {session.protocol?.warmup}
            </div>
          </div>

          <div className={`bg-slate-900 rounded-xl border-l-4 ${mainSetBorder} shadow-lg shadow-emerald-900/10 overflow-hidden`}>
            <div className={`p-3 border-b border-slate-800 ${mainSetBg} flex justify-between items-center`}>
              <span className="text-xs font-bold text-white">MAIN SET</span>
              <span className={`text-[10px] font-mono ${mainSetText}`}>PRIME DIRECTIVE</span>
            </div>
            <div className="p-4 space-y-2">
              {session.protocol?.main.map((step, i) => (
                <div key={i} className="flex gap-3 text-sm text-white">
                  <span className="font-mono text-slate-500">{i + 1}.</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="p-3 border-b border-slate-800 bg-slate-800/30 flex justify-between items-center">
              <span className="text-xs font-medium text-slate-300">COOL DOWN</span>
              <span className="text-[10px] font-mono text-slate-500">FLUSH</span>
            </div>
            <div className="p-3 text-sm text-slate-300">
              {session.protocol?.cooldown}
            </div>
          </div>
        </div>
      )}

      {/* CONSTRAINTS (Common to both) */}
      {!isPast && session.constraints && (
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
            <AlertTriangle className="w-3 h-3" /> Constraints
          </h3>
          <div className="flex flex-wrap gap-2">
            {session.constraints.map((c, i) => (
              <span key={i} className="text-xs bg-slate-950 text-slate-300 px-3 py-1.5 rounded border border-slate-800">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ACTION BUTTON (Only for Future) */}
      {!isPast && onComplete && (
        <div className="sticky bottom-4 pt-4">
          <button 
            onClick={onComplete}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition-transform active:scale-[0.98]"
          >
            <PlayCircle className="w-5 h-5" />
            ACCEPT MISSION / LOG COMPLETION
          </button>
        </div>
      )}
    </div>
  );
}

