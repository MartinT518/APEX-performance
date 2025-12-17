# **COACH: The Apex Performance Operating System**

## **Product & Functional Requirements Document (v2.3)**

Version: 2.3 (Added Open Source GitHub Stack)  
Status: Engineering Ready  
Author: Coach / Architect  
Framework: MAKER (Monitor, Analyze, Kill, Execute, Review)

# **PART 1: PRODUCT VISION & ARCHITECTURE**

## **1\. The Core Philosophy: "Reasoning Over Tracking"**

COACH is not a fitness tracker. It is a **Bio-Mechanical Reasoning Engine** designed for the "High-Rev" Athlete—an outlier physiology (e.g., 183bpm marathon HR) that breaks standard algorithms.

**The "Zero-Error" Mandate:**

1. **Structure Before Engine:** We never load a metabolic engine on a broken chassis. If Strength training is missed, Running is throttled.  
2. **Phenotype Sovereignty:** The user's specific physiology (verified by lab/field data) overrides population norms.  
3. **Substitution, Not Rest:** When mechanical risk is high, we do not simply rest (de-training); we substitute with non-impact load (BFR/Cycling) to maintain metabolic pressure.

## **2\. The Hybrid Logic Architecture**

The system uses two distinct logic engines:

1. **Macro-Engine (Weekly/Yearly):** **Probabilistic.** Uses Monte Carlo simulations to generate the TrainingBlueprint. It answers: *"What is the probability of hitting Sub-2:30 by September?"*  
2. **Micro-Engine (Daily):** **Deterministic.** Uses Multi-Agent Vetoes and a Substitution Matrix. It answers: *"Do we run hard today? Yes or No?"*

# **PART 2: FUNCTIONAL REQUIREMENTS (FRD)**

## **Module M: MONITOR (Active Ingestion Layer)**

*Goal: Capture the "Hidden" Variables (Strength, Gut, Pain) that sensors miss.*

### **FR-M1: Phenotype Configuration (The "Truth" File)**

**Critical for High-Rev Athletes.**

* **Requirement:** Onboarding must capture is\_high\_rev\_phenotype.  
* **Logic:** If True, disable standard "Anaerobic" alerts for steady-state HR \> 170bpm.  
* **Schema:**  
  {  
    "phenotype\_id": "phoenix\_high\_rev\_01",  
    "config": {  
      "max\_hr\_override": 205,  
      "threshold\_hr\_known": 179,  
      "anaerobic\_floor\_hr": 192,  
      "structural\_weakness": \["patellar\_tendon", "glute\_med"\]  
    }  
  }

### **FR-M2: The Active "Chassis" Audit (Strength)**

**Critical Correction:** Passive sync is insufficient.

* **Requirement:** A daily "Chassis Check" prompt if no API data is found.  
* **Input:** "Did you lift today?" \-\> If Yes: "Select Tonnage Tier" (Maintenance / Hypertrophy / Strength / Power).  
* **Metric:** Acute\_Tonnage\_Load (7-day rolling sum).

### **FR-M3: The Active "Fueling" Audit**

**Critical Correction:** Passive sync cannot measure GI distress.

* **Trigger:** Any Run \> 90 minutes.  
* **Prompt:**  
  1. "Approximate Carbs/Hour?" (\<30g / 30-60g / 60-90g / \>90g)  
  2. "GI Distress Rating?" (1-10)  
* **Logic:** Failure to log this marks the session as Fueling\_Unknown (Risk).

## **Module K: KILL (Data Integrity & Signal Processing)**

*Goal: Filter signal from noise before Agents see it.*

### **FR-K1: The High-Rev Filter**

* **Algorithm:**  
  * Incoming\_HR stream is compared against Phenotype\_Config.  
  * IF HR \> Age\_Predicted\_Max AND is\_high\_rev\_phenotype is FALSE \-\> Flag SUSPECT.  
  * IF HR \> Age\_Predicted\_Max AND is\_high\_rev\_phenotype is TRUE \-\> Flag VALID.

### **FR-K2: Artifact & Decoupling Logic**

* **Cadence Lock:** IF Correlation(HR, Cadence) \> 0.95 for \> 5 mins \-\> **Discard HR**.  
* **Dropouts:** IF ΔHR \> 40bpm in \< 3 sec \-\> **Discard Window**.

