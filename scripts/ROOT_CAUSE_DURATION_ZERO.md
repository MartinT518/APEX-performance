# Root Cause: Zero Duration in Database

## Problem
All sessions in Supabase have `duration_minutes = 0` even though training sessions exist in Garmin.

## Root Cause Analysis

### NOT the Database Type
The `int4` (INTEGER) type in PostgreSQL is **NOT** the problem. It can store values from -2,147,483,648 to 2,147,483,647, which is more than sufficient for duration in minutes.

### The Real Problem
The issue is in the **data extraction and validation logic**:

1. **Python Script** (`scripts/sync-garmin-mcp.py`):
   - `extract_duration()` function returns `(0, "none")` when duration cannot be found
   - This 0 gets set as `durationInSeconds: 0` in the activity object

2. **TypeScript Sync** (`src/modules/monitor/ingestion/garminSyncMCP.ts`):
   - **OLD BEHAVIOR**: When `durationInSeconds` is 0, the code would:
     - Try fallback methods (checking details, start/end times, etc.)
     - If all fail, set `durationSeconds = 0`
     - Convert to `durationMinutes = 0`
     - **Store 0 in database** ❌
   
   - **NEW BEHAVIOR**: When duration cannot be extracted:
     - Log detailed error information
     - **Skip the activity** (don't store invalid data) ✅
     - Increment error count
     - Continue to next activity

## Fix Applied

### Changes Made

1. **Skip Invalid Activities**:
   - Activities with zero or missing duration are now **skipped** instead of stored
   - Prevents invalid data from entering the database

2. **Enhanced Validation**:
   - Duration must be at least 1 minute
   - Duration must be less than 1440 minutes (24 hours) - warns if exceeded
   - Multiple fallback methods checked before giving up

3. **Better Logging**:
   - Logs Python script's `durationInSeconds` value immediately
   - Warns if first activity has duration = 0
   - Detailed error logs for activities that are skipped
   - Shows which duration field was used (for successful extractions)

### Code Changes

**Before:**
```typescript
if (!durationSeconds || durationSeconds === 0) {
  // Set duration to 0 and add flag in metadata for manual override
  durationSeconds = 0;
}
const durationMinutes = durationSeconds ? Math.round(durationSeconds / 60) : 0;
// ... stores 0 in database
```

**After:**
```typescript
if (!durationSeconds || durationSeconds === 0) {
  logger.error(`❌ CRITICAL: No valid duration found for activity ${activity.activityId}`);
  // Skip this activity - don't store invalid data
  logger.warn(`⚠️ Skipping activity ${activity.activityId} due to missing duration`);
  errors++;
  continue; // Skip to next activity
}

const durationMinutes = Math.round(durationSeconds / 60);

// Validate duration is reasonable
if (durationMinutes < 1) {
  logger.error(`❌ Invalid duration: ${durationMinutes} minutes`);
  errors++;
  continue;
}
// ... only stores valid durations
```

## Next Steps

### 1. Re-sync Garmin Activities
The fix prevents new zero-duration entries, but existing ones need to be fixed:

```sql
-- Find sessions with zero duration
SELECT id, session_date, sport_type, metadata->>'activityId' as activity_id
FROM session_logs
WHERE duration_minutes = 0
AND source = 'garmin_health';

-- Option 1: Delete invalid sessions (if you want to re-sync)
DELETE FROM session_logs
WHERE duration_minutes = 0
AND source = 'garmin_health';

-- Option 2: Update manually (if you know the correct duration)
UPDATE session_logs
SET duration_minutes = {actual_minutes}
WHERE id = '{session_id}';
```

### 2. Check Python Script Logs
When running sync, check for:
- `"Activity {id}: Extracted duration {seconds}s from {source}"` ✅ (success)
- `"Activity {id}: No valid duration found after checking all sources"` ❌ (failure)

If you see failures, the Python script's `extract_duration()` function may need to be updated to handle your Garmin API response format.

### 3. Verify Fix
After re-syncing, verify no zero durations are stored:
```sql
SELECT COUNT(*) as zero_duration_count
FROM session_logs
WHERE duration_minutes = 0
AND source = 'garmin_health';
-- Should return 0 after fix
```

## Why This Happened

The original code was designed to be "forgiving" - it would store activities even if duration couldn't be extracted, flagging them for manual override. However, this led to:
- Invalid data in database (0 duration)
- Frontend showing "0h 0m" for all sessions
- Difficult to identify which sessions need manual correction

The new approach is **strict validation**:
- Only store activities with valid duration
- Skip activities that can't be validated
- Log detailed errors for debugging
- User can manually add activities if needed

## Summary

- ✅ **Database type (`int4`) is fine** - not the problem
- ✅ **Fix applied**: Skip activities with zero/missing duration
- ✅ **Enhanced validation**: Minimum 1 minute, maximum 24 hours
- ✅ **Better logging**: Detailed error messages for debugging
- ⚠️ **Action required**: Re-sync Garmin activities to populate correct durations
- ⚠️ **Action required**: Clean up existing zero-duration entries in database

