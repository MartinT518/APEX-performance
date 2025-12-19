-- Daily Decision Snapshot Table
-- Purpose: Cache daily coach analysis results to avoid repeated heavy computation
-- Stores computed status, votes, final workout plan, and certainty metrics

-- Add fueling_gi_distress column to daily_monitoring
ALTER TABLE daily_monitoring 
ADD COLUMN IF NOT EXISTS fueling_gi_distress INTEGER CHECK (fueling_gi_distress >= 1 AND fueling_gi_distress <= 10);

-- Create daily_decision_snapshot table
CREATE TABLE IF NOT EXISTS daily_decision_snapshot (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  global_status TEXT NOT NULL CHECK (global_status IN ('GO', 'ADAPTED', 'SHUTDOWN')),
  reason TEXT NOT NULL,
  votes_jsonb JSONB NOT NULL,
  final_workout_jsonb JSONB NOT NULL,
  certainty_score DECIMAL(5, 2),
  certainty_delta DECIMAL(5, 2),
  inputs_summary_jsonb JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_decision_snapshot_user_id ON daily_decision_snapshot(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_decision_snapshot_date ON daily_decision_snapshot(date);
CREATE INDEX IF NOT EXISTS idx_daily_decision_snapshot_user_date ON daily_decision_snapshot(user_id, date);

-- Enable RLS
ALTER TABLE daily_decision_snapshot ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own daily decision snapshots"
  ON daily_decision_snapshot FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily decision snapshots"
  ON daily_decision_snapshot FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily decision snapshots"
  ON daily_decision_snapshot FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger for updated_at timestamp
CREATE TRIGGER update_daily_decision_snapshot_updated_at
  BEFORE UPDATE ON daily_decision_snapshot
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE daily_decision_snapshot IS 'Cached daily coach analysis results. Invalidated when inputs change.';
COMMENT ON COLUMN daily_decision_snapshot.global_status IS 'Computed status: GO, ADAPTED, or SHUTDOWN based on agent votes';
COMMENT ON COLUMN daily_decision_snapshot.votes_jsonb IS 'JSON array of agent votes with colors/labels';
COMMENT ON COLUMN daily_decision_snapshot.final_workout_jsonb IS 'Final workout plan (post-substitution if applied)';
COMMENT ON COLUMN daily_decision_snapshot.inputs_summary_jsonb IS 'Summary of inputs used for this decision (for cache invalidation)';

