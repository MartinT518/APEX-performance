# Analyze Garmin Export File

This script helps you verify how Garmin activity data is structured and whether the duration extraction logic will work correctly.

## Purpose

When Garmin activities show `duration_minutes = 0` in the database, this script helps you:
1. See what duration fields are actually present in the raw Garmin export
2. Test what the Python `extract_duration()` function would extract
3. Identify missing or incorrectly named duration fields

## Usage

### Option 1: Analyze a JSON file

```bash
npx tsx scripts/analyze-garmin-export.ts path/to/garmin-export.json
```

### Option 2: Pipe JSON from stdin

```bash
cat garmin-activity.json | npx tsx scripts/analyze-garmin-export.ts
```

### Option 3: Analyze a single activity object

```bash
echo '{"activityId": 123, "duration": 3600, ...}' | npx tsx scripts/analyze-garmin-export.ts
```

## How to Get Garmin Export Data

### Method 1: From Garmin Connect Web

1. Go to https://connect.garmin.com/
2. Navigate to an activity
3. Open browser DevTools (F12)
4. Go to Network tab
5. Filter by "activity" or "json"
6. Click on an activity in the list
7. Find the API request (usually something like `/activity-service/activity/...`)
8. Copy the response JSON
9. Save it to a file (e.g., `garmin-activity.json`)

### Method 2: From Python Script Logs

If you're running the sync script, you can add logging to capture the raw activity data:

```python
# In sync-garmin-mcp.py, add:
import json
logger.info(f"Raw activity JSON: {json.dumps(activity, indent=2)}")
```

### Method 3: Export from Garmin Connect App

1. Use Garmin Connect mobile app
2. Share activity → Export as JSON (if available)
3. Or use Garmin's data export feature

### Method 4: Use the MCP Client Directly

You can create a simple Python script to fetch and save activity data:

```python
from garmin_connect_mcp.client import init_garmin_client, GarminClientWrapper
from garmin_connect_mcp.auth import load_config
import json

config = load_config()
garmin = init_garmin_client(config)
client = GarminClientWrapper(garmin)

# Get activities
activities = client.safe_call('get_activities_by_date', '2025-01-01', '2025-01-31', '')

# Save first activity to file
with open('garmin-activity.json', 'w') as f:
    json.dump(activities[0] if activities else {}, f, indent=2)

# Or get full details
if activities:
    activity_id = activities[0].get('activityId')
    details = client.safe_call('get_activity', activity_id)
    with open('garmin-activity-details.json', 'w') as f:
        json.dump(details, f, indent=2)
```

## What the Script Shows

For each activity, the script displays:

1. **Basic Information**: Activity ID, name, type, start/end times
2. **Duration Fields**: All duration-related fields found in the activity object
3. **Details Object**: Duration fields in the nested `details` object (if present)
4. **Python Extraction Simulation**: What `extract_duration()` would return
5. **All Keys**: Complete list of all fields in the activity object
6. **Raw Duration Structure**: Detailed structure of the `duration` field

## Example Output

```
📦 Detected: Single activity object

================================================================================
Activity 1
================================================================================

📋 Basic Information:
   Activity ID: 21238182165
   Activity Name: Haaslava Running
   Start Time Local: 2025-12-12T13:44:45.000Z

⏱️  Duration Fields in Activity Object:
   duration: 5534.32177734375 (number)
   elapsedDuration: 5865.61376953125 (number)

🔍 Python extract_duration() Simulation:
   Extracted Duration: 5534 seconds
   Source Used: duration (number)
   ✅ SUCCESS: Would store 92 minutes (1h 32m)
```

## Troubleshooting

### If extraction fails (duration = 0):

1. **Check the raw duration field structure**:
   - Is `duration` a number or an object?
   - What are the exact field names? (e.g., `elapsedDuration` vs `elapsedDurationInSeconds`)

2. **Check if details object has duration**:
   - Some activities only have duration in the `details` object
   - The script shows if `details` is present and what fields it contains

3. **Update Python extraction logic**:
   - If you see a duration field that's not being checked, add it to `extract_duration()` in `scripts/sync-garmin-mcp.py`

### Common Issues

- **Duration is a float**: The Python script handles floats, but check if it's being truncated incorrectly
- **Duration field name mismatch**: Garmin API might use different field names (e.g., `elapsedDuration` vs `elapsedDurationInSeconds`)
- **Duration in nested object**: Check `details.summaryDTO` or other nested structures

## Next Steps

After analyzing the export:

1. **If extraction succeeds**: The issue might be in the TypeScript code or database storage
2. **If extraction fails**: Update `extract_duration()` in `scripts/sync-garmin-mcp.py` to handle the field names you found
3. **Re-sync activities**: After fixing extraction, re-sync Garmin activities to populate correct durations

## Related Scripts

- `scripts/debug-garmin-duration.ts`: Check existing database entries for zero durations
- `scripts/sync-garmin-mcp.py`: The actual sync script that uses `extract_duration()`

