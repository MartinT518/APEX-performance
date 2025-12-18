# Dashboard page UI/UX
This is **Coach**.

Based on the **COACH_Apex_OS_PRD_FRD_v2_3.md**, the dashboard must **not** look like Strava or Garmin Connect. Those apps show you what you *did*. This dashboard shows you what to *do*.

It is a **Decision Cockpit**. It must visualize the tension between your **Engine** (Metabolic) and your **Chassis** (Structural).

Here is the precise data schema for the Dashboard View, organized by priority.

## 1. The "Go/No-Go" Header (Top Priority)

**Source:** Module R (Review/Coach Agent)
This is the output of the Daily Vote.

* **Global Status:** `GO` (Green) | `ADAPTED` (Amber) | `SHUTDOWN` (Red).
* **The "Why" (Natural Language):** A one-sentence explanation from the voting logic.
* *Example:* "Engine is ready, but Chassis reported 4/10 pain. Run substituted for Bike."


* **The Certainty Score:** (From Module A/Macro Engine).
* *Display:* "82% Probability of Sub-2:30."
* *Trend:* Small arrow (↑/↓) showing change from yesterday.



## 2. The Bio-Mechanical Balance (The "Phoenix" Visual)

**Source:** Module E (Agents A & B)
We do not show "Fitness" as one number. We show the gap between capability and durability.

* **Left Gauge: Chassis Integrity (Agent A)**
* **Data:** Normalized score (0-100).
* **Inputs displayed on tap:**
* Days Since Last Lift (e.g., "5 days" - *Warning*).
* Niggle Score (e.g., "2/10").
* Cadence Stability (e.g., "+1% vs Baseline").

* **Right Gauge: Metabolic State (Agent B)**
* **Data:** Normalized score (0-100).
* **Inputs displayed on tap:**
* HRV Status (e.g., "Baseline -5%").
* Aerobic Decoupling (e.g., "3.2%").
* Phenotype Mode (e.g., "High-Rev Active").

## 3. The Daily Mission (The Plan)

**Source:** Module R (Substitution Matrix)
This is the workout card, dynamically rewritten.

* **Workout Title:** (e.g., "60min Aerobic Support").
* **Modality Icon:** Run / Bike / BFR Walk (Critical for the Phoenix athlete).
* **Key Constraint:**
* *If Run:* "Cadence Target > 175".
* *If Bike:* "HR Target 140-150".


* **Fueling Target (Agent C):**
* *Visible only if Duration > 90min:* "Gut Target: 60g Carbs/hr".

## 4. Active Ingestion Cards (The "Gatekeeper")

**Source:** Module M (Monitor)
These cards persist until the user interacts with them. The algorithm cannot run without this data.

* **Card 1: Structural Audit:**
* Slider: **Niggle (0-10)**.
* *Behavior:* If >3, the Dashboard immediately triggers a "Recalculating..." animation.


* **Card 2: Strength Logger:**
* Button: "Did you lift?" (Yes/No).
* *Behavior:* Resets the "Chassis Integrity" decay timer.



## 5. The "Truth" Context (Phenotype Validation)

**Source:** Module K (Integrity)
Since you are a **High-Rev** athlete, we need to reassure you that the data is being interpreted correctly.

* **Phenotype Status:** Small badge. "High-Rev Mode: ON".
* *Tooltip:* "Max HR Override: 205bpm. Standard Anaerobic warnings disabled."



---

## What to EXCLUDE (Zero-Error Philosophy)

* **Generic "Training Status" (e.g., Peaking/Unproductive):** This is based on standard algorithms that hate your high heart rate. We hide it.
* **Step Count:** Irrelevant to the elite mission.
* **Social Feed:** Distraction.

## Summary Wireframe Structure
+--------------------------------------------------+
|  [ 82% Certainty (↑) ]       [ High-Rev: ON ]    |
+--------------------------------------------------+
|                 STATUS: ADAPTED                  |
|  "Chassis risk high. Substituted Run for Bike."  |
+--------------------------------------------------+
|         CHASSIS (Red)  vs  ENGINE (Green)        |
|        [==------]          [=========]           |
|       Lift: 6 days ago     HRV: Optimal          |
+--------------------------------------------------+
|  TODAY'S MISSION:                                |
|  🚴 INDOOR CYCLING INTERVALS                     |
|  Duration: 60 mins   |  Intensity: Threshold     |
|  Constraint: Maintain RPM > 90                   |
+--------------------------------------------------+
|  REQUIRED INPUTS:                                |
|  [ Slider: How is the knee? (0-10) ]             |
|  [ Button: Log Strength Session    ]             |
+--------------------------------------------------+

