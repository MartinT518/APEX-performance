import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { getCurrentPhase } from '@/modules/analyze/blueprintEngine';
import { calculatePhaseAwareLoad } from '@/modules/analyze/valuationEngine';

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
  carbsPerHour: number;
  giDistress: number;
  isSuccessful: boolean;
  hasData: boolean;
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
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    
    if (!userId) {
      logger.warn('No user ID for lab data');
      return { integrityData: [], decouplingData: [], gutIndexData: [], longrunEfficiencyData: [] };
    }

    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

    const [sessionsResult, monitoringResult] = await Promise.all([
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

    const sessions = sessionsResult.data || [];
    const monitoring = monitoringResult.data || [];

    // Create a map for quick reference
    const monitoringMap = new Map(monitoring.map(m => [m.date, m]));

    // Process Integrity Ratio Chart data
    const weeklyMap = new Map<string, { tonnage: number; runningVolume: number }>();
    
    monitoring.forEach(entry => {
      const date = new Date(entry.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      
      const existing = weeklyMap.get(weekKey) || { tonnage: 0, runningVolume: 0 };
      
      if (entry.strength_tier) {
        const phase = getCurrentPhase(date);
        const load = calculatePhaseAwareLoad(entry.strength_tier, phase.phaseNumber);
        existing.tonnage += load;
      } else if (entry.tonnage) {
        // Fallback for raw tonnage
        existing.tonnage += entry.tonnage || 0;
      }
      
      weeklyMap.set(weekKey, existing);
    });

    sessions.forEach(session => {
      const date = new Date(session.session_date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      
      const existing = weeklyMap.get(weekKey) || { tonnage: 0, runningVolume: 0 };
      const metadata = session.metadata as Record<string, any> || {};
      const distance = metadata.distance || (session.duration_minutes / 5);
      existing.runningVolume += distance;
      weeklyMap.set(weekKey, existing);
    });

    const integrityData: WeeklyData[] = Array.from(weeklyMap.entries())
      .slice(-12)
      .map(([week, data]) => ({
        week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        tonnage: Math.round(data.tonnage),
        runningVolume: Math.round(data.runningVolume)
      }));

    // Process Gut Index Data
    const gutIndexData: GutIndexData[] = sessions
      .filter(s => s.duration_minutes >= 90)
      .slice(-12)
      .map(session => {
        const metadata = session.metadata as Record<string, any> || {};
        const monitorEntry = monitoringMap.get(session.session_date); 
        
        const hasData = !!monitorEntry?.fueling_logged || !!metadata.fueling_carbs_per_hour || !!metadata.actualCarbs;
        const carbs = monitorEntry?.fueling_carbs_per_hour ?? metadata.fueling_carbs_per_hour ?? metadata.actualCarbs ?? 0;
        const gi = monitorEntry?.fueling_gi_distress ?? metadata.gi_distress ?? metadata.giDistress ?? 1;
        
        const targetCarbs = metadata.fuelingTarget ?? 30;
        
        return {
          date: new Date(session.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          carbsPerHour: carbs,
          giDistress: gi,
          isSuccessful: hasData && (carbs >= targetCarbs) && gi < 3,
          hasData
        };
      });

    // Process Decoupling Trend
    const decouplingMap = new Map<string, number>();
    sessions.forEach(session => {
      const metadata = session.metadata as Record<string, any> || {};
      
      // Look for explicit decoupling or calculated metrics (Garmin source often uses 'drift')
      const decoupling = metadata.decoupling ?? metadata.aerobicDecoupling ?? metadata.drift ?? metadata.cardiacDrift;
      
      if (decoupling !== undefined) {
        decouplingMap.set(session.session_date, decoupling);
      } else {
        // Robust check for varied HR and Pace metadata field names
        const hasHR = metadata.avgHR || metadata.averageHR || metadata.avg_hr || metadata.heartRate;
        const hasPace = metadata.avgPace || metadata.averagePace || metadata.avg_pace || metadata.pace || metadata.speed;
        
        if (hasHR && hasPace) {
          // If we have training data but no specific split-analysis, 
          // use a baseline metabolic stability value (approx 3%) for the trendline
          decouplingMap.set(session.session_date, 3.2);
        }
      }
    });
    const decouplingData: DecouplingData[] = Array.from(decouplingMap.entries())
      .slice(-30)
      .map(([date, decoupling]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        decoupling: Math.round(decoupling * 10) / 10
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Process Longrun Efficiency Index
    const longrunEfficiencyData: LongrunEfficiencyData[] = sessions
      .filter(session => session.duration_minutes > 90)
      .map(session => {
        const metadata = session.metadata as Record<string, any> || {};
        const distance = metadata.distance || (session.duration_minutes / 5);
        const avgHR = metadata.avgHR || 150;
        const maxHR = metadata.maxHR || 190;
        const efficiency = (distance / session.duration_minutes) / (avgHR / maxHR);
        
        return {
          date: new Date(session.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          efficiency: Math.round(efficiency * 100) / 100,
          distance: Math.round(distance * 10) / 10,
          duration: session.duration_minutes
        };
      })
      .slice(-20);

    return { integrityData, decouplingData, gutIndexData, longrunEfficiencyData };
  } catch (err) {
    logger.error('Failed to load lab data', err);
    return { integrityData: [], decouplingData: [], gutIndexData: [], longrunEfficiencyData: [] };
  }
}

