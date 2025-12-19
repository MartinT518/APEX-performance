"use client";

import { useState, useEffect } from 'react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { SessionDetailView } from '@/components/shared/SessionDetailView';
import { PostActionReport } from '@/components/shared/PostActionReport';
import { runCoachAnalysis } from '../actions';
import { workoutToPrototypeSession } from '@/types/prototype';
import { IAnalysisResult } from '@/types/analysis';
import { 
  RefreshCw, 
  CheckCircle2, 
  Hammer, 
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import type { PrototypeSessionDetail } from '@/types/prototype';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

type PlanSubView = 'list' | 'detail';

function PlanContent() {
  const [subView, setSubView] = useState<PlanSubView>('list');
  const [selectedSession, setSelectedSession] = useState<PrototypeSessionDetail | null>(null);
  const [showPAR, setShowPAR] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<IAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<PrototypeSessionDetail[]>([]);
  const [pastSessions, setPastSessions] = useState<Map<string, { type: string; status: 'executed' | 'substituted' }>>(new Map());

  useEffect(() => {
    loadPlanData();
    loadPastSessions();
  }, []);

  const loadPastSessions = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      
      if (!userId) {
        logger.warn('No user ID found when loading past sessions');
        return;
      }

      // Load past 3 days and next 3 days (7 days total to cover calendar range)
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 3); // 3 days ago
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 3); // 3 days forward
      endDate.setHours(23, 59, 59, 999);
      
      const { data: sessions, error } = await supabase
        .from('session_logs')
        .select('session_date, sport_type, metadata, duration_minutes')
        .eq('user_id', userId)
        .gte('session_date', startDate.toISOString().split('T')[0])
        .lte('session_date', endDate.toISOString().split('T')[0])
        .order('session_date', { ascending: false });

      if (error) {
        logger.error('Failed to query past sessions', error);
        return;
      }

      logger.info(`Loaded ${sessions?.length || 0} sessions for tactical map`);

      const sessionMap = new Map<string, { type: string; status: 'executed' | 'substituted' }>();
      
      sessions?.forEach((s) => {
        const metadata = s.metadata as Record<string, unknown> | null;
        // Check if session was substituted (explicit flag or substitution option present)
        const isSubstituted = metadata?.substituted === true || 
                             (metadata?.substitutionOption !== undefined && metadata?.substitutionOption !== null);
        
        // Normalize session_date to YYYY-MM-DD format (handle both date strings and Date objects)
        let dateKey = s.session_date;
        if (dateKey instanceof Date) {
          dateKey = dateKey.toISOString().split('T')[0];
        } else if (typeof dateKey === 'string') {
          // Ensure it's in YYYY-MM-DD format (remove time if present)
          dateKey = dateKey.split('T')[0];
        }
        
        sessionMap.set(dateKey, {
          type: s.sport_type,
          status: isSubstituted ? 'substituted' : 'executed'
        });
        
        // Debug logging
        logger.info(`Session mapped: ${dateKey} -> ${s.sport_type} (${isSubstituted ? 'substituted' : 'executed'})`);
      });
      
      logger.info(`Session map keys: ${Array.from(sessionMap.keys()).join(', ')}`);
      setPastSessions(sessionMap);
    } catch (err) {
      logger.error('Failed to load past sessions', err);
    }
  };

  const loadPlanData = async () => {
    try {
      console.log('[Tactical Map] Starting loadPlanData...');
      logger.info('Loading plan data for tactical map');

      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      
      const result = await runCoachAnalysis(userId);
      console.log('[Tactical Map] runCoachAnalysis result:', {
        success: result.success,
        hasDecision: !!result.decision,
        hasFinalWorkout: !!result.decision?.finalWorkout,
        decisionKeys: result.decision ? Object.keys(result.decision) : [],
        message: result.message
      });
      
      if (result.success) {
        setAnalysisResult(result);
        
        // Generate upcoming sessions from analysis result
        const sessions: PrototypeSessionDetail[] = [];
        
        if (result.decision?.finalWorkout) {
          console.log('[Tactical Map] finalWorkout found:', result.decision.finalWorkout);
          const today = new Date();
          const workout = result.decision.finalWorkout;
          
          // Today's workout
          const todaySession = workoutToPrototypeSession(workout, 'Today');
          console.log('[Tactical Map] Today session created:', todaySession);
          sessions.push(todaySession);
          
          // Generate a few future sessions (mock for now - would come from plan)
          for (let i = 1; i <= 3; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
            
            // Create mock future sessions
            const futureSession = {
              id: 100 + i,
              day: dayName,
              title: i === 1 ? 'Chassis Hardening (HLRT)' : i === 2 ? '32km Simulation Run' : 'Aerobic Flush (Bike)',
              type: i === 1 ? 'STR' : i === 2 ? 'KEY' : 'REC',
              load: i === 2 ? 'EXTREME' : i === 1 ? 'MED' : 'LOW',
              duration: i === 2 ? '2h 15m' : '60 min',
              objective: i === 1 
                ? 'Max Force Production & Tendon Stiffness'
                : i === 2
                ? 'Glycogen Depletion Management'
                : 'Non-impact blood flow to accelerate recovery',
              protocol: i === 1 ? {
                warmup: '10 min Mobility (Hips/Ankles) + Core Activation',
                main: [
                  'A1. Hex Bar Deadlift: 4 x 5 @ 85% 1RM',
                  'A2. Box Jumps: 4 x 3 (Max Height)',
                  'B1. Bulgarian Split Squat: 3 x 8/leg (Heavy)',
                  'B2. Soleus Calf Raises: 3 x 12 (Slow Eccentric)'
                ],
                cooldown: '5 min Dead Hangs & Decompression'
              } : i === 2 ? {
                warmup: '15 min Easy (HR < 145)',
                main: [
                  '3 x 5km @ Marathon Pace (Target: 3:33/km)',
                  'Recovery: 1km Float (4:00/km) between reps'
                ],
                cooldown: '10 min flush jog'
              } : {
                warmup: '10 min spin',
                main: ['40 min steady Zone 1 Power'],
                cooldown: '10 min spin'
              },
              constraints: i === 1 ? [
                'Leave 2 Reps In Reserve (RIR 2)',
                'Perfect Form > Weight',
                'Rest 3 min between heavy sets'
              ] : i === 2 ? [
                'HR Cap: Do not exceed 188 bpm',
                'Cadence: Maintain >178 spm when fatigued'
              ] : ['Cadence > 90 rpm', 'Power < 150w']
            };
            console.log(`[Tactical Map] Future session ${i} created:`, futureSession);
            sessions.push(futureSession);
          }
        } else {
          console.warn('[Tactical Map] No finalWorkout in decision:', {
            hasDecision: !!result.decision,
            decision: result.decision
          });
          logger.warn('No finalWorkout found in analysis result for tactical map');
        }
        
        console.log(`[Tactical Map] Total sessions generated: ${sessions.length}`, sessions);
        logger.info(`Generated ${sessions.length} upcoming sessions for tactical map`);
        setUpcomingSessions(sessions);
      } else {
        console.error('[Tactical Map] runCoachAnalysis failed:', result.message);
        setError(result.message || 'Analysis unsuccessful');
        logger.error('Failed to load plan data - analysis unsuccessful', result.message);
      }
    } catch (err) {
      console.error('[Tactical Map] Error in loadPlanData:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      logger.error('Failed to load plan data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSession = (session: PrototypeSessionDetail) => {
    setSelectedSession(session);
    setSubView('detail');
  };

  const handleBack = () => {
    setSubView('list');
    setSelectedSession(null);
  };

  const handleComplete = () => {
    setShowPAR(true);
  };

  if (subView === 'detail' && selectedSession) {
    return <SessionDetailView session={selectedSession} onBack={handleBack} onComplete={handleComplete} />;
  }

  // Generate calendar days - past 3 days, today, and next 3 days (7 days total)
  // Days 4-7 are "Provisional" (subject to Daily Chassis Audit)
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day
  const calendarDays = [];
  
  // Start 3 days ago, go through today, then 3 days forward (7 days total)
  for (let i = -3; i <= 3; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    // Use local date string to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const sessionInfo = pastSessions.get(dateStr);
    const isPast = i < 0;
    const isToday = i === 0;
    
    // Debug logging for first render
    if (i === -3 && process.env.NODE_ENV === 'development') {
      logger.info(`Calendar day ${dateStr}: sessionInfo = ${sessionInfo ? JSON.stringify(sessionInfo) : 'null'}`);
    }
    
    calendarDays.push({
      day: date.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0),
      date: date.getDate(),
      dateStr: dateStr,
      isToday: isToday,
      isPast: isPast,
      isProvisional: i >= 1, // Days after today are provisional
      sessionInfo
    });
  }

  return (
    <div className="space-y-6 pb-24 p-4 animate-in fade-in duration-300">
      {showPAR && <PostActionReport onClose={() => setShowPAR(false)} />}
      
      <header>
        <h1 className="text-2xl font-bold text-white mb-1">Tactical Map</h1>
        <p className="text-sm text-slate-400">Phase 2: Metabolic Hybrid Block</p>
      </header>

      {/* Calendar Grid */}
      <div className="bg-slate-900 rounded-xl p-1 overflow-x-auto border border-slate-800">
        <div className="flex justify-between min-w-[300px]">
          {calendarDays.map((day, i) => {
            // Determine icon based on session status
            let icon = null;
            if (day.isPast && day.sessionInfo) {
              if (day.sessionInfo.status === 'substituted') {
                icon = <RefreshCw className="w-3 h-3 text-amber-500" />;
              } else if (day.sessionInfo.status === 'executed') {
                icon = <CheckCircle2 className="w-3 h-3 text-emerald-500" />;
              }
            } else if (day.isPast && !day.sessionInfo) {
              // Past day with no session - show missed indicator
              icon = <AlertCircle className="w-3 h-3 text-slate-600" />;
            }
            
            return (
              <div 
                key={i} 
                className={`flex flex-col items-center p-3 rounded-lg min-w-[13%] relative ${
                  day.isToday ? 'bg-slate-800 ring-1 ring-emerald-500' : ''
                } ${day.isProvisional ? 'opacity-60 border border-dashed border-slate-700' : ''}`}
                title={
                  day.isProvisional 
                    ? 'Subject to Daily Chassis Audit' 
                    : day.isPast && day.sessionInfo
                    ? `${day.sessionInfo.type} - ${day.sessionInfo.status}`
                    : day.isPast
                    ? 'No session recorded'
                    : 'Future session'
                }
              >
                <span className="text-[10px] text-slate-500 mb-1">{day.day}</span>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${
                  day.isPast 
                    ? 'bg-slate-800 text-slate-400' 
                    : day.isToday 
                    ? 'bg-emerald-500 text-slate-950' 
                    : day.isProvisional
                    ? 'bg-slate-800/30 text-slate-500 border border-dashed border-slate-600'
                    : 'bg-slate-800/50 text-slate-600'
                }`}>
                  {day.date}
                </div>
                {day.isProvisional && !day.isPast && (
                  <AlertCircle className="w-3 h-3 text-slate-500 mt-1" title="Provisional - Subject to Daily Chassis Audit" />
                )}
                {icon}
              </div>
            );
          })}
        </div>
      </div>

      {/* Debug info - remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-slate-600 mt-2 space-y-1">
          <div>Loaded {pastSessions.size} sessions from database</div>
          <div>Session dates: {Array.from(pastSessions.keys()).join(', ')}</div>
          <div>Calendar dates: {calendarDays.map(d => d.dateStr).join(', ')}</div>
          <div>Matching sessions: {calendarDays.filter(d => d.sessionInfo).length}</div>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase">Upcoming Operations</h3>
        {upcomingSessions.length === 0 ? (
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-center">
            <p className="text-slate-500 text-sm mb-2">No upcoming sessions loaded</p>
            <p className="text-slate-600 text-xs mb-2">
              {loading ? 'Analyzing Chassis & Engine...' : error ? error : 'Analysis completed but no workout generated'}
            </p>
            {error && error.includes('Audit Required') && (
              <button 
                onClick={() => window.location.href = '/'}
                className="mt-4 px-4 py-2 bg-emerald-500 text-slate-950 rounded-lg text-xs font-bold hover:bg-emerald-400 transition-colors"
              >
                COMPLETE DAILY LOG
              </button>
            )}
            {process.env.NODE_ENV === 'development' && (
              <div className="text-xs text-slate-600 mt-2 space-y-1 text-left">
                <div>Analysis result: {analysisResult ? '✅ Loaded' : '❌ Not loaded'}</div>
                <div>Has decision: {analysisResult?.decision ? '✅ Yes' : '❌ No'}</div>
                <div>Has finalWorkout: {analysisResult?.decision?.finalWorkout ? '✅ Yes' : '❌ No'}</div>
                {analysisResult?.decision && (
                  <div>Decision keys: {Object.keys(analysisResult.decision).join(', ')}</div>
                )}
                {analysisResult?.error && (
                  <div className="text-red-400">Error: {String(analysisResult.error)}</div>
                )}
              </div>
            )}
          </div>
        ) : (
          upcomingSessions.map((s) => (
            <button 
              key={s.id} 
              onClick={() => handleSelectSession(s)}
              className="w-full bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center justify-between hover:bg-slate-800 transition-colors group text-left"
            >
              <div>
                <div className="text-xs text-slate-500 mb-0.5">{s.day}</div>
                <div className="font-bold text-white text-sm">{s.title}</div>
              </div>
              <div className="flex items-center gap-3">
                {s.type === 'KEY' && (
                  <div className="bg-red-500/10 text-red-400 text-[10px] px-2 py-1 rounded border border-red-500/20">
                    KEY
                  </div>
                )}
                {s.type === 'STR' && (
                  <div className="bg-violet-500/10 text-violet-400 text-[10px] px-2 py-1 rounded border border-violet-500/20">
                    STR
                  </div>
                )}
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-500 transition-colors" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default function PlanPage() {
  return (
    <AuthGuard>
      <ErrorBoundary>
        <PlanContent />
      </ErrorBoundary>
    </AuthGuard>
  );
}
