-- Add source quality flags to session_logs table
-- Tracks HR source (Wrist HR vs. Chest Strap) and device type

ALTER TABLE session_logs
ADD COLUMN IF NOT EXISTS hr_source VARCHAR(20) CHECK (hr_source IN ('WRIST_HR', 'CHEST_STRAP', 'UNKNOWN')),
ADD COLUMN IF NOT EXISTS device VARCHAR(100);

-- Add comments for documentation
COMMENT ON COLUMN session_logs.hr_source IS 'Heart rate data source: WRIST_HR (optical wrist sensor), CHEST_STRAP (chest strap), or UNKNOWN';
COMMENT ON COLUMN session_logs.device IS 'Device name/model used for the activity (e.g., "Garmin Forerunner 945")';

-- Set default for existing rows
UPDATE session_logs
SET hr_source = 'UNKNOWN'
WHERE hr_source IS NULL;
