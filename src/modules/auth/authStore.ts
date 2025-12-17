import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  getCurrentUser: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      set({
        user: data.user,
        session: data.session,
        isLoading: false,
        error: null,
      });

      return { error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to sign in');
      set({
        isLoading: false,
        error: error.message,
      });
      return { error };
    }
  },

  signUp: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      set({
        user: data.user,
        session: data.session,
        isLoading: false,
        error: null,
      });

      return { error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to sign up');
      set({
        isLoading: false,
        error: error.message,
      });
      return { error };
    }
  },

  signOut: async () => {
    set({ isLoading: true });

    try {
      await supabase.auth.signOut();
      set({
        user: null,
        session: null,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to sign out');
      set({
        isLoading: false,
        error: error.message,
      });
    }
  },

  getCurrentUser: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      set({
        user: session?.user ?? null,
        session: session ?? null,
      });
    } catch (err) {
      console.error('Error getting current user:', err);
    }
  },

  initialize: async () => {
    if (get().isInitialized) return;

    // Get initial session
    await get().getCurrentUser();

    // Listen for auth state changes
    supabase.auth.onAuthStateChange((_event, session) => {
      set({
        user: session?.user ?? null,
        session: session ?? null,
        isInitialized: true,
      });
    });

    set({ isInitialized: true });
  },
}));

