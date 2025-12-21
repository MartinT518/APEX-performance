import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistNiggleScore, persistStrengthSession, persistFuelingLog } from './monitorStore/logic/persistence';
import { loadTodayMonitoringFromSupabase } from './monitorStore/logic/loader';
import { getTodayDate, getDaysSinceLastLift } from './monitorStore/logic/dateUtils';

export type TonnageTier = 'maintenance' | 'hypertrophy' | 'strength' | 'power' | 'explosive';

interface MonitorState {
  todayEntries: {
    niggleScore: number | null;
    strengthSession: {
      performed: boolean;
      tonnageTier?: TonnageTier;
    } | null;
    fuelingLog: {
      carbsPerHour: number; // g/hr
      giDistress: number; // 1-10
    } | null;
    lastAuditTime: number | null;
  };

  // Historical tracking
  lastLiftDate: string | null; // ISO date string

  // Actions
  setNiggleScore: (score: number) => Promise<void>;
  logStrengthSession: (performed: boolean, tier?: TonnageTier) => Promise<void>;
  logFueling: (carbsPerHour: number, giDistress: number) => Promise<void>;
  resetDailyEntries: () => void;
  getDaysSinceLastLift: () => number;
  getLastLiftTier: () => Promise<TonnageTier | undefined>;
  calculateCurrentWeeklyVolume: () => Promise<number>;
  loadTodayMonitoring: (userId?: string) => Promise<void>;
}

export const useMonitorStore = create<MonitorState>()(
  persist(
    (set, get) => ({
      todayEntries: {
        niggleScore: null,
        strengthSession: null,
        fuelingLog: null,
        lastAuditTime: null,
      },

      lastLiftDate: null,

      setNiggleScore: async (score) => {
        const today = getTodayDate();
        set((state) => ({
          todayEntries: {
            ...state.todayEntries,
            niggleScore: score,
            lastAuditTime: Date.now(),
          },
        }));

        // Persist to Supabase
        const result = await persistNiggleScore(score, today);
        if (!result.success) {
          throw new Error(result.error || 'Failed to save niggle score');
        }
      },

      logStrengthSession: async (performed, tier) => {
        const today = getTodayDate();
        set((state) => ({
          todayEntries: {
            ...state.todayEntries,
            strengthSession: {
              performed,
              tonnageTier: tier,
            },
            lastAuditTime: Date.now(),
          },
          lastLiftDate: performed ? today : state.lastLiftDate,
        }));

        // Persist to Supabase
        const result = await persistStrengthSession(performed, tier, today);
        if (!result.success) {
          throw new Error(result.error || 'Failed to save strength session');
        }
      },

      logFueling: async (carbsPerHour, giDistress) => {
        const today = getTodayDate();
        set((state) => ({
          todayEntries: {
            ...state.todayEntries,
            fuelingLog: {
              carbsPerHour,
              giDistress
            },
            lastAuditTime: Date.now(),
          },
        }));

        // Persist to Supabase (including GI distress)
        const result = await persistFuelingLog(carbsPerHour, giDistress, today);
        if (!result.success) {
          throw new Error(result.error || 'Failed to save fueling log');
        }
      },

      resetDailyEntries: () =>
        set({
          todayEntries: {
            niggleScore: null,
            strengthSession: null,
            fuelingLog: null,
            lastAuditTime: null,
          },
        }),

      getDaysSinceLastLift: () => {
        const state = get();
        return getDaysSinceLastLift(state.lastLiftDate);
      },

      getLastLiftTier: async () => {
        try {
          const { supabase } = await import('@/lib/supabase');
          const { data: session } = await supabase.auth.getSession();
          const userId = session?.session?.user?.id;
          
          if (!userId) return undefined;

          // Query for most recent strength session with tier
          const { data } = await supabase
            .from('daily_monitoring')
            .select('strength_tier')
            .eq('user_id', userId)
            .eq('strength_session', true)
            .not('strength_tier', 'is', null)
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!data?.strength_tier) return undefined;

          // Map DB tier to TonnageTier
          const { dbToTonnageTier } = await import('./monitorStore/logic/tierMapper');
          return dbToTonnageTier(data.strength_tier);
        } catch (err) {
          const { logger } = await import('@/lib/logger');
          logger.warn('Failed to get last lift tier', err);
          return undefined;
        }
      },

      calculateCurrentWeeklyVolume: async () => {
        try {
          const { supabase } = await import('@/lib/supabase');
          const { data: session } = await supabase.auth.getSession();
          const userId = session?.session?.user?.id;
          
          if (!userId) return 0;

          // Get start of current week (Monday)
          const today = new Date();
          const dayOfWeek = today.getDay();
          const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
          const weekStart = new Date(today.setDate(diff));
          weekStart.setHours(0, 0, 0, 0);
          const weekStartStr = weekStart.toISOString().split('T')[0];

          // Query running sessions in current week
          const { data: sessions } = await supabase
            .from('session_logs')
            .select('duration_minutes')
            .eq('user_id', userId)
            .eq('sport_type', 'RUNNING')
            .gte('session_date', weekStartStr)
            .lte('session_date', new Date().toISOString().split('T')[0]);

          if (!sessions) return 0;

          // Convert duration to km (approximate: 1km ≈ 5 minutes for easy pace)
          // This is a rough estimate; in production, use actual distance from metadata if available
          const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
          const weeklyKm = totalMinutes / 5; // Rough conversion

          return Math.round(weeklyKm * 10) / 10; // Round to 1 decimal
        } catch (err) {
          const { logger } = await import('@/lib/logger');
          logger.warn('Failed to calculate weekly volume', err);
          return 0;
        }
      },

      loadTodayMonitoring: async (userId?: string) => {
        const data = await loadTodayMonitoringFromSupabase(userId);
        if (data) {
          set({
            todayEntries: data,
          });
        }
      },
    }),
    {
      name: 'apex-monitor-storage',
    }
  )
);
