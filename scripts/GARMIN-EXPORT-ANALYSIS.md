# Garmin Export Analysis - Quick Guide

## Problem

Garmin activities are showing `duration_minutes = 0` in the database and frontend, even though the activities have valid durations in Garmin Connect.

## Solution

I've created a tool to analyze Garmin export files and verify the data structure.

## Files Created

1. **`scripts/analyze-garmin-export.ts`** - Main analysis script
2. **`scripts/README-ANALYZE-GARMIN.md`** - Detailed documentation
3. **`scripts/garmin-samples/`** - Directory for your export files

## Quick Start

### Step 1: Get a Garmin Export File

**Option A: From Browser DevTools (Easiest)**
1. Go to https://connect.garmin.com/
2. Open DevTools (F12) → Network tab
3. Click on an activity
4. Find the API response (filter by "activity" or "json")
5. Copy the JSON response
6. Save as `scripts/garmin-samples/activity-<id>.json`

**Option B: From Python Script**
```python
# Add to sync-garmin-mcp.py temporarily:
import json
with open('garmin-activity.json', 'w') as f:
    json.dump(activity, f, indent=2)
```

**Option C: Use the sample data you provided**
Based on your message, you have data like:
```json
{
  "timestamp": "2025-12-12T13:44:45.000Z",
  "activityId": "21238182165",
  "duration": 5534.32177734375,
  "elapsedDuration": 5865.61376953125,
  ...
}
```

Save this to `scripts/garmin-samples/activity-21238182165.json`

### Step 2: Run the Analyzer

```bash
npx tsx scripts/analyze-garmin-export.ts scripts/garmin-samples/activity-21238182165.json
```

### Step 3: Review the Output

The script will show:
- ✅ **What duration fields are present** in the raw data
- ✅ **What the Python script would extract** (simulated)
- ✅ **Whether extraction succeeds or fails**
- ✅ **All available fields** for debugging

## Expected Output

If your export has `duration: 5534.32177734375`, you should see:

```
⏱️  Duration Fields in Activity Object:
   duration: 5534.32177734375 (number)
   elapsedDuration: 5865.61376953125 (number)

🔍 Python extract_duration() Simulation:
   Extracted Duration: 5534 seconds
   Source Used: duration (number)
   ✅ SUCCESS: Would store 92 minutes (1h 32m)
```

## If Extraction Fails

If you see `❌ FAILED: No duration extracted!`, the script will show:
- What duration fields ARE present
- What the Python script is checking for
- How to fix the extraction logic

## Next Steps

1. **Run the analyzer** on your export file
2. **Check the output** - does it extract duration correctly?
3. **If it fails**: The output will show what fields are missing/incorrect
4. **Update Python script**: Based on the analysis, update `extract_duration()` in `scripts/sync-garmin-mcp.py`
5. **Re-sync**: After fixing, re-sync Garmin activities

## Related Scripts

- `scripts/debug-garmin-duration.ts` - Check existing database entries
- `scripts/sync-garmin-mcp.py` - The sync script (needs `extract_duration()` fix if analysis shows issues)

## Your Sample Data

Based on your message showing:
- `"duration": 5534.32177734375` (float)
- `"elapsedDuration": 5865.61376953125` (float)
- `"pointCount": 0` (no time-series data, but summary data exists)

The Python script's `extract_duration()` function should handle floats, but let's verify:
1. Save your sample data to a JSON file
2. Run the analyzer
3. See if it extracts correctly

If it doesn't, the analyzer will show exactly what's wrong.

