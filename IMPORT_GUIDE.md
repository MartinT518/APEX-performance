# Historical Data Import Guide

## ✅ Pre-Import Checklist

All verification checks have passed:
- ✅ Environment variables configured
- ✅ JSON files valid (2,707 health + 2,012 activities + 2,012 details)
- ✅ Database migrations applied
- ⚠️ Authentication needed (CLI scripts can't use browser sessions)

## Step 1: Get Your User ID

You have **4 options** to get your user ID:

### Option 0: Use the Helper Page (Easiest!)
1. Make sure your dev server is running: `npm run dev`
2. Log in to the application at `http://localhost:3000`
3. Go to: `http://localhost:3000/get-user-id`
4. Your User ID will be displayed with copy buttons
5. Click "Copy User ID" or "Copy Full Import Command"

### Option A: From Browser Console
1. Start your dev server: `npm run dev`
2. Open `http://localhost:3000` in your browser
3. Log in to your account
4. Open browser console (F12)
5. Run this command:
   ```javascript
   const { createClient } = await import('@supabase/supabase-js');
   const supabase = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL,
     process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
   );
   const { data: { user } } = await supabase.auth.getUser();
   console.log('User ID:', user.id);
   ```

### Option B: From Supabase Dashboard (Also Easy!)
1. Go to Supabase Dashboard → Authentication → Users
2. Find your user account
3. Copy the User ID (UUID)

### Option C: Query Database
1. Go to Supabase Dashboard → SQL Editor
2. Run:
   ```sql
   SELECT id, email FROM auth.users LIMIT 1;
   ```
3. Copy the `id` value

## Step 2: Prepare Your JSON Files

### Option 1: Copy Files to Repository (Recommended)

1. Copy your JSON files from `garmin-connect-mcp-main/data/garmin/export/` to `./data/` in this repository:
   - `garmin_export_health_daily.json`
   - `garmin_export_activities.json`
   - `garmin_export_activity_details.json` (optional, for biomechanical metrics)

2. The import script will automatically detect files in `./data/` if no paths are provided.

### Option 2: Use Custom File Paths

If files are in a different location, provide paths via command line:
```bash
npx tsx scripts/import-historical-data.ts \
  --user-id=<your-user-id> \
  --health-data=<path-to-health.json> \
  --activity-data=<path-to-activities.json> \
  --activity-details=<path-to-details.json>
```

### Expected JSON Format

The import script expects JSON files with **snake_case** field names (matching Garmin export format):

- Health data: `date`, `hrv`, `hrv_method`, `resting_hr`, `sleep_duration`, etc.
- Activity data: `activity_id`, `start_time`, `sport_type`, `duration`, `distance_km`, etc.

See `data/README.md` for detailed format specifications.

## Step 3: Run the Import

Once you have your user ID and files ready, run:

```bash
npx tsx scripts/import-historical-data.ts --user-id=<your-user-id>
```

**Example:**
```bash
# If files are in ./data/ directory (recommended)
npx tsx scripts/import-historical-data.ts --user-id=841dcd04-2398-46b4-9998-7b047ea030ea

# Or with custom file paths
npx tsx scripts/import-historical-data.ts \
  --user-id=841dcd04-2398-46b4-9998-7b047ea030ea \
  --health-data=../garmin-connect-mcp-main/data/garmin/export/garmin_export_health_daily.json \
  --activity-data=../garmin-connect-mcp-main/data/garmin/export/garmin_export_activities.json
```

## Expected Output

You should see:
```
✅ Health data file valid: 2707 records
✅ Activity data file valid: 2012 records
✅ Activity details file valid: 2012 records
Importing data for user: <your-user-id>
Starting health data import...
Health data: 2707 imported, 0 errors
Starting activity data import...
Activity data: 2012 imported, 0 errors
Import complete!
Total: 4719 records imported, 0 errors
```

## Troubleshooting

### "Not authenticated" Error
- Make sure you're using the `--user-id` flag
- Verify the user ID is correct (UUID format)
- Check that the user exists in Supabase

### "Duplicate key" Errors
- This means some data already exists
- The script will skip duplicates automatically
- Check the error count in the summary

### "RLS policy violation" Error
- Make sure you're using the correct user ID
- Verify RLS policies are set up correctly
- Check that migrations 001-009 are all applied

### Import is Slow
- This is normal for 4,719 records
- Health data: ~2,707 inserts/updates
- Activity data: ~2,012 inserts/updates
- Expect 5-15 minutes depending on your connection

## After Import

### Verify Data

Check that data was imported correctly:

```sql
-- Check health data
SELECT COUNT(*) as health_records, 
       MIN(date) as earliest, 
       MAX(date) as latest 
FROM daily_monitoring 
WHERE user_id = '<your-user-id>';

-- Check activity data
SELECT COUNT(*) as activity_records,
       COUNT(DISTINCT metadata->>'activityId') as unique_activities
FROM session_logs 
WHERE user_id = '<your-user-id>';

-- Check biomechanical metrics
SELECT COUNT(*) as sessions_with_gct
FROM session_logs
WHERE metadata->>'groundContactTime' IS NOT NULL
AND user_id = '<your-user-id>';
```

### Test New Features

1. **Z-Score Normalization**: Trigger daily analysis and check for Z-score calculations
2. **Feature Store**: Test `getReadinessContext()` with your historical data
3. **Economy/Durability**: Check if historical sessions are flagged for form decay
4. **Constraint Engine**: Generate an Elite Week plan and verify constraints

## Next Steps

After successful import:

1. **Set up incremental sync** (optional):
   ```bash
   npx tsx scripts/incremental-sync.ts
   ```
   This will sync only new data from Garmin API going forward.

2. **Run backtesting** (optional):
   ```bash
   npx tsx scripts/walk-forward-backtest.ts
   ```
   This tests injury prediction accuracy.

3. **Start using the application**:
   - The system now has 7 years of historical context
   - Z-scores will be calculated from your actual data
   - Feature store will use your real training patterns

## Quick Reference

**Import Command:**
```bash
npx tsx scripts/import-historical-data.ts --user-id=<your-user-id>
```

**Verification:**
```bash
npx tsx scripts/verify-setup.ts
```

**Get User ID:**
```bash
npx tsx scripts/get-user-id.ts
```

**Incremental Sync:**
```bash
npx tsx scripts/incremental-sync.ts
```
