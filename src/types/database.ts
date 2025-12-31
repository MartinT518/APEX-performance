/**
 * Database Types for Supabase
 * 
 * This file defines the TypeScript types that match your Supabase database schema.
 * Update these types to match your actual database tables.
 * 
 * To generate types automatically, use:
 * npx supabase gen types typescript --project-id <your-project-id> > src/types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type StructuralWeakness = 
  | 'patellar_tendon' 
  | 'glute_med' 
  | 'achilles' 
  | 'lower_back' 
  | 'plantar_fascia'
  | 'hip_flexor'
  | 'it_band';

export interface Database {
  public: {
    Tables: {
      phenotype_profiles: {
        Row: {
          id: string;
          user_id: string;
          is_high_rev: boolean;
          max_hr_override: number;
          threshold_hr_known: number | null;
          anaerobic_floor_hr: number;
          structural_weakness: StructuralWeakness[];
          lift_days_required: number;
          niggle_threshold: number;
          goal_marathon_time: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          is_high_rev?: boolean;
          max_hr_override: number;
          threshold_hr_known?: number | null;
          anaerobic_floor_hr: number;
          structural_weakness?: StructuralWeakness[];
          lift_days_required?: number;
          niggle_threshold?: number;
          goal_marathon_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          is_high_rev?: boolean;
          max_hr_override?: number;
          threshold_hr_known?: number | null;
          anaerobic_floor_hr?: number;
          structural_weakness?: StructuralWeakness[];
          lift_days_required?: number;
          niggle_threshold?: number;
          goal_marathon_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      daily_monitoring: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          niggle_score: number | null;
          strength_session: boolean;
          strength_tier: 'Mobility' | 'Hypertrophy' | 'Strength' | 'Power' | null;
          tonnage: number | null;
          fueling_logged: boolean;
          fueling_carbs_per_hour: number | null;
          fueling_gi_distress: number | null;
          hrv: number | null;
          hrv_method: 'GARMIN' | 'MANUAL' | 'UNKNOWN' | null;
          rhr: number | null;
          sleep_seconds: number | null;
          sleep_score: number | null;
          body_battery: number | null;
          training_readiness: number | null;
          stress_score: number | null;
          rem_percent: number | null;
          deep_percent: number | null;
          light_percent: number | null;
          bedtime: string | null;
          wake_time: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          niggle_score?: number | null;
          strength_session?: boolean;
          strength_tier?: 'Mobility' | 'Hypertrophy' | 'Strength' | 'Power' | null;
          tonnage?: number | null;
          fueling_logged?: boolean;
          fueling_carbs_per_hour?: number | null;
          fueling_gi_distress?: number | null;
          hrv?: number | null;
          hrv_method?: 'GARMIN' | 'MANUAL' | 'UNKNOWN' | null;
          rhr?: number | null;
          sleep_seconds?: number | null;
          sleep_score?: number | null;
          body_battery?: number | null;
          training_readiness?: number | null;
          stress_score?: number | null;
          rem_percent?: number | null;
          deep_percent?: number | null;
          light_percent?: number | null;
          bedtime?: string | null;
          wake_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          niggle_score?: number | null;
          strength_session?: boolean;
          strength_tier?: 'Mobility' | 'Hypertrophy' | 'Strength' | 'Power' | null;
          tonnage?: number | null;
          fueling_logged?: boolean;
          fueling_carbs_per_hour?: number | null;
          fueling_gi_distress?: number | null;
          hrv?: number | null;
          hrv_method?: 'GARMIN' | 'MANUAL' | 'UNKNOWN' | null;
          rhr?: number | null;
          sleep_seconds?: number | null;
          sleep_score?: number | null;
          body_battery?: number | null;
          training_readiness?: number | null;
          stress_score?: number | null;
          rem_percent?: number | null;
          deep_percent?: number | null;
          light_percent?: number | null;
          bedtime?: string | null;
          wake_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };

      };

      daily_decision_snapshot: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          global_status: 'GO' | 'ADAPTED' | 'SHUTDOWN';
          reason: string;
          votes_jsonb: Json;
          final_workout_jsonb: Json;
          certainty_score: number | null;
          certainty_delta: number | null;
          inputs_summary_jsonb: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          global_status: 'GO' | 'ADAPTED' | 'SHUTDOWN';
          reason: string;
          votes_jsonb: Json;
          final_workout_jsonb: Json;
          certainty_score?: number | null;
          certainty_delta?: number | null;
          inputs_summary_jsonb?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          global_status?: 'GO' | 'ADAPTED' | 'SHUTDOWN';
          reason?: string;
          votes_jsonb?: Json;
          final_workout_jsonb?: Json;
          certainty_score?: number | null;
          certainty_delta?: number | null;
          inputs_summary_jsonb?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      session_logs: {
        Row: {
          id: string;
          user_id: string;
          session_date: string;
          sport_type: 'RUNNING' | 'CYCLING' | 'STRENGTH' | 'OTHER';
          duration_minutes: number;
          source: 'garmin_health' | 'manual_upload' | 'test_mock';
          hr_source: 'WRIST_HR' | 'CHEST_STRAP' | 'UNKNOWN' | null;
          device: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_date: string;
          sport_type: 'RUNNING' | 'CYCLING' | 'STRENGTH' | 'OTHER';
          duration_minutes: number;
          source?: 'garmin_health' | 'manual_upload' | 'test_mock';
          hr_source?: 'WRIST_HR' | 'CHEST_STRAP' | 'UNKNOWN' | null;
          device?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_date?: string;
          sport_type?: 'RUNNING' | 'CYCLING' | 'STRENGTH' | 'OTHER';
          duration_minutes?: number;
          source?: 'garmin_health' | 'manual_upload' | 'test_mock';
          hr_source?: 'WRIST_HR' | 'CHEST_STRAP' | 'UNKNOWN' | null;
          device?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      agent_votes: {
        Row: {
          id: string;
          session_id: string;
          agent_type: 'STRUCTURAL' | 'METABOLIC' | 'FUELING';
          vote: 'GREEN' | 'YELLOW' | 'RED';
          reasoning: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          agent_type: 'STRUCTURAL' | 'METABOLIC' | 'FUELING';
          vote: 'GREEN' | 'YELLOW' | 'RED';
          reasoning: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          agent_type?: 'STRUCTURAL' | 'METABOLIC' | 'FUELING';
          vote?: 'GREEN' | 'YELLOW' | 'RED';
          reasoning?: string;
          created_at?: string;
        };
      };
      baseline_metrics: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          hrv: number | null;
          tonnage: number | null;
          fueling_carbs_per_hour: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          hrv?: number | null;
          tonnage?: number | null;
          fueling_carbs_per_hour?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          hrv?: number | null;
          tonnage?: number | null;
          fueling_carbs_per_hour?: number | null;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      structural_weakness_type: StructuralWeakness;
      sport_type: 'RUNNING' | 'CYCLING' | 'STRENGTH' | 'OTHER';
      agent_type: 'STRUCTURAL' | 'METABOLIC' | 'FUELING';
      vote_type: 'GREEN' | 'YELLOW' | 'RED';
      strength_tier: 'Mobility' | 'Hypertrophy' | 'Strength' | 'Power';
    };
  };
}

