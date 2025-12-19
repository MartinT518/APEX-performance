# Garmin Connect MCP - Comprehensive Understanding Document

**Purpose**: This document provides a complete understanding of the Garmin Connect MCP server implementation, data flow, and common issues for debugging and future development.

**Last Updated**: 2025-01-27

---

## 1. Architecture Overview

### 1.1 Project Structure

```
garmin-connect-mcp-main/
├── src/garmin_connect_mcp/
│   ├── server.py              # MCP server entry point (FastMCP)
│   ├── client.py              # Garmin API client wrapper with error handling
│   ├── auth.py                # Authentication & token management
│   ├── response_builder.py    # Response formatting & structure
│   ├── formatters.py          # Data formatting utilities
│   ├── tools/                 # MCP tool implementations
│   │   ├── activities.py      # Activity query & details tools
│   │   ├── training.py         # Training analysis tools
│   │   └── ...                 # Other tool modules
│   └── types.py               # Type definitions
├── scripts/
│   └── setup_auth.py          # Interactive authentication setup
└── tests/                      # Test suite
```

### 1.2 Data Flow

```
┌─────────────────┐
│  TypeScript     │
│  garminSyncMCP  │
│  .ts            │
└────────┬────────┘
         │ execAsync()
         │ python sync-garmin-mcp.py
         ▼
┌─────────────────┐
│  Python Script  │
│  sync-garmin-   │
│  mcp.py         │
└────────┬────────┘
         │ Uses GarminClientWrapper
         │ client.safe_call()
         ▼
┌─────────────────┐
│  Garmin API     │
│  get_activities │
│  _by_date()     │
└────────┬────────┘
         │ Returns list of activities
         ▼
┌─────────────────┐
│  Python Script  │
│  Extracts &     │
│  formats data   │
└────────┬────────┘
         │ JSON output
         ▼
┌─────────────────┐
│  TypeScript     │
│  Parses JSON &  │
│  saves to DB    │
└─────────────────┘
```

---

## 2. Key Components

### 2.1 Authentication (`auth.py`)

**Token Persistence**:
- Tokens stored in `~/.garminconnect/` directory
- Uses `garth` library for OAuth token management
- Supports MFA (Multi-Factor Authentication)
- Token-based login attempted first, falls back to credential login

**Flow**:
1. Check for existing tokens in `~/.garminconnect/`
2. If tokens exist, try token-based login
3. If token login fails, use email/password credentials
4. If MFA required, prompt for code
5. Save tokens for future use

### 2.2 Client Wrapper (`client.py`)

**Purpose**: Provides safe, consistent error handling for Garmin API calls.

**Key Methods**:
- `init_garmin_client(config)`: Initialize and authenticate client
- `GarminClientWrapper.safe_call(method_name, *args)`: Safely call Garmin API methods

**Error Handling**:
- `GarminAuthenticationError`: 401/403 errors
- `GarminRateLimitError`: 429 errors
- `GarminNotFoundError`: 404 errors
- `GarminAPIError`: Other API errors

### 2.3 Response Builder (`response_builder.py`)

**Purpose**: Formats API responses into structured JSON with metadata.

**Key Methods**:
- `format_activity(activity_dict, unit)`: Formats activity data with rich formatting
- `build_response(data, analysis, metadata, pagination)`: Builds structured response
- `build_error_response(message, error_type, suggestions)`: Builds error response

**Activity Formatting**:
- Duration: `{ seconds: number, formatted: string }`
- Distance: `{ meters: number, formatted: string }`
- Dates: `{ datetime, date, day_of_week, formatted }`

### 2.4 Activities Tool (`tools/activities.py`)

**Main Functions**:
- `query_activities()`: Query activities with flexible parameters
- `get_activity_details()`: Get comprehensive activity details
- `get_activity_social()`: Get social details (likes, comments)

**Query Patterns**:
1. Specific activity by ID
2. Date range query (paginated)
3. Specific date query
4. General pagination query
5. Last activity (default)

---

## 3. Integration with Main Project

### 3.1 Python Sync Script (`scripts/sync-garmin-mcp.py`)

**Purpose**: Bridge between TypeScript server actions and MCP client.

