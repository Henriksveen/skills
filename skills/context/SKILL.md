---
name: context
description: Use ONLY when the user explicitly requests the context skill, for example "init context", "load context", "add to context", or asks it to suggest context to save. Stores and retrieves user-controlled project knowledge in .context/. Never invoke it merely because a thread explores an idea.
---

`.context/` holds background that many tasks and threads share: project explanations, current behavior, constraints, intentions, unresolved ideas, and decisions. The user decides what to retain. Threads explore and work normally, then use this skill to load background or save selected information.

## User control

- Invoking the skill does not grant ongoing permission to write. Only `init` and an explicit `add` request authorize their described changes. Finish that operation, then stop writing.
- `load` and requests to review or suggest context are read-only. Show proposed additions in the reply and wait for the user to select them.
- Never maintain exploration notes, save a conversation transcript, choose an outcome, or promote findings automatically.
- Reading files through an AGENTS.md reference does not invoke the skill or authorize edits.
- Manage only the project context files described below. Links to other documents do not authorize edits to them.

## Layout

```
.context/
  index.md          map of project context, with descriptions and when to load each file
  overview.md       short project introduction, important constraints, and current direction
  topics/<topic>.md one subject per file, including facts, intentions, and unresolved ideas
  decisions.md      explicit project decisions, with reasons and sources
  assets/           images, diagrams, sample data
```

Templates are in `templates.md` in this skill's folder. Use repo-relative paths in references. Link to existing docs instead of duplicating them. Existing context outside this layout is user work; read it when relevant and do not move or delete it without a request.

## Modes

Use the user's intent to select `init`, `load`, or `add`. A request for suggestions can accompany any mode but never authorizes the suggested writes. If the user invokes the skill without an operation, ask what they want to do.

### init

1. Inspect existing `.context/` files and repository instructions. If an index already exists, report that context is initialized and identify any missing core files. Offer to complete the setup; do not overwrite existing content.
2. For a new setup, create missing `index.md`, `overview.md`, and `decisions.md` from the templates, plus `topics/` and `assets/`. Preserve files from any partial setup. Leave unknown information as explicit open questions. Do not create exploration files.
3. Add the AGENTS.md snippet from `templates.md`, preserving other instructions and avoiding duplicate sections. If there is no AGENTS.md, ask before creating one. If existing instructions conflict, propose a targeted change instead of silently overriding them.
4. Offer to draft initial context from the conversation, existing docs, or relevant code. Show the drafts in the reply. Save them only when the user requests it, using `add`.

### load

Examples: `load context`, `load context sync`, or `load context for exploring offline support`.

1. Read `index.md`. If it is missing, report the incomplete setup and use available context only when its relevance is clear. Do not initialize files during a load.
2. Always read `overview.md`. If it is missing in an existing setup, report that and continue with available context; do not create it during a load.
3. Read named topics, or select relevant topics and decision entries using the user's task and the index. For a bare `load context`, load the overview and list available topics without asking a blocking question. Do not load every topic or the entire decision history by default.
4. Follow relevant links to explanations, evidence, and assets. View images when supported; otherwise use their descriptions and report the limitation. List missing referenced files.
5. Preserve the distinctions between current behavior, requirements, proposals, and decisions. Check relevant code when needed to answer the user's task or investigate an apparent mismatch. State what was verified and what remains saved context only; do not imply a full code audit.
6. Report which files or decision entries were loaded and summarize the background briefly. Separately report any mismatch between saved context and code. Do not silently resolve it or edit files.

Threads already running do not receive additions automatically. A later `load` re-reads the requested files, even if they were read earlier in the session.

### add

Examples:

- `Add to context: users must be able to read notes offline.`
- `Use the context skill to save the background I explained earlier.`
- `Save what we learned about authentication, excluding the proposed redesign.`
- `Save both approaches as proposals. We have not chosen one.`
- `Add the rate-limit candidate you suggested.`

