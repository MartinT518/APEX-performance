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

    // Fetch all monitoring data for the range at once
    const { data: monitoringData, error: monitoringError } = await supabase
      .from('daily_monitoring')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (monitoringError) throw monitoringError;

    // Fetch all votes for these sessions
    const sessionIds = (sessionLogs || []).map(log => log.id);
    const { data: allVotes, error: votesError } = sessionIds.length > 0 
      ? await supabase.from('agent_votes').select('*').in('session_id', sessionIds)
      : { data: [], error: null };

    if (votesError) throw votesError;

    // Create a map for quick access
    const monitoringMap = new Map(monitoringData?.map(m => [m.date, m]) || []);
    const votesBySession = new Map<string, AgentVote[]>();
    (allVotes || []).forEach(vote => {
      const existing = votesBySession.get(vote.session_id) || [];
      existing.push(vote as AgentVote);
      votesBySession.set(vote.session_id, existing);
    });

    const sessionsWithVotes: SessionWithVotes[] = (sessionLogs || []).map(log => ({
      ...log,
      votes: votesBySession.get(log.id) || [],
      dailyMonitoring: monitoringMap.get(log.session_date) as DailyMonitoring | null
    }));

    // CRITICAL: Synthesis of 'Virtual' Strength Sessions
    // If a day has a strength_session in monitoring but NO session log of type STRENGTH,
    // we inject a virtual session so the valuation engine can see the chassis data.
    monitoringData?.forEach(m => {
      if (m.strength_session) {
        const hasSession = sessionsWithVotes.some(s => s.session_date === m.date && s.sport_type === 'STRENGTH');
        if (!hasSession && (filterSport === 'ALL' || filterSport === 'STRENGTH')) {
          const isMobility = m.strength_tier === 'Mobility' || !m.strength_tier;
          sessionsWithVotes.push({
            id: `virtual-${m.date}`,
            session_date: m.date,
            sport_type: 'STRENGTH',
            duration_minutes: 45, 
            source: 'manual_upload',
            metadata: { 
              virtual: true, 
              hidden: isMobility, // Hide mobility/stretching from training log
              strengthTier: m.strength_tier,
              activityName: isMobility ? `Audit: Maintenance` : `Audit: ${m.strength_tier} Lift` 
            },
            created_at: m.updated_at || m.date,
            votes: [], 
            dailyMonitoring: m as DailyMonitoring
          });
        }
      }
    });

    // Re-sort and filter out hidden sessions for the UI
    return sessionsWithVotes.sort((a, b) => b.session_date.localeCompare(a.session_date));
  } catch (err) {
    logger.error('Failed to load session history', err);
    throw err;
  }
}