**Flow**:
1. Loads config from `.env.local` or `.env`
2. Initializes Garmin client with token persistence
3. Calls `get_activities_by_date(start_date, end_date, '')`
4. For each activity:
   - Extracts basic info (ID, name, type, times)
   - **Extracts duration** (see issue below)
   - Fetches full details with `get_activity(activity_id)`
5. Returns JSON with `{ success, activities[], count }`

**Called From**: `src/modules/monitor/ingestion/garminSyncMCP.ts`

### 3.2 TypeScript Integration (`garminSyncMCP.ts`)

**Flow**:
1. Executes Python script via `execAsync()`
2. Parses JSON response
3. For each activity:
   - Checks if session already exists
   - Extracts duration from multiple sources (see issue)
   - Converts to session stream
   - Saves to database

---

## 4. Current Issue: Duration Extraction

### 4.1 Problem Statement

**Symptom**: Duration is 0 in training history page after Garmin sync.

**Root Cause**: The Python script (`sync-garmin-mcp.py`) only extracts duration from one source:
```python
duration_obj = activity.get('duration', {})
duration_seconds = duration_obj.get('totalSeconds', 0) if isinstance(duration_obj, dict) else 0
```

**Why This Fails**:
1. Garmin API `get_activities_by_date()` may return duration in different formats:
   - As a number: `duration: 3600`
   - As an object: `duration: { totalSeconds: 3600, ... }`
   - As `elapsedDuration` or `elapsedDurationInSeconds`
   - Missing entirely from list response

2. The script fetches full details with `get_activity()`, which contains complete duration information, but doesn't extract duration from details if the initial extraction failed.

3. TypeScript code tries multiple sources, but Python only provides `durationInSeconds` which might be 0.

### 4.2 Data Structure Analysis

**From `get_activities_by_date()` (list response)**:
```python
activity = {
    'activityId': 123456789,
    'activityName': 'Morning Run',
    'activityType': {'typeKey': 'running', ...},
    'startTimeGMT': '2025-01-27T10:00:00.0',
    'startTimeLocal': '2025-01-27T11:00:00.0',
    'duration': 3600,  # OR { 'totalSeconds': 3600, ... } OR missing
    # OR
    'elapsedDuration': 3600,
    # OR
    'elapsedDurationInSeconds': 3600,
    ...
}
```

**From `get_activity()` (details response)**:
```python
details = {
    'activityId': 123456789,
    'duration': 3600,  # OR { 'totalSeconds': 3600, ... }
    'elapsedDuration': 3600,
    'elapsedDurationInSeconds': 3600,
    'summaryDTO': {
        'elapsedDuration': 3600,
        'duration': 3600,
        ...
    },
    ...
}
```

### 4.3 Current Extraction Logic

**Python Script** (lines 108-110):
```python
duration_obj = activity.get('duration', {})
duration_seconds = duration_obj.get('totalSeconds', 0) if isinstance(duration_obj, dict) else 0
```

**Issues**:
- Only checks `duration.totalSeconds` if duration is a dict
- Doesn't handle `duration` as a number
- Doesn't check `elapsedDuration` or `elapsedDurationInSeconds`
- Doesn't fall back to `details` object

**TypeScript** (lines 222-296):
- Tries multiple sources but Python only provides `durationInSeconds`
- Checks `elapsedDurationInSeconds`, duration object, flat fields, start/end times, details
- But if Python returns 0, TypeScript can't recover

---

## 5. Garmin API Response Formats

### 5.1 Activity List Response (`get_activities_by_date()`)

**Common Fields**:
- `activityId`: number
- `activityName`: string
- `activityType`: `{ typeKey: string, ... }`
- `startTimeGMT`: string (ISO format)
- `startTimeLocal`: string (ISO format)
- `duration`: number OR `{ totalSeconds: number, ... }` OR missing
- `elapsedDuration`: number (may be present)
- `elapsedDurationInSeconds`: number (may be present)
- `distance`: number (meters)
- `averageSpeed`: number (m/s)
- `averageHR`: number
- `maxHR`: number

### 5.2 Activity Details Response (`get_activity()`)

**Common Fields**:
- All fields from list response, plus:
- `summaryDTO`: `{ elapsedDuration: number, duration: number, ... }`
- `activityDetailMetrics`: time-series data
- `metricDescriptors`: metadata about metrics
- More complete duration information

