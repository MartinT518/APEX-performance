# System Patterns

## 1. Component Architecture
* **Module-Based Structure:** Code is organized by the 5 Core Modules:
    * `src/modules/monitor` (M): Inputs (Niggle Slider, Strength Log).
    * `src/modules/kill` (K): Data Processing (High-Rev Filter, Decoupling).
    * `src/modules/analyze` (A): Context & Forecasting (Baseline Engine, Blueprint Engine, Valuation Engine).
    * `src/modules/execute` (E): Agents (Structural, Metabolic, Fueling).
    * `src/modules/review` (R): Coach Logic (Substitution Matrix).
* **Atomic Design:** Inside modules, use `atoms` (UI), `logic` (Hooks/Utils), and `features` (Complex Views).
* **Container/Presenter:** Separate logic (Agents) from UI (Dashboards).

## 2. Naming Conventions
* **Components:** PascalCase (e.g., `NiggleSlider.tsx`, `AgentStatusCard.tsx`)
* **Functions/Hooks:** camelCase (e.g., `calculateTonnage`, `usePhenotypeConfig`)
* **Types/Interfaces:** PascalCase with prefix (e.g., `IPhenotype`, `ISessionData`)
* **Constants:** SCREAMING_SNAKE_CASE (e.g., `MAX_HR_CEILING`, `VOTE_RED`)

## 3. Data Flow Patterns
* **The "Veto" Pattern:**
    * Agents do not "act"; they "vote".
    * Flow: `Sensor Data` -> `Agent Function` -> `Vote Object` -> `Coach Synthesis` -> `UI Update`.
    * **Strict Rule:** Agents must return a `VoteObject` (Red/Amber/Green) with a `reasoning` string.

