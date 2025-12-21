"use client";

import { useState, useEffect } from 'react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { SessionDetailView } from '@/components/shared/SessionDetailView';
import { loadSessionsWithVotes } from './logic/sessionLoader';
import { sessionWithVotesToPrototype } from '@/types/prototype';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, RefreshCw, Download, Clock } from 'lucide-react';
import { logger } from '@/lib/logger';
import type { PrototypeSessionDetail } from '@/types/prototype';
import { syncGarminSessions } from '../actions';

type HistorySubView = 'list' | 'detail';

function HistoryContent() {
  const [subView, setSubView] = useState<HistorySubView>('list');
  const [selectedSession, setSelectedSession] = useState<PrototypeSessionDetail | null>(null);
  const [sessions, setSessions] = useState<PrototypeSessionDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [syncCooldown, setSyncCooldown] = useState<number | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'up_to_date' | 'cooldown'>('idle');

  useEffect(() => {
    loadSessions();
    checkSyncStatus();
    
    // Auto-sync on app foregrounding (check every 30 seconds)
    const interval = setInterval(() => {
      checkSyncStatus();
    }, 30000);
    
    // Also check when window gains focus
    const handleFocus = () => {
      checkSyncStatus();
    };
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const checkSyncStatus = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      
      if (!userId) return;
      
      // Check last sync time from database
      const { data: lastSession } = await supabase
        .from('session_logs')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const lastSessionTyped = lastSession as { created_at: string } | null;
      if (lastSessionTyped?.created_at) {
        const lastSync = new Date(lastSessionTyped.created_at);
        const now = new Date();
        const minutesSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60);
        
        if (minutesSinceSync < 5) {
          setSyncStatus('up_to_date');
          setLastSyncTime(lastSync);
        } else {
          setSyncStatus('idle');
        }
      } else {
        setSyncStatus('idle');
      }
    } catch (err) {
      logger.warn('Failed to check sync status', err);
    }
  };

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      
      if (!userId) {
        setIsLoading(false);
        return;
      }

      // Load last 30 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const sessionsWithVotes = await loadSessionsWithVotes(
        userId,
        {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0]
        },
        'ALL'
      );

      // Debug: Log raw session data
      logger.info(`Loaded ${sessionsWithVotes.length} sessions from database`);
      if (sessionsWithVotes.length > 0) {
        logger.info('Sample session metadata:', JSON.stringify(sessionsWithVotes[0].metadata, null, 2));
      }

      // Convert to prototype format
      const prototypeSessions = sessionsWithVotes.map(s => 
        sessionWithVotesToPrototype(s, s.dailyMonitoring || null)
      );

      // Debug: Log converted sessions
      if (prototypeSessions.length > 0) {
        logger.info('Sample converted session:', JSON.stringify(prototypeSessions[0], null, 2));
      }

      setSessions(prototypeSessions);
    } catch (err) {
      logger.error('Failed to load history', err);
      // Show error to user
      setSessions([]);
    } finally {
      setIsLoading(false);
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

  const handleClearAllSessions = async () => {
    if (!confirm('Are you sure you want to delete all synced sessions? This cannot be undone.')) {
      return;
    }

    setIsSyncing(true);
    setSyncMessage('');
    
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      
      if (!userId) {
        setSyncMessage('Please log in to clear sessions.');
        setIsSyncing(false);
        return;
      }

      // Delete all sessions for this user
      const { error } = await supabase
        .from('session_logs')
        .delete()
        .eq('user_id', userId)
        .eq('source', 'garmin_health');

      if (error) {
        setSyncMessage('Failed to clear sessions: ' + error.message);
      } else {
        setSyncMessage('All sessions cleared. You can now re-sync.');
        setSessions([]);
        // Auto-sync after clearing
        setTimeout(() => {
          handleSyncGarmin(false);
        }, 1000);
      }
    } catch (err) {
      logger.error('Failed to clear sessions', err);
      setSyncMessage('Failed to clear sessions.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncGarmin = async (forceUpdate: boolean = false) => {
    setIsSyncing(true);
    setSyncMessage('');
    
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      
      if (!userId) {
        setSyncMessage('Please log in to sync Garmin data.');
        setIsSyncing(false);
        return;
      }

      // Default to last 30 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const result = await syncGarminSessions(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        userId,
        forceUpdate // Force update if requested
      );

      if (result.inCooldown && result.minutesRemaining) {
        setSyncCooldown(result.minutesRemaining);
        setSyncStatus('cooldown');
        setSyncMessage(`Sync in cooldown. Please wait ${result.minutesRemaining} more minute(s).`);
      } else if (result.success) {
        setSyncMessage(`Successfully synced ${result.synced || 0} session(s).`);
        setSyncStatus('up_to_date');
        setLastSyncTime(new Date());
        // Reload sessions after sync
        await loadSessions();
      } else {
        setSyncStatus('idle');
        setSyncMessage(result.message || 'Sync failed. Please try again.');
      }
    } catch (err) {
      logger.error('Failed to sync Garmin', err);
      setSyncMessage('Sync failed. Please check your Garmin credentials and try again.');
    } finally {
      setIsSyncing(false);
      // Clear message after 5 seconds
      setTimeout(() => {
        setSyncMessage('');
        setSyncCooldown(null);
      }, 5000);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 pb-24 p-4">
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-400">Loading session history...</p>
        </div>
      </div>
    );
  }

  if (subView === 'detail' && selectedSession) {
    return <SessionDetailView session={selectedSession} onBack={handleBack} />;
  }

  return (
    <div className="space-y-6 pb-24 p-4">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Black Box</h1>
          <p className="text-sm text-slate-400">Audit Log & Data Integrity</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleSyncGarmin(false)}
            disabled={isSyncing || (syncCooldown !== null && syncCooldown > 0)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              isSyncing || (syncCooldown !== null && syncCooldown > 0)
                ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                : syncStatus === 'up_to_date'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-slate-900 border-slate-700 text-white hover:bg-slate-800'
            }`}
            title={
              syncStatus === 'up_to_date' 
                ? `Last synced: ${lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'Recently'}`
                : 'Sync Garmin activities'
            }
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">Syncing...</span>
              </>
            ) : syncCooldown !== null && syncCooldown > 0 ? (
              <>
                <Clock className="w-4 h-4" />
                <span className="text-sm">Wait {syncCooldown}m</span>
              </>
            ) : syncStatus === 'up_to_date' ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm">Up to Date</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span className="text-sm">Sync Garmin</span>
              </>
            )}
          </button>
          <button
            onClick={() => handleSyncGarmin(true)}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Update existing sessions with enhanced metadata (distance, pace, HR, etc.)"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm">Update</span>
          </button>
          <button
            onClick={handleClearAllSessions}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete all synced sessions and re-sync from Garmin"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm">Clear & Re-sync</span>
          </button>
        </div>
      </header>
      
      {syncMessage && (
        <div className={`p-3 rounded-lg border ${
          syncMessage.includes('Successfully') 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
        }`}>
          <p className="text-sm">{syncMessage}</p>
        </div>
      )}

      <div className="space-y-3">
        {sessions.length === 0 ? (
          <div className="text-center py-12 text-slate-400 space-y-4">
            <p className="text-lg font-semibold">No sessions found</p>
            <p className="text-sm">Sync Garmin data to see your training history.</p>
            <button
              onClick={() => handleSyncGarmin(false)}
              disabled={isSyncing || (syncCooldown !== null && syncCooldown > 0)}
              className="mt-4 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
            >
              <Download className="w-4 h-4" />
              {isSyncing ? 'Syncing...' : 'Sync Garmin Now'}
            </button>
          </div>
        ) : (
          sessions
            .filter(s => !s.hidden)
            .map((session) => (
            <button 
              key={session.id} 
              onClick={() => handleSelectSession(session)}
              className="w-full bg-slate-900 rounded-xl overflow-hidden border border-slate-800 hover:bg-slate-800 transition-colors text-left"
            >
              <div className="p-4 flex justify-between items-start">
                <div className="flex gap-3">
                  <div className={`mt-1 ${
                    session.type === 'EXEC' ? 'text-emerald-500' : 'text-amber-500'
                  }`}>
                    {session.type === 'EXEC' ? <CheckCircle2 className="w-5 h-5" /> : <RefreshCw className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-slate-500">{session.day}</span>
                      {session.integrity === 'SUSPECT' && (
                        <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 rounded border border-red-500/20">
                          SUSPECT DATA
                        </span>
                      )}
                      {session.integrity === 'VALID' && (
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 rounded">
                          VALID
                        </span>
                      )}
                      {session.compliance && (
                        <span className={`text-[10px] px-1.5 rounded border ${
                          session.compliance === 'COMPLIANT' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : session.compliance === 'SUBSTITUTED'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {session.compliance}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-white text-sm mb-1">{session.title}</h3>
                    <div className="text-xs text-slate-400 space-y-0.5">
                      {session.objective && (
                        <div className="line-clamp-1">Mission: {session.objective}</div>
                      )}
                      <div className="flex items-center gap-3">
                        {session.distance && (
                          <span>{session.distance.toFixed(1)}km</span>
                        )}
                        {session.pace && (
                          <span className={session.integrity === 'SUSPECT' ? 'text-red-400' : ''}>
                            Pace: {session.integrity === 'SUSPECT' ? 'INVALID' : session.pace}
                          </span>
                        )}
                        {session.trainingType && (
                          <span>Type: {session.trainingType}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-mono font-bold text-slate-300">
                    {typeof session.load === 'number' ? session.load : session.load}
                  </div>
                  <div className="text-[10px] text-slate-600">LOAD</div>
                </div>
              </div>
              
              {session.agentFeedback && (
                <div className="bg-slate-950 px-4 py-2 border-t border-slate-800 flex gap-4 text-[10px] font-mono">
                  <span className={session.agentFeedback.structural.includes('RED') ? 'text-red-400' : 'text-emerald-500'}>
                    STRUCT: {session.agentFeedback.structural.split('.')[0]}
                  </span>
                  <span className={session.agentFeedback.metabolic.includes('AMBER') ? 'text-amber-400' : 'text-emerald-500'}>
                    META: {session.agentFeedback.metabolic.split('.')[0]}
                  </span>
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <AuthGuard>
      <ErrorBoundary>
        <HistoryContent />
      </ErrorBoundary>
    </AuthGuard>
  );
}
