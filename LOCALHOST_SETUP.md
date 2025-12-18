# Localhost Setup Guide - APEX Performance

Complete guide to get everything working in localhost with full functionality: Supabase, Garmin integration, data analysis, and all features.

## Prerequisites

- Node.js 18+ installed
- Python 3.11+ installed (for Garmin MCP server)
- `uv` package manager (recommended) or `pip` (for Garmin MCP)
- Supabase account (free tier works)
- Garmin Connect account (optional, but needed for real data)

---

## Step 1: Environment Variables Setup

### Quick Setup (Recommended)

**Windows (PowerShell):**
```powershell
.\scripts\setup-env.ps1
```

**Linux/Mac:**
```bash
chmod +x scripts/setup-env.sh
./scripts/setup-env.sh
```

### Manual Setup

Create `.env.local` in the project root:

```env
# ============================================
# APEX Performance - Environment Variables
# ============================================

# Supabase Configuration (REQUIRED)
# Get these from: https://app.supabase.com/project/_/settings/api
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-publishable-key-here
SUPABASE_SECRET_DEFAULT_KEY=your-secret-key-here

# Garmin Connect (OPTIONAL - for real data ingestion)
# Without these, app runs in simulation mode
GARMIN_EMAIL=your-email@example.com
GARMIN_PASSWORD=your-password-here
```

