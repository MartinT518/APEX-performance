# MAKER Process Workflow (Strict Mode + Learning)

When the user submits a coding request, strictly follow this loop:

## PHASE 1: DECOMPOSITION & MEMORY
1.  **Analyze:** Read user request, `@project_context.md`, and `memory/error_registry.md`.
2.  **Warn:** If task triggers a known pitfall, warn the user.
3.  **Decompose:** Break task into atomic steps. Ask: "Proceed with Step 1?"

## PHASE 2: THE "RED FLAG" TEST (TDD)
1.  **Test First:** Generate a test case defining "Success" for the step.
2.  **Wait:** Get user confirmation.

## PHASE 3: ISOLATED EXECUTION
1.  **Focus:** Execute *only* the current step.
2.  **Output:** Generate code to pass the test.

## PHASE 4: RED-FLAGGING & REGISTRATION
1.  **Audit:** Check length (>100 lines) and types.
2.  **Register:** If you fix a tricky error, update `memory/error_registry.md`.

## PHASE 5: VERIFICATION
1.  **Prompt:** "Does this pass the test and align with the plan?"
2.  **Loop:** Proceed to next step.
