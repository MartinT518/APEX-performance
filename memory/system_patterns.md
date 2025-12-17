# System Patterns

## 1. Component Architecture
* **Module-Based Structure:** Code is organized by the 4 Core Modules:
    * `src/modules/monitor` (M): Inputs (Niggle Slider, Strength Log).
    * `src/modules/kill` (K): Data Processing (High-Rev Filter, Decoupling).
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
* **Probabilistic Forecasting:**
    * Long-term success is not a binary. It is a **Monte Carlo Probability** (0-100%) derived from current adherence and injury risk.

## 8. UI Patterns
* **Agent Signaling:**
    * The UI must reflect the Agent's Vote color (Red/Amber/Green) directly.
    * **Chassis Gauge:** Visualizes the `Structural Agent` score.
    * **Tonnage Chart:** Visualizes the `Structure Before Engine` balance.
