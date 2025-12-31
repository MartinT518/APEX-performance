-- Add goal_marathon_time column to phenotype_profiles table
-- Format: "HH:MM:SS" (e.g., "2:20:00" for 2:20:00 goal)

ALTER TABLE phenotype_profiles
ADD COLUMN IF NOT EXISTS goal_marathon_time VARCHAR(8) DEFAULT '2:30:00';

-- Add comment for clarity
COMMENT ON COLUMN phenotype_profiles.goal_marathon_time IS 'Target marathon time in HH:MM:SS format (e.g., "2:20:00" for 2:20:00 goal)';