## 4. State Management (Zustand)
* **Stores:** Split stores by Module.
    * `useMonitorStore` (Inputs: Niggle, Strength)
    * `usePhenotypeStore` (Config: Max HR, Weaknesses)
    * `useAnalyzeStore` (Baselines: HRV, Tonnage, Confidence Score)
    * `usePlanStore` (Output: Today's Workout)

## 5. Error Handling
* **Graceful Degradation:** If "Garmin MCP" fails, fallback to "Manual Input Mode" immediately.
* **Validation:** All inputs (sliders, forms) must be validated against `PhenotypeConfig` limits (e.g., HR cannot be > 220).

## 6. Verification Patterns
* **The MAKER Audit:**
    * Before declaring a module "Complete", it must pass a "Red Flag" test script (e.g., `tests/maker-monitor-check.ts`).
    * **Success Criteria:** Must handle edge cases (Nulls, NaN, Max Int) and enforce Business Logic (Vetoes) without exception.

## 7. Math & Logic Patterns
* **EWMA Memory:**
    * Baselines (HRV, Load) use **Exponential Weighted Moving Averages** (7-day and 28-day) rather than simple arithmetic means. This prioritizes recent context while retaining history.
    * Implemented in `src/modules/analyze/baselineEngine.ts` with `calculateEWMA()` function.
* **Probabilistic Forecasting:**
    * Long-term success is not a binary. It is a **Monte Carlo Probability** (0-100%) derived from current adherence and injury risk.
    * Implemented in `src/modules/analyze/blueprintEngine.ts` with `runMonteCarloSimulation()` function.

## 8. UI Patterns
* **Agent Signaling:**
    * The UI must reflect the Agent's Vote color (Red/Amber/Green) directly.
    * **Chassis Gauge:** Visualizes the `Structural Agent` score.
    * **Tonnage Chart:** Visualizes the `Structure Before Engine` balance.

## 9. History Page Audit Log Pattern
* **Session Status Badges:**
    * Execution Status: EXEC (Green) / SUB (Amber) / FAIL (Red) based on session metadata and sport_type.
    * Integrity Flag: VALID (Blue) / SUSPECT (Orange) from session metadata diagnostics.
    * Chassis Impact: Structural load score displayed as badge.
* **Data Joining:**
    * Join `session_logs` with `daily_monitoring` on `session_date = date` to display subjective inputs (niggle, strength, fueling).
    * Load `agent_votes` per session for post-mortem analysis.
    * Extract integrity status from `metadata.diagnostics.status` and cadence lock from `metadata.cadenceLockDetected`.
* **Expandable Detail View:**
    * Session cards are expandable to show: Phenotype context, Agent post-mortem reports, Hidden variables log, Blueprint impact.

## 10. Chart Visualization Patterns
* **Recharts Library:**
    * Use `ResponsiveContainer` for all charts to ensure mobile compatibility.
    * Consistent color scheme: Blue for structural/tonnage, Red for running/risk, Green for metabolic, Purple for fueling.
    * Dark theme styling: `stroke="#a1a1aa"` for axes, `backgroundColor: '#18181b'` for tooltips.
* **Chart Types:**
    * **Integrity Ratio:** Bar chart (tonnage) + Line chart (running volume) with dual Y-axes. Risk alerts when line > bars.
    * **Decoupling Trend:** Line chart showing percentage over time. Goal is flattening line.
    * **Gut Index:** Line chart with reference line for threshold (marathon readiness minimum).

## 11. Modal Interruption Pattern
* **Substitution Modal:**
    * Full-screen overlay with darkened background (`bg-black/50`).
    * Blocks navigation until user acknowledges by selecting an option.
    * Triggers when niggle score crosses threshold (>3) from <=3.
    * Presents 3 intervention options: Cycling Intervals, BFR Walk, Complete Rest.
    * On selection, triggers coach analysis to dynamically rewrite plan.
    * Modal is non-dismissible (no close button) until option selected.

## 12. Garmin Sync Pattern
* **Manual-Only Sync:**
    * No automatic background sync. User must explicitly trigger sync via button.
    * Date range selection: User selects start and end dates from UI filters.
* **Date Range Chunking:**
    * Date ranges >7 days are automatically split into sequential 7-day chunks.
    * Each chunk processed sequentially (one after another) to avoid rate limits.
    * Progress feedback: "Processing patch 1 of 5 (2025-11-18 to 2025-11-24)".
    * Chunking logic extracted to `logic/dateChunker.ts` utility for testability.
* **Rate Limit Handling:**
    * Batch size: 5 activities per batch.
    * Delays: 5 seconds after first batch, 3 seconds between subsequent batches.
    * Retry logic: Exponential backoff (2s, 4s, 8s) for rate-limited requests.
    * Early stopping: Stop immediately on 429 errors, return partial results.
* **Cooldown Mechanism:**
    * 5-minute cooldown between syncs (checked via last Garmin session `created_at`).
    * Cooldown only applies to first chunk; subsequent chunks in same sync bypass cooldown.
* **MCP Client Integration Pattern:**
    * **Primary Method:** Use MCP server's Python client (`garmin-connect-mcp-main`) via subprocess.
    * **Token Persistence:** OAuth tokens automatically saved to `~/.garminconnect/` directory. Client reuses tokens on subsequent syncs, only authenticating once.
    * **Efficient Queries:** Uses `get_activities_by_date(start_date, end_date, activity_type)` method - single API call per date range chunk instead of pagination.
    * **Error Handling:** Custom exceptions (`GarminRateLimitError`, `GarminAuthenticationError`) with proper error propagation to TypeScript layer.
    * **Fallback Strategy:** If Python/MCP unavailable, automatically falls back to npm `garmin-connect` package. This ensures sync works even without Python runtime.
    * **Subprocess Communication:** Python script outputs JSON to stdout, TypeScript parses and processes. Stderr used for logging without interfering with JSON parsing.
    * **Activity Details:** Python script fetches full activity details using `get_activity(activity_id)` and includes in response. TypeScript adapts details to session stream using existing `adaptGarminToSessionStream()` function.

## 13. Prototype Regeneration Pattern
* **Visual Fidelity Priority:**
    * When regenerating app from prototype, maintain exact UI/UX workflow and visual appearance.
    * Prototype structure (even if monolithic) takes precedence over MAKER file size limits during initial implementation.
    * Decomposition into smaller files is a follow-up optimization task, not a blocking requirement.
* **Type Adapter Layer:**
    * Create `src/types/prototype.ts` to define prototype-specific types and adapter functions.
    * Adapters transform between database types (`SessionWithVotes`, `IWorkout`) and prototype types (`SessionDetail`).
    * This isolates prototype UI from database schema changes.
* **Component Reuse Strategy:**
    * Audit existing components against prototype for exact visual match.
    * Only reuse if visually identical; otherwise rebuild to ensure pixel-perfect fidelity.
    * Use MAKER workflow for component creation: atomic decomposition, test-first, isolated execution, visual verification.

## 14. Responsive Layout Pattern
* **Mobile-First Navigation:**
    * Mobile: `TopNav` (COACH header) + `BottomNav` (thumb-accessible navigation bar).
    * Desktop: `Sidebar` (persistent navigation panel).
    * Use conditional rendering (`md:hidden` / `hidden md:block`) in `layout.tsx`, not CSS-only hiding.
* **Content Container:**
    * Mobile: `max-w-md mx-auto` centers content and prevents text from stretching too wide.
    * Desktop: `md:max-w-none md:mx-0` removes width constraints for full-width layout.
    * Bottom padding: `pb-20 md:pb-0` accounts for mobile bottom navigation height.
* **Layout Structure:**
    * `main` element has `md:ml-64` to account for fixed sidebar width on desktop.
    * Mobile navigation is fixed (`fixed bottom-0`) with high z-index (`z-50`).
    * All pages respect container constraints automatically via layout wrapper.

## 15. ValuationEngine Pattern (Mathematical Logic Layer)
* **Separate Logic Module:**
    * Mathematical calculations isolated in `src/modules/analyze/valuationEngine.ts`.
    * Pure functions: `calculateSmartAdherenceScore()`, `calculateIntegrityRatio()`, `calculateBlueprintProbability()`.
    * No UI dependencies - can be tested independently.
* **Equation Implementation:**
    * **Equation A (Smart Adherence)**: `Sum(V_eff * I_comp) / Sum(V_plan)`. Valid structural vetoes count as 0.8 adherence, not failure.
    * **Equation B (Integrity Ratio)**: `RollingAvg(Strength_Load) / RollingAvg(Run_Volume)` with unit normalization.
    * **Equation C (Blueprint Probability)**: `Base_Prob + (Alpha * (Vol_Banked - Vol_Req)) - (Beta * Risk_Penalty)` with 85% cap.
* **Phase-Aware Calculations:**
    * Vol_Req ramps by training phase: Phase 1 (60%), Phase 2 (80%), Phase 3 (100%), Phase 4 (50% taper).
    * Phase 3 penalty: If weekly volume < 50km, probability drops by 30%.
    * Uses `getCurrentPhase()` from blueprintEngine to determine phase requirements.
* **Risk Acknowledgment:**
    * Maximum probability capped at 85% (never promise certainty).
    * Applies cap at both calculation and display layers.
    * Constant `MAX_PROBABILITY = 85` enforces "Zero-Error" philosophy.

## 16. Data Integrity Validation Pattern
* **Suspect Data Handling:**
    * Sessions with `integrity === 'SUSPECT'` (e.g., cadence lock) must display "INVALID" for pace/distance fields.
    * Red highlighting (`text-red-400`) for all suspect data fields.
    * Never display calculated metrics (pace, distance) when data integrity is compromised.
* **Visual Indicators:**
    * Integrity badges: "VALID" (blue) / "SUSPECT DATA" (red) in session cards.
    * Compliance badges: "COMPLIANT" (green) / "SUBSTITUTED" (amber) / "MISSED" (red).
    * Conditional rendering: `session.integrity === 'SUSPECT' ? 'INVALID' : session.pace`.
* **Data Source Validation:**
    * Check `metadata.cadenceLockDetected` and `metadata.diagnostics.status` before displaying metrics.
    * Extract integrity from session metadata during type conversion (`sessionWithVotesToPrototype`).

## 17. Provisional Plan Display Pattern
* **Dynamic Plan Visualization:**
    * Training plan shows 7 days (today + 6 future days).
    * Days 3-7 marked as "Provisional" with visual indicators: dashed border, reduced opacity (60%), AlertCircle icon.
    * Tooltip: "Subject to Daily Chassis Audit" reinforces that plan is live, not static.
* **MAKER Framework Alignment:**
    * Reflects that Day 4 depends on Day 3's execution.
    * If Day 3 fails (Structural Veto), Day 4 must change.
    * Visual distinction prevents false sense of certainty.
* **Implementation:**
    * Flag: `isProvisional: i >= 3` in calendar generation.
    * Conditional styling: `opacity-60 border border-dashed border-slate-700`.
    * Icon: `<AlertCircle />` with tooltip for provisional days.

## 18. Client-Side Decoupling Calculation Pattern
* **Efficiency Factor (EF) Formula:**
    * `EF = Normalized Graded Pace / Avg HR`
    * Decoupling: `(EF_first_half - EF_second_half) / EF_first_half * 100`
* **Fallback Chain:**
    1. Use pre-calculated `decoupling` from metadata if available.
    2. Calculate from `firstHalfPace`, `firstHalfHR`, `secondHalfPace`, `secondHalfHR` if available.
    3. Fallback to estimated 2.5% if no data available.
* **Data Dependency:**
    * Requires first/second half metrics in session metadata.
    * **Recommendation**: Enhance `sessionProcessor.ts` to calculate and store these during session ingestion.
    * Current implementation gracefully handles missing data with fallbacks.
* **Pace Parsing:**
    * Handles both formats: "3:45/km" (MM:SS) and "3.75" (decimal minutes).
    * Regex: `/(\d+):(\d+)/` for time format, `parseFloat()` for decimal.

## 19. Auto-Sync Status Pattern
* **Persistent Button Visibility:**
    * Sync button always visible, never disappears or becomes permanently disabled.
    * Status indicators: "Syncing..." (spinner), "Up to Date" (green checkmark), "Wait Xm" (cooldown), "Sync Garmin" (idle).
* **Auto-Sync on Foreground:**
    * Check sync status every 30 seconds via `setInterval`.
    * Check on window focus event (`window.addEventListener('focus')`).
    * Determines status by checking last session `created_at` timestamp.
* **Status Logic:**
    * "Up to Date": Last sync within 5 minutes.
    * "Idle": Last sync > 5 minutes ago or no sync history.
    * "Cooldown": Active cooldown period (from sync action response).
* **Visual Feedback:**
    * Green background (`bg-emerald-500/10`) when up to date.
    * Tooltip shows last sync time: `title="Last synced: {time}"`.
    * Button serves as fallback, not primary interaction - status is automatic.

## 20. Module A (Analyze) Patterns
* **Purpose:** Context & Forecasting - Establishes baselines and calculates probabilities for long-term goal achievement.
* **Core Components:**
    * `baselineEngine.ts` (FR-A1): Calculates rolling statistics using EWMA for HRV (7-day) and Tonnage (28-day).
    * `blueprintEngine.ts` (FR-A2): Runs Monte Carlo simulations to generate confidence scores for goal achievement.
    * `valuationEngine.ts`: Implements three core equations (Smart Adherence, Integrity Ratio, Blueprint Probability).
    * `analyzeStore.ts`: Zustand store managing baseline state and history.
* **Baseline Calculation Pattern:**
    * Uses EWMA (Exponential Weighted Moving Average) for adaptive baselines.
    * Formula: `EMA_today = (Value_today * alpha) + (EMA_yesterday * (1 - alpha))` where `alpha = 2 / (N + 1)`.
    * HRV uses 7-day window (more responsive), Tonnage uses 28-day window (more stable).
    * Updates occur post-Module K (only clean data used).
* **Blueprint Engine Pattern:**
    * Monte Carlo simulation runs 1000 season futures.
    * Algorithm: `dP/dt = Training_Load * exp(-Injury_Risk)`.
    * Uses linear regression to determine trajectory from current load.
    * Returns success probability (0-100%) and confidence level (LOW/MEDIUM/HIGH).
* **Valuation Engine Pattern:**
    * **Equation A (Smart Adherence)**: `Sum(V_eff * I_comp) / Sum(V_plan)`.
        * Valid structural vetoes count as 0.8 adherence, not failure.
        * MISSED sessions contribute 0.
    * **Equation B (Integrity Ratio)**: `RollingAvg(Strength_Load) / RollingAvg(Run_Volume)`.
        * Normalizes units: `(Tonnage/1000) / (Volume/10)` to prevent meaningless ratios.
        * Goal ratio: 0.8 (chassis supports engine).
    * **Equation C (Blueprint Probability)**: `Base_Prob + (Alpha * (Vol_Banked - Vol_Req)) - (Beta * Risk_Penalty)`.
        * Phase-aware volume requirements: Phase 1 (60%), Phase 2 (80%), Phase 3 (100%), Phase 4 (50% taper).
        * Phase 3 penalty: If weekly volume < 50km, probability drops by 30%.
        * Maximum probability capped at 85% (never promise certainty).
* **State Management:**
    * `useAnalyzeStore` manages baselines and history.
    * Persists to Supabase `baseline_metrics` table.
    * Falls back to localStorage for offline support.
* **Data Flow:**
    * `Sensor Data` -> `Module K (Clean Data)` -> `Module A (Update Baselines)` -> `Module A (Calculate Probability)` -> `Module R (Coach Synthesis)` -> `UI Display`.