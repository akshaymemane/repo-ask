# UI-MODERNIZATION review — round 1

Verdict: **CHANGES_REQUESTED**

- Reviewed commit: `6547f773f8c285c8af59a3b07e4c184dc18eac3c`
- Branch/worktree: `task/ui-modernization` / `opendevin-ui-modernization`
- Reviewer: independent Codex quality/accessibility reviewer

## Findings

1. **Major — the two-row compact rail and fixed 57px sticky offset can overlap navigation and focused content.**  
   `repoask/web/styles.css:1471-1483`; rendered `evidence/ask-500x844.png`  
   The inherited compact layout gives `.primary-nav` `order: 3; width: 100%`, so the modern sticky rail renders as two rows (about 110px in the supplied 500px artifact). The route bar nevertheless sticks at `top: 57px`, and `.workspace` subtracts only `113px` (57 + 56) from the viewport. Once the page scrolls, the route bar occupies the lower half of the sticky rail and the workspace is sized roughly one rail-row too tall. This violates the contract's focus-preservation constraint and the handoff's explicit “sticky rail + route bar do not occlude focused content” check. Either keep the compact rail non-sticky, make it a guaranteed single row, or derive a shared compact-rail height for both the route-bar offset and workspace height. Add a rendered scroll/focus regression at 390/500px, not just a no-horizontal-overflow assertion.

2. **Major — compact primary navigation misses the declared 44px target size.**  
   `repoask/web/styles.css:1474,1478`; `design-contract.md:20`; `evidence/report.json:42`  
   The contract requires 44px compact targets and the evidence says the compact artifact has 44px controls, but `.rail-new` and every primary-nav link explicitly use `min-height: 40px`. These are among the most frequently used touch targets. Raise them to at least 44px and assert the actual computed sizes at the compact viewport. The general `.button` rule does not cover these anchors.

3. **Minor — the content-state evidence overstates what was rendered.**  
   `evidence/report.json:13-35`  
   Both screenshots show the same Ask/setup state. The report marks loading, error, success and permission as passed, but its observations are source-level claims rather than recorded exercises of those states; no artifact or named browser fixture demonstrates an error/retry state or a completed-success state. Exercise representative loading/error/success states in the scratch workspace and identify the fixture/route in the observations, or describe the checks as source review instead of rendered acceptance. A light-mode capture/observation should also be added because light/dark parity is a delivered claim and review focus, even though token contrast spot-checks are acceptable (`#5f6977` on `#f4f6f8` ≈ 5.14:1; white on `#087d66` ≈ 5.08:1).

## Checks run

- Focused shell UI: 14/14 passed.
- Full UI: 285/285 passed.
- Web assets: 2/2 passed.
- Inspected both rendered artifacts and the exact CSS/HTML diff.
- Confirmed no `transition: all` or `will-change: all`; reduced-motion rules and dark/light semantic token contrast are otherwise sound.

The graphite/mint direction, desktop hierarchy, explicit transition properties, reduced-motion handling, focus-ring styling and horizontal-overflow correction otherwise match the modernization contract. Resubmit an exact commit after the compact sticky geometry and target-size findings are corrected and the evidence is made precise.
