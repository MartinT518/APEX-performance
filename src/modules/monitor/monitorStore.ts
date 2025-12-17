import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistNiggleScore, persistStrengthSession, persistFuelingLog } from './monitorStore/logic/persistence';
import { loadTodayMonitoringFromSupabase } from './monitorStore/logic/loader';
import { getTodayDate, getDaysSinceLastLift } from './monitorStore/logic/dateUtils';

export type TonnageTier = 'maintenance' | 'hypertrophy' | 'strength' | 'power';

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

        // Persist to Supabase
        const result = await persistFuelingLog(carbsPerHour, today);
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
