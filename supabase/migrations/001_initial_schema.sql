-- APEX Performance Database Schema
-- Run this migration in your Supabase SQL Editor to set up the initial schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE structural_weakness_type AS ENUM (
  'patellar_tendon',
  'glute_med',
  'achilles',
  'lower_back',
  'plantar_fascia',
  'hip_flexor',
  'it_band'
);

CREATE TYPE sport_type AS ENUM (
  'RUNNING',
  'CYCLING',
  'STRENGTH',
  'OTHER'
);

CREATE TYPE agent_type AS ENUM (
  'STRUCTURAL',
  'METABOLIC',
  'FUELING'
);

CREATE TYPE vote_type AS ENUM (
  'GREEN',
  'YELLOW',
  'RED'
);

CREATE TYPE strength_tier AS ENUM (
  'Mobility',
  'Hypertrophy',
  'Strength',
  'Power'
);

-- Phenotype Profiles Table (FR-M1)
CREATE TABLE phenotype_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_high_rev BOOLEAN NOT NULL DEFAULT true,
  max_hr_override INTEGER NOT NULL,
  threshold_hr_known INTEGER,
  anaerobic_floor_hr INTEGER NOT NULL,
  structural_weakness structural_weakness_type[] DEFAULT ARRAY[]::structural_weakness_type[],
  lift_days_required INTEGER DEFAULT 3,
  niggle_threshold INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Daily Monitoring Table (FR-M2)
CREATE TABLE daily_monitoring (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  niggle_score INTEGER CHECK (niggle_score >= 0 AND niggle_score <= 10),
  strength_session BOOLEAN DEFAULT false,
  strength_tier strength_tier,
  tonnage DECIMAL(10, 2),
  fueling_logged BOOLEAN DEFAULT false,
  fueling_carbs_per_hour DECIMAL(5, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Session Logs Table (FR-K1)
CREATE TABLE session_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  sport_type sport_type NOT NULL,
  duration_minutes INTEGER NOT NULL,
  source VARCHAR(50) DEFAULT 'manual_upload',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent Votes Table (FR-E1)
CREATE TABLE agent_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES session_logs(id) ON DELETE CASCADE,
  agent_type agent_type NOT NULL,
  vote vote_type NOT NULL,
  reasoning TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Baseline Metrics Table (FR-R1)
CREATE TABLE baseline_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hrv DECIMAL(6, 2),
  tonnage DECIMAL(10, 2),
  fueling_carbs_per_hour DECIMAL(5, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Indexes for performance
CREATE INDEX idx_phenotype_profiles_user_id ON phenotype_profiles(user_id);
CREATE INDEX idx_daily_monitoring_user_id ON daily_monitoring(user_id);
CREATE INDEX idx_daily_monitoring_date ON daily_monitoring(date);
CREATE INDEX idx_session_logs_user_id ON session_logs(user_id);
CREATE INDEX idx_session_logs_date ON session_logs(session_date);
CREATE INDEX idx_agent_votes_session_id ON agent_votes(session_id);
CREATE INDEX idx_baseline_metrics_user_id ON baseline_metrics(user_id);
CREATE INDEX idx_baseline_metrics_date ON baseline_metrics(date);

-- Row Level Security (RLS) Policies
ALTER TABLE phenotype_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE baseline_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own data
CREATE POLICY "Users can view own phenotype profile"
  ON phenotype_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own phenotype profile"
  ON phenotype_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own phenotype profile"
  ON phenotype_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own daily monitoring"
  ON daily_monitoring FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily monitoring"
  ON daily_monitoring FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily monitoring"
  ON daily_monitoring FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own session logs"
  ON session_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own session logs"
  ON session_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own agent votes"
  ON agent_votes FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM session_logs WHERE id = agent_votes.session_id));

CREATE POLICY "Users can insert own agent votes"
  ON agent_votes FOR INSERT
  WITH CHECK (auth.uid() = (SELECT user_id FROM session_logs WHERE id = agent_votes.session_id));

CREATE POLICY "Users can view own baseline metrics"
  ON baseline_metrics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own baseline metrics"
  ON baseline_metrics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own baseline metrics"
  ON baseline_metrics FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_phenotype_profiles_updated_at
  BEFORE UPDATE ON phenotype_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_monitoring_updated_at
  BEFORE UPDATE ON daily_monitoring
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_session_logs_updated_at
  BEFORE UPDATE ON session_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

