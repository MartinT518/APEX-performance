# Garmin Data Import & Duration Debugging

## Problem
History trainings show 0 durations even though training sessions exist in Garmin.

## Root Cause Analysis

The issue is in the data flow from Garmin → Python Script → TypeScript → Database:

1. **Python Script** (`scripts/sync-garmin-mcp.py`):
   - Extracts duration using `extract_duration()` function
   - Returns `durationInSeconds` in the activity object (line 225)

2. **TypeScript Sync** (`src/modules/monitor/ingestion/garminSyncMCP.ts`):
   - Previously checked `elapsedDurationInSeconds` first (which doesn't exist in Python response)
   - Now fixed to check `durationInSeconds` first (matching Python output)

3. **Database Storage**:
   - Duration is stored in `session_logs.duration_minutes`
   - Also stored in `metadata.durationMinutes` for reference

4. **Frontend Display** (`src/types/prototype.ts`):
   - Converts `session.duration_minutes` to formatted string: `${hours}h ${minutes}m`
   - If `duration_minutes` is 0, displays as "0h 0m"

## Debugging Steps

### 1. Run Debug Script

**Prerequisites:**
- Ensure `.env.local` exists with Supabase credentials:
  ```env
  SUPABASE_URL=your_supabase_url
  SUPABASE_SECRET_DEFAULT_KEY=your_service_role_key
  ```
- Or use legacy format:
  ```env
  NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
  ```

**Finding your User ID:**

Option 1: Use the helper script:
```bash
npx tsx scripts/list-users.ts
```

Option 2: Get it from Supabase dashboard:
- Go to Authentication → Users
- Copy the UUID for your user

**Usage:**
```bash
# Run with your user ID:
npx tsx scripts/debug-garmin-duration.ts <your_user_id>
```

**Example:**
```bash
npx tsx scripts/debug-garmin-duration.ts 123e4567-e89b-12d3-a456-426614174000
```

This will:
- Load the last 20 Garmin sessions from database for the specified user
- Show `duration_minutes` value for each session
- Show metadata fields related to duration
- Identify which sessions have zero duration
- Provide a summary with next steps

### 2. Check Python Script Output

The Python script logs duration extraction to stderr. Check logs when syncing:

```bash
# When running sync, check for these log messages:
# "Activity {id}: Extracted duration {seconds}s from {source}"
# "Activity {id}: No valid duration found after checking all sources"
```

### 3. Verify Database Values

Query the database directly:

```sql
SELECT 
  id,
  session_date,
  sport_type,
  duration_minutes,
  metadata->>'activityId' as activity_id,
  metadata->>'activityName' as activity_name,
  metadata->>'durationInSeconds' as duration_in_seconds,
  metadata->>'requiresManualDuration' as requires_manual
FROM session_logs
WHERE source = 'garmin_health'
ORDER BY session_date DESC
LIMIT 10;
```

### 4. Test with Sample Garmin File

To test the import flow with actual Garmin data:

1. Export a sample activity from Garmin Connect (JSON format)
2. Save it to `scripts/sample-garmin-activity.json`
3. Create a test script that:
   - Reads the JSON file
   - Simulates the Python script's `extract_duration()` function
   - Verifies duration extraction works correctly

## Fixes Applied

1. **Priority Order Fixed**: Changed TypeScript to check `durationInSeconds` first (matching Python output)
2. **Better Logging**: Added debug logs to trace duration extraction
3. **Interface Updated**: Updated `MCPActivity` interface to match Python response format

## Next Steps

1. Run the debug script to see current state
2. Re-sync Garmin activities to populate correct durations
3. If durations are still 0, check:
   - Python script logs for duration extraction failures
   - Garmin API response structure (may have changed)
   - Database constraints (duration_minutes NOT NULL)

## Manual Override

If duration cannot be extracted automatically, the system sets `requiresManualDuration: true` in metadata. You can:

1. Query sessions with zero duration:
   ```sql
   SELECT * FROM session_logs 
   WHERE duration_minutes = 0 
   AND metadata->>'requiresManualDuration' = 'true';
   ```

2. Update manually:
   ```sql
   UPDATE session_logs 
   SET duration_minutes = {actual_minutes}
   WHERE id = '{session_id}';
   ```

