---
name: context
description: Use ONLY when the user explicitly requests the context skill, for example "init context", "load context", "add to context", or "suggest context to save". Stores and retrieves user-controlled project context in .context/, including an overview, topic files, and a decisions log. Keeps current behavior, requirements, proposals, open questions, and decisions separate, with sources. Never invoke it merely because a thread explores an idea.
---

`.context/` holds project context that tasks and threads share. Exploration happens in ordinary conversations.

## Choose the operation

Use the user's intent to select `init`, `load`, `add`, or `suggest`. If no operation is clear, ask what they want to do before proceeding. `suggest` can accompany any operation. Run it after the other operation finishes, so it compares the conversation with the current context.

Only `init` and an explicit `add` request authorize their described writes. Permission ends when that operation finishes. `load`, `suggest`, review, and agreement with an idea are read-only. Reading through an AGENTS.md reference does not invoke the skill or authorize edits.

The user chooses what to retain and which outcomes to accept. Manage only the project context files in the layout below, plus the AGENTS.md setup described in `init`. Links to other documents authorize reading them, not editing them. Keep exploration notes and conversation transcripts out of saved context.

## Layout

```
.context/
  index.md          map of project context, with descriptions and when to load each file
  overview.md       short project introduction, important constraints, and current direction
  topics/<topic>.md one subject per file, including facts, intentions, and unresolved ideas
  decisions.md      explicit project decisions, with reasons and sources
  assets/           images, diagrams, sample data
```

Use repo-relative paths in references. Link to existing docs instead of duplicating them. Existing context outside this layout is user work; read it when relevant and preserve its location and contents unless the user requests a change.

## init

Example: `init context`.

Read [writing.md](writing.md) before setup and use the blocks in [templates.md](templates.md).

1. Inspect `.context/` and repository instructions. If `index.md` already exists, report that context is initialized, identify missing core files, and offer to complete setup instead of overwriting existing content.

   Complete when the existing setup has been reported, or the missing core files and directories have been identified for a new setup. Continue only for new setup or user-requested completion.
2. Create only the missing `index.md`, `overview.md`, `decisions.md`, `topics/`, and `assets/`. Preserve partial setup files.

   Complete when each required path exists and existing content is intact.
3. Add the AGENTS.md snippet from the templates, preserving other instructions and avoiding duplicate sections. Ask before creating a missing AGENTS.md. If instructions conflict, propose a targeted change for approval.

   Complete when the snippet is in place or the unresolved creation or conflict has been reported to the user.
4. Report the setup result and offer to draft initial context from the conversation, existing docs, or relevant code. Show any drafts in the reply for a later `add` request.

   Complete when the reply identifies created paths, outstanding setup work, and the offer or drafts.

## load

Examples: `load context`, `load context sync`, or `load context for exploring offline support`.

1. Read `index.md` and always read `overview.md`. If either is missing, note the incomplete setup and continue with available context whose relevance is clear. Threads do not receive additions automatically, so re-read requested files on every load, even if read earlier in the session.

   Complete when both core files have been read or each missing file has been identified.
2. Read named topics, or select relevant topics and decision entries using the user's task and the index. For a bare `load context`, use the overview and available topic list without a blocking question. Leave other topics and decision history unloaded by default.

   Complete when all requested or task-relevant topics and decision entries have been read, or unavailable material has been identified.
3. Follow relevant links to explanations, evidence, and assets. View images when supported; otherwise use their descriptions and note the limitation. Apply the claim types below. Check relevant code when needed for the task or an apparent mismatch.

   Complete when each relevant reference has been read or identified as missing or unavailable, and any code checks are distinguished from saved context.
4. Briefly summarize the background and list the files or decision entries loaded. For a bare load, list available topics. Separately report mismatches with code, missing files, and viewing limitations.

   Complete when the report distinguishes what you verified from saved context only, without implying a full code audit or resolving a mismatch silently.

## add

Examples: `Add to context: users must be able to read notes offline`, `Save both approaches as proposals`, or `Add the rate-limit candidate you suggested`.

Read [writing.md](writing.md) before preparing edits. Use [templates.md](templates.md) when creating a context file.

1. Extract only the requested information from the available conversation, supplied files, or selected candidates. Honor exclusions and ask about ambiguous scope or sources. Use only accessible history rather than claiming to recover unavailable conversations.

   Complete when the claims to save and their sources are identified and unambiguous.
2. Read the index and relevant existing context. Choose `overview.md` for a short project-wide summary, a topic for subject detail, or `decisions.md` for an explicit decision. Use a clear kebab-case name for a new topic; create it when its scope is clear and ask when placement requires guessing.

   Complete when every claim has a target and any existing duplicates have been identified.
3. Classify and source every claim using the claim types below. Apply the decision rules in `writing.md` when recording a choice. If an edit contradicts or removes existing text, show the old and proposed text and ask for confirmation unless the user already authorized that exact correction. Preserve unresolved disagreements as uncertainty.

   Complete when every claim has a type and source, required decision reasons are known, and necessary confirmations have been obtained.
4. Apply the authorized edits using the writing and shared-file rules in `writing.md`.

   Complete only after the post-edit checks in `writing.md` pass or a conflict or inconsistency has been reported.
5. Report what was saved and where, including corrections and superseded information. Explain any information removed by an authorized correction.

   Complete when the reply accounts for every requested item as saved, already present, or unresolved.

## suggest

For `Review this conversation and suggest what would be useful as project context`:

1. Read relevant existing context and compare it with the available conversation.

   Complete when useful new additions or corrections have been identified, or none are needed.
2. Reply with a numbered list. Each item must include the text to save, its claim type and source, and its target file. If there are no useful candidates, say so. Example:

   ```text
   1. The API limits each user to 100 requests per minute. Type: current behavior, verified YYYY-MM-DD. Source: api/middleware/rate-limit.ts, rateLimit. Target: .context/topics/sync.md.
   2. A local edit queue could support offline edits by replaying requests when online. Type: proposal, not chosen. Source: conversation summary, YYYY-MM-DD. Target: .context/topics/sync.md.
   3. Should queued edits expire after a period offline? Type: open question. Source: conversation, YYYY-MM-DD. Target: .context/topics/sync.md.
   ```

   Complete when the reply contains every candidate's required fields or states that none are needed. Wait for the user's selection and save request.

## Claim types and sources

Use sections or short labels within topics, not separate workflows:

- Current behavior: call implementation claims verified only with evidence. Mark user-reported behavior unverified against code when not checked.
- Requirements and preferences: user-provided constraints or intentions. Record them without requiring code proof or implying implementation.
- Proposals and hypotheses: possibilities under consideration, not decisions or implemented behavior. Mark hypotheses unverified.
- Open questions: matters that remain unresolved. Keep unknown information explicit here.
- Decisions: explicit user choices linked to `decisions.md`. An accepted decision does not prove implementation.

Keep origin information next to the claim: a code path and symbol, a document or asset, a user-provided requirement, or a dated conversation summary. Include verification dates for code or measurements. Add thread links only when available; do not invent them. A file's update date is not the verification date of every claim in it.
