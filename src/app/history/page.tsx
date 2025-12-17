"use client";

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { createClient } from '@/lib/supabase';
import { DecisionReviewCard } from '@/components/history/DecisionReviewCard';
import { logger } from '@/lib/logger';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';

interface SessionLog {
  id: string;
  session_date: string;
  sport_type: 'RUNNING' | 'CYCLING' | 'STRENGTH' | 'OTHER';
  duration_minutes: number;
  source: 'garmin_health' | 'manual_upload' | 'test_mock';
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface AgentVote {
  id: string;
  session_id: string;
  agent_type: 'STRUCTURAL' | 'METABOLIC' | 'FUELING';
  vote: 'GREEN' | 'YELLOW' | 'RED';
  reasoning: string;
  created_at: string;
}

interface SessionWithVotes extends SessionLog {
  votes: AgentVote[];
}

function HistoryContent() {
  const [sessions, setSessions] = useState<SessionWithVotes[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterSport, setFilterSport] = useState<'ALL' | 'RUNNING' | 'CYCLING' | 'STRENGTH' | 'OTHER'>('ALL');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadSessions();
  }, [filterSport, dateRange]);

  async function loadSessions() {
    setIsLoading(true);
    setError(null);
    
    try {
      const supabase = createClient();
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      
      if (!userId) {
        setError('Not authenticated');
        setIsLoading(false);
        return;
      }

      // Build query
      let query = supabase
        .from('session_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('session_date', dateRange.start)
        .lte('session_date', dateRange.end)
        .order('session_date', { ascending: false })
        .limit(50);

      if (filterSport !== 'ALL') {
        query = query.eq('sport_type', filterSport);
      }

      const { data: sessionLogs, error: logsError } = await query;

      if (logsError) throw logsError;

      // Fetch votes for each session
      const sessionsWithVotes: SessionWithVotes[] = await Promise.all(
        (sessionLogs || []).map(async (log) => {
          const { data: votes } = await supabase
            .from('agent_votes')
            .select('*')
            .eq('session_id', log.id)
            .order('created_at', { ascending: true });

          return {
            ...log,
            votes: votes || []
          };
        })
      );

      setSessions(sessionsWithVotes);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load sessions';
      logger.error('Failed to load session history', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white p-8 font-sans ml-64">
        <div className="flex items-center justify-center h-64">
          <p className="text-zinc-400">Loading session history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white p-8 font-sans ml-64">
        <div className="flex items-center justify-center h-64">
          <p className="text-red-400">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans ml-64">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-zinc-100">Session History</h1>

        {/* Filters */}
        <div className="mb-6 flex gap-4 items-center">
          <div>
            <label className="text-sm text-zinc-400 mr-2">Sport Type:</label>
            <select
              value={filterSport}
              onChange={(e) => setFilterSport(e.target.value as any)}
              className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white"
            >
              <option value="ALL">All</option>
              <option value="RUNNING">Running</option>
              <option value="CYCLING">Cycling</option>
              <option value="STRENGTH">Strength</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          
          <div>
            <label className="text-sm text-zinc-400 mr-2">Start Date:</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white"
            />
          </div>
          
          <div>
            <label className="text-sm text-zinc-400 mr-2">End Date:</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white"
            />
          </div>
        </div>

        {/* Sessions List */}
        {sessions.length === 0 ? (
          <div className="text-center py-12 text-zinc-400">
            <p>No sessions found for the selected filters.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <DecisionReviewCard key={session.id} session={session} />
            ))}
          </div>
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

