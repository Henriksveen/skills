# Templates

Copy the relevant fenced block and replace placeholders using known information. Remove unused topic sections. `SKILL.md` defines claim types and sources, and `writing.md` defines the editing rules.

## index.md

```md
# Project context

Updated: YYYY-MM-DD

Read this index and `.context/overview.md` first. Load other files as needed.
Project context changes require an explicit init or add request to the context skill.

## Core

- .context/overview.md: project purpose, important constraints, and current direction. Always load.
- .context/decisions.md: explicit choices, reasons, and history. Load entries relevant to the subject.

## Topics

<!-- One line per topic:
- .context/topics/<topic>.md: <scope>. Load when <situation>.
-->

## Other background

<!-- Link to useful existing docs or context files without copying or relocating them. -->
```

## decisions.md

```md
# Decisions

Updated: YYYY-MM-DD

Newest first. Accepted means chosen, not necessarily implemented. Keep superseded entries as history.

<!-- Entry format:
## YYYY-MM-DD: <short title>

Status: accepted | superseded
Decision: <what the user chose>.
Why: <the user's reason>.
Source: <user decision and date, supporting document, or available thread link>.
Related context: .context/topics/<topic>.md
Replaces: <link to earlier entry, only when applicable>.
Superseded by: <link to replacement, only for a superseded entry>.
-->

<!-- Example:
## YYYY-MM-DD: Queue offline edits locally

Status: accepted
Decision: Queue edits on the device and replay them in batches when online.
Why: It fits the current API and avoids a heavier client dependency.
Source: user decision, YYYY-MM-DD.
Related context: .context/topics/sync.md
-->
```

## topics/<topic>.md

```md
# <Topic>

Updated: YYYY-MM-DD

<What this topic covers.>

## Background

<!-- Explanations and examples needed to understand the subject. Cite sources. -->

## Current behavior

<!-- Example:
- Each save makes a PUT request. Source: api/routes/notes.ts, updateNote. Verified YYYY-MM-DD.
- Large notes sometimes time out. Source: user report, YYYY-MM-DD. Unverified against code.
-->

## Requirements and preferences

<!-- Example:
- Offline reading is required. Source: user-provided requirement, YYYY-MM-DD. Implementation status not established.
-->

## Proposals and hypotheses

<!-- Example:
- A local edit queue could support offline writes. Proposal, not chosen. Source: technical exploration summarized by the user, YYYY-MM-DD.
- Batching might reduce rate-limit errors. Unverified hypothesis. Source: discussion, YYYY-MM-DD.
-->

## Open questions

<!-- Questions that remain unresolved. -->

## Related decisions

<!-- Links to relevant headings in .context/decisions.md. Do not duplicate full entries. -->

## References

<!-- Use repo-relative paths. Mark missing attachments pending, not saved.
- .context/assets/<file>: <what it shows and why it matters>.
-->
```

## overview.md

```md
# Project overview

Updated: YYYY-MM-DD

## Purpose

<!-- What the project does, who it is for, and why. Unknown until provided.
Example: Notes is a web app for small teams to share meeting notes. Source: user-provided summary, YYYY-MM-DD.
-->

## Current state

<!-- Short description of what exists. State the source and whether it was verified.
Example: Notes can be created, edited, and shared. Source: api/routes/notes.ts. Verified YYYY-MM-DD.
-->

## Important constraints

<!-- Project-wide requirements and preferences, with their origin.
Example: The app must run on the current company laptop image. Source: user-provided requirement, YYYY-MM-DD.
-->

## Current direction

<!-- User intentions or accepted decisions. A planned change is not implemented behavior. Link to detail.
Example: Offline editing is planned. See .context/topics/sync.md. Implementation status not established.
-->

## Open questions

- What project context should new threads know? Not yet provided.
```

## AGENTS.md snippet

```md
## Project context

Shared project context lives in `.context/`. When a task needs it, read `.context/index.md` and `.context/overview.md`, then load relevant topics, decisions, and linked material. Report missing core files rather than creating them during a read.

Distinguish current behavior, requirements and preferences, proposals and hypotheses, open questions, and decisions. A proposal is not a decision; an accepted decision is not evidence of implementation. Report apparent disagreements with code instead of silently rewriting context.

Only invoke the context skill when the user requests it. Writes to the project context files listed in `.context/index.md` require an explicit init or add request for that operation. Loading, reviewing, or suggesting context never authorizes writes or ongoing note-taking. Links to supporting documents do not authorize edits to those documents.

If you discover useful new context, you may suggest it in your reply:

Context candidate: <text to save>. Type: <current behavior, requirement or preference, proposal or hypothesis, open question, or decision>. Source: <code path, document, user statement, or conversation, with date>. Target: <project context file>.

Do not save the candidate unless the user explicitly asks. Avoid repeating suggestions.
```
