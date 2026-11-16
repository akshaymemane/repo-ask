# Ask landing hint handoff

- Author and role: Claude, experience
- Branch: `task/ask-landing-hint-align`
- Base: `29209a3` (integration)
- Submitted commit: `3edac68`
- Origin: the user reported that the hint under the Ask landing composer was not aligned with the input box.

## Behavior

`ask.js` uses a local two-argument `el(tag, text)` that ignores a third argument. The hint passed
`'landing-hint'` as that argument, so it rendered as an unstyled paragraph: full width, 16px,
left-aligned. The hint now sets `className` directly, as the landing heading already does. No
other three-argument `el` call exists in `ask.js`.

## Verification

| Scenario | Command or check | Result |
| --- | --- | --- |
| UI suite | `node --test tests/ui/*.test.mjs` | 200 pass, 0 fail |
| New test fails without fix | Ran against the base file | Fails: "hint carries its class" |
| Chrome, running app | Hint and composer bounding boxes | Both x=671, width 760; hint 13px |

## Risks and next action

None known. Reviewer scope: the landing render path in `ask.js` and the new test.
