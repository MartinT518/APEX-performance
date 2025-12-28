"use client";

import { useEffect, useState, useMemo } from 'react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { useMonitorStore } from '@/modules/monitor/monitorStore';
import { usePhenotypeStore } from '@/modules/monitor/phenotypeStore';
import { runCoachAnalysis, backfillDailyMonitoring } from '../actions';
import { IAnalysisResult } from '@/types/analysis';
import { calculateValuation, type ValuationResult } from '@/modules/analyze/valuationEngine';
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

import { BrainCircuit } from 'lucide-react';

function BiometricIntelligenceCard() {
  const [narrative, setNarrative] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadNarrative();
  }, []);

  const loadNarrative = async () => {
    try {
      setLoading(true);
      const { getBiometricNarrative } = await import('./actions');
      const result = await getBiometricNarrative();
      if (result.success && result.narrative) {
        setNarrative(result.narrative);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!narrative && !loading) return null;

  return (
    <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-2 mb-3">
        <BrainCircuit className="w-4 h-4 text-violet-400" />
        <span className="text-xs font-bold text-violet-400 uppercase tracking-widest">Physiological Intelligence</span>
      </div>
      
      {loading ? (
        <div className="flex gap-2 items-center text-xs text-slate-500 animate-pulse">
          <div className="w-2 h-2 rounded-full bg-violet-400"></div>
          Analyzing biometrics...
        </div>
      ) : (
        <div className="space-y-3">
             <div className="flex justify-between items-start">
               <div className="text-sm text-white font-medium leading-relaxed max-w-[90%]">
                 "{narrative.reasoning_string}"
               </div>
               <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                   narrative.state_assessment === 'OPTIMAL' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                   narrative.state_assessment.includes('STRESS') ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                   'bg-amber-500/10 text-amber-400 border-amber-500/20'
               }`}>
                 {narrative.state_assessment.replace('_', ' ')}
               </span>
             </div>
             
             <div className="text-xs text-slate-400 bg-slate-950/50 p-3 rounded-lg border border-slate-800/50 italic">
               "{narrative.physiological_story}"
             </div>

             <div className="flex gap-2 items-center">
               <span className="text-[10px] text-slate-500 uppercase">Recommendation:</span>
               <span className="text-xs text-white font-bold">{narrative.recommended_action}</span>
             </div>
        </div>
      )}
    </div>
  );
}

function DashboardContent() {
  const { todayEntries, setNiggleScore, logStrengthSession, logFueling, loadTodayMonitoring, getDaysSinceLastLift } = useMonitorStore();
  const { profile, loadProfile } = usePhenotypeStore();
  const [niggleScore, setNiggleScoreLocal] = useState(0);
  const [liftStatus, setLiftStatus] = useState<'NONE' | 'MAIN' | 'HYPER' | 'STR' | 'EXPL'>('NONE');
  const [showIntervention, setShowIntervention] = useState(false);
  const [showShutdown, setShowShutdown] = useState(false);
  const [showPAR, setShowPAR] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<IAnalysisResult | null>(null);
  const [certaintyScore, setCertaintyScore] = useState(82);
  const [certaintyDelta, setCertaintyDelta] = useState(1.2);
  const [previousCertaintyScore, setPreviousCertaintyScore] = useState<number | null>(null);
  const [hrv, setHrv] = useState<number | null>(null);
  const [drift, setDrift] = useState<number | null>(null);
  const [rhr, setRhr] = useState<number | null>(null);
  const [sleepSeconds, setSleepSeconds] = useState<number | null>(null);
  const [sleepScore, setSleepScore] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fuelingCarbsPerHour, setFuelingCarbsPerHour] = useState<number | null>(null);
  const [fuelingGiDistress, setFuelingGiDistress] = useState<number | null>(null);
  const [lastRunDuration, setLastRunDuration] = useState<number>(0);
  const [valuation, setValuation] = useState<ValuationResult | null>(null);
  const [isChassisDirty, setIsChassisDirty] = useState(false);
  const [auditStatus, setAuditStatus] = useState<'NOMINAL' | 'AUDIT_PENDING' | 'CAUTION'>('NOMINAL');

  // Load data on mount
  useEffect(() => {
    loadTodayMonitoring();
    loadProfile();
    loadBaselineMetrics();
    runInitialAnalysis();
  }, []);

  // Sync from Store to Local State
  useEffect(() => {
    if (todayEntries.niggleScore !== null) setNiggleScoreLocal(todayEntries.niggleScore);
    if (todayEntries.strengthSession?.performed && todayEntries.strengthSession?.tonnageTier) {
      const tier = todayEntries.strengthSession.tonnageTier;
      if (tier === 'maintenance') setLiftStatus('MAIN');
      else if (tier === 'hypertrophy') setLiftStatus('HYPER');
      else if (tier === 'strength' || tier === 'power') setLiftStatus('STR');
      else if (tier === 'explosive') setLiftStatus('EXPL');
    } else {
      setLiftStatus('NONE');
    }
    // Sync fueling data
    if (todayEntries.fuelingLog) {
      setFuelingCarbsPerHour(todayEntries.fuelingLog.carbsPerHour);
      setFuelingGiDistress(todayEntries.fuelingLog.giDistress);
    }
    // Sync Health Metrics
    if (todayEntries.hrv) setHrv(todayEntries.hrv);
    if (todayEntries.rhr) setRhr(todayEntries.rhr);
    if (todayEntries.sleepSeconds) setSleepSeconds(todayEntries.sleepSeconds);
    if (todayEntries.sleepScore) setSleepScore(todayEntries.sleepScore);
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
        .maybeSingle() as { data: any, error: any };

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

      if (latestSession && (latestSession as any).metadata) {
        const metadata = (latestSession as any).metadata as Record<string, unknown>;
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
      
      // Update Audit Status logic
      if (result.auditStatus) {
        setAuditStatus(result.auditStatus as any);
      } else {
        setAuditStatus('NOMINAL');
      }

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
        const valuationResult = calculateValuation(prototypeSessions);
        setValuation(valuationResult);
        
        // Cap probability at 85% - High-Rev athlete always carries 15% risk of structural failure
        const newScore = Math.min(85, valuationResult.blueprintProbability);
        
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

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setNiggleScoreLocal(val);
    setIsChassisDirty(true);
  };

  const handleLiftStatusChange = (status: 'MAIN' | 'HYPER' | 'STR' | 'EXPL') => {
    setLiftStatus(status);
    setIsChassisDirty(true);
  };

  const handleSaveChassisAudit = async () => {
    try {
      setIsLoading(true);
      
      // Save Niggle
      await setNiggleScore(niggleScore);
      
      // Save Strength Status
      const tierMap: Record<string, 'maintenance' | 'hypertrophy' | 'strength' | 'explosive'> = {
        'MAIN': 'maintenance',
        'HYPER': 'hypertrophy',
        'STR': 'strength',
        'EXPL': 'explosive'
      };
      
      const performed = liftStatus !== 'NONE';
      const tier = performed ? tierMap[liftStatus] : undefined;
      
      await logStrengthSession(performed, tier);
      
      // Save Fueling Data
      if (fuelingCarbsPerHour !== null) {
        await logFueling(fuelingCarbsPerHour, fuelingGiDistress || 1);
      }

      // Reload analysis to update Integrity Ratio
      await runInitialAnalysis();
      
      // Trigger intervention if niggle is high
      if (niggleScore > 3) {
        setShowIntervention(true);
      }
      
      setIsChassisDirty(false);
    } catch (err) {
      logger.error('Failed to save chassis audit', err);
    } finally {
      setIsLoading(false);
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
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h2 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-60">Macro-Engine Valuation</h2>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-black text-white tracking-tighter italic">{certaintyScore}%</span>
            <span className="text-xs text-emerald-500 font-bold flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              <TrendingUp className="w-3 h-3" /> +{certaintyDelta}%
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {isHighRev && (
            <div className="bg-slate-900 px-3 py-1.5 rounded-xl text-[10px] font-black text-emerald-500 border border-slate-800 flex items-center gap-1.5 shadow-xl">
              <Activity className="w-3 h-3 animate-pulse" />
              HIGH-REV
            </div>
          )}
          <button 
            onClick={() => {
              setIsLoading(true);
              runInitialAnalysis();
            }}
            disabled={isLoading}
            className="bg-slate-900 p-2 rounded-xl border border-slate-800 text-slate-400 hover:text-emerald-500 hover:border-emerald-500/50 transition-all disabled:opacity-50 group shadow-xl"
            title="Force Re-Analysis"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-500' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
          </button>
        </div>
      </div>

      {/* GO / NO-GO STATUS */}
      <div className={`rounded-xl p-5 border-l-4 shadow-lg transition-all duration-300 ${
        globalStatus === 'SHUTDOWN'
          ? 'bg-red-500/10 border-red-500 shadow-red-900/20'
          : isAdapted 
          ? 'bg-amber-500/10 border-amber-500 shadow-amber-900/20' 
          : auditStatus === 'AUDIT_PENDING'
          ? 'bg-slate-800/50 border-slate-500 shadow-slate-900/20 cursor-not-allowed opacity-75'
          : 'bg-emerald-500/10 border-emerald-500 shadow-emerald-900/20'
      }`}>
        <div className="flex items-center gap-3 mb-2">
          {globalStatus === 'SHUTDOWN' ? (
            <AlertTriangle className="text-red-500" />
          ) : isAdapted ? (
            <AlertTriangle className="text-amber-500" />
          ) : auditStatus === 'AUDIT_PENDING' ? (
            <Activity className="text-slate-500 animate-pulse" />
          ) : (
            <CheckCircle2 className="text-emerald-500" />
          )}
          <h1 className="text-xl font-bold text-white tracking-tight">
            STATUS: {
              globalStatus === 'SHUTDOWN' ? 'SHUTDOWN' : 
              auditStatus === 'AUDIT_PENDING' ? 'INPUTS REQUIRED' :
              globalStatus ?? 'GO'
            }
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

      <BiometricIntelligenceCard />

      {/* CHASSIS vs ENGINE GAUGES */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <Dumbbell className={`w-4 h-4 ${valuation?.integrityRatio && valuation.integrityRatio < 0.8 ? 'text-red-400' : 'text-slate-400'}`} />
            <span className="text-xs font-bold text-slate-400">CHASSIS</span>
          </div>
          <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`absolute top-0 left-0 h-full transition-all duration-500 ${
                !valuation?.integrityRatio ? 'w-[60%] bg-slate-600' :
                valuation.integrityRatio < 0.8 ? 'bg-red-500' :
                valuation.integrityRatio < 1.0 ? 'bg-amber-500' : 'bg-emerald-500'
              }`} 
              style={{ width: `${Math.min(100, (valuation?.integrityRatio || 0.6) * 100)}%` }}
            />
          </div>
          <div className="mt-3 flex justify-between text-[10px] text-slate-500 font-mono">
            <span className={valuation?.integrityRatio && valuation.integrityRatio < 0.8 ? 'text-red-400 font-bold' : ''}>
              {valuation?.chassisVerdict || `LIFT: ${liftStatus === 'NONE' ? `${getDaysSinceLastLift()}d AGO` : 'TODAY'}`}
            </span>
            <span>NIGGLE: {niggleScore}/10</span>
          </div>
        </div>

        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-400">ENGINE (RHR: {rhr ?? '--'})</span>
          </div>
          <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`absolute top-0 left-0 h-full w-[92%] transition-all duration-500 ${
                 !hrv ? 'bg-slate-600' :
                 hrv < 35 ? 'bg-red-500' :
                 hrv < 45 ? 'bg-amber-500' : 'bg-emerald-500'
               }`} 
               style={{ width: `${Math.min(100, (hrv ? (hrv / 80) : 0.6) * 100)}%` }}
            />
          </div>
          <div className="mt-3 flex justify-between text-[10px] text-slate-500 font-mono">
            <span>HRV: {hrv ? `${Math.round(hrv)}ms` : '--'}</span>
            <span>SLEEP: {sleepSeconds ? `${(sleepSeconds / 3600).toFixed(1)}h` : '--'} {sleepScore ? `(${sleepScore})` : ''}</span>
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

              {workout.prehabDrills && workout.prehabDrills.length > 0 && (
                <div className="mt-3 bg-slate-950/50 rounded-lg p-3 border border-slate-800 border-l-4 border-l-violet-500">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-violet-400 uppercase tracking-wider">Structural Integrity</span>
                        <span className="text-[10px] text-slate-500 font-mono">PREHAB</span>
                    </div>
                    <ul className="space-y-1">
                        {workout.prehabDrills.map((drill, idx) => (
                            <li key={idx} className="text-[10px] text-slate-300 flex items-start gap-2">
                                <span className="text-violet-500 font-bold">•</span>
                                {drill}
                            </li>
                        ))}
                    </ul>
                </div>
              )}
              
              {workout.nutritionPlan && (
                <div className="mt-4 bg-slate-950/50 rounded-lg p-3 border border-slate-800 border-l-4 border-l-orange-500">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Fueling Strategy</span>
                        <span className="text-xs font-mono text-white">{workout.nutritionPlan.dailyCalories} kcal</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400 font-mono mb-3">
                        <div className="text-center bg-slate-900 rounded py-1">
                             <span className="block text-slate-500">CARB</span>
                             <span className="text-white">{workout.nutritionPlan.macros.carbs}g</span>
                        </div>
                        <div className="text-center bg-slate-900 rounded py-1">
                             <span className="block text-slate-500">PRO</span>
                             <span className="text-white">{workout.nutritionPlan.macros.protein}g</span>
                        </div>
                        <div className="text-center bg-slate-900 rounded py-1">
                             <span className="block text-slate-500">FAT</span>
                             <span className="text-white">{workout.nutritionPlan.macros.fat}g</span>
                        </div>
                    </div>
                    <div className="space-y-1 text-[10px]">
                        <div className="flex gap-2">
                            <span className="text-orange-500 font-bold min-w-[35px]">PRE:</span>
                            <span className="text-slate-300">{workout.nutritionPlan.contextual.preWorkout}</span>
                        </div>
                        <div className="flex gap-2">
                            <span className="text-orange-500 font-bold min-w-[35px]">INTRA:</span>
                            <span className="text-slate-300">{workout.nutritionPlan.contextual.intraWorkout}</span>
                        </div>
                        <div className="flex gap-2">
                            <span className="text-orange-500 font-bold min-w-[35px]">POST:</span>
                            <span className="text-slate-300">{workout.nutritionPlan.contextual.postWorkout}</span>
                        </div>
                    </div>
                </div>
              )}
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
            {getDaysSinceLastLift() < 7 && liftStatus === 'NONE' && (
              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wider">
                Optional: Lifted {getDaysSinceLastLift()}d ago
              </span>
            )}
            {getDaysSinceLastLift() >= 7 && liftStatus === 'NONE' && (
              <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 uppercase tracking-wider">
                Required: {getDaysSinceLastLift()}d since last lift
              </span>
            )}
          </div>
          {/* Granular Strength Tonnage Input */}
          <div className="grid grid-cols-2 gap-2">
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
             <button 
                onClick={() => handleLiftStatusChange('EXPL')}
                className={`text-xs py-2 rounded border ${
                  liftStatus === 'EXPL' 
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400 font-bold animate-pulse' 
                    : 'bg-slate-800 border-slate-700 text-slate-500'
                }`}
             >
               Explosive/Plyo
             </button>
          </div>
          {liftStatus === 'NONE' && (
             <p className="text-[10px] text-slate-500 text-center italic mt-1">
               *Select tier to credit Chassis Integrity Score
             </p>
          )}

          {/* Fueling Input */}
          <div className="pt-4 border-t border-slate-800">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-white">Run Fueling (Carbs/hr)</span>
              <span className="font-mono font-bold text-orange-400">
                {(fuelingCarbsPerHour || 0) > 0 ? `${fuelingCarbsPerHour}g` : '-'}
              </span>
            </div>
            <div className="flex items-center gap-3">
               <input 
                type="range" 
                min="0" 
                max="120" 
                step="5"
                value={fuelingCarbsPerHour || 0} 
                onChange={(e) => {
                  setFuelingCarbsPerHour(Number(e.target.value));
                  setIsChassisDirty(true);
                }}
                className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <input
                type="number"
                value={fuelingCarbsPerHour || 0}
                onChange={(e) => {
                  setFuelingCarbsPerHour(Number(e.target.value));
                  setIsChassisDirty(true);
                }}
                className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-center text-white font-mono"
              />
            </div>
          </div>

          <button
            onClick={handleSaveChassisAudit}
            disabled={!isChassisDirty || isLoading}
            className={`w-full mt-4 font-bold py-2 rounded-lg transition-all ${
              isChassisDirty 
                ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 animate-pulse' 
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            {isLoading ? 'SAVING...' : isChassisDirty ? 'SAVE CHASSIS AUDIT' : 'CHASSIS LOGGED'}
          </button>

          <button
            onClick={async () => {
                if (confirm('Backfill Dec 1-19 with Niggle:0 and Strength defaults (Dec 17: Power, Dec 16: Explosive)?')) {
                    setIsLoading(true);
                    const res = await backfillDailyMonitoring();
                    if (res.success) {
                        alert(`Successfully backfilled ${res.count} days!`);
                        await runInitialAnalysis();
                    } else {
                        alert(`Backfill failed: ${res.message || res.error}`);
                    }
                    setIsLoading(false);
                }
            }}
            className="w-full mt-2 text-[10px] text-slate-500 hover:text-slate-400 font-mono py-1 border border-slate-800 rounded flex items-center justify-center gap-1"
          >
            <TrendingUp className="w-3 h-3" /> BACKFILL HISTORY
          </button>
        </div>



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
