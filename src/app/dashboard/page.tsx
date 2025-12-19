"use client";

import { useEffect, useState, useMemo } from 'react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { useMonitorStore } from '@/modules/monitor/monitorStore';
import { usePhenotypeStore } from '@/modules/monitor/phenotypeStore';
import { runCoachAnalysis } from '../actions';
import { IAnalysisResult } from '@/types/analysis';
import { calculateValuation } from '@/modules/analyze/valuationEngine';
import { loadSessionsWithVotes } from '../history/logic/sessionLoader';
import { sessionWithVotesToPrototype } from '@/types/prototype';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Dumbbell, 
  TrendingUp, 
  Zap,
  RefreshCw,
  Droplets,
  Moon
} from 'lucide-react';
import { SubstitutionModal } from '@/components/plan/SubstitutionModal';
import { applySubstitutionOption } from '../actions';
import { PostActionReport } from '@/components/shared/PostActionReport';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

function DashboardContent() {
  const { todayEntries, setNiggleScore, logStrengthSession, logFueling, loadTodayMonitoring, getDaysSinceLastLift } = useMonitorStore();
  const { profile, loadProfile } = usePhenotypeStore();
  const [niggleScore, setNiggleScoreLocal] = useState(0);
  const [liftStatus, setLiftStatus] = useState<'NONE' | 'MAIN' | 'HYPER' | 'STR'>('NONE');
  const [showIntervention, setShowIntervention] = useState(false);
  const [showShutdown, setShowShutdown] = useState(false);
  const [showPAR, setShowPAR] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<IAnalysisResult | null>(null);
  const [certaintyScore, setCertaintyScore] = useState(82);
  const [certaintyDelta, setCertaintyDelta] = useState(1.2);
  const [previousCertaintyScore, setPreviousCertaintyScore] = useState<number | null>(null);
  const [hrv, setHrv] = useState<number | null>(null);
  const [drift, setDrift] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fuelingCarbsPerHour, setFuelingCarbsPerHour] = useState<number | null>(null);
  const [fuelingGiDistress, setFuelingGiDistress] = useState<number | null>(null);
  const [lastRunDuration, setLastRunDuration] = useState<number>(0);

  // Load data on mount
  useEffect(() => {
    loadTodayMonitoring();
    loadProfile();
    loadBaselineMetrics();
    runInitialAnalysis();
  }, []);

  // Sync niggle score from store
  useEffect(() => {
    setNiggleScoreLocal(todayEntries.niggleScore || 0);
    // Update lift status from store
    if (todayEntries.strengthSession?.performed && todayEntries.strengthSession?.tonnageTier) {
      const tier = todayEntries.strengthSession.tonnageTier;
      if (tier === 'maintenance') setLiftStatus('MAIN');
      else if (tier === 'hypertrophy') setLiftStatus('HYPER');
      else if (tier === 'strength' || tier === 'power') setLiftStatus('STR');
    } else {
      setLiftStatus('NONE');
    }
    // Sync fueling data
    if (todayEntries.fuelingLog) {
      setFuelingCarbsPerHour(todayEntries.fuelingLog.carbsPerHour);
      setFuelingGiDistress(todayEntries.fuelingLog.giDistress);
    }
  }, [todayEntries]);

  // Use status from decision result (vote-driven) instead of hardcoded logic
  // Compute these values from analysisResult using useMemo to avoid recomputation issues
  const {
    globalStatus,
    statusReason,
    votesDisplay,
    isAdapted,
    isShutdown,
    workout,
    isHighRev,
    hasStructuralRed
  } = useMemo(() => {
    const gStatus = analysisResult?.decision?.global_status;
    const sReason = analysisResult?.decision?.reason;
    const vDisplay = analysisResult?.decision?.votes_display;
    const adapted = gStatus === 'ADAPTED' || gStatus === 'SHUTDOWN';
    const shutdown = gStatus === 'SHUTDOWN';
    const w = analysisResult?.decision?.finalWorkout;
    const highRev = profile?.is_high_rev ?? true;
    const structuralRed = analysisResult?.decision?.votes?.some(
      v => v.agentId === 'structural_agent' && v.vote === 'RED'
    ) ?? false;
    
    return {
      globalStatus: gStatus,
      statusReason: sReason,
      votesDisplay: vDisplay,
      isAdapted: adapted,
      isShutdown: shutdown,
      workout: w,
      isHighRev: highRev,
      hasStructuralRed: structuralRed
    };
  }, [analysisResult, profile]);

  // Show substitution modal when structural RED detected
  useEffect(() => {
    if (hasStructuralRed) {
      setShowIntervention(true);
    }
  }, [hasStructuralRed]);

  // Show shutdown modal when SHUTDOWN status
  useEffect(() => {
    if (isShutdown && !hasStructuralRed) {
      setShowShutdown(true);
    }
  }, [isShutdown, hasStructuralRed]);

  const loadBaselineMetrics = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      
      if (!userId) return;

      // Load latest HRV
      const { data: baseline } = await supabase
        .from('baseline_metrics')
        .select('hrv')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (baseline?.hrv) {
        setHrv(Number(baseline.hrv));
      }

      // Load latest session to calculate drift
      const { data: latestSession } = await supabase
        .from('session_logs')
        .select('metadata')
        .eq('user_id', userId)
        .order('session_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestSession?.metadata) {
        const metadata = latestSession.metadata as Record<string, unknown>;
        // Extract decoupling from metadata if available
        const decoupling = metadata.decoupling as number | undefined;
        if (decoupling !== undefined) {
          setDrift(decoupling);
        }
      }
    } catch (err) {
      logger.warn('Failed to load baseline metrics', err);
    }
  };

  const runInitialAnalysis = async () => {
    setIsLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      const result = await runCoachAnalysis(userId);
      if (result.success) {
        setAnalysisResult(result);
      }
      
      // Calculate ValuationEngine probability
      if (userId) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90); // Last 90 days
        
        const sessionsWithVotes = await loadSessionsWithVotes(
          userId,
          {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0]
          },
          'ALL'
        );
        
        // Convert to prototype format
        const prototypeSessions = sessionsWithVotes.map(s => 
          sessionWithVotesToPrototype(s, s.dailyMonitoring || null)
        );
        
        // Calculate valuation
        const valuation = calculateValuation(prototypeSessions);
        // Cap probability at 85% - High-Rev athlete always carries 15% risk of structural failure
        const newScore = Math.min(85, valuation.blueprintProbability);
        
        // Calculate delta from previous score
        if (previousCertaintyScore !== null) {
          const delta = newScore - previousCertaintyScore;
          setCertaintyDelta(delta);
        } else {
          // Use a default delta if no previous data
          setCertaintyDelta(0);
        }
        
        setPreviousCertaintyScore(newScore);
        setCertaintyScore(newScore);
        
        // Get last run duration for fueling audit check
        if (sessionsWithVotes.length > 0) {
          const lastRun = sessionsWithVotes.find(s => s.sport_type === 'RUNNING');
          if (lastRun) {
            setLastRunDuration(lastRun.duration_minutes);
          }
        }
      } else if (result.simulation?.successProbability) {
        // Fallback to simulation if no user session
        const newScore = Math.round(result.simulation.successProbability);
        setCertaintyScore(newScore);
      }
    } catch (err) {
      logger.error('Failed to run initial analysis', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSliderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setNiggleScoreLocal(val);
    
    try {
      await setNiggleScore(val);
      const wasAdapted = niggleScore > 3;
      if (val > 3 && !wasAdapted) {
        setShowIntervention(true);
      }
    } catch (err) {
      logger.error('Failed to save niggle score', err);
    }
  };

  const handleLiftStatusChange = async (status: 'MAIN' | 'HYPER' | 'STR') => {
    setLiftStatus(status);
    try {
      const tierMap = {
        'MAIN': 'maintenance' as const,
        'HYPER': 'hypertrophy' as const,
        'STR': 'strength' as const
      };
      await logStrengthSession(true, tierMap[status]);
    } catch (err) {
      logger.error('Failed to save strength session', err);
    }
  };

  // Calculate chassis percentage based on lift status and niggle
  const chassisPercentage = isAdapted ? 40 : 
    liftStatus !== 'NONE' ? 85 : 60;

  return (
    <div className="space-y-6 pb-24 p-4">
      {/* Substitution Modal - triggers on structural RED */}
      {hasStructuralRed && (
        <SubstitutionModal
          open={showIntervention || hasStructuralRed}
          onClose={() => setShowIntervention(false)}
          niggleScore={niggleScore}
          onSelectOption={async (option) => {
            const result = await applySubstitutionOption(option);
            if (result.success) {
              setShowIntervention(false);
              // Reload analysis to show updated workout
              await runInitialAnalysis();
            }
          }}
          originalWorkout={workout ?? undefined}
        />
      )}
      
      {/* Shutdown Modal - triggers on SHUTDOWN status */}
      {isShutdown && !hasStructuralRed && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 w-full max-w-md rounded-2xl border-2 border-red-500 shadow-2xl shadow-red-900/40 overflow-hidden">
            <div className="bg-red-500/10 p-4 border-b border-red-500/20 flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-red-500 animate-pulse" />
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">SYSTEM SHUTDOWN</h2>
                <p className="text-xs text-red-400 font-mono">Multiple Critical Flags Detected</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-300 text-sm leading-relaxed">
                {statusReason}
              </p>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-500 uppercase mb-2">Required Action</div>
                <div className="flex items-center gap-3">
                  <Moon className="w-8 h-8 text-red-500" />
                  <div>
                    <div className="text-white font-bold">Complete Rest + Mobility</div>
                    <div className="text-xs text-slate-400">No training stimulus allowed</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-950">
              <button
                onClick={() => setShowShutdown(false)}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-lg transition-colors"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Post Action Report */}
      {showPAR && <PostActionReport onClose={() => setShowPAR(false)} />}

      {/* Header / Certainty */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-slate-400 text-xs font-mono uppercase tracking-wider">Macro-Engine Probability</h2>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{certaintyScore}%</span>
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +{certaintyDelta}%
            </span>
          </div>
        </div>
        {isHighRev && (
          <div className="bg-slate-800 px-2 py-1 rounded text-[10px] font-mono text-slate-300 border border-slate-700 flex items-center gap-1">
            <Activity className="w-3 h-3 text-emerald-500" />
            HIGH-REV: ON
          </div>
        )}
      </div>

      {/* GO / NO-GO STATUS */}
      <div className={`rounded-xl p-5 border-l-4 shadow-lg transition-all duration-300 ${
        globalStatus === 'SHUTDOWN'
          ? 'bg-red-500/10 border-red-500 shadow-red-900/20'
          : isAdapted 
          ? 'bg-amber-500/10 border-amber-500 shadow-amber-900/20' 
          : 'bg-emerald-500/10 border-emerald-500 shadow-emerald-900/20'
      }`}>
        <div className="flex items-center gap-3 mb-2">
          {globalStatus === 'SHUTDOWN' ? (
            <AlertTriangle className="text-red-500" />
          ) : isAdapted ? (
            <AlertTriangle className="text-amber-500" />
          ) : (
            <CheckCircle2 className="text-emerald-500" />
          )}
          <h1 className="text-xl font-bold text-white tracking-tight">
            STATUS: {globalStatus ?? 'GO'}
          </h1>
        </div>
        <p className="text-sm text-slate-300">
          {statusReason ?? "Chassis and Engine are Green. Execute High-Rev Protocol."}
        </p>
        {votesDisplay && (
          <div className="mt-3 flex gap-2 text-xs">
            <span className={`px-2 py-1 rounded ${
              votesDisplay.structural.color === 'red' ? 'bg-red-500/20 text-red-400' :
              votesDisplay.structural.color === 'amber' ? 'bg-amber-500/20 text-amber-400' :
              'bg-green-500/20 text-green-400'
            }`}>
              Structural: {votesDisplay.structural.label}
            </span>
            <span className={`px-2 py-1 rounded ${
              votesDisplay.metabolic.color === 'red' ? 'bg-red-500/20 text-red-400' :
              votesDisplay.metabolic.color === 'amber' ? 'bg-amber-500/20 text-amber-400' :
              'bg-green-500/20 text-green-400'
            }`}>
              Metabolic: {votesDisplay.metabolic.label}
            </span>
            <span className={`px-2 py-1 rounded ${
              votesDisplay.fueling.color === 'red' ? 'bg-red-500/20 text-red-400' :
              votesDisplay.fueling.color === 'amber' ? 'bg-amber-500/20 text-amber-400' :
              'bg-green-500/20 text-green-400'
            }`}>
              Fueling: {votesDisplay.fueling.label}
            </span>
          </div>
        )}
      </div>

      {/* CHASSIS vs ENGINE GAUGES */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <Dumbbell className={`w-4 h-4 ${isAdapted ? 'text-red-400' : 'text-slate-400'}`} />
            <span className="text-xs font-bold text-slate-400">CHASSIS</span>
          </div>
          <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`absolute top-0 left-0 h-full transition-all duration-500 ${
                isAdapted ? 'w-[40%] bg-red-500' : 'w-[85%] bg-emerald-500'
              }`} 
            />
          </div>
          <div className="mt-3 flex justify-between text-[10px] text-slate-500 font-mono">
            <span>LIFT: {liftStatus === 'NONE' ? `${getDaysSinceLastLift()}d AGO` : 'TODAY'}</span>
            <span>NIGGLE: {niggleScore}/10</span>
          </div>
        </div>

        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-400">ENGINE</span>
          </div>
          <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="absolute top-0 left-0 h-full w-[92%] bg-emerald-500" />
          </div>
          <div className="mt-3 flex justify-between text-[10px] text-slate-500 font-mono">
            <span>HRV: {hrv ? `+${Math.round(hrv - 50)}ms` : '+2ms'}</span>
            <span>DRIFT: {drift ? `${drift.toFixed(1)}%` : '1.2%'}</span>
          </div>
        </div>
      </div>

      {/* TODAY'S MISSION */}
      {workout && (
        <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
          <div className="bg-slate-800/50 p-3 border-b border-slate-800 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-300">TODAY'S MISSION</span>
            <span className="text-[10px] font-mono text-slate-500">PHASE 2: HYBRID</span>
          </div>
          <div className="p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">
                  {workout.notes || workout.structure?.mainSet || `${workout.type} Session`}
                </h3>
                <div className="flex gap-2 text-xs">
                  <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                    {isAdapted ? 'Non-Impact' : 'High-Rev Mode'}
                  </span>
                  {!isAdapted && workout.constraints?.fuelingTarget && (
                    <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded flex items-center gap-1">
                      <Droplets className="w-3 h-3" /> {workout.constraints.fuelingTarget}g Carbs/hr
                    </span>
                  )}
                </div>
              </div>
              {isAdapted 
                ? <RefreshCw className="w-6 h-6 text-amber-500" /> 
                : <Zap className="w-6 h-6 text-emerald-500" />
              }
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm border-b border-slate-800 pb-2">
                <span className="text-slate-400">Intensity Target</span>
                <span className="font-mono text-white">
                  {isAdapted 
                    ? 'Power Z4 (280-300w)' 
                    : workout.constraints?.hrTarget 
                      ? `HR ${workout.constraints.hrTarget.min}-${workout.constraints.hrTarget.max} bpm`
                      : 'HR Target'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm border-b border-slate-800 pb-2">
                <span className="text-slate-400">Structural Constraint</span>
                <span className="font-mono text-white">
                  {isAdapted 
                    ? 'RPM > 90' 
                    : workout.constraints?.cadenceTarget 
                      ? `Cadence > ${workout.constraints.cadenceTarget}`
                      : 'Cadence Target'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE INPUTS */}
      <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
        <h4 className="text-xs font-bold text-slate-400 mb-4 uppercase">Daily Chassis Audit</h4>
        
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-white">Niggle / Pain Score</span>
            <span className={`font-mono font-bold ${niggleScore > 3 ? 'text-red-400' : 'text-emerald-400'}`}>
              {niggleScore}/10
            </span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="10" 
            value={niggleScore} 
            onChange={handleSliderChange}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] text-slate-600 mt-1">
            <span>Clean</span>
            <span>Broken</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Did you lift today?</span>
          </div>
          {/* Granular Strength Tonnage Input */}
          <div className="grid grid-cols-3 gap-2">
             <button 
                onClick={() => handleLiftStatusChange('MAIN')}
                className={`text-xs py-2 rounded border ${
                  liftStatus === 'MAIN' 
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                    : 'bg-slate-800 border-slate-700 text-slate-500'
                }`}
             >
               Maintenance
             </button>
             <button 
                onClick={() => handleLiftStatusChange('HYPER')}
                className={`text-xs py-2 rounded border ${
                  liftStatus === 'HYPER' 
                    ? 'bg-blue-500/20 border-blue-500 text-blue-400' 
                    : 'bg-slate-800 border-slate-700 text-slate-500'
                }`}
             >
               Hypertrophy
             </button>
             <button 
                onClick={() => handleLiftStatusChange('STR')}
                className={`text-xs py-2 rounded border ${
                  liftStatus === 'STR' 
                    ? 'bg-violet-500/20 border-violet-500 text-violet-400 font-bold' 
                    : 'bg-slate-800 border-slate-700 text-slate-500'
                }`}
             >
               Power/Str
             </button>
          </div>
          {liftStatus === 'NONE' && (
             <p className="text-[10px] text-slate-500 text-center italic mt-1">
               *Select tier to credit Chassis Integrity Score
             </p>
          )}
        </div>

        {/* Fueling Audit - Show when required */}
        {(lastRunDuration > 90 || (workout?.constraints?.fuelingTarget && workout.constraints.fuelingTarget > 90)) && (
          <div className="mt-6 pt-6 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-400 mb-4 uppercase">Fueling Audit Required</h4>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-300 mb-2 block">
                  Carbs per Hour (g/hr)
                </label>
                <input
                  type="number"
                  min="0"
                  max="150"
                  value={fuelingCarbsPerHour ?? ''}
                  onChange={(e) => setFuelingCarbsPerHour(e.target.value ? Number(e.target.value) : null)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  placeholder="e.g., 60"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300 mb-2 block">
                  GI Distress (1-10)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={fuelingGiDistress ?? 5}
                    onChange={(e) => setFuelingGiDistress(Number(e.target.value))}
                    className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <span className="text-sm font-mono text-white w-12 text-right">
                    {fuelingGiDistress ?? 5}/10
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                  <span>None</span>
                  <span>Severe</span>
                </div>
              </div>
              <button
                onClick={async () => {
                  if (fuelingCarbsPerHour !== null && fuelingGiDistress !== null) {
                    try {
                      await logFueling(fuelingCarbsPerHour, fuelingGiDistress);
                      await runInitialAnalysis();
                    } catch (err) {
                      logger.error('Failed to save fueling log', err);
                    }
                  }
                }}
                disabled={fuelingCarbsPerHour === null || fuelingGiDistress === null}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-2 rounded-lg transition-colors"
              >
                Save Fueling Audit
              </button>
            </div>
          </div>
        )}

        {/* Show audit pending message */}
        {analysisResult?.auditStatus === 'AUDIT_PENDING' && (
          <div className="mt-6 pt-6 border-t border-red-500/50">
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
              <p className="text-sm text-red-400 font-semibold mb-2">
                Audit Required: Please complete all required inputs above
              </p>
              <p className="text-xs text-slate-400">
                Analysis cannot proceed until all gatekeeper inputs are completed.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <ErrorBoundary>
        <DashboardContent />
      </ErrorBoundary>
    </AuthGuard>
  );
}