## **Module A: ANALYZE (Context & Forecasting)**

*Goal: Establish Baselines and calculate Probabilities. This is the memory of the system.*

### **FR-A1: The Baseline Engine**

* **Requirement:** Agents cannot vote without a "Normal" to compare against. This module computes rolling stats.  
* **Metrics Computed (Daily):**  
  * HRV\_Baseline (7-day & 28-day EWMA).  
  * Cadence\_Efficiency\_Baseline (Avg Cadence @ Z2 Pace).  
  * Tonnage\_Maintenance\_Level (Avg Weekly Load).  
* **Logic:** Updates occur post-Module K (Clean Data only).

### **FR-A2: The Blueprint Engine (Probabilistic)**

* **Requirement:** Generate the long-term "Confidence Score" (The Macro-Engine).  
* **Algorithm:** Bayesian Linear Growth Model.  
  * dP/dt \= Training\_Load \* exp(-Injury\_Risk).  
  * **Monte Carlo:** Simulate 1000 season futures based on current adherence.  
* **Output:** Certainty\_Score (e.g., "82% Confidence in Goal"). This informs the Coach (Module R) on long-term trends.

## **Module E: EXECUTE (The Micro-Agents)**

*Goal: Specialized, Independent Risk Assessment.*

### **Agent A: The Structural Agent (The Chassis)**

* **Primary Metric:** Structural\_Integrity\_Score (SIS).  
* **Computation:** (Mean\_Cadence\_Stability \* 0.5) \+ (Tonnage\_Adherence \* 0.5) \- (Niggle\_Pain \* 10).  
* **Veto Logic:**  
  * IF Niggle \> 3 \-\> **RED VETO** (Hard Stop).  
  * IF Days\_Since\_Lift \> 5 \-\> **AMBER VETO** (Cap Intensity).

### **Agent B: The Metabolic Agent (The Engine)**

* **Primary Metric:** Aerobic\_Decoupling (Pw:Hr).  
* **Veto Logic:**  
  * IF Decoupling \> 5% on last Zone 2 run \-\> **AMBER** (Fatigue/Dehydration).  
  * IF Time\_In\_Red\_Zone \> Plan\_Limit \-\> **RED** (Acute Overreach).

### **Agent C: The Fueling Agent (The Gut)**

* **Primary Metric:** Gut\_Training\_Index (Rolling count of \>60g/hr sessions).  
* **Veto Logic:**  
  * IF Next\_Run\_Duration \> 2.5h AND Gut\_Training\_Index \< 3 \-\> **RED VETO** on Duration (Cap at 2h).

## **Module R: REVIEW (The Coach Logic & Substitution)**

*Goal: Deterministic Plan Rewriting.*

### **FR-R1: The Substitution Matrix (Hard Logic)**

The Coach Agent does not "guess." It follows this rigorous Matrix:

| Structural Agent | Metabolic Agent | Fueling Agent | Action | Rewrite Protocol |  
| RED (Pain/Lift) | GREEN | GREEN | SUBSTITUTE | Bike Intervals (Match HR Duration) OR BFR. |  
| GREEN | RED (Fatigue) | GREEN | DOWNGRADE | Zone 1 Recovery or Rest. |  
| GREEN | GREEN | RED (Gut) | CAP | Long Run Capped at 120min \+ 5 min surges. |  
| RED | RED | Any | SHUTDOWN | Complete Rest \+ Mobility. |

# **PART 3: TECHNICAL PROCESS FLOW**

### **Step 1: Initialization & Phenotype Load**

1. **App Launch.**  
2. **Load User\_Phenotype:** Fetch max\_hr\_override, lift\_days\_required, niggle\_threshold.  
3. **Check Last\_Sync\_Time:** If \> 4 hours, trigger Garmin MCP Pull.

### **Step 2: Active User Ingestion (The "Gatekeeper")**

1. **Prompt:** "Daily Chassis Check."  
   * *Input:* Niggle Slider (0-10).  
   * *Input:* Strength Log (Yes/No).  
2. **Logic:** IF Niggle \> niggle\_threshold (3), set Global\_State \= CAUTION.

### **Step 3: Raw Data Processing (The "Kill" Module)**

1. **Ingest FIT File:** Parse HR, Pace, Cadence, GCT.  
2. **Run Integrity\_Check(Stream):** Apply High\_Rev\_Filter & Detect Cadence\_Lock.