1. Extract only the information the user asked to save from the available conversation, supplied files, or selected candidates. Honor exclusions. Ask if the scope or source is ambiguous. Do not claim to have recovered inaccessible chat history.
2. Read the index and relevant existing context to avoid duplicates. Choose `overview.md` for a short project-wide summary, an existing or new topic for subject detail, or `decisions.md` for an explicit decision. Use a clear kebab-case topic name. Create a new topic as part of the request when its scope is clear; ask when placement would require guessing.
3. Classify each claim using the knowledge distinctions below and retain its source. A user requirement can be recorded as user-provided without proving it in code. An implementation claim needs evidence before calling it verified. Never turn a proposed approach into a decision or implemented behavior.
4. Re-read target files immediately before editing and follow the shared-write rules below. Integrate the information into the right sections instead of appending disconnected "Update:" paragraphs. Avoid duplicating existing content; a repeated claim needs no new entry.
5. If a change contradicts or removes existing text, show the old and proposed text and ask for confirmation unless the user already explicitly authorized that exact correction. Preserve uncertainty when the evidence does not resolve a disagreement.
6. For a decision, record what the user chose, why, and its source. Ask for a missing reason rather than inventing one. Keep earlier decisions as history and mark them superseded when the user replaces them. An accepted decision does not prove implementation.
7. Set `Updated:` on changed context files. Update the index when adding a file or changing its scope, and update linked summaries only as needed for this authorized change. Do not restructure unrelated content.
8. Report what was saved and where, including corrections or superseded information. The request authorizes this operation only; later findings require another explicit request.

## Suggestions from a conversation

For `Review this conversation and suggest what would be useful as project context`, read relevant existing context and reply with a numbered list of proposed additions or corrections. Include the text to save, its type, source, and target. Wait for the user to select items. Do not create files or a saved candidate list.

An agent may also suggest a useful addition during ordinary work:

```text
Context candidate: <claim, including whether it is a fact, requirement, or proposal>. Target: <file>.
```

Keep suggestions in the reply. Suggest only useful new information; do not repeat candidates in every reply. Agreement with an idea is not a request to save it. Wait for an explicit save request.

## Knowledge distinctions and sources

Use sections or short labels within topics, not separate workflows:

- Current behavior: verified facts with evidence, or user-reported behavior explicitly marked unverified against code.
- Requirements and preferences: user-provided constraints or intentions. These need not be implemented.
- Proposals and hypotheses: possibilities under consideration, explicitly not decisions. Mark hypotheses unverified.
- Open questions: matters that remain unresolved.
- Decisions: explicit choices linked to `decisions.md`, with reasons and status.

Keep origin information next to the claim: a code path and symbol, a document or asset, a user-provided requirement, or a dated conversation summary. Include verification dates for code or measurements. Add thread links only when available; do not invent them. A file's update date is not the verification date of every claim in it.

## Images and supporting files

When the user asks to save supporting material, include a useful text description of what it shows and why it matters. If its bytes are accessible through the available tools, copy it into `assets/` without replacing another file. If a pasted attachment cannot be saved, ask the user to save it to a suggested path and mark the reference pending until the file exists. Do not claim an image was saved or interpret details you cannot see. Link to evidence so future agents can distinguish it from your interpretation.

## Rules for writing to shared files

Several threads share the checkout. Re-reading reduces conflicts but is not a lock or a guarantee against concurrent writes.

- Read each target immediately before editing. For new files, check that the destination is still absent and use a create operation that fails if it exists when supported.
- Use targeted edits with expected old text, not whole-file writes based on an earlier read. If the tool supports an atomic content check, use it.
- If content changed, re-read it. Retry only if the authorized change still applies without disturbing the other edit. If edits overlap or change the meaning of the request, stop and ask the user to resolve them.
- Re-read affected sections and index links after editing. Report inconsistencies without overwriting another thread's work.

## Writing rules

- Preserve useful explanations, examples, and reasons, not chat chronology. Do not reduce a concept explanation to a cryptic fact list.
- Keep the overview brief and the index one line per topic or relevant document, with loading guidance. Do not duplicate topic detail in them.
- Aim for about 150 lines per topic. Suggest splitting large topics; do not split them without permission.
- Point to code by path and symbol, adding lines when helpful. Avoid large code copies.
- Never drop information silently. Explain corrections and keep superseded decision history.
