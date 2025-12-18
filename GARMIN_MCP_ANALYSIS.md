# Garmin MCP Usage Analysis

## Problem Identified

We're **bypassing the Garmin MCP server** and using the npm `garmin-connect` package incorrectly, which causes aggressive rate limiting.

## Root Cause Analysis

### MCP Server Approach (Python `garminconnect` library)
1. **OAuth Token Persistence**: 
   - Saves tokens to `~/.garminconnect/` directory
   - Reuses tokens across sessions (no re-authentication)
   - Only authenticates once, then uses tokens
   - **This is the KEY difference** - avoids repeated logins

2. **Efficient API Calls**:
   - Uses `get_activities_by_date(start_date, end_date, activity_type)` 
   - Fetches activities directly by date range (no pagination needed)
   - **Single API call per date range chunk** instead of multiple paginated calls

3. **Better Error Handling**:
   - Custom exceptions (`GarminRateLimitError`, `GarminAuthenticationError`)
   - Proper token refresh logic
   - Handles MFA automatically

### Our Current Approach (npm `garmin-connect` package)
1. **Email/Password Every Time**:
   - Uses `new GarminConnect({ username, password })` 
   - Calls `login()` on **every sync attempt**
   - Fresh authentication = **triggers Cloudflare protection**
   - **No token persistence** - npm package doesn't support it

2. **Inefficient Pagination**:
   - Uses `getActivities(offset, limit)` 
   - Fetches recent activities and filters by date in memory
   - **Multiple API calls** to get date range (5 activities per batch)
   - For 18 days, we might need 10+ batches = 10+ API calls

3. **No Token Persistence**:
   - npm package has no token storage methods
   - Every sync = new authentication
   - **This is the main problem** - repeated logins trigger rate limits

## API Method Comparison

| Feature | MCP (Python) | Our Code (npm) |
|---------|--------------|----------------|
| Login Method | Token-based (persisted) | Email/password (every time) |
| Date Range Query | `get_activities_by_date(start, end)` | `getActivities(offset, limit)` + filter |
| API Calls per 18-day sync | ~3 (one per chunk) | ~15-20 (multiple batches per chunk) |
| Token Persistence | ✅ Yes (`~/.garminconnect/`) | ❌ No |
| Rate Limit Risk | Low (reuses session) | High (fresh login each time) |

## Solution Options

### Option 1: Use MCP Server via Subprocess (Recommended)
Call the Python MCP server as a subprocess:
```typescript
// Call MCP server tool: query_activities
const result = await exec(`uv run --directory garmin-connect-mcp-main garmin-connect-mcp query_activities --start_date ${startDate} --end_date ${endDate}`);
```

**Pros**: 
- Token persistence (saves to `~/.garminconnect/`)
- Efficient `get_activities_by_date` method
- Better rate limit handling
- Single API call per chunk

**Cons**: 
- Requires Python runtime
- Subprocess overhead
- Need to parse JSON responses

### Option 2: Switch to Python Client Directly
Use Python `garminconnect` library via Node.js child process:
- Similar to Option 1 but more direct
- Can implement token persistence in Python script
- Call from Node.js server actions

### Option 3: Improve npm Package Usage (Limited)
The npm package is fundamentally limited:
- ❌ No token persistence
- ❌ No `get_activities_by_date` method
- ✅ Can only optimize delays and batch sizes

**Current workarounds** (what we're doing):
- Longer delays between requests
- Smaller batch sizes
- Cooldown mechanism
- But still hitting rate limits because of repeated logins

## Recommendation

**Immediate**: Use MCP server via subprocess for sync operations
- Implement a Python script that uses the MCP server's client
- Call it from Node.js server actions
- This gives us token persistence and efficient date-range queries

**Implementation Plan**:
1. Create Python sync script that uses MCP client
2. Call script from `syncGarminSessions` server action
3. Parse JSON output and insert into database
4. Tokens persist automatically in `~/.garminconnect/`

This will **dramatically reduce** rate limiting because:
- Only authenticates once (tokens persist)
- Single API call per date chunk (not multiple batches)
- Reuses authenticated session

