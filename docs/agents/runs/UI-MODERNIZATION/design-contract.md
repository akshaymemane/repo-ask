# UI modernization design contract

## Product surface and job

OpenDevin is a local engineering command center. A developer repeatedly scans repository state, asks code questions, reviews implementation plans, and supervises execution. The interface must put the active work, its scope, and its state ahead of product explanation.

## Direction

- **Audience:** experienced developers managing many repositories and long-running implementation sessions.
- **Tone:** calm, technical, dense, precise, and quietly premium.
- **Memorable detail:** an “active workspace” language made from a restrained mint status light, inset active edges, and layered graphite surfaces.
- **Hierarchy:** workspace rail → current route/scope → primary work surface → secondary inspector. Primary actions use the mint accent; warnings and failures retain semantic amber/red.
- **Typography:** compact system sans for interface text, monospace only for identifiers/code, balanced short headings, tabular dynamic metrics.
- **Motion:** 120–180 ms transitions for hover, focus, panel/surface entry, and button press. No ambient or looping decoration.

## Constraints

- Preserve existing DOM behavior, routes, API contracts, keyboard order, focus management, state language, and source citations.
- No new runtime dependency, remote font, image asset, gradient, oversized card, or decorative dashboard widget.
- WCAG-visible focus, non-color state labels, reduced-motion support, and 44 px touch targets at compact widths.
- Reuse current tokens and selectors so legacy/demo fallbacks remain visually coherent.

## Target viewports

- `390x844`: compact phone; navigation, toolbar, tables, composers, and dialogs must not overflow.
- `1440x900`: primary desktop; rail, work surface, and inspector must remain visually distinct without wasted space.

## Content-state contract

| State | Trigger | Visible feedback | Safe next action |
| --- | --- | --- | --- |
| Loading | route/API read pending | stable page structure and explicit loading copy | wait or navigate elsewhere |
| Empty | no conversations/repositories/sessions | quiet empty surface with a direct setup/create action | connect, index, or start from Ask |
| Error | API/provider/index failure | semantic error text and retained surrounding context | retry/reload/configure |
| Partial | some repository/model/session data unavailable | available content remains visible; unavailable portion is named | inspect details or adjust scope |
| Success | connection, save, index, plan, or session step succeeds | status line/badge plus next supported action | continue the workflow |
| Permission | source sharing, repository writes, or provider access is blocked | boundary and required setting are named | return to Settings or leave disabled |

## Acceptance observations

- One obvious active route and one primary action per local context.
- Surface depth comes from borders, tone, and restrained shadow—not nested cards.
- Updating counts, durations, and usage values do not visually jump.
- Hover never substitutes for focus; reduced motion removes transforms/animations.
- Desktop and compact rendered evidence are required before approval.
