# Error Registry
| Context | The Error | The Fix | Prevention Rule |
| :--- | :--- | :--- | :--- |
| **Garmin Integration** | `TS2304: Cannot find name 'GarminConnect'` | Created `src/types/declarations.d.ts` | **Dependency Typings**: Always check for `@types/package` or create a declaration file immediately. |
| **Garmin Adapter** | `TS2322: Type 'string' is not assignable to type 'number'` (ISessionStream) | Updated adapter to strict interface match | **Strict Interface Adherence**: Verify adapter outputs against interfaces before building. |
| **Session Types** | `TS2322: Property 'heartRate' is missing` | Made `heartRate` optional (`?`) in `ISessionDataPoint` | **Real World Data**: Sensor data is never perfect; optional fields are necessary. |
| **HighRev Filter** | `TS18048: 'p.heartRate' is possibly 'undefined'` | Added null check `if (!p.heartRate) continue` | **Strict Null Checks**: Always guard optional properties in calculation logic. |
| **Python Integration** | `CommandNotFoundException: uv` | Use `pip install` or ensure `uv` is in PATH. | **Environment Checks**: Verify CLI tools exist before running shell commands. |
| **Unit Testing** | `Cadence Lock Test Failed` (False Negative) | Fixed test data generation to ensure shared noise source. | **Test Fidelity**: When testing correlation algorithms, synthetic data must actually be correlated (use shared variables). |
| **Type Safety** | `any` types in `garminAdapter.ts` and `actions.ts` | Created `src/types/garmin.ts` with proper interfaces, replaced `error: any` with `error: unknown` | **Strict Typing**: Never use `any`; create proper TypeScript interfaces for external APIs. Use `unknown` for error handling. |
| **Mock Data UUID** | `invalid input syntax for type uuid: 'phoenix_high_rev_01'` | Added UUID validation, auto-reload from Supabase if mock ID detected, prevent mock profile persistence | **UUID Validation**: Always validate UUIDs before database operations. Never persist mock IDs to Supabase. |
| **File Complexity** | Files exceeding 100-line MAKER limit (251, 245, 234, 217, 184 lines) | Decomposed into atomic modules: `logic/` subdirectories with single-responsibility functions | **MAKER Decomposition**: Files must not exceed 100 lines. Extract logic into `logic/` subdirectories following single responsibility principle. |
