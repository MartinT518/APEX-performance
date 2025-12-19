# Garmin Export Samples

Place your Garmin export JSON files here for analysis.

## Quick Start

1. **Export a Garmin activity** (see `../README-ANALYZE-GARMIN.md` for methods)
2. **Save it here** as `activity-<id>.json` or `activity-<date>.json`
3. **Run the analyzer**:
   ```bash
   npx tsx scripts/analyze-garmin-export.ts scripts/garmin-samples/activity-123.json
   ```

## Example File Names

- `activity-21238182165.json` - Single activity by ID
- `activities-2025-01-27.json` - Multiple activities from a date
- `activity-details-21238182165.json` - Full activity details

## What to Look For

After running the analyzer, check:
- ✅ Does it extract a valid duration? (should be > 0 seconds)
- ⚠️ What source was used? (e.g., "duration (number)", "elapsedDuration")
- ❌ If extraction fails, what duration fields ARE present?

This will help identify why `duration_minutes = 0` in the database.

