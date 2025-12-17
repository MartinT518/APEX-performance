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