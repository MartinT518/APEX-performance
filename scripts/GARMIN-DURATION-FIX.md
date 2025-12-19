# Garmin Duration Extraction - Root Cause & Fix

## What I Found

After analyzing your enhanced Garmin MCP repository (`c:\Users\mtamm\Documents\garmin-connect-mcp-main`), I discovered the actual structure of Garmin API responses.

### Actual Garmin API Response Structure

From `data/garmin/activities_2025-12-01_2025-12-05_running.json`:

```json
{
  "activityId": 21167594108,
  "activityName": "Haaslava Running",
  "duration": 5534.32177734375,        // ← FLOAT NUMBER (seconds)
  "elapsedDuration": 5865.61376953125,  // ← FLOAT NUMBER (seconds)
  "movingDuration": 5450.8819580078125,
  ...
}
```

**Key Finding**: The Garmin API returns `duration` as a **float number** (not an object), directly in seconds.

### How the Enhanced MCP Handles It

The enhanced MCP repository (`response_builder.py` line 157-158) simply uses:

```python
if "duration" in activity_dict and activity_dict["duration"] is not None:
    seconds = activity_dict["duration"]  # Direct assignment - works because it's a number
```

This works because `duration` is already a number in the API response.

## The Problem in APEX Performance Repo

Your `scripts/sync-garmin-mcp.py` has an `extract_duration()` function that should handle this, but there might be an issue with:

1. **Type checking**: The function checks `isinstance(duration_obj, (int, float))` which should work
2. **Data transformation**: Maybe the data is being transformed before reaching the extraction function
3. **Fallback logic**: If `duration` is missing, it might not be finding `elapsedDuration` correctly

## The Fix

### Option 1: Simplify Duration Extraction (Recommended)

Since the Garmin API returns `duration` as a number, simplify the extraction:

```python
def extract_duration(activity: dict, details: dict | None = None) -> tuple[int, str]:
    """
    Extract duration from activity data.
    
    The Garmin API returns duration as a float number (seconds) in the activity object.
    """
    # Priority 1: Check duration (direct number from API)
    duration = activity.get('duration')
    if duration and isinstance(duration, (int, float)) and duration > 0:
        return (int(duration), "duration")
    
    # Priority 2: Check elapsedDuration (also a number)
    elapsed = activity.get('elapsedDuration')
    if elapsed and isinstance(elapsed, (int, float)) and elapsed > 0:
        return (int(elapsed), "elapsedDuration")
    
    # Priority 3: Check elapsedDurationInSeconds (if present)
    elapsed_sec = activity.get('elapsedDurationInSeconds')
    if elapsed_sec and isinstance(elapsed_sec, (int, float)) and elapsed_sec > 0:
        return (int(elapsed_sec), "elapsedDurationInSeconds")
    
    # Priority 4: Fall back to details if available
    if details:
        details_duration = details.get('duration')
        if details_duration and isinstance(details_duration, (int, float)) and details_duration > 0:
            return (int(details_duration), "details.duration")
        
        details_elapsed = details.get('elapsedDuration')
        if details_elapsed and isinstance(details_elapsed, (int, float)) and details_elapsed > 0:
            return (int(details_elapsed), "details.elapsedDuration")
    
    return (0, "none")
```

### Option 2: Add Debugging to Current Function

Add logging to see what's actually being received:

```python
def extract_duration(activity: dict, details: dict | None = None) -> tuple[int, str]:
    # ... existing code ...
    
    # Add at the start:
    logger.debug(f"Activity duration field: {activity.get('duration')} (type: {type(activity.get('duration'))})")
    logger.debug(f"Activity elapsedDuration: {activity.get('elapsedDuration')} (type: {type(activity.get('elapsedDuration'))})")
    
    # ... rest of function ...
```

## Verification Steps

1. **Test with your analyzer script**:
   ```bash
   # Copy a sample activity from the enhanced MCP repo
   cp "c:\Users\mtamm\Documents\garmin-connect-mcp-main\data\garmin\activities_2025-12-01_2025-12-05_running.json" scripts/garmin-samples/
   
   # Run the analyzer
   npx tsx scripts/analyze-garmin-export.ts scripts/garmin-samples/activities_2025-12-01_2025-12-05_running.json
   ```

2. **Check Python script logs** during sync:
   - Look for: `"Activity {id}: Extracted duration {seconds}s from {source}"`
   - If you see `"No valid duration found"`, check what fields are actually present

3. **Verify TypeScript receives the value**:
   - Check logs in `garminSyncMCP.ts` for `"Using durationInSeconds from Python script"`
   - If duration is still 0, the Python script isn't extracting it correctly

## Expected Behavior

Based on the sample data:
- `duration: 5534.32177734375` → Should extract as `5534` seconds → `92` minutes
- `elapsedDuration: 5865.61376953125` → Should extract as `5865` seconds → `97` minutes (if duration missing)

## Next Steps

1. **Update `extract_duration()`** in `scripts/sync-garmin-mcp.py` with the simplified version above
2. **Add logging** to trace duration extraction
3. **Re-sync activities** to populate correct durations
4. **Clean up zero-duration entries** in the database:
   ```sql
   DELETE FROM session_logs
   WHERE duration_minutes = 0
   AND source = 'garmin_health';
   ```

## Why This Happened

The original `extract_duration()` function was written to handle multiple possible formats (dict with `totalSeconds`, number, etc.), but the actual Garmin API consistently returns `duration` as a float number. The function should work, but there might be an edge case or data transformation issue causing it to fail.

The fix simplifies the logic to match the actual API response structure, making it more reliable.

