# APEX Performance - Complete User Guide

**Version 1.0** | Last Updated: January 2025

> **Developer Note:** This guide includes code references throughout. Each feature description includes a **Code Reference** section pointing to the relevant file and line numbers where the logic is implemented in the repository.

---

## Table of Contents

1. [What is APEX Performance?](#what-is-apex-performance)
2. [Getting Started](#getting-started)
3. [Daily Workflow](#daily-workflow)
4. [Pages & Features](#pages--features)
5. [Understanding the System](#understanding-the-system)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)
8. [FAQ](#faq)

---

## What is APEX Performance?

**APEX Performance** is a bio-mechanical reasoning engine designed for "High-Rev" athletes—those who operate at sustained high heart rates (typically >175 bpm during marathons). Unlike standard fitness apps that track activities, APEX **reasons** about your training using three AI agents that evaluate your structural health, metabolic state, and fueling status.

**Code Reference:** 
- Main coach orchestration: `src/modules/dailyCoach.ts` (lines 20-52)
- Agent evaluation: `src/modules/dailyCoach/logic/decision.ts` (lines 27-97)
- Server action entry point: `src/app/actions.ts` (lines 21-175)

### Core Philosophy: "Structure Before Engine"

The app prioritizes your **chassis** (structural integrity) over your **engine** (cardiovascular fitness). This means:
- Strength training is mandatory, not optional
- Pain signals (niggle scores) can veto high-intensity runs
- Substitutions (cycling, BFR walks) replace rest days
- Every decision is backed by data and reasoning

**Code Reference:**
- Structural Agent logic: `src/modules/execute/agents/structuralAgent.ts` (lines 11-60)
- Substitution matrix: `src/modules/review/logic/substitutionMatrix.ts` (lines 9-111)

### Key Features

- **Real-Time Coach Analysis**: AI agents evaluate your readiness for each workout
  - **Code Reference:** `src/app/actions.ts` (lines 21-175), `src/modules/dailyCoach/logic/decision.ts` (lines 27-97)
- **Garmin Integration**: Automatically syncs your training data
  - **Code Reference:** `src/modules/monitor/ingestion/garminSyncMCP.ts` (lines 43-207), `src/modules/monitor/ingestion/garminSync.ts` (lines 14-249)
- **Phenotype Calibration**: Customize the system to your unique physiology
  - **Code Reference:** `src/modules/monitor/phenotypeStore.ts` (lines 23-135), `src/app/settings/page.tsx` (lines 32-228)
- **Data Integrity**: Validates sensor data quality (cadence lock, HR drift)
  - **Code Reference:** `src/modules/kill/logic/cadenceLock.ts`, `src/modules/kill/logic/decoupling.ts` (lines 12-34)
- **Blueprint Tracking**: Long-term goal probability based on current trajectory
  - **Code Reference:** `src/modules/analyze/blueprintEngine.ts` (lines 31-81), `src/modules/dailyCoach/logic/analysis.ts` (lines 19-48)
- **Responsive Design**: Mobile-first with bottom navigation, desktop sidebar
  - **Code Reference:** `src/app/layout.tsx` (lines 26-60), `src/components/layout/BottomNav.tsx` (lines 20-54), `src/components/layout/TopNav.tsx` (lines 6-27), `src/components/layout/Sidebar.tsx` (lines 10-82)

---

## Getting Started

### Step 1: Initial Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   - Create `.env.local` file (see `ENV_TEMPLATE.md`)
   - Add your Supabase credentials (required)
   - Add Garmin credentials (optional, for data sync)

3. **Start the App**
   ```bash
   npm run dev
   ```

4. **Open in Browser**
   - Navigate to `http://localhost:3000`

### Step 2: Create Your Account

1. Click **"Sign Up"** on the home page
2. Enter your email and password
3. You'll be automatically logged in and redirected to the Dashboard
   - **Code Reference:** `src/app/page.tsx` (lines 10-72), `src/components/auth/SignUpForm.tsx`, `src/components/auth/AuthProvider.tsx`

### Step 3: Configure Your Phenotype (First Time Setup)

**This is the most important step!** Your phenotype settings tell the system your biological truth.

1. Navigate to **Settings** (⚙️ icon in navigation)
   - **Code Reference:** `src/components/layout/Sidebar.tsx` (lines 39-44), `src/components/layout/BottomNav.tsx` (lines 13-14)
2. Configure the following:

   **High-Rev Mode Toggle**
   - Enable if your marathon HR averages >175 bpm
   - This disables standard anaerobic warnings
   - The system will validate sustained high HR as "Threshold" not "Error"

   **True Max Heart Rate**
   - Override the default 220-age formula
   - Enter your actual tested max HR
   - Example: If you've hit 205 bpm in a race, enter 205

   **Lactate Threshold HR**
   - Your tested lactate threshold (if known)
   - Used to set Zone 4 floor
   - Leave blank if unknown

   **Mandatory Strength Sessions**
   - Set how many strength sessions per week are required
   - Falling below this triggers Structural Agent veto
   - Recommended: 2-3 sessions/week

   **Structural Weaknesses**
   - Select any injury history areas
   - Options: Patellar Tendon, Achilles, IT Band, Plantar Fascia, Glute/Hamstring, Lower Back
   - These inform the Structural Agent's risk assessment

3. Click **"LOCK PHENOTYPE"** to save

**Note:** You can update these settings anytime, but changes affect future coach decisions.

---

## Daily Workflow

### Morning Routine (5 minutes)

1. **Open Dashboard** (Mission icon)
   - **Code Reference:** `src/app/dashboard/page.tsx` (lines 25-403), `src/components/layout/BottomNav.tsx` (lines 13-14)
2. **Check GO/NO-GO Status**
   - Green "GO" = Execute planned workout
   - Amber "ADAPTED" = Structural Agent veto - substitution required
   - **Code Reference:** `src/app/dashboard/page.tsx` (lines 177-220), `src/modules/review/logic/substitutionMatrix.ts` (lines 32-56)

3. **Review Today's Mission**
   - See your planned workout
   - Check objective and protocol
   - Review constraints (HR caps, cadence targets)

4. **Daily Chassis Audit** (if prompted)
   - **Niggle Score**: Rate pain/discomfort (0-10)
     - 0-3: Green (no issues)
     - 4-6: Yellow (caution)
     - 7-10: Red (veto likely)
   - **Strength Session**: Log if you completed strength training
     - Select tier: Maintenance, Hypertrophy, Strength, or Power

5. **Review Agent Feedback**
   - Structural Agent: Chassis integrity status
   - Metabolic Agent: HRV and decoupling status
   - Fueling Agent: Gut training index

### Pre-Workout

1. **Check Plan Page** (Calendar icon)
   - Review upcoming sessions
   - Tap a session to see full details
   - Review protocol, constraints, and fueling targets
   - **Code Reference:** `src/app/plan/page.tsx` (lines 23-271), `src/components/shared/SessionDetailView.tsx` (lines 21-192)

2. **Execute Workout**
   - Follow the protocol as specified
   - Respect HR caps and cadence targets
   - If structural issues arise, consider substitution

### Post-Workout

1. **Post-Action Report** (if prompted)
   - **GI Distress**: Rate gut discomfort (1-10)
   - **Actual Carbs Ingested**: Enter grams per hour
   - **RPE**: Rate perceived exertion (6-10)
   - **Code Reference:** `src/components/shared/PostActionReport.tsx` (lines 9-58)

2. **Sync Garmin** (if using Garmin device)
   - Go to History page
   - Click "Sync Garmin" button
   - Select date range (start with 7 days)
   - Wait for sync to complete
   - **Code Reference:** `src/app/actions.ts` (lines 177-332), `src/modules/monitor/ingestion/garminSyncMCP.ts` (lines 43-207)

### Weekly Review

1. **Check Lab Page** (Flask icon)
   - Review Integrity Ratio chart (Chassis vs Engine balance)
   - Check Decoupling Trend (aerobic efficiency)
   - Look for trends and correlations

2. **Review History** (Log icon)
   - See all completed sessions
   - Check integrity badges (VALID vs SUSPECT)
   - Review agent post-mortem feedback
   - Identify patterns in substitutions or adaptations

---

## Pages & Features

### 🎯 Dashboard (Mission)

**Purpose:** Your daily command center. Shows real-time readiness status and today's workout.

**Key Elements:**

1. **Macro-Engine Probability**
   - Percentage chance of achieving your long-term goal
   - Based on current trajectory and adherence
   - Delta shows change from previous analysis
   - **Code Reference:** `src/app/dashboard/page.tsx` (lines 159-167), `src/modules/analyze/blueprintEngine.ts` (lines 31-81)

2. **GO/NO-GO Status**
   - **GO (Green)**: Chassis and Engine are green. Execute High-Rev Protocol.
   - **ADAPTED (Amber)**: Structural Agent Veto. Run substituted for Non-Impact Load.
   - **Code Reference:** `src/app/dashboard/page.tsx` (lines 177-220), `src/modules/review/logic/substitutionMatrix.ts` (lines 32-56)

3. **Chassis vs Engine Gauges**
   - **Chassis**: Structural integrity score (0-100%)
     - Based on: Days since last lift, niggle score, cadence stability
     - **Code Reference:** `src/app/dashboard/page.tsx` (lines 241-259), `src/modules/monitor/monitorStore.ts` (lines 115-118)
   - **Engine**: Metabolic efficiency score (0-100%)
     - Based on: HRV, aerobic decoupling, time in red zone
     - **Code Reference:** `src/app/dashboard/page.tsx` (lines 261-270), `src/modules/kill/logic/decoupling.ts` (lines 12-34)

4. **Today's Mission Card**
   - Workout title and objective
   - Duration and load level
   - Protocol (warmup, main set, cooldown)
   - Constraints (HR caps, cadence targets)
   - Fueling targets (if applicable)
   - **Code Reference:** `src/app/dashboard/page.tsx` (lines 272-350), `src/app/actions.ts` (lines 111-129)

5. **Daily Chassis Audit**
   - **Niggle Slider**: Rate pain/discomfort (0-10)
     - Moving slider >3 may trigger intervention modal
     - **Code Reference:** `src/app/dashboard/page.tsx` (lines 101-114), `src/modules/execute/agents/structuralAgent.ts` (lines 15-30)
   - **Strength Session**: Log if completed
     - Select tier: Maintenance, Hypertrophy, Strength, Power
     - **Code Reference:** `src/app/dashboard/page.tsx` (lines 116-128), `src/modules/monitor/monitorStore.ts` (lines 64-83)

6. **Agent Status Grid**
   - Structural Agent vote (Green/Yellow/Red)
     - **Code Reference:** `src/modules/execute/agents/structuralAgent.ts` (lines 11-60)
   - Metabolic Agent vote (Green/Yellow/Red)
     - **Code Reference:** `src/modules/execute/agents/metabolicAgent.ts` (lines 12-82)
   - Fueling Agent vote (Green/Yellow/Red)
     - **Code Reference:** `src/modules/execute/agents/fuelingAgent.ts` (lines 11-43)
   - Each shows reasoning

**Interactions:**
- Adjust niggle slider → May trigger Substitution Modal
  - **Code Reference:** `src/app/dashboard/page.tsx` (lines 101-114), `src/components/shared/SubstitutionModal.tsx` (lines 11-66)
- Log strength session → Updates chassis gauge
  - **Code Reference:** `src/app/dashboard/page.tsx` (lines 116-128)
- Click "Refresh Analysis" → Re-runs coach analysis
  - **Code Reference:** `src/app/dashboard/page.tsx` (lines 84-99), `src/app/actions.ts` (lines 21-175)

**When to Use:**
- Every morning to check readiness
- Before workouts to review mission
- After logging data to see updated status

---

### 📅 Plan (Calendar)

**Purpose:** View upcoming training sessions and past execution history.

**Key Elements:**

1. **Calendar Grid**
   - Shows 7-day window (3 days past, today, 3 days future)
   - Past days show execution status:
     - ✅ Green checkmark = Executed as planned
     - 🔄 Amber refresh = Substituted
   - Future days show planned sessions
   - Today is highlighted with emerald ring
   - **Code Reference:** `src/app/plan/page.tsx` (lines 124-217), `src/app/plan/page.tsx` (lines 30-104) for past session loading

2. **Upcoming Sessions List**
   - Today's workout (from coach analysis)
   - Next 3-4 planned sessions
   - Each shows:
     - Day name
     - Session type (KEY, STR, REC, etc.)
     - Title and duration
     - Load level
   - **Code Reference:** `src/app/plan/page.tsx` (lines 106-217), `src/types/prototype.ts` (lines 120-180)

3. **Session Detail View** (tap a session)
   - Full protocol breakdown
   - Mission objective
   - Execution constraints
   - Fueling timeline (if applicable)
   - Checklist items
   - "START MISSION" button
   - **Code Reference:** `src/components/shared/SessionDetailView.tsx` (lines 21-192), `src/app/plan/page.tsx` (lines 120-122)

**Interactions:**
- Tap calendar day → See session details
  - **Code Reference:** `src/app/plan/page.tsx` (lines 106-217)
- Tap session in list → Open detail view
  - **Code Reference:** `src/app/plan/page.tsx` (lines 106-109), `src/components/shared/SessionDetailView.tsx` (lines 21-192)
- Tap "START MISSION" → Begin workout (triggers Post-Action Report on completion)
  - **Code Reference:** `src/app/plan/page.tsx` (lines 116-118), `src/components/shared/PostActionReport.tsx` (lines 9-58)

**When to Use:**
- Planning your week
- Reviewing upcoming workouts
- Checking past execution adherence

---

### 📊 History (Black Box / Log)

**Purpose:** Audit log of all training sessions. Shows what happened and why.

**Key Elements:**

1. **Session List**
   - All sessions from last 30 days
   - Each card shows:
     - Day and date
     - Session title
     - Execution status (EXEC/SUB badge)
     - Integrity badge (VALID/SUSPECT)
     - Load score
     - Agent feedback summary
   - **Code Reference:** `src/app/history/page.tsx` (lines 26-62), `src/app/history/logic/sessionLoader.ts` (lines 37-111)

2. **Session Detail View** (tap a session)
   - **Post-Mortem Data:**
     - Integrity status and reasoning
     - Agent feedback (Structural & Metabolic)
     - Hidden variables (niggle, strength tier, GI distress)
   - **Execution Details:**
     - Protocol followed
     - Constraints respected
     - Fueling timeline
   - **Blueprint Impact:**
     - How this session affected long-term goal probability
   - **Code Reference:** `src/components/shared/SessionDetailView.tsx` (lines 21-192), `src/types/prototype.ts` (lines 45-118)

3. **Garmin Sync** (top right)
   - Button to sync activities from Garmin Connect
   - Date range selector
   - Progress indicator
   - Status messages
   - **Code Reference:** `src/modules/monitor/ingestion/garminSyncMCP.ts`, `src/modules/monitor/ingestion/garminSync.ts`, `src/app/actions.ts` (lines 177-332)

**Session Status Badges:**
- **EXEC (Green)**: Completed as planned
- **SUB (Amber)**: Substituted (e.g., Run → Bike)
- **VALID (Blue)**: Data passed integrity checks
- **SUSPECT (Orange)**: Data quality issues (cadence lock, sensor dropout)

**Interactions:**
- Tap session card → View full details
  - **Code Reference:** `src/app/history/page.tsx` (lines 64-72), `src/components/shared/SessionDetailView.tsx` (lines 21-192)
- Click "Sync Garmin" → Import activities
  - **Code Reference:** `src/app/actions.ts` (lines 177-332), `src/modules/monitor/ingestion/garminSyncMCP.ts` (lines 43-207)
- Review agent feedback → Understand why decisions were made
  - **Code Reference:** `src/app/history/page.tsx` (lines 139-148), `src/modules/dailyCoach/logic/decision.ts` (lines 39-97)

**When to Use:**
- After workouts to see post-mortem analysis
- Weekly review to identify patterns
- When syncing Garmin data
- Understanding why substitutions occurred

---

### 🧪 Lab (Analytics)

**Purpose:** Deep analytics showing bio-mechanical correlations over time.

**Key Elements:**

1. **Integrity Ratio Chart**
   - Shows Chassis vs Engine balance over 12 weeks
   - **Bars**: Lift tonnage (structural load)
   - **Dots**: Run volume (cardiovascular load)
   - **Green line**: Safe ratio threshold
   - **Goal**: Maintain balance (bars and dots aligned)
   - **Code Reference:** `src/app/lab/page.tsx` (lines 26-75), `src/app/lab/logic/dataLoader.ts` (lines 26-128)

2. **Aerobic Decoupling Chart**
   - Shows cardiac drift trend over time
   - **Lower is better**: Indicates improved efficiency
   - **Goal**: Flattening or decreasing trend
   - **Warning**: Increasing trend suggests overreaching
   - **Code Reference:** `src/app/lab/page.tsx` (lines 77-95), `src/modules/kill/logic/decoupling.ts` (lines 12-34)

3. **Gut Training Index** (if data available)
   - Tracks successful fueling sessions (>60g carbs/hr)
   - Rolling count of gut-adapted sessions
   - **Goal**: Increasing trend indicates gut training adaptation

**Interactions:**
- Hover over chart bars → See exact values
  - **Code Reference:** `src/app/lab/page.tsx` (lines 26-95) - Chart rendering with hover tooltips
- Review trends → Identify correlations
  - **Code Reference:** `src/app/lab/logic/dataLoader.ts` (lines 26-128) - Data aggregation and transformation
- Compare periods → See improvement/decline
  - **Code Reference:** `src/app/lab/page.tsx` (lines 26-95) - Chart visualization

**When to Use:**
- Weekly review of trends
- Before major training blocks
- When troubleshooting performance issues
- Understanding long-term adaptations

---

### ⚙️ Settings (Phenotype Configuration)

**Purpose:** Define your biological truth. These settings override standard algorithms.

**Key Elements:**

1. **High-Rev Mode Toggle**
   - Enable if you're a "High-Rev" athlete
   - Marathon HR averages >175 bpm
   - Disables standard anaerobic warnings
   - Activates "Phoenix Protocol"
   - **Code Reference:** `src/app/settings/page.tsx` (lines 114-142), `src/modules/monitor/phenotypeStore/logic/profileUpdater.ts`

2. **Heart Rate Configuration**
   - **True Max HR**: Override 220-age formula
   - **Lactate Threshold HR**: Your tested threshold (if known)
   - These set your HR zones
   - **Code Reference:** `src/app/settings/page.tsx` (lines 144-167), `src/modules/monitor/phenotypeStore.ts` (lines 32-57)

3. **Chassis Configuration**
   - **Mandatory Strength Sessions**: Required per week (2-3 recommended)
   - **Structural Weaknesses**: Select injury history areas
     - Patellar Tendon
     - Achilles Tendon
     - IT Band
     - Plantar Fascia
     - Glute/Hamstring
     - Lower Back
   - **Code Reference:** `src/app/settings/page.tsx` (lines 170-215), `src/modules/monitor/phenotypeStore.ts` (lines 32-57)

**Interactions:**
- Toggle High-Rev mode → Changes agent behavior
  - **Code Reference:** `src/app/settings/page.tsx` (lines 64-91), `src/modules/monitor/phenotypeStore.ts` (lines 59-84)
- Adjust HR values → Updates metabolic agent thresholds
  - **Code Reference:** `src/app/settings/page.tsx` (lines 64-91), `src/modules/execute/agents/metabolicAgent.ts` (lines 34-53)
- Select weaknesses → Informs structural agent risk assessment
  - **Code Reference:** `src/app/settings/page.tsx` (lines 197-214), `src/modules/execute/agents/structuralAgent.ts`
- Click "LOCK PHENOTYPE" → Saves all settings
  - **Code Reference:** `src/app/settings/page.tsx` (lines 64-91), `src/modules/monitor/phenotypeStore.ts` (lines 32-57)

**When to Use:**
- First-time setup (required)
- After physiological testing (update HR values)
- If injury history changes
- When transitioning to/from High-Rev training

**Important:** Changes to phenotype settings affect future coach decisions. Update after testing or significant physiological changes.

---

## Understanding the System

### The Three Agents

The app uses three AI agents that "vote" on your readiness:

1. **Structural Agent (Agent A)**
   - Evaluates: Niggle score, days since last lift, cadence stability
   - Votes: Green (GO), Yellow (Caution), Red (VETO)
   - **Red vote** = Substitution required (Run → Bike/BFR Walk)
   - **Code Reference:** `src/modules/execute/agents/structuralAgent.ts` (lines 11-60)

2. **Metabolic Agent (Agent B)**
   - Evaluates: HRV, aerobic decoupling, time in red zone
   - Votes: Green (GO), Yellow (Caution), Red (VETO)
   - **Red vote** = Reduce intensity or substitute
   - **Code Reference:** `src/modules/execute/agents/metabolicAgent.ts` (lines 12-82), `src/modules/kill/logic/decoupling.ts` (lines 12-34)

3. **Fueling Agent (Agent C)**
   - Evaluates: Gut training index, fueling adherence
   - Votes: Green (GO), Yellow (Caution), Red (VETO)
   - **Red vote** = Fueling strategy needs adjustment
   - **Code Reference:** `src/modules/execute/agents/fuelingAgent.ts` (lines 11-43)

### Coach Synthesis

The coach combines agent votes to make final decisions:
- **All Green** → Execute as planned
- **Any Red** → Substitution or modification
- **Multiple Yellow** → Caution, reduce intensity
- **Code Reference:** `src/modules/review/logic/substitutionMatrix.ts` (lines 9-111), `src/modules/dailyCoach/logic/decision.ts` (lines 84-96)

### Substitution Matrix

When Structural Agent vetoes a run:
- **Option 1**: Cycling Intervals (non-impact, maintains intensity)
- **Option 2**: BFR Walk (blood flow restriction, low impact)
- **Option 3**: Complete Rest (last resort)

The system prefers **active substitutions** over rest to maintain training load.

**Code Reference:** `src/modules/review/logic/substitutionMatrix.ts` (lines 32-56), `src/components/shared/SubstitutionModal.tsx` (lines 11-66)

### Data Integrity

The app validates sensor data quality:
- **Cadence Lock**: Detects when cadence sensor is stuck
  - **Code Reference:** `src/modules/kill/logic/cadenceLock.ts`
- **HR Drift**: Identifies cardiac drift patterns
  - **Code Reference:** `src/modules/kill/logic/decoupling.ts` (lines 12-34)
- **Sensor Dropout**: Flags missing data points
  - **Code Reference:** `src/modules/dailyCoach/logic/sessionProcessor.ts`

Sessions marked **SUSPECT** are excluded from baseline calculations to maintain data quality.
- **Code Reference:** `src/types/prototype.ts` (lines 76-79), `src/app/history/page.tsx` (lines 117-126)

---

## Troubleshooting

### "No data showing on Dashboard"

**Cause:** New account or no data entered yet.

**Solution:**
1. Enter daily monitoring data (niggle score, strength session)
2. Run coach analysis (automatic on Dashboard load)
3. Sync Garmin data if using Garmin device

### "Garmin sync fails"

**Possible Causes:**
- Invalid credentials in `.env.local`
- Rate limiting (wait 10-15 minutes)
- Network issues

**Solutions:**
1. Verify `GARMIN_EMAIL` and `GARMIN_PASSWORD` in `.env.local`
2. Try smaller date range (7 days instead of 30)
3. Wait 5 minutes between sync attempts
4. Check browser console for detailed error

### "Settings page constantly loading"

**Cause:** Infinite loop in profile loading (should be fixed, but if it occurs):

**Solution:**
1. Refresh the page
2. Clear browser cache
3. Check browser console for errors
4. Report issue if persists

### "Coach analysis not running"

**Cause:** Missing phenotype configuration or data.

**Solution:**
1. Complete Settings page configuration
2. Enter at least one daily monitoring entry
3. Refresh Dashboard page
4. Check browser console for errors

### "Sessions not appearing in History"

**Possible Causes:**
- No Garmin sync completed
- Date range filter too narrow
- No sessions in selected period

**Solutions:**
1. Sync Garmin data from History page
2. Expand date range
3. Check that sessions exist in selected period

### "Integrity badges showing SUSPECT"

**Cause:** Data quality issues detected (cadence lock, sensor dropout, etc.)

**Solution:**
1. This is informational - the system is working correctly
2. Check sensor connections for future sessions
3. SUSPECT sessions are excluded from baselines automatically

---

## Best Practices

### Daily Monitoring

1. **Be Honest with Niggle Scores**
   - Rate pain accurately (0-10)
   - Don't ignore warning signs
   - System uses this to protect you

2. **Log Strength Sessions Promptly**
   - Enter immediately after completion
   - Select correct tier (Maintenance/Hypertrophy/Strength/Power)
   - This affects Structural Agent decisions
   - **Code Reference:** `src/app/dashboard/page.tsx` (lines 351-395), `src/modules/monitor/monitorStore.ts` (lines 64-83), `src/modules/execute/agents/structuralAgent.ts` (lines 32-50)

3. **Complete Post-Action Reports**
   - Enter GI distress and fueling data
   - Helps Fueling Agent learn your gut capacity
   - Improves future recommendations
   - **Code Reference:** `src/components/shared/PostActionReport.tsx` (lines 9-58), `src/modules/execute/agents/fuelingAgent.ts` (lines 11-43)

### Garmin Sync

1. **Start Small**
   - First sync: 7 days or less
   - Gradually increase range
   - Avoid syncing entire history at once
   - **Code Reference:** `src/app/history/logic/dateChunker.ts` - Date range chunking logic

2. **Respect Rate Limits**
   - Wait 5 minutes between syncs
   - If rate limited, wait 10-15 minutes
   - Use MCP client for better performance
   - **Code Reference:** `src/modules/monitor/ingestion/garminSyncMCP.ts` (lines 43-207), `src/app/actions.ts` (lines 177-332)

3. **Regular Syncs**
   - Sync weekly or after major workouts
   - Keeps data current
   - Enables accurate analysis
   - **Code Reference:** `src/app/actions.ts` (lines 177-332) - Sync cooldown and rate limit handling

### Phenotype Configuration

1. **Test Before Setting**
   - Don't guess your max HR
   - Test lactate threshold if possible
   - Update after physiological testing
   - **Code Reference:** `src/app/settings/page.tsx` (lines 144-167) - HR input fields

2. **Be Accurate with Injury History**
   - Select all relevant areas
   - System uses this for risk assessment
   - Update if new injuries occur
   - **Code Reference:** `src/app/settings/page.tsx` (lines 197-214), `src/modules/execute/agents/structuralAgent.ts` - Injury history affects agent decisions

3. **Review Periodically**
   - Re-evaluate after training blocks
   - Update HR values after testing
   - Adjust strength frequency based on needs
   - **Code Reference:** `src/app/settings/page.tsx` (lines 64-91) - Profile update logic

### Training Adherence

1. **Follow Constraints**
   - Respect HR caps
   - Maintain cadence targets
   - Follow fueling timelines

2. **Trust the Substitutions**
   - If system suggests substitution, follow it
   - Substitutions maintain training load
   - Better than complete rest

3. **Review Agent Feedback**
   - Understand why decisions were made
   - Learn from post-mortem analysis
   - Adjust behavior based on patterns
   - **Code Reference:** `src/app/history/page.tsx` (lines 139-148), `src/modules/dailyCoach/logic/decision.ts` (lines 39-97) - Agent reasoning

---

## Code Reference Index

For developers, here's a quick reference to the main code files organized by feature:

### Core Application Files
- **Main Layout**: `src/app/layout.tsx` (lines 26-60) - Responsive layout with mobile/desktop navigation
- **Home/Auth**: `src/app/page.tsx` (lines 10-72) - Landing page with sign up/login
- **Server Actions**: `src/app/actions.ts` (lines 21-332) - Coach analysis and Garmin sync server actions

### Page Components
- **Dashboard**: `src/app/dashboard/page.tsx` (lines 25-403) - Daily command center
- **Plan**: `src/app/plan/page.tsx` (lines 23-271) - Calendar and upcoming sessions
- **History**: `src/app/history/page.tsx` (lines 16-165) - Session audit log
- **Lab**: `src/app/lab/page.tsx` (lines 9-143) - Analytics and charts
- **Settings**: `src/app/settings/page.tsx` (lines 32-238) - Phenotype configuration

### Navigation Components
- **Sidebar**: `src/components/layout/Sidebar.tsx` (lines 10-82) - Desktop navigation
- **BottomNav**: `src/components/layout/BottomNav.tsx` (lines 20-54) - Mobile bottom navigation
- **TopNav**: `src/components/layout/TopNav.tsx` (lines 6-27) - Mobile top header

### Shared Components
- **SessionDetailView**: `src/components/shared/SessionDetailView.tsx` (lines 21-192) - Session detail display
- **SubstitutionModal**: `src/components/shared/SubstitutionModal.tsx` (lines 11-66) - Intervention modal
- **PostActionReport**: `src/components/shared/PostActionReport.tsx` (lines 9-58) - Post-workout form

### Core Modules
- **Daily Coach**: `src/modules/dailyCoach.ts` (lines 20-52) - Main orchestration class
- **Coach Decision**: `src/modules/dailyCoach/logic/decision.ts` (lines 27-97) - Agent evaluation and synthesis
- **Coach Analysis**: `src/modules/dailyCoach/logic/analysis.ts` (lines 19-48) - Baseline and blueprint calculations
- **Substitution Matrix**: `src/modules/review/logic/substitutionMatrix.ts` (lines 9-111) - Workout modification logic

### Agent Logic
- **Structural Agent**: `src/modules/execute/agents/structuralAgent.ts` (lines 11-60) - Chassis integrity evaluation
- **Metabolic Agent**: `src/modules/execute/agents/metabolicAgent.ts` (lines 12-82) - Engine efficiency evaluation
- **Fueling Agent**: `src/modules/execute/agents/fuelingAgent.ts` (lines 11-43) - Gut training evaluation

### Data Processing
- **Cadence Lock**: `src/modules/kill/logic/cadenceLock.ts` - Sensor data validation
- **Decoupling**: `src/modules/kill/logic/decoupling.ts` (lines 12-34) - Aerobic decoupling calculation
- **Session Processor**: `src/modules/dailyCoach/logic/sessionProcessor.ts` - Session data processing

### State Management
- **Monitor Store**: `src/modules/monitor/monitorStore.ts` (lines 35-133) - Daily monitoring state
- **Phenotype Store**: `src/modules/monitor/phenotypeStore.ts` (lines 23-135) - User phenotype configuration
- **Auth Store**: `src/modules/auth/authStore.ts` - Authentication state

### Data Integration
- **Garmin Sync MCP**: `src/modules/monitor/ingestion/garminSyncMCP.ts` (lines 43-207) - Python MCP client integration
- **Garmin Sync**: `src/modules/monitor/ingestion/garminSync.ts` (lines 14-249) - npm client fallback
- **Session Loader**: `src/app/history/logic/sessionLoader.ts` (lines 37-111) - Session data loading
- **Lab Data Loader**: `src/app/lab/logic/dataLoader.ts` (lines 26-128) - Analytics data aggregation
- **Date Chunker**: `src/app/history/logic/dateChunker.ts` - Date range chunking for Garmin sync

### Type Definitions & Adapters
- **Prototype Types**: `src/types/prototype.ts` (lines 1-180) - Prototype data structures and adapters
- **Workout Types**: `src/types/workout.ts` - Workout and session type definitions
- **Agent Types**: `src/types/agents.ts` - Agent vote and input types

### Analysis & Blueprint
- **Blueprint Engine**: `src/modules/analyze/blueprintEngine.ts` (lines 31-81) - Monte Carlo simulation
- **Baseline Calculator**: `src/modules/analyze/analyzeStore/logic/baselineCalculator.ts` - Baseline calculations

---

**Last Updated:** January 2025  
**For technical setup, see:** `READY_TO_USE.md`  
**For developers, see:** `project_context.md`
