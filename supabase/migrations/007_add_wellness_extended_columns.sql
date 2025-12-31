-- Add extended wellness columns to daily_monitoring table
-- Body Battery, Training Readiness, Stress Score, Sleep metrics

ALTER TABLE daily_monitoring
ADD COLUMN IF NOT EXISTS body_battery INTEGER CHECK (body_battery >= 0 AND body_battery <= 100),
ADD COLUMN IF NOT EXISTS training_readiness INTEGER CHECK (training_readiness >= 0 AND training_readiness <= 100),
ADD COLUMN IF NOT EXISTS stress_score INTEGER CHECK (stress_score >= 0 AND stress_score <= 100),
ADD COLUMN IF NOT EXISTS rem_percent DECIMAL(5,2) CHECK (rem_percent >= 0 AND rem_percent <= 100),
ADD COLUMN IF NOT EXISTS deep_percent DECIMAL(5,2) CHECK (deep_percent >= 0 AND deep_percent <= 100),
ADD COLUMN IF NOT EXISTS light_percent DECIMAL(5,2) CHECK (light_percent >= 0 AND light_percent <= 100),
ADD COLUMN IF NOT EXISTS bedtime TIME,
ADD COLUMN IF NOT EXISTS wake_time TIME;

-- Add comments for documentation
COMMENT ON COLUMN daily_monitoring.body_battery IS 'Body Battery score (0-100) from Garmin';
COMMENT ON COLUMN daily_monitoring.training_readiness IS 'Training Readiness score (0-100) from Garmin';
COMMENT ON COLUMN daily_monitoring.stress_score IS 'Stress Score (0-100) from Garmin';
COMMENT ON COLUMN daily_monitoring.rem_percent IS 'REM sleep percentage (0-100)';
COMMENT ON COLUMN daily_monitoring.deep_percent IS 'Deep sleep percentage (0-100)';
COMMENT ON COLUMN daily_monitoring.light_percent IS 'Light sleep percentage (0-100)';
COMMENT ON COLUMN daily_monitoring.bedtime IS 'Bedtime (HH:MM:SS format)';
COMMENT ON COLUMN daily_monitoring.wake_time IS 'Wake time (HH:MM:SS format)';
