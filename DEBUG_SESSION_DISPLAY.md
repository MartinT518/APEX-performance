# Debug: Sessions Not Showing in UI

## Problem
Console logs show sync succeeded, but UI shows "No sessions found for the selected filters."

## Common Causes

### 1. Date Range Mismatch ⚠️ MOST LIKELY
**Issue**: Sessions synced for different dates than UI filter shows.

**Check**:
- What date range did you sync? (Check console logs)
- What date range is selected in UI? (Check the date inputs)
- Sessions are filtered by `session_date` field

**Fix**:
- Adjust the date range in UI to match when you synced
- Or sync again with the date range currently shown in UI

### 2. Sport Type Filter
**Issue**: Sessions filtered out by sport type dropdown.

**Check**:
- Is "Sport Type" set to "All"?
- What sport type were the synced activities? (Check console logs)

**Fix**:
- Set Sport Type filter to "All" to see all sessions

### 3. Session Date Format Issue
**Issue**: `session_date` in database doesn't match date range query.

**Check in browser console**:
```javascript
// Check what dates are in database
// Open browser DevTools > Console, then:
const { data } = await supabase
  .from('session_logs')
  .select('session_date, sport_type, activityName')
  .order('session_date', { ascending: false })
  .limit(10);
console.log('Sessions in DB:', data);
```

### 4. User ID Mismatch
**Issue**: Sessions saved with different user_id than current user.

**Check**:
- Are you logged in as the same user who synced?
- Check console for authentication errors

## Quick Debug Steps

### Step 1: Check Date Range
1. Look at the date inputs in UI
2. Check console logs for what date range was synced
3. Make sure they match!

### Step 2: Check Sport Filter
1. Set Sport Type to "All"
2. Refresh page

### Step 3: Check Database Directly
Open browser console and run:
```javascript
// Get current user
const { data: { session } } = await supabase.auth.getSession();
const userId = session?.user?.id;
console.log('Current user ID:', userId);

// Get all sessions for this user
const { data: sessions } = await supabase
  .from('session_logs')
  .select('*')
  .eq('user_id', userId)
  .order('session_date', { ascending: false })
  .limit(20);
console.log('All sessions:', sessions);
console.log('Session dates:', sessions?.map(s => s.session_date));
```

### Step 4: Check UI Date Range
In browser console:
```javascript
// Check what date range UI is using
// This will show in React DevTools or add console.log in loadSessions()
```

## Most Likely Fix

**The date range in UI doesn't match when sessions were synced.**

**Solution**:
1. Check console logs - what date range was synced?
2. Adjust UI date inputs to match that range
3. Or sync again with the date range currently shown in UI

## Example Scenario

**What happened**:
- You synced: 2025-01-01 to 2025-01-07
- UI shows: 2024-12-01 to 2024-12-31 (default last 30 days)
- Result: No sessions shown (wrong date range!)

**Fix**:
- Change UI date inputs to: 2025-01-01 to 2025-01-07
- Sessions will appear!

