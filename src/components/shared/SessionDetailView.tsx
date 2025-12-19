"use client";

import { 
  ChevronLeft, 
  Info, 
  AlertTriangle, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Activity, 
  Target, 
  Settings,
  PlayCircle,
  Clock
} from 'lucide-react';
import type { PrototypeSessionDetail } from '@/types/prototype';

interface SessionDetailViewProps {
  session: PrototypeSessionDetail;
  onBack: () => void;
  onComplete?: () => void;
}

export function SessionDetailView({ session, onBack, onComplete }: SessionDetailViewProps) {
  // Determine if this is a past session or a future planned session
  const isPast = !!(session.agentFeedback || session.distance || session.distanceKm || session.pace || session.protocol);
  
  // Helper to check status strings that might contain descriptive text (e.g., "GREEN. Cadence...")
  const checkStatus = (status: string | undefined, target: string) => 
    status?.toUpperCase().includes(target.toUpperCase());

  // Logic for Coach's Verdict
  let verdict = { 
    title: "MISSION BRIEFING", 
    color: "bg-slate-800 border-slate-700", 
    textColor: "text-slate-300",
    text: "Review objectives before execution.", 
    icon: Info 
  };
  
  if (isPast) {
    if (session.integrity === 'SUSPECT') {
      verdict = { 
        title: "DATA CORRUPTED", 
        color: "bg-red-500/10 border-red-500/50", 
        textColor: "text-red-400",
        text: "Sensors unreliable. Metric analysis suspended.",
        icon: AlertTriangle 
      };
    } else if (session.type === 'SUB') {
      verdict = { 
        title: "TACTICAL ADAPTATION", 
        color: "bg-amber-500/10 border-amber-500/50", 
        textColor: "text-amber-400",
        text: "Plan modified to protect Chassis. 100% Logic Adherence.",
        icon: RefreshCw 
      };
    } else if (
      session.type === 'EXEC' && 
      session.agentFeedback &&
      checkStatus(session.agentFeedback.structural, 'GREEN') && 
      checkStatus(session.agentFeedback.metabolic, 'GREEN')
    ) {
      verdict = { 
        title: "MISSION ACCOMPLISHED", 
        color: "bg-emerald-500/10 border-emerald-500/20", 
        textColor: "text-emerald-400",
        text: "Perfect execution. Blueprint probability increased.",
        icon: CheckCircle2 
      };
    } else if (!session.agentFeedback) {
      verdict = { 
        title: "MISSION LOGGED", 
        color: "bg-slate-800 border-slate-700", 
        textColor: "text-slate-300",
        text: "Session synced. Agent critique pending analysis.",
        icon: Clock 
      };
    } else {
      verdict = { 
        title: "MISSION COMPROMISED", 
        color: "bg-amber-500/10 border-amber-500/20", 
        textColor: "text-amber-400",
        text: "Deviations detected. See Agent critique below.",
        icon: AlertTriangle
      };
    }
  }

  // Fallback for agent feedback to ensure the section is always visible for history
  const activeFeedback = session.agentFeedback || {
    structural: 'PENDING',
    metabolic: 'PENDING',
    conversational: "Agent analysis in progress. Biometric data has been secured and is awaiting deep audit."
  };

  return (
    <div className="space-y-6 pb-24 p-4 animate-in slide-in-from-right duration-300">
      <button 
        onClick={onBack} 
        className="flex items-center text-slate-400 hover:text-white text-sm font-medium mb-2 transition-colors"
      >
        <ChevronLeft className="w-4 h-4 mr-1" /> Back
      </button>

      {/* 1. HERO STATS (Top of Screen) */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
            {session.type === 'STR' ? 'Volume' : 'Distance'}
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {session.type === 'STR' ? (
              <div className="flex items-baseline justify-center">
                <span>{session.strengthVolume || '-'}</span>
                {session.strengthVolume && <span className="text-xs text-slate-500 ml-0.5 lowercase font-sans">reps</span>}
              </div>
            ) : (
              <div className="flex items-baseline justify-center">
                <span>{session.distanceKm ? session.distanceKm.toFixed(1) : (session.distance ? (session.distance / 1000).toFixed(1) : '-')}</span>
                <span className="text-xs text-slate-500 ml-0.5 lowercase font-sans">km</span>
              </div>
            )}
          </div>
        </div>
        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
            {session.type === 'STR' ? 'Load' : 'Pace'}
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {session.type === 'STR' ? (
              <div className="flex items-baseline justify-center">
                <span>{session.strengthLoad ? Math.round(session.strengthLoad).toLocaleString() : '-'}</span>
                {session.strengthLoad && <span className="text-xs text-slate-500 ml-0.5 lowercase font-sans">kg</span>}
              </div>
            ) : (
              <span>{session.pace || '-'}</span>
            )}
          </div>
        </div>
        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Duration</div>
          <div className="text-xl font-bold text-white font-mono">{session.duration || '-'}</div>
        </div>
      </div>

      {/* 2. COACH'S VERDICT CARD */}
      <div className={`p-4 rounded-xl border ${verdict.color} ${verdict.textColor} flex items-start gap-4 shadow-lg`}>
        <verdict.icon className="w-6 h-6 shrink-0 mt-1" />
        <div>
          <h3 className="font-bold tracking-tight text-lg uppercase">{verdict.title}</h3>
          <p className="text-xs opacity-90 leading-relaxed mt-1 font-medium">{verdict.text}</p>
        </div>
      </div>

      {/* SESSION TITLE */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded uppercase font-mono tracking-wide">
            {session.day}
          </span>
          {session.trainingType && (
            <span className="text-[10px] bg-slate-800/50 text-slate-500 px-2 py-0.5 rounded uppercase font-mono border border-slate-800">
              {session.trainingType}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-white leading-tight">{session.title}</h1>
      </div>

      {/* 3. BIO-MECHANICAL COST (Trade-off Chart) - Restricted to Past Sessions */}
      {isPast && session.costAnalysis && (
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
            <Activity className="w-3 h-3 text-emerald-500" /> Bio-Mechanical Cost
          </h3>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-emerald-400 font-bold">Metabolic Stimulus (Engine)</span>
                <span className="text-slate-500 font-mono">{session.costAnalysis.metabolic}/100</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)] transition-all duration-1000" 
                  style={{ width: `${session.costAnalysis.metabolic}%` }}
                ></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-red-400 font-bold">Structural Cost (Chassis)</span>
                <span className="text-slate-500 font-mono">{session.costAnalysis.structural}/100</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)] transition-all duration-1000"
                  style={{ width: `${session.costAnalysis.structural}%` }}
                ></div>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-3 italic">
            *High Efficiency = High Metabolic Gain with Low Structural Cost.
          </p>
        </div>
      )}

      {/* 4. THE CRITIC (Agent Feedback) */}
      {isPast && (
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-slate-700"></div>
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
            <Target className="w-3 h-3 text-emerald-500" /> The Critic (Agent Debrief)
          </h3>
          <div className="flex gap-4">
            <div className="shrink-0 pt-1">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                <Settings className="w-4 h-4 text-emerald-500" />
              </div>
            </div>
            <div>
              <p className="text-sm text-zinc-200 italic leading-relaxed font-medium">
                "{activeFeedback.conversational || "Agent C confirms adherence to bio-mechanical constraints. No fatal errors detected."}"
              </p>
              <div className="flex gap-3 mt-3">
                <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${
                  checkStatus(activeFeedback.structural, 'GREEN') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                  checkStatus(activeFeedback.structural, 'RED') ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                  checkStatus(activeFeedback.structural, 'PENDING') ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' :
                  'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  STRUCT: {activeFeedback.structural}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${
                  checkStatus(activeFeedback.metabolic, 'GREEN') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                  checkStatus(activeFeedback.metabolic, 'RED') ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                  checkStatus(activeFeedback.metabolic, 'PENDING') ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' :
                  'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  META: {activeFeedback.metabolic}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MISSION PROTOCOL / EXERCISES */}
      {session.protocol && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase ml-1">
            {isPast ? 'Session Log / Exercises' : 'Mission Protocol'}
          </h3>
          
          {session.protocol.warmup && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="p-3 border-b border-slate-800 bg-slate-800/30 flex justify-between items-center">
                <span className="text-xs font-medium text-slate-300 uppercase">Warmup</span>
                <span className="text-[10px] font-mono text-slate-500">{isPast ? 'COMPLETED' : 'INITIATION'}</span>
              </div>
              <div className="p-3 text-sm text-slate-300">
                {session.protocol.warmup}
              </div>
            </div>
          )}

          <div className={`bg-slate-900 rounded-xl border-l-4 ${session.type === 'STR' ? 'border-violet-500' : 'border-emerald-500'} shadow-lg overflow-hidden`}>
            <div className={`p-3 border-b border-slate-800 ${session.type === 'STR' ? 'bg-violet-500/5' : 'bg-emerald-500/5'} flex justify-between items-center`}>
              <span className="text-xs font-bold text-white uppercase">
                {session.type === 'STR' ? 'Exercises & Sets' : 'Main Set'}
              </span>
              <span className={`text-[10px] font-mono ${session.type === 'STR' ? 'text-violet-400' : 'text-emerald-400'}`}>
                {isPast ? 'LOGGED' : 'PRIME DIRECTIVE'}
              </span>
            </div>
            <div className="p-4 space-y-2">
              {session.protocol.main.map((step, i) => (
                <div key={i} className="flex gap-3 text-sm text-white">
                  <span className="font-mono text-slate-500">{i + 1}.</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>

          {session.protocol.cooldown && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="p-3 border-b border-slate-800 bg-slate-800/30 flex justify-between items-center">
                <span className="text-xs font-medium text-slate-300 uppercase">Cool Down</span>
                <span className="text-[10px] font-mono text-slate-500">{isPast ? 'COMPLETED' : 'FLUSH'}</span>
              </div>
              <div className="p-3 text-sm text-slate-300">
                {session.protocol.cooldown}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Original Objective (Context) */}
      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
        <h3 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
          <Target className="w-3 h-3" /> {isPast ? 'Mission Outcome' : 'Mission Objective'}
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed">
          {session.objective}
        </p>
      </div>

      {/* ACTION BUTTON (Only for Future) */}
      {!isPast && onComplete && (
        <div className="sticky bottom-4 pt-4">
          <button 
            onClick={onComplete}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition-all hover:scale-[1.01] active:scale-[0.98]"
          >
            <PlayCircle className="w-5 h-5" />
            INITIATE LOGGING / COMPLETE MISSION
          </button>
        </div>
      )}
    </div>
  );
}
