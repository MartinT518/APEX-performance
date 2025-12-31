-- Extend session_logs.metadata JSONB to include biomechanical metrics
-- These fields will be stored in the metadata JSONB column
-- No schema change needed, but document expected structure

-- Note: This migration doesn't alter the schema since metadata is already JSONB
-- It serves as documentation of the expected biomechanical fields structure

COMMENT ON COLUMN session_logs.metadata IS 'JSONB metadata including:
- Biomechanical: groundContactTime (ms), strideLength (cm), verticalOscillation (cm), verticalRatio (%)
- Power: averagePower (W), maxPower (W), normalizedPower (W)
- Advanced: avgStepFrequency (spm), avgGradeAdjustedSpeed (m/s), movingDuration (s)
- Standard: distanceKm, avgPace, avgHR, maxHR, avgCadence, calories, elevationGain';

-- Example structure for metadata:
-- {
--   "groundContactTime": 213.1,
--   "strideLength": 153.11,
--   "verticalOscillation": 10.07,
--   "verticalRatio": 6.6,
--   "averagePower": 425.0,
--   "maxPower": 523.0,
--   "normalizedPower": 426.0,
--   "avgStepFrequency": 173.34,
--   "avgGradeAdjustedSpeed": 4.46,
--   "movingDuration": 1079.0
-- }
