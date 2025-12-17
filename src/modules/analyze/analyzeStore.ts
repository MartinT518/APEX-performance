import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { calculateUpdatedBaselines } from './analyzeStore/logic/baselineCalculator';
import { persistBaselineMetrics } from './analyzeStore/logic/persistence';
import { loadBaselinesFromSupabase } from './analyzeStore/logic/loader';
import { recalculateBlueprintConfidence } from './analyzeStore/logic/blueprint';
import type { Baselines, BaselineHistory } from './analyzeStore/logic/baselineCalculator';

interface AnalyzeState {
  baselines: Baselines;
  history: BaselineHistory;

  // Actions
  ingestDailyMetrics: (metrics: { hrv?: number; tonnage?: number; fuelingCarbs?: number }) => Promise<void>;
  recalculateBlueprint: (goalMetric: number) => Promise<void>;
  loadBaselines: (userId?: string) => Promise<void>;
}

const INITIAL_BASELINES: Baselines = {
  hrv7Day: null,
  hrv28Day: null,
  tonnage7Day: null,
  gutTrainingIndex: 0,
  confidenceScore: "UNKNOWN"
};

const INITIAL_HISTORY: BaselineHistory = {
  hrv: [],
  tonnage: [],
  fuelingSessions: []
};

export const useAnalyzeStore = create<AnalyzeState>()(
  persist(
    (set, get) => ({
      baselines: INITIAL_BASELINES,
      history: INITIAL_HISTORY,

      ingestDailyMetrics: async ({ hrv, tonnage, fuelingCarbs }) => {
        const today = new Date().toISOString().split('T')[0];
        const state = get();
        
        const { baselines: newBaselines, history: newHistory } = calculateUpdatedBaselines(
          state.baselines,
          state.history,
          { hrv, tonnage, fuelingCarbs }
        );

        set({ baselines: newBaselines, history: newHistory });

        // Persist to Supabase (best effort, don't block UI)
        await persistBaselineMetrics({ hrv, tonnage, fuelingCarbs }, today);
      },

      recalculateBlueprint: async (goalMetric) => {
        const state = get();
        const confidenceScore = recalculateBlueprintConfidence(
          state.baselines.tonnage7Day,
          goalMetric
        );

        set(state => ({
          baselines: {
            ...state.baselines,
            confidenceScore
          }
        }));
      },

      loadBaselines: async (userId?: string) => {
        const data = await loadBaselinesFromSupabase(userId);
        if (data) {
          set({
            history: data.history,
            baselines: {
              ...data.baselines,
              confidenceScore: get().baselines.confidenceScore, // Preserve existing
            },
          });
        }
      }
    }),
    {
      name: 'apex-analyze-storage',
    }
  )
);
