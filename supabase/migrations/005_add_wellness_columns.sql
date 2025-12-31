-- Add wellness columns to daily_monitoring table
-- HRV (Heart Rate Variability), RHR (Resting Heart Rate), Sleep data

ALTER TABLE daily_monitoring 
ADD COLUMN IF NOT EXISTS hrv DECIMAL(6, 2),
ADD COLUMN IF NOT EXISTS rhr INTEGER,
ADD COLUMN IF NOT EXISTS sleep_seconds INTEGER,
ADD COLUMN IF NOT EXISTS sleep_score INTEGER CHECK (sleep_score >= 0 AND sleep_score <= 100);

-- Add comments for documentation
COMMENT ON COLUMN daily_monitoring.hrv IS 'Average overnight HRV (sleep HRV) in milliseconds';
COMMENT ON COLUMN daily_monitoring.rhr IS 'Resting heart rate in beats per minute';
COMMENT ON COLUMN daily_monitoring.sleep_seconds IS 'Total sleep duration in seconds';
COMMENT ON COLUMN daily_monitoring.sleep_score IS 'Sleep quality score (0-100)';