---

## 6. Debugging Guide

### 6.1 Check Python Script Output

**Add logging to `sync-garmin-mcp.py`**:
```python
logger.info(f"Activity {activity_id} duration extraction:")
logger.info(f"  duration field: {activity.get('duration')}")
logger.info(f"  elapsedDuration: {activity.get('elapsedDuration')}")
logger.info(f"  elapsedDurationInSeconds: {activity.get('elapsedDurationInSeconds')}")
logger.info(f"  Extracted duration_seconds: {duration_seconds}")
```

### 6.2 Check TypeScript Parsing

**Add logging to `garminSyncMCP.ts`**:
```typescript
logger.warn(`Activity ${activity.activityId} duration fields:`, {
  durationInSeconds: activity.durationInSeconds,
  duration: activity.duration,
  elapsedDuration: activity.elapsedDuration,
  elapsedDurationInSeconds: activity.elapsedDurationInSeconds,
  details_duration: activity.details?.duration,
});
```

### 6.3 Inspect Raw API Response

**Test directly with Python**:
```python
from garmin_connect_mcp.client import init_garmin_client, GarminClientWrapper
from garmin_connect_mcp.auth import load_config

config = load_config()
garmin = init_garmin_client(config)
client = GarminClientWrapper(garmin)

activities = client.safe_call('get_activities_by_date', '2025-01-20', '2025-01-27', '')
print(json.dumps(activities[0], indent=2))  # Inspect first activity
```

---

## 7. Common Issues & Solutions

### 7.1 Duration is 0

**Cause**: Duration not extracted correctly from API response.

**Solution**: See Development Plan - improve duration extraction in Python script.

### 7.2 Rate Limiting

**Cause**: Too many API calls in short time.

**Solution**: Script already has 2-second delay between detail fetches. Consider:
- Batch processing
- Caching
- Reducing detail fetches

### 7.3 Authentication Failures

**Cause**: Tokens expired or invalid.

**Solution**: 
- Run `garmin-connect-mcp-auth` to re-authenticate
- Check `~/.garminconnect/` directory exists and has tokens
- Verify credentials in `.env.local`

### 7.4 Missing Activity Details

**Cause**: `get_activity()` call failed.

**Solution**: Script already handles this gracefully - includes basic info even if details fail.

---

## 8. Best Practices

### 8.1 Error Handling

- Always use `GarminClientWrapper.safe_call()` for API calls
- Handle all custom exceptions (`GarminAPIError`, etc.)
- Provide fallback behavior when possible

### 8.2 Token Management

- Use token persistence to avoid repeated authentication
- Handle MFA gracefully
- Save tokens after successful login

### 8.3 Data Extraction

- Check multiple field names for the same data
- Provide fallback sources
- Log extraction attempts for debugging

### 8.4 Performance

- Use `get_activities_by_date()` for date ranges (single API call)
- Add delays between detail fetches to avoid rate limiting
- Cache frequently accessed data when possible

---

## 9. File Reference

### 9.1 Key Files

- **`scripts/sync-garmin-mcp.py`**: Python sync script (needs duration fix)
- **`src/modules/monitor/ingestion/garminSyncMCP.ts`**: TypeScript integration
- **`garmin-connect-mcp-main/src/garmin_connect_mcp/client.py`**: API client wrapper
- **`garmin-connect-mcp-main/src/garmin_connect_mcp/response_builder.py`**: Response formatting
- **`garmin-connect-mcp-main/src/garmin_connect_mcp/tools/activities.py`**: Activity tools

### 9.2 Configuration Files

- **`.env.local`**: Environment variables (GARMIN_EMAIL, GARMIN_PASSWORD)
- **`~/.garminconnect/`**: OAuth token storage directory

---

## 10. Future Improvements

1. **Duration Extraction**: Fix multi-source duration extraction (see Development Plan)
2. **Caching**: Cache activity details to reduce API calls
3. **Batch Processing**: Process activities in batches to handle large date ranges
4. **Error Recovery**: Retry failed detail fetches with exponential backoff
5. **Logging**: Add structured logging for better debugging

---

**End of Document**

