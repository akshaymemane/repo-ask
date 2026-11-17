# UI interaction consistency handoff

## Scope

- Completes side-panel tab relationships (`id`, `aria-controls`, `aria-labelledby`).
- Treats the compact side panel as a modal overlay: outside content is inert, Tab is contained, Escape closes, and focus returns to the opener. Desktop remains a non-modal complementary panel.
- Gives the repository mention textarea combobox/listbox semantics and keeps `aria-expanded` correct for results and empty results.
- Removes implicit repository-picker confirmation from Enter in search fields and checkboxes; only the Add button confirms.
- Raises compact touch targets for side-panel tabs, picker rows, and mention options.

## Verification

- Focused UI: 26/26 passed.
- Full UI: 282/282 passed with `REPOASK_TEST_PYTHON=/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python`.
- Web assets: 2/2 passed.

## Review focus

- Confirm inert state is applied only to siblings outside the compact panel's ancestor path and is restored on close.
- Confirm the focus loop includes the compact panel's available controls and desktop behavior stays non-modal.
- Confirm Enter remains available to toggle a native checkbox but never resolves the picker.
