# Project Context & Constraints
> **Reference this file (@project_context.md) at the start of new tasks.**

## 1. Tech Stack (Hard Constraints)
* **Language:** TypeScript 5.x
* **Framework:** Next.js 15 (App Router) - **Note:** `cookies()` is async in Next.js 15
* **Styling:** Tailwind CSS v3.4
* **State:** Zustand (client-side only - never in server actions)
* **DB:** Supabase (PostgreSQL) with RLS policies
* **Runtime:** Node.js (Server Actions) / Browser (Agents)
* **Auth:** Supabase Auth with security-first pattern (server-side session only)

## 2. Design System / Vibe
* **Library:** shadcn/ui
* **Icons:** Lucide React
* **Theme:** Minimalist, Dark Mode default (High Contrast for Athletes)

## 3. Critical Rules (The "Never" List)
* **No `any` types** - Use `unknown` for error handling, create proper interfaces
* **No default exports** - Use named exports only
* **No inline styles** - Use Tailwind CSS classes
* **No client-provided userId in server actions** - Always get from server session (security-first)
* **No zustand in server actions** - Fetch data from Supabase directly
* **No `dotenv.config()` in production code** - Environment variables loaded by runtime

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
* **Architecture Decisions:** [@memory/architecture_decisions.md](memory/architecture_decisions.md) - 40 ADRs (latest: ADR-040)
* **System Patterns:** [@memory/system_patterns.md](memory/system_patterns.md) - 40 patterns (latest: Unit Test Pattern)
* **Gold Standards:** [@memory/gold_standards.md](memory/gold_standards.md) - 7 patterns (latest: Phenotype Invalidation)
* **Error Registry:** [@memory/error_registry.md](memory/error_registry.md) - 40 entries (latest: P0 Unit Tests)

**Key Recent Patterns:**
* **Security-First Authentication:** Server actions get userId from session only (ADR-031, ADR-032)
* **Snapshot Caching:** Daily decisions cached in `daily_decision_snapshot` table (ADR-034)
* **Substitution Persistence:** Selected substitutions persist to DB (ADR-035)
* **LLM Constraints:** Explicitly passed to LLM narrator (ADR-038)
* **Phenotype Invalidation:** Future snapshots invalidated on phenotype change (ADR-039)

## 6. Current Status & Compliance

**Systematic Code Review:** ✅ **COMPLETE** (2025-01-31)
* **P0 Issues:** 6/6 fixed (100%) - Security, data integrity, functional bugs
* **P1 Issues:** 5/5 fixed (100%) - Performance, testing, data quality
* **P2 Issues:** 3/3 fixed (100%) - Code quality, LLM constraints, phenotype invalidation
* **Overall Compliance:** ~90% (up from 72%)
* **Test Coverage:** P0 functions >80% coverage
* **Documentation:** See `docs/SYSTEMATIC_REVIEW_SUMMARY.md` for full report

**Key Implementations:**
* ✅ Security-first authentication (no client-provided userId)
* ✅ Snapshot caching with automatic invalidation
* ✅ Substitution persistence (reload-safe)
* ✅ Gatekeeper AUDIT_PENDING enforcement
* ✅ LLM constraints explicitly passed
* ✅ Phenotype invalidation for future snapshots
* ✅ Unit tests for all P0 functions

## 7. Prototype Regeneration Notes
* **Source:** `app.tsx.prototype` (1133 lines) - Exact workflow and UI/UX specification
* **Status:** Regenerated with real data integration (Supabase + Garmin MCP)
* **Known Issues:** Page files exceed 100-line MAKER limit (intentional for prototype fidelity)
* **Type Adapters:** `src/types/prototype.ts` bridges prototype types with database schema
* **Decomposition:** Follow-up optimization task to split large page files into `logic/` subdirectories
* **Integrations:**
    * **Garmin:** Hybrid Sync via MCP (Python) + Supabase Edge Functions. Includes Deep Sync (retroactive update) and Strength Protocol Extraction.

## 8. Testing & Quality Assurance
* **Unit Tests:** `tests/*.test.ts` - Status resolver, audit gating, substitution persistence, import idempotency
* **Integration Tests:** `tests/integration/*.ts` - Daily flow, substitution selection, audit blocking
* **MAKER Checks:** `tests/maker-*.ts` - Module-specific compliance checks
* **Linting:** ESLint with TypeScript strict rules (288 issues - mostly pre-existing `any` types)
* **Test Coverage Target:** >80% for P0 functions, >60% for P1 functions