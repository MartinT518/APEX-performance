import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { IPhenotypeProfile, IPhenotypeConfig } from '@/types/phenotype';
import { loadProfileFromSupabase } from './phenotypeStore/logic/profileLoader';
import { updateProfileConfig, toggleHighRevMode } from './phenotypeStore/logic/profileUpdater';
import { isValidProfileId } from './phenotypeStore/logic/validation';
import { createMockProfile } from './phenotypeStore/logic/mockProfile';
import { MOCK_PROFILE_ID } from './phenotypeStore/logic/constants';

interface PhenotypeState {
  profile: IPhenotypeProfile | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setProfile: (profile: IPhenotypeProfile) => void;
  updateConfig: (updates: Partial<IPhenotypeConfig>) => Promise<void>;
  toggleHighRevMode: (enabled: boolean) => Promise<void>;
  loadProfile: (userId?: string) => Promise<void>;
}

export const usePhenotypeStore = create<PhenotypeState>()(
  persist(
    (set, get) => ({
      profile: null,
      isLoading: false,
      error: null,

      setProfile: (profile) => set({ profile }),

      updateConfig: async (updates) => {
        const state = get();
        if (!state.profile) {
          throw new Error('No profile loaded. Call loadProfile() first.');
        }

        // Validate and reload if mock ID
        if (!isValidProfileId(state.profile.id)) {
          await get().loadProfile();
          const updatedState = get();
          if (!updatedState.profile || !isValidProfileId(updatedState.profile.id)) {
            throw new Error('Cannot update profile: No valid profile found. Please reload the page.');
          }
        }

        set({ isLoading: true, error: null });

        try {
          const updatedProfile = await updateProfileConfig(state.profile, updates);
          set({ profile: updatedProfile, isLoading: false });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
          set({ error: errorMessage, isLoading: false });
          throw err;
        }
      },

      toggleHighRevMode: async (enabled) => {
        const state = get();
        if (!state.profile) {
          throw new Error('No profile loaded. Call loadProfile() first.');
        }

        // Validate and reload if mock ID
        if (!isValidProfileId(state.profile.id)) {
          await get().loadProfile();
          const updatedState = get();
          if (!updatedState.profile || !isValidProfileId(updatedState.profile.id)) {
            throw new Error('Cannot update profile: No valid profile found. Please reload the page.');
          }
        }

        set({ isLoading: true, error: null });

        try {
          const updatedProfile = await toggleHighRevMode(state.profile, enabled);
          set({ profile: updatedProfile, isLoading: false });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to update high-rev mode';
          set({ error: errorMessage, isLoading: false });
          throw err;
        }
      },

      loadProfile: async (userId?: string) => {
        set({ isLoading: true, error: null });

        try {
          const profile = await loadProfileFromSupabase(userId);
          set({ profile, isLoading: false });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load profile';
          console.error('Error loading phenotype profile:', err);
          
          // Only fallback to mock data if no user is authenticated (for development)
          const { data: session } = await (await import('@/lib/supabase')).supabase.auth.getSession();
          const targetUserId = userId || session?.session?.user?.id;

          if (!targetUserId) {
            const mockProfile = createMockProfile();
            set({ 
              profile: mockProfile, 
              isLoading: false, 
              error: errorMessage 
            });
          } else {
            // User is authenticated but profile load failed - don't use mock data
            set({ 
              profile: null, 
              isLoading: false, 
              error: errorMessage 
            });
          }
        }
      },
    }),
    {
      name: 'apex-phenotype-storage',
      partialize: (state) => {
        // Don't persist mock profiles - they cause UUID errors
        if (state.profile && state.profile.id === MOCK_PROFILE_ID) {
          return { profile: null };
        }
        return { profile: state.profile };
      },
      onRehydrateStorage: () => (state) => {
        // Clear mock profiles on rehydration
        if (state?.profile?.id === MOCK_PROFILE_ID) {
          state.profile = null;
        }
      },
    }
  )
);
