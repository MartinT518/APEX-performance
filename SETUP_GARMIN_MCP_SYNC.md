# Setup Guide: Garmin MCP Sync

## Quick Start Checklist

You're almost ready! Here's what you need to do:

## ✅ Already Done
- Python 3.13.3 installed
- MCP `.env` file exists
- Token directory exists (`~/.garminconnect/`)

## 🔧 Next Steps

### Step 1: Install MCP Dependencies (if not already done)

```bash
cd garmin-connect-mcp-main
uv sync
```

**OR** if you don't have `uv`:

```bash
cd garmin-connect-mcp-main
pip install -r requirements.txt
```

### Step 2: Verify Credentials

The Python script will read credentials from:
1. `.env.local` in project root (preferred - same as Next.js)
2. `.env` in `garmin-connect-mcp-main/` (fallback)

Make sure one of these files has:
```env
GARMIN_EMAIL=your-email@example.com
GARMIN_PASSWORD=your-password
```

### Step 3: First-Time Authentication (if needed)

If you haven't authenticated yet, run:

```bash
cd garmin-connect-mcp-main
uv run garmin-connect-mcp-auth
```

**OR** with pip:

```bash
cd garmin-connect-mcp-main
python -m garmin_connect_mcp.scripts.setup_auth
```

This will:
- Prompt for your Garmin credentials
- Handle MFA if enabled
- Save OAuth tokens to `~/.garminconnect/` for future use

### Step 4: Test the Sync

1. **Start your Next.js dev server:**
   ```bash
   npm run dev
   ```

2. **Open the History page** in your browser

3. **Select a date range** (e.g., last 7 days)

4. **Click "Sync Garmin"** button

5. **Watch the progress:**
   - First sync will use MCP client (if Python available)
   - You'll see progress: "Processing patch 1 of X..."
   - If MCP fails, it automatically falls back to npm client

## How It Works

### Primary Method: MCP Python Client
- ✅ Uses OAuth token persistence (`~/.garminconnect/`)
- ✅ Efficient `get_activities_by_date()` queries
- ✅ Single API call per date chunk
- ✅ Better rate limit handling

### Fallback: npm garmin-connect Package
- ✅ Works if Python/MCP unavailable
- ✅ Uses email/password authentication
- ✅ More API calls (pagination-based)
- ⚠️ Higher rate limit risk

## Troubleshooting

### "Failed to initialize Garmin client"
- Check credentials in `.env.local` or `garmin-connect-mcp-main/.env`
- Run authentication script: `uv run garmin-connect-mcp-auth`
- Verify tokens in `~/.garminconnect/` directory

### "Python script not found"
- Make sure Python 3.11+ is installed
- Check `scripts/sync-garmin-mcp.py` exists
- Verify Python is in PATH: `python --version`

### "Rate limited"
- Wait 10-15 minutes between sync attempts
- Use smaller date ranges (7 days or less)
- MCP client should reduce rate limiting significantly

### "MCP sync failed, falling back to npm client"
- This is normal if Python/MCP unavailable
- App will still work with npm client
- Check Python dependencies: `cd garmin-connect-mcp-main && uv sync`

## Expected Behavior

### First Sync (with MCP):
1. Python script initializes Garmin client
2. Uses existing tokens OR authenticates once
3. Fetches activities in date range (single API call per chunk)
4. Processes and saves to database
5. Tokens saved for next sync

### Subsequent Syncs (with MCP):
1. Python script reuses saved tokens
2. No authentication needed
3. Faster sync (no login delay)
4. Lower rate limit risk

## Verification

To verify everything works:

1. **Check Python script:**
   ```bash
   python scripts/sync-garmin-mcp.py 2025-01-01 2025-01-07
   ```
   Should output JSON with activities or error message.

2. **Check token directory:**
   ```bash
   ls ~/.garminconnect/
   ```
   Should contain token files after first authentication.

3. **Check app logs:**
   - Look for "Attempting sync with MCP client" in server logs
   - Should see "MCP sync result: X synced, Y errors"

## You're Ready! 🚀

Once dependencies are installed and credentials are set, just:
1. Start the dev server
2. Go to History page
3. Click "Sync Garmin"
4. Watch it work!

The app will automatically use MCP client if available, or fall back to npm client if not.