**Important Notes:**
- Never commit `.env.local` to git (it's in `.gitignore`)
- `NEXT_PUBLIC_` prefix is required for client-side access
- Garmin credentials are optional - app works without them in simulation mode

---

## Step 2: Supabase Setup

### 2.1 Create Supabase Project

1. Go to https://app.supabase.com
2. Create a new project (free tier is fine)
3. Wait for project to finish provisioning (~2 minutes)

### 2.2 Get Your Credentials

1. Go to **Settings** → **API**
2. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (new format) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
   - **Secret key** (new format) → `SUPABASE_SECRET_DEFAULT_KEY`

3. Update `.env.local` with these values

### 2.3 Run Database Migration

1. Go to **SQL Editor** in Supabase dashboard
2. Open `supabase/migrations/001_initial_schema.sql`
3. Copy the entire contents
4. Paste into SQL Editor
5. Click **Run** (or press F5)

**Verify Migration:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see:
- `agent_votes`
- `baseline_metrics`
- `daily_monitoring`
- `phenotype_profiles`
- `session_logs`

---

## Step 3: Garmin Integration Setup

The app uses **two** Garmin integrations:

### 3.1 Garmin Client (npm package) - For App Data Fetching

This is already installed via `package.json`. It's used by the app to fetch activity data.

**Setup:**
1. Add credentials to `.env.local`:
   ```env
   GARMIN_EMAIL=your-email@example.com
   GARMIN_PASSWORD=your-password-here
   ```

2. The app will automatically use these when running analysis

**Test it:**
```bash
npx tsx src/modules/monitor/test-garmin.ts
```

### 3.2 Garmin MCP Server (Python) - For AI Assistant Integration

This allows Cursor/Claude to fetch Garmin data directly.

**Setup:**

1. **Install Dependencies:**
   ```bash
   cd garmin-connect-mcp-main
   
   # Using uv (recommended)
   uv sync
   
   # OR using pip
   pip install -r requirements.txt
   ```

2. **Configure Credentials:**
   
   Create `.env` file in `garmin-connect-mcp-main/`:
   ```env
   GARMIN_EMAIL=your-email@example.com
   GARMIN_PASSWORD=your-password-here
   ```

3. **Authenticate (First Time):**
   ```bash
   cd garmin-connect-mcp-main
   uv run garmin-connect-mcp-auth
   ```
   
   This will:
   - Prompt for credentials
   - Handle MFA if enabled
   - Save authentication tokens to `~/.garminconnect/`

4. **Configure Cursor/Claude (Optional):**
   
   Create or edit: `C:\Users\YOUR_USERNAME\.cursor\mcp.json`
   
   ```json
   {
     "mcpServers": {
       "garmin": {
         "command": "uv",
         "args": [
           "run",
           "--directory",
           "C:/Users/YOUR_USERNAME/Documents/APEX performance/garmin-connect-mcp-main",
           "garmin-connect-mcp"
         ]
       }
     }
   }
   ```
   
   Replace `YOUR_USERNAME` with your actual Windows username.

**Note:** The MCP server is optional - the app works fine without it. It's mainly for AI assistant integration.

---

## Step 4: Install Dependencies & Start Dev Server

```bash
# Install npm dependencies
npm install

# Start development server
npm run dev
```

The app will be available at: **http://localhost:3000**

---

## Step 5: Verify Full Functionality

### 5.1 Authentication Flow

1. Open http://localhost:3000
2. You should see the login page
3. Click "Sign Up" and create an account
4. You should be redirected to dashboard after signup

### 5.2 Phenotype Configuration

1. Go to **Settings** (sidebar or `/settings`)
2. Fill in all phenotype fields:
   - Age, weight, height
   - Training age
   - Primary sport
   - Metabolic phenotype
   - Strength tier
3. Click **Save**
4. Verify success toast appears

### 5.3 Daily Check-in

1. Go to **Dashboard**
2. Complete daily check-in:
   - Gatekeeper prompt (how do you feel?)
   - Niggle slider (0-10)
   - Strength tier selection
   - Fueling log (optional)
3. Verify data saves (check toast notifications)

### 5.4 Coach Analysis

1. After completing daily check-in, click **Run Analysis**
2. The app will:
   - Load your phenotype
   - Fetch Garmin data (if credentials provided) or use simulation
   - Process session data
   - Run analysis with baseline metrics
   - Generate agent decisions
   - Display results

**Expected Output:**
- Analysis result card with workout recommendation
- Agent status grid showing all 3 agents
- Decision log with reasoning
- Certainty score
- Chassis gauge

### 5.5 Session History

1. Go to **History** (sidebar or `/history`)
2. You should see past analysis sessions
3. Click on a session to review details

---

## Step 6: Test Garmin Data Integration

### 6.1 Verify Garmin Client Works

```bash
# Run test script
npx tsx src/modules/monitor/test-garmin.ts
```

**Expected Output:**
```
--- TEST RUNNER: Phase 9 (Garmin Integration) ---
Attempting Login...
✅ Login Verified.
Fetching recent activities...
✅ Fetched 1 activity.
Fetching details for ID: 12345678...
✅ Details Fetched.
Running Adapter...
Converted Output: 150 data points.
✅ Adapter Verified.
```

### 6.2 Test Real Data in App

1. Make sure Garmin credentials are in `.env.local`
2. Run analysis in the app
3. Check browser console for logs:
   - Should see: `✅ Garmin Client Initialized & Logged In`
   - Should see: `✅ Ingested X points from Garmin.`
   - Data source should show `GARMIN` instead of `SIMULATION`

---

## Troubleshooting

### Issue: "Supabase connection failed"

**Solutions:**
- Verify `.env.local` has correct Supabase credentials
- Check Supabase project is active (not paused)
- Verify migration was run successfully
- Check browser console for specific error messages

### Issue: "Garmin login failed"

**Solutions:**
- Verify credentials in `.env.local` are correct
- Check if MFA is enabled (may need to handle manually)
- Try logging into Garmin Connect website first
- App will continue in simulation mode if Garmin fails

### Issue: "No activities found"

**Solutions:**
- Make sure you have activities in Garmin Connect
- Check the activity has detailed metrics (some activities may not have high-res data)
- App will use simulation data if no activities found

### Issue: "Analysis returns empty results"

**Solutions:**
- Make sure phenotype is configured (Settings page)
- Complete daily check-in before running analysis
- Check browser console for errors
- Verify baseline metrics exist in database

### Issue: "MCP server not working"

**Solutions:**
- Verify Python 3.11+ is installed: `python --version`
- Verify `uv` is installed: `uv --version`
- Check `.env` file exists in `garmin-connect-mcp-main/`
- Run authentication: `uv run garmin-connect-mcp-auth`
- MCP server is optional - app works without it

---

## Quick Verification Checklist

- [ ] `.env.local` file exists with Supabase credentials
- [ ] Supabase project created and migration run
- [ ] `npm install` completed successfully
- [ ] `npm run dev` starts without errors
- [ ] Can sign up and log in
- [ ] Can save phenotype settings
- [ ] Can complete daily check-in
- [ ] Can run analysis and see results
- [ ] Can view session history
- [ ] (Optional) Garmin credentials added and test script passes
- [ ] (Optional) Garmin MCP server configured

---

## Security Notes (Localhost Only)

Since you're the only user on localhost, security is relaxed:

- ✅ Credentials can be in `.env.local` (already in `.gitignore`)
- ✅ No need for complex RLS policies (Supabase handles basic auth)
- ✅ Garmin credentials stored locally only
- ⚠️ **DO NOT** commit `.env.local` to git
- ⚠️ **DO NOT** share credentials

For production deployment, see `DEPLOYMENT.md` for security best practices.

---

## Next Steps

Once everything works in localhost:

1. **Test all features** - Make sure everything works end-to-end
2. **Add real Garmin data** - Connect your Garmin account for real analysis
3. **Review session history** - Check that data persists correctly
4. **Test error scenarios** - Disconnect internet, invalid credentials, etc.

When ready for production, see `DEPLOYMENT.md`.

---

**Last Updated**: 2025-01-27  
**Status**: Complete localhost setup guide with all integrations


