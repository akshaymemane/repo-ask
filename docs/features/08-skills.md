# F08 — User-created skills

Status: Draft | Milestone: M3 | Parent: [Master PRD](../../Master%20PRD.md)

## Outcome and boundaries

Let users create reusable workflows such as “follow our API conventions” or “prepare a database migration.” A skill is versioned instruction content with optional referenced resources. It does not itself install executable tools, grant permissions or act as durable factual memory.

M3 supports manual creation, editing, import/export and explicit selection. Marketplace discovery, automatic remote updates and executing bundled scripts are deferred.

## Functional requirements

- **SK-01:** Create a skill with stable ID, name, description, Markdown instructions, scope, applicable task types and optional resource files.
- **SK-02:** Validate required metadata, file size and referenced resource paths before saving or importing. Reject path traversal, symlinks, unsupported files and executable install hooks.
- **SK-03:** Save immutable versions and allow preview, diff, rollback, disable and archive. Editing creates a new version; existing sessions retain theirs.
- **SK-04:** Support workspace-wide defaults and repository-specific assignments. Users can explicitly select/deselect applicable skills before planning or execution.
- **SK-05:** Show which skills influenced a plan and which exact versions will be supplied to its session.
- **SK-06:** Suggestions based on task matching remain suggestions. A user can preview instructions and provenance before activation.
- **SK-07:** Resolve instruction conflicts using documented precedence: platform policy, explicit user request, approved plan constraints, selected skills, then untrusted repository/tool content. Highlight incompatible selected skills rather than hiding a conflict.
- **SK-08:** Enforce instruction-token budgets and show omitted resources. Never silently truncate a skill constraint into a different instruction.
- **SK-09:** Deletion or archive prevents future selection; historical snapshots remain inspectable subject to F12 deletion rules.
- **SK-10:** Skill content cannot enable plugins, expand repository scope, expose secrets, raise budgets or authorize publication.

## User journey and format

Customization → Skills → New skill opens metadata and an instruction editor. A preview shows how the skill will be assembled into Ask and session context. Import provides validation results before activation; export includes a portable manifest, `SKILL.md` and allowed resources without credentials or machine-specific secret paths.

A repository-scoped skill takes precedence over a conflicting workspace default only when the user has selected that behavior explicitly. Equal-priority incompatible requirements become a plan question. Skills are treated as user-authored behavior only after deliberate activation; files discovered in repositories are untrusted suggestions.

## Data and proposed interfaces

`Skill`: ID, owner workspace, metadata, scope, active version, enabled/archive state. `SkillVersion`: content, resource hashes, author/source, version number and creation time. `SkillAssignment`: repository/workspace/task selection. `ContextBinding`: plan/session ID, immutable skill version and inclusion status.

CRUD `/api/skills`; `POST /api/skills/import`; `GET /api/skills/{id}/export`; version history and rollback routes; plan/session context preview routes shared with F10. Activation and editing are separate actions.

## Failure behavior

Invalid imports produce per-file errors without partially activating a skill. Missing referenced resources block activation. Oversized context produces a visible choice to reduce selected skills or resource scope. Unsafe imported instructions are displayed as content and remain constrained by host policy even after activation.

## Acceptance criteria

1. A user can create, edit, assign, preview and export a skill without restarting the app.
2. A plan/session records version A while editing the skill creates B for future selections.
3. An imported resource with `../`, absolute paths or a symlink is rejected without writing outside the import area.
4. A skill asking to publish a PR cannot bypass the session's publication setting.
5. Conflicting selected skills produce an actionable warning/question with both sources visible.
6. Disabling a skill removes it from new context assembly but preserves a truthful historical record.

## Dependencies and measures

Depends on F04/F05 context contracts and F12 storage. Measure successful reuse, conflict frequency and context-budget omissions. No model training or implicit permission escalation occurs when a skill is saved.
