import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export interface SessionLog {
  id: string;
  session_date: string;
  sport_type: 'RUNNING' | 'CYCLING' | 'STRENGTH' | 'OTHER';
  duration_minutes: number;
  source: 'garmin_health' | 'manual_upload' | 'test_mock';
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AgentVote {
  id: string;
  session_id: string;
  agent_type: 'STRUCTURAL' | 'METABOLIC' | 'FUELING';
  vote: 'GREEN' | 'YELLOW' | 'RED';
  reasoning: string;
  created_at: string;
}

export interface DailyMonitoring {
  niggle_score: number | null;
  strength_session: boolean;
  strength_tier: 'Mobility' | 'Hypertrophy' | 'Strength' | 'Power' | null;
  tonnage: number | null;
  fueling_logged: boolean;
  fueling_carbs_per_hour: number | null;
}

export interface SessionWithVotes extends SessionLog {
  votes: AgentVote[];
  dailyMonitoring?: DailyMonitoring | null;
}

export async function loadSessionsWithVotes(
  userId: string,
  dateRange: { start: string; end: string },
  filterSport: 'ALL' | 'RUNNING' | 'CYCLING' | 'STRENGTH' | 'OTHER'
): Promise<SessionWithVotes[]> {
  try {
    // Validate date range - use defaults if empty or invalid
    const startDate = dateRange.start && dateRange.start.trim() !== '' 
      ? dateRange.start 
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const endDate = dateRange.end && dateRange.end.trim() !== '' 
      ? dateRange.end 
      : new Date().toISOString().split('T')[0];

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      logger.warn(`Invalid date format in dateRange: start=${dateRange.start}, end=${dateRange.end}`);
      throw new Error('Invalid date format. Expected YYYY-MM-DD');
    }

    let query = supabase
      .from('session_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('session_date', startDate)
      .lte('session_date', endDate)
      .order('session_date', { ascending: false })
      .limit(50);

    if (filterSport !== 'ALL') {
      query = query.eq('sport_type', filterSport);
    }

    const { data: sessionLogs, error: logsError } = await query;

    if (logsError) throw logsError;

    // Debug logging
    logger.info(`Loaded ${sessionLogs?.length || 0} sessions for date range ${startDate} to ${endDate}, sport filter: ${filterSport}`);
    if (sessionLogs && sessionLogs.length > 0) {
      logger.info(`Session dates: ${sessionLogs.map((s: SessionLog) => s.session_date).join(', ')}`);
    }

    const sessionsWithVotes: SessionWithVotes[] = await Promise.all(
      (sessionLogs || []).map(async (log: SessionLog) => {
        const [votesResult, monitoringResult] = await Promise.all([
          supabase
            .from('agent_votes')
            .select('*')
            .eq('session_id', log.id)
            .order('created_at', { ascending: true }),
          supabase
            .from('daily_monitoring')
            .select('*')
            .eq('user_id', userId)
            .eq('date', log.session_date)
            .maybeSingle()
        ]);

        return {
          ...log,
          votes: (votesResult.data as AgentVote[]) || [],
          dailyMonitoring: monitoringResult.data as DailyMonitoring | null
        };
      })
    );

    return sessionsWithVotes;
  } catch (err) {
    logger.error('Failed to load session history', err);
    throw err;
  }
}