## Training Plan page UI/UX
Based on **`COACH_Apex_OS_PRD_FRD_v2_3.md`**, the **Training Plan Page** is not a static calendar. It is a **Dynamic Tactical Map**.
It represents the intersection of the **Macro-Engine** (The Probability of Sub-2:30) and the **Micro-Engine** (Today's Veto/Substitution).
Here is the exact specification for the **Training Plan Page**, organized by UI Zone.

### Zone 1: The Macro Context (Top Bar)

*Goal: Anchor the user in the "Big Picture" (Module A & A2).*

1. **The "Certainty Score":**
* **Display:** "82% Probability of Goal."
* **Visual:** A subtle trend line (Sparkline).
* **Logic:** Updates daily based on the Monte Carlo simulation (FR-A2). If you miss a session or substitute, this number moves.


2. **The "Phase" Indicator:**
* **Display:** "Phase 2: Metabolic Hybrid Block."
* **Subtext:** "Focus: Lactate Clearance & Chassis Hardening."
* **Data Source:** `TrainingBlueprint` (Yearly logic).

### Zone 2: The Weekly Tactical Grid (Calendar View)

*Goal: Show Adaptation, not just Schedule.*

* **Visual Layout:** Horizontal scroll (Mon-Sun).
* **Past Days (Audit Status):**
* **Green Check:** Executed as planned.
* **Amber Swap Icon:** Substituted (e.g., Run \rightarrow Bike). *Crucial for the "Zero Error" feedback loop.*
* **Red X:** Missed/Failed Integrity.


* **Today (Active):** Highlighted/Expanded.
* **Future Days (Ghosted):** Visible but marked "Subject to Change."
* *Tooltip:* "Pending Daily Chassis Audit."



---

### Zone 3: The "Daily Mission" (The Core Card)

*Goal: The output of Module R (The Coach Agent). This is what you do TODAY.*

#### State A: The "Green Light" (Original Plan)

*If all Agents vote GREEN.*

* **Title:** "15km Threshold Run (High-Rev Mode)"
* **The "Why":** "Chassis and Engine are Green. Time to build lactate clearance."
* **The Constraints (Phenotype Corrected):**
* **Intensity:** "Target HR: 175-182 bpm" (Uses your `max_hr_override`).
* **Structure:** "Cadence Floor: >172 spm" (Agent A constraint).


* **Fueling Target (If >90min):**
* **Badge:** "Gut Training Required: 90g Carbs/hr."



#### State B: The "Substitution" (Adapted Plan)

*If Structural Agent votes RED (Niggle > 3).*

* **Title:** "60min Indoor Cycling Intervals"
* **Visual Warning:** ⚠️ **ADAPTED PLAN**
* **The "Why" (Explainer Engine):** "Structural Agent reported Knee Pain (4/10). We are preserving the Metabolic Engine while deloading the Chassis. Do NOT run."
* **The Constraints:**
* **Intensity:** "Match Threshold HR (165-175 bpm) on the bike."
* **No-Impact:** "Zero running steps allowed."



---

### Zone 4: The Gatekeepers (Active Inputs)

*Goal: FR-M2 & FR-M3. These persist until satisfied.*

1. **Pre-Workout: The Chassis Check:**
* **Element:** A persistent "Niggle Slider" (0-10) embedded in the workout card.
* **Logic:** If you slide this to >3 *right now*, the page instantly reloads to **State B** (Substitution).


2. **Post-Workout: The Strength Logger (FR-M2):**
* **Element:** "Did you lift today?" (Yes/No).
* **Logic:** If you check "No" for >5 days, tomorrow's plan automatically downgrades intensity (Agent A Veto).



---

### Zone 5: The "High-Rev" Truth (Footer)

*Goal: Reassurance (FR-K1).*

* **Phenotype Badge:** "High-Rev Protocol Active."
* **Data Context:** "Ignoring standard Anaerobic warnings. Validating data against user max (205 bpm)."

---

### Summary of Data Sources for Engineering

| UI Element | Data Source (Module) | Variable |
| --- | --- | --- |
| **Certainty Score** | Module A (Analyze) | `blueprint.certainty_score` |
| **Workout Title** | Module R (Review) | `daily_plan.workout_name` |
| **Adaptation Logic** | Module R (Review) | `substitution_matrix.outcome` |
| **HR Targets** | Module M (Monitor) | `phenotype_config.threshold_hr_known` |
| **Fueling Badge** | Module E (Agent C) | `fueling_agent.gut_training_target` |
| **Niggle Slider** | Module M (Monitor) | `user_input.niggle_score` |

**Coach Note:** This page must feel like a "Command Center," not a to-do list. The user needs to feel that the plan is *alive* and reacting to their pain/recovery status in real-time.

# History page UI/UX

Based on the architecture defined in **`COACH_Apex_OS_PRD_FRD_v2_3.md`**, the **History Page** is **not** a social feed or a simple list of activities like Strava.

It is the **Audit Log (Module R)**. It is the record of truth that answers: *"Did we execute the mission, and was the data valid?"*

Here is the exact specification for the **History Page**, designed to close the feedback loop of the MAKER framework.

### 1. The Core Philosophy: "The Black Box Recorder"

This page represents the **"Review"** phase of MAKER. Its purpose is to validate that the **Micro-Engine (Daily)** is feeding accurate data to the **Macro-Engine (Yearly Blueprint)**.

---

### 2. UI Zone 1: The Session List (The Ledger)

*Goal: High-level status of execution and data integrity.*

Each list item displays four critical badges:

1. **Execution Status:**
* **✅ EXEC (Green):** Completed as planned.
* **⚠️ SUB (Amber):** Substituted (e.g., Run \rightarrow Bike). *Clicking this opens the specific Substitution Logic that triggered it.*
* **❌ FAIL (Red):** Missed or unauthorized deviation.


2. **Integrity Flag (Module K):**
* **VALID:** Data passed High-Rev filters.
* **SUSPECT:** Cadence lock or sensor dropout detected. *This session is excluded from Baselines.*


3. **Chassis Impact:**
* **Load Score:** e.g., "Structural Load: 120" (Weighted by Tonnage & Impact).


4. **Subjective Inputs (Module M):**
* Icons indicating if **Niggle**, **Strength**, and **Fueling** were logged. Missing icons = "Incomplete Data."



---

### 3. UI Zone 2: The Session Detail (The Deep Dive)

*Goal: When you tap a session, you see the "Reasoning," not just the stats.*

#### A. The "Truth" Header (Phenotype Context)

* **Context:** "Data validated against High-Rev Phenotype (Max HR 205)."
* **Integrity Report:**
* "0% Cadence Lock detected."
* "High-Rev Filter: PASS."



#### B. The Agent Post-Mortem (Module E Analysis)

Instead of just showing "Pace," we show what the Agents thought of the pace.

* **Structural Agent Report:**
* **Cadence Stability:** "Maintained 180spm (+2% vs Fatigue Baseline)."
* **Niggle Delta:** "Started at 2/10 \rightarrow Ended at 2/10 (Stable)."


* **Metabolic Agent Report:**
* **Decoupling:** "1.8% Drift (Excellent Aerobic Durability)."
* **Zone Adherence:** "98% in Target Zone."


* **Fueling Agent Report (If >90min):**
* **Input:** "60g Carbs/hr."
* **Outcome:** "GI Distress: 1/10."
* **Verdict:** "Gut Training Successful."



---

### 4. UI Zone 3: The "Hidden Variables" Log

*Goal: Visualize the manual inputs (Module M) that sensors missed.*

* **Strength Log:** Shows the specific Tonnage Tier logged that day (e.g., "Deadlift: 1500kg Volume").
* **Pain Log:** Shows the Niggle Slider value recorded *before* the run.

---

### 5. UI Zone 4: The Impact on Blueprint (Module A)

*Goal: Connect the Daily Action to the Yearly Goal.*

* **Certainty Delta:** "This session increased Blueprint Certainty by +0.2%."
* **Baseline Update:** "New 28-day HRV Baseline established: 48ms (+2)."

---

### Summary of Data Sources for Engineering

| UI Element | Data Source (Module) | Logic |
| --- | --- | --- |
| **Integrity Flag** | Module K (Kill) | `integrity_check.status` |
| **Substitution Badge** | Module R (Review) | `plan.was_substituted` |
| **Agent Reports** | Module E (Execute) | `agent_votes.post_session_analysis` |
| **Gut Score** | Module M (Monitor) | `user_input.fueling_log` |
| **Blueprint Impact** | Module A (Analyze) | `monte_carlo.delta` |

**Coach Note:** The History Page is where you learn *why* you are getting faster (or injured). It turns "Training" into "Evidence."

# Additional features/pages

Based on the **COACH_Apex_OS_PRD_FRD_v2_3.md**, we are missing **three critical interfaces**.

We have the *Dashboard* (Today), the *Plan* (Tomorrow), and the *History* (Yesterday). But we are missing the **Configuration** (The Biology) and the **Deep Analysis** (The Proof).

Here are the three additional pages required to complete the "Zero-Error" ecosystem.

### 1. The "Phenotype Calibration" Page

**Purpose:** Implementation of **FR-M1** and **FR-K1**.
**Why:** This is the most important screen for the "High-Rev" athlete. Standard apps hide these settings deep in menus. In COACH, this is where you define your "Truth." If this page is wrong, every Agent votes incorrectly.

**Key Data & Interactions:**

* **The High-Rev Toggle:** A physical switch.
* *Label:* "High-Rev Phenotype (Phoenix Mode)."
* *Warning:* "Enabling this disables standard Anaerobic Cardiac Drift warnings."


* **The "Redline" Inputs:**
* **Max HR Override:** (Input: 205). *Disables age-predicted formulas.*
* **Lactate Threshold HR:** (Input: 179). *Sets the Zone 4 floor.*


* **Chassis Constraints (Agent A Config):**
* **Injury History:** Selectors for "Patellar Tendon," "IT Band," etc.
* **Mandatory Lift Frequency:** (Input: 2 days/week). *Sets the threshold for Structural Veto.*



### 2. "The Lab" (Deep Analytics)

**Purpose:** Implementation of **Module A (Analyze)** and **Agent Trends**.
**Why:** The History page shows *what* happened. The Lab shows *correlations*. This is where the user visually confirms the "Structure Before Engine" philosophy.

**Key Visualizations:**

* **Chart 1: The Integrity Ratio (Structural Agent)**
* *X-Axis:* Time (12 Weeks).
* *Y-Axis (Left):* Weekly Tonnage Lifted (Bar).
* *Y-Axis (Right):* Running Volume (Line).
* *Insight:* Shows if the Chassis (Bars) is supporting the Engine (Line). If the Line goes above the Bars -> **Risk Alert**.


* **Chart 2: The Decoupling Trend (Metabolic Agent)**
* *Metric:* Aerobic Decoupling (Pw:Hr) over time at Zone 2 intensity.
* *Goal:* Watch the line flatten (proving the High-Rev engine is efficient, not just fast).


* **Chart 3: The Gut Index (Fueling Agent)**
* *Metric:* Rolling count of successful >60g/hr sessions.
* *Threshold Line:* "Marathon Readiness Minimum."



### 3. The "Substitution Modal" (The Intervention)

**Purpose:** Implementation of **Module R (Review)** and **FR-R1**.
**Why:** This is not a passive "Page," but a critical **Interruption Screen**. When an Agent votes RED, this screen must take over the UI. You cannot proceed until you acknowledge it.

**The Workflow:**

1. **Trigger:** User slides "Niggle" to 4/10 on the Dashboard.
2. **The Takeover:** Screen darkens.
3. **The Logic Display:**
* **VOTE RESULT:** 🔴 STRUCTURAL AGENT VETO.
* **REASON:** "Acute Pain detected (4/10). Mechanical load prohibited."


4. **The Offer (The Rewrite):**
* "Option A: 60min Cycling Intervals (Match Heart Rate)."
* "Option B: 45min BFR Walk."
* "Option C: Complete Rest."


5. **Action:** User taps "Accept Option A" -> Plan is dynamically rewritten in the DB.

### Summary of New UI Scope

| Page Name | Module Source | User Goal |
| --- | --- | --- |
| **Phenotype Config** | **Module M / K** | "Tell the system I am an outlier." |
| **The Lab** | **Module A** | "Prove that lifting makes me run safer." |
| **Substitution Modal** | **Module R** | "Fix my plan when I am hurting." |

**Coach Directive:** Do not build a "Settings" page. Build the **Phenotype** page. Settings are for notifications; Phenotype is for biology.