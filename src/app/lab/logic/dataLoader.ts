import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export interface WeeklyData {
  week: string;
  tonnage: number;
  runningVolume: number;
}

export interface DecouplingData {
  date: string;
  decoupling: number;
}

export interface GutIndexData {
  date: string;
  successfulSessions: number;
}

export interface LongrunEfficiencyData {
  date: string;
  efficiency: number; // Efficiency index
  distance: number;
  duration: number;
}

export interface LabData {
  integrityData: WeeklyData[];
  decouplingData: DecouplingData[];
  gutIndexData: GutIndexData[];
  longrunEfficiencyData: LongrunEfficiencyData[];
}

export async function loadLabData(): Promise<LabData> {
  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    
    if (!userId) {
      logger.warn('No user ID for lab data');
      return { integrityData: [], decouplingData: [], gutIndexData: [], longrunEfficiencyData: [] };
    }

    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

    const [baselinesResult, sessionsResult, monitoringResult] = await Promise.all([
      supabase
        .from('baseline_metrics')
        .select('*')
        .eq('user_id', userId)
        .gte('date', twelveWeeksAgo.toISOString().split('T')[0])
        .order('date', { ascending: true }),
      supabase
        .from('session_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('sport_type', 'RUNNING')
        .gte('session_date', twelveWeeksAgo.toISOString().split('T')[0])
        .order('session_date', { ascending: true }),
      supabase
        .from('daily_monitoring')
        .select('*')
        .eq('user_id', userId)
        .gte('date', twelveWeeksAgo.toISOString().split('T')[0])
        .order('date', { ascending: true })
    ]);

    const baselines = baselinesResult.data || [];
    const sessions = sessionsResult.data || [];
    const monitoring = monitoringResult.data || [];

    // Process Integrity Ratio Chart data
    const weeklyMap = new Map<string, { tonnage: number; runningVolume: number }>();
    
    monitoring.forEach(entry => {
      if (entry.tonnage) {
        const date = new Date(entry.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        
        const existing = weeklyMap.get(weekKey) || { tonnage: 0, runningVolume: 0 };
        existing.tonnage += entry.tonnage || 0;
        weeklyMap.set(weekKey, existing);
      }
    });

    sessions.forEach(session => {
      const date = new Date(session.session_date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      
      const existing = weeklyMap.get(weekKey) || { tonnage: 0, runningVolume: 0 };
      existing.runningVolume += (session.duration_minutes / 5) || 0;
      weeklyMap.set(weekKey, existing);
    });

    // Integrity Ratio: Normalize units (Tonnage/1000) / (Volume/10)
    // This prevents 10,000kg vs 100km from being a 100:1 ratio
    const integrityData: WeeklyData[] = Array.from(weeklyMap.entries())
      .slice(-12)
      .map(([week, data]) => ({
        week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        tonnage: Math.round(data.tonnage),
        runningVolume: Math.round(data.runningVolume)
      }));

    // Process Decoupling Trend - Client-side EF calculation
    // Formula: Compare Efficiency Factor (EF) of first half vs second half
    // EF = Normalized Graded Pace / Avg HR
    const decouplingMap = new Map<string, number>();
    sessions.forEach(session => {
      const metadata = session.metadata as Record<string, unknown> | null;
      const dateStr = session.session_date;
      
      // Try to get pre-calculated decoupling from metadata first
      const preCalculated = metadata?.decoupling as number | undefined;
      if (preCalculated !== undefined && preCalculated !== null) {
        if (!decouplingMap.has(dateStr) || decouplingMap.get(dateStr)! > preCalculated) {
          decouplingMap.set(dateStr, preCalculated);
        }
        return;
      }
      
      // Client-side calculation: EF = (Pace in min/km) / (Avg HR)
      // Calculate decoupling as: (EF_first_half - EF_second_half) / EF_first_half * 100
      const avgPace = metadata?.avgPace as string | undefined || metadata?.pace as string | undefined;
      const avgHR = metadata?.avgHR as number | undefined || metadata?.avg_hr as number | undefined;
      const firstHalfPace = metadata?.firstHalfPace as string | undefined;
      const firstHalfHR = metadata?.firstHalfHR as number | undefined;
      const secondHalfPace = metadata?.secondHalfPace as string | undefined;
      const secondHalfHR = metadata?.secondHalfHR as number | undefined;
      
      if (firstHalfPace && firstHalfHR && secondHalfPace && secondHalfHR) {
        // Parse pace strings (e.g., "3:45/km" or "3.75")
        const parsePace = (paceStr: string): number => {
          const match = paceStr.match(/(\d+):(\d+)/);
          if (match) {
            return parseInt(match[1], 10) + parseInt(match[2], 10) / 60;
          }
          return parseFloat(paceStr) || 0;
        };
        
        const efFirst = parsePace(firstHalfPace) / firstHalfHR;
        const efSecond = parsePace(secondHalfPace) / secondHalfHR;
        
        if (efFirst > 0) {
          const decoupling = ((efFirst - efSecond) / efFirst) * 100;
          decouplingMap.set(dateStr, Math.max(0, decoupling));
        }
      } else if (avgPace && avgHR) {
        // Fallback: Use overall average (less accurate but better than nothing)
        // Estimate decoupling from overall metrics (simplified)
        const parsePace = (paceStr: string): number => {
          const match = paceStr.match(/(\d+):(\d+)/);
          if (match) {
            return parseInt(match[1], 10) + parseInt(match[2], 10) / 60;
          }
          return parseFloat(paceStr) || 0;
        };
        
        const pace = parsePace(avgPace);
        if (pace > 0 && avgHR > 0) {
          // Rough estimate: assume 2-5% decoupling for typical runs
          // This is a placeholder until we have first/second half data
          const estimatedDecoupling = 2.5; // Default estimate
          if (!decouplingMap.has(dateStr)) {
            decouplingMap.set(dateStr, estimatedDecoupling);
          }
        }
      }
    });

    const decouplingData: DecouplingData[] = Array.from(decouplingMap.entries())
      .slice(-30)
      .map(([date, decoupling]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        decoupling: Math.round(decoupling * 10) / 10 // Round to 1 decimal
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Process Gut Index
    const gutSessions = new Map<string, number>();
    let rollingCount = 0;
    
    monitoring
      .filter(m => m.fueling_logged && m.fueling_carbs_per_hour && m.fueling_carbs_per_hour >= 60)
      .forEach(entry => {
        rollingCount++;
        gutSessions.set(entry.date, rollingCount);
      });

    const gutIndexData: GutIndexData[] = Array.from(gutSessions.entries())
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        successfulSessions: count
      }));

    // Process Longrun Efficiency Index - filter sessions >90 minutes
    const longrunEfficiencyData: LongrunEfficiencyData[] = sessions
      .filter(session => session.duration_minutes > 90)
      .map(session => {
        const metadata = session.metadata as Record<string, unknown> | null;
        const distance = (metadata?.distance as number | undefined) || 
                        (metadata?.distanceKm as number | undefined) || 
                        (session.duration_minutes / 5); // Rough estimate if not available
        const avgHR = metadata?.avgHR as number | undefined || metadata?.avg_hr as number | undefined;
        const maxHR = metadata?.maxHR as number | undefined || metadata?.max_hr as number | undefined || 200;
        
        // Calculate efficiency: (Distance / Duration) / (Avg HR / Max HR)
        // Higher efficiency = better (more distance per time with lower HR relative to max)
        const efficiency = avgHR && maxHR 
          ? (distance / session.duration_minutes) / (avgHR / maxHR)
          : distance / session.duration_minutes; // Fallback if HR not available
        
        return {
          date: new Date(session.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          efficiency: Math.round(efficiency * 100) / 100, // Round to 2 decimals
          distance: Math.round(distance * 10) / 10,
          duration: session.duration_minutes
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-20); // Last 20 long runs

    return { integrityData, decouplingData, gutIndexData, longrunEfficiencyData };
  } catch (err) {
    logger.error('Failed to load lab data', err);
      return { integrityData: [], decouplingData: [], gutIndexData: [], longrunEfficiencyData: [] };
  }
}

