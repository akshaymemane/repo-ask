No blocking findings in `ff0a6da..f931041`.

The wiring preserves explicit preflight callbacks. `SessionService.preflight(plan_content)` returns the expected `blocking_reasons`, `warnings`, and `execution` fields without recursive plan reads. Plans without a profile retain their existing readiness behavior. Startup composes Ask before execution; no import cycle was introduced. The updated UI copy matches the available controls.

Ran `python3 -m unittest tests.test_publication_api`: **9 tests passed**. New tests verify callback wiring and preservation; full readiness behavior and UI copy were checked by inspection, not runtime integration tests.

Verdict: approve exact commit f931041