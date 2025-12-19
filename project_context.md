# Project Context & Constraints
> **Reference this file (@project_context.md) at the start of new tasks.**

## 1. Tech Stack (Hard Constraints)
* **Language:** TypeScript 5.x
* **Framework:** Next.js 14 (App Router)
* **Styling:** Tailwind CSS v3.4
* **State:** Zustand
* **DB:** Supabase (PostgreSQL)
* **Runtime:** Node.js (Server Actions) / Browser (Agents)

## 2. Design System / Vibe
* **Library:** shadcn/ui
* **Icons:** Lucide React
* **Theme:** Minimalist, Dark Mode default (High Contrast for Athletes)

## 3. Critical Rules (The "Never" List)
* [ ] No `any` types.
* [ ] No default exports.
* [ ] No inline styles.

## 4. Project Vision & Core Logic (from APEX performance.md)
* **Goal:** Bio-Mechanical Reasoning Engine for "High-Rev" Athletes.
* **Core Philosophy:** "Reasoning Over Tracking" - Structure Before Engine.
* **Modules:**
    * **M (Monitor):** Active Ingestion (Strength, Gut, Pain).
    * **K (Kill):** Data Integrity & Signal Processing (High-Rev Filter).
    * **A (Analyze):** Context & Forecasting (Baseline Engine, Blueprint Engine, Valuation Engine).
    * **E (Execute):** Micro-Agents (Structural, Metabolic, Fueling).
    * **R (Review):** Coach Logic & Substitution (Deterministic Plan Rewriting).
* **Key Logic:**
    * **Phenotype Sovereignty:** User physiology overrides population norms.
    * **Substitution Matrix:** If risk is high, substitute with non-impact load (e.g., Bike) instead of rest.

## 5. Memory Bank
* **Architecture Decisions:** [@memory/architecture_decisions.md](memory/architecture_decisions.md)
* **System Patterns:** [@memory/system_patterns.md](memory/system_patterns.md)
* **Gold Standards:** [@memory/gold_standards.md](memory/gold_standards.md)
* **Error Registry:** [@memory/error_registry.md](memory/error_registry.md)

## 6. Prototype Regeneration Notes
* **Source:** `app.tsx.prototype` (1133 lines) - Exact workflow and UI/UX specification
* **Status:** Regenerated with real data integration (Supabase + Garmin MCP)
* **Known Issues:** Page files exceed 100-line MAKER limit (intentional for prototype fidelity)
* **Type Adapters:** `src/types/prototype.ts` bridges prototype types with database schema
* **Decomposition:** Follow-up optimization task to split large page files into `logic/` subdirectories
* **Integrations:**
    * **Garmin:** Hybrid Sync via MCP (Python) + Supabase Edge Functions. Includes Deep Sync (retroactive update) and Strength Protocol Extraction.