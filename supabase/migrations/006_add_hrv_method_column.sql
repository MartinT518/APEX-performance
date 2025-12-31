-- Add HRV Method column to daily_monitoring table
-- Tracks whether HRV was measured via Garmin or manually entered

ALTER TABLE daily_monitoring
ADD COLUMN IF NOT EXISTS hrv_method VARCHAR(20) CHECK (hrv_method IN ('GARMIN', 'MANUAL', 'UNKNOWN'));

-- Add comment for documentation
COMMENT ON COLUMN daily_monitoring.hrv_method IS 'Source of HRV measurement: GARMIN (from Garmin device), MANUAL (user entered), or UNKNOWN';

-- Set default for existing rows
UPDATE daily_monitoring
SET hrv_method = 'UNKNOWN'
WHERE hrv_method IS NULL;
