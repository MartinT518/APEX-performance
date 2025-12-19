-- Coach Audit Logs Table
-- Purpose: Immutable audit trail for all Coach Veto Engine decisions
-- This table logs rule version, vote combinations, and decision paths for auditability

CREATE TABLE IF NOT EXISTS coach_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES session_logs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_version TEXT NOT NULL DEFAULT '1.0',
  vote_combination TEXT NOT NULL, -- e.g., "structural_RED", "structural_RED_metabolic_RED"
  decision_path TEXT NOT NULL, -- JSON string of decision tree path
  substitution_applied TEXT, -- The substitution that was applied
  action_taken TEXT NOT NULL, -- 'EXECUTED_AS_PLANNED' | 'MODIFIED' | 'SKIPPED'
  reasoning TEXT NOT NULL,
  data_integrity_status TEXT, -- 'VALID' | 'SUSPECT' | 'REJECTED'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying by session
CREATE INDEX IF NOT EXISTS idx_coach_audit_logs_session_id ON coach_audit_logs(session_id);

-- Index for querying by user and date
CREATE INDEX IF NOT EXISTS idx_coach_audit_logs_user_date ON coach_audit_logs(user_id, created_at DESC);

-- Index for querying by vote combination (for analysis)
CREATE INDEX IF NOT EXISTS idx_coach_audit_logs_vote_combination ON coach_audit_logs(vote_combination);

-- Enable RLS
ALTER TABLE coach_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own audit logs
CREATE POLICY "Users can view their own audit logs"
  ON coach_audit_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: System can insert audit logs (via service role)
-- Note: In production, this should be restricted to server-side code only
CREATE POLICY "Service role can insert audit logs"
  ON coach_audit_logs
  FOR INSERT
  WITH CHECK (true); -- In production, restrict to service role

-- Comments for documentation
COMMENT ON TABLE coach_audit_logs IS 'Immutable audit trail for Coach Veto Engine decisions. No updates allowed - only inserts.';
COMMENT ON COLUMN coach_audit_logs.rule_version IS 'Version of substitution table used (e.g., "1.0", "2.0")';
COMMENT ON COLUMN coach_audit_logs.vote_combination IS 'Combination of agent votes that triggered decision (e.g., "structural_RED")';
COMMENT ON COLUMN coach_audit_logs.decision_path IS 'JSON string documenting the decision tree path taken';
COMMENT ON COLUMN coach_audit_logs.substitution_applied IS 'The specific substitution protocol that was applied';

