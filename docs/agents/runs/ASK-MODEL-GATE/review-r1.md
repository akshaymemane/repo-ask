# Review round 1

**Verdict: APPROVED**

Independent review of `41fcec3` found no blocking issues.

- `setBusy` preserves unavailable-action disabling, and submission—including Enter's default intent—rejects unavailable intents before sending.
- Conversation and landing role reads are epoch-guarded; landing rerenders report fresh roles through `onRoles`, while the fallback cannot overwrite a reported result. Only explicit `unassigned` states gate actions.
- `onRoles` observes each setup render without changing checklist state or assignment behavior.
- Disabled controls reference the visible setup notice through `aria-describedby`, including its Models settings link.

Verification: UI suite 192 passed, 0 failed; `tests.test_web_assets` passed 2/2.