### **Step 4: Analysis & Baserunning (The "Analyze" Module)**

1. **Update Baselines:** Re-calculate 7-day/28-day HRV, RHR, Tonnage averages.  
2. **Run Monte Carlo:** Update "Certainty Score" based on today's session completion.

### **Step 5: Agent Evaluation (The Reasoning)**

1. **Run Structural\_Agent:** Check Cadence\_Decoupling & Lift\_Recency.  
2. **Run Metabolic\_Agent:** Check Pw:Hr\_Drift.  
3. **Run Fueling\_Agent:** Check Gut\_Score.

### **Step 6: The Coach Synthesis (Deterministic Rewrite)**

1. **Aggregate Votes:** \[RED, GREEN, AMBER\].  
2. **Query Substitution\_Matrix:**  
   * Input: Structural=RED, Metabolic=GREEN.  
   * Result: SUBSTITUTE.  
3. **Generate Plan:** Replaces Impact with Non-Impact Load (Bike/BFR).

# **PART 4: DATA SCHEMAS (Reference)**

*(See v2.2 for JSON examples)*

# **PART 6: OPEN SOURCE ACCELERATORS (The GitHub Stack)**

**Directive:** Do not build core utilities from scratch. Use these verified repositories to accelerate the "Chassis" and "Logic" layers.

### **1\. Logic & Reasoning (The Agents)**

* **Library:** json-rules-engine (JavaScript/TypeScript)  
* **Repo:** [github.com/cachecontrol/json-rules-engine](https://github.com/cachecontrol/json-rules-engine)  
* **Use Case:** Powered the **Substitution Matrix** (FR-R1). It allows you to store the Agent Rules (e.g., "IF Niggle \> 3 AND HRV \< Baseline") as JSON config files rather than hard-coded logic. Crucial for updating rules without app store releases.  
* **Why:** Lightweight, runs offline (React Native compatible).

### **2\. Data Ingestion (The "Kill" Module)**

* **Library:** fitparse (Python) or fit-file-parser (JS)  
* **Repo:** [github.com/dtcooper/python-fitparse](https://github.com/dtcooper/python-fitparse) (Backend)  
* **Repo:** [github.com/jimmykane/fit-file-parser](https://www.google.com/search?q=https://github.com/jimmykane/fit-file-parser) (Frontend/Node)  
* **Use Case:** Parsing the raw .FIT files from Garmin. You need access to the raw byte streams to detect Cadence Lock (FR-K2) which aggregated APIs often smooth over.  
* **Why:** The "Gold Standard" for FIT parsing.

### **3\. Signal Processing (Module K)**

* **Library:** HeartPy  
* **Repo:** [github.com/paulvangentcom/heartrate\_analysis\_python](https://github.com/paulvangentcom/heartrate_analysis_python)  
* **Use Case:** Anomaly detection. This library has built-in algorithms for "Clipping" and "Artifact correction" which we will use to filter the High-Rev data (FR-K1) before the Agents see it.  
* **Why:** Specifically designed for noisy sensor data.

### **4\. Mathematics & Stats (The Blueprint Engine)**

* **Library:** simple-statistics  
* **Repo:** [github.com/simple-statistics/simple-statistics](https://github.com/simple-statistics/simple-statistics)  
* **Use Case:** On-device calculation of Standard Deviation (for Rolling Baselines) and Linear Regression (for trend detection).  
* **Why:** Very small bundle size, perfect for mobile offline mode.

### **5\. UI Components (The Chassis Dashboard)**

* **Library:** Victory Native  
* **Repo:** [github.com/FormidableLabs/victory-native](https://github.com/FormidableLabs/victory-native)  
* **Use Case:** Visualizing the **Chassis Integrity Score** (FR-E1). We need "Gauge" and "Candlestick" charts to show the relationship between Strength Tonnage and Run Volume.  
* **Why:** Best-in-class performance for React Native data viz.

### **6\. Health Bridge (The Backup Ingest)**

* **Library:** react-native-health  
* **Repo:** [github.com/agencyenterprise/react-native-health](https://github.com/agencyenterprise/react-native-health)  
* **Use Case:** Fallback ingestion. If Garmin API fails, we pull step count and sleep data from Apple Health / Google Fit directly on device.