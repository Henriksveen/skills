# context

A user-controlled record of project knowledge in `.context/`. Many tasks and threads can load it. You choose which explanations, discoveries, ideas, and decisions to save.

The skill supports `init`, `load`, and `add`. Exploration happens in ordinary conversations. There is no automatic note-taking or exploration lifecycle.

## Requests

These are natural-language requests, not registered slash commands. Explicitly request the context skill when saving or loading.

| You say | What happens |
| --- | --- |
| `Init context` | Creates the core files and adds the AGENTS.md reference. Preserves existing files. |
| `Load context` | Loads the index and overview, then lists available topics. |
| `Load context for exploring offline support` | Also loads relevant topics and decision entries, and reports which ones. |
| `Add to context: ...` | Integrates the requested information with its type and source. |
| `Use the context skill to save the background I explained earlier` | Extracts the requested background from the available conversation and saves it. |
| `Use the context skill to suggest what is worth saving from this conversation` | Proposes additions in the reply. Writes nothing until you select them. |

An invocation authorizes only the requested operation. `Load context` never grants permission to save later findings. You can edit the markdown files yourself too.

## Layout

```text
.context/
  index.md          descriptions of available context and when to load it
  overview.md       short project introduction, constraints, and current direction
  topics/           subject-specific explanations, facts, requirements, and proposals
  decisions.md      explicit choices, reasons, sources, and superseded history
  assets/           screenshots, diagrams, supporting files
```

A topic can contain both current behavior and future ideas, in clearly marked sections. "We are considering offline support" must stay distinct from "offline support is implemented" and "we decided to implement it."

## Example: exploring offline support for a notes app

All details and paths below are illustrative.

### Set up and save the initial background

In a thread in your application repo:

> Init context.

The agent creates the core files and adds a reference in AGENTS.md. It asks before creating AGENTS.md if one does not exist. It offers to draft initial background from your conversation, docs, or code. You can review those drafts before requesting a save.

You explain the project and current sync behavior, then ask:

> Use the context skill to save the background I explained. This is a mobile notes app for individual users. Saves currently go straight to the API. Offline reading is required; offline editing is still an idea. Include the data-flow diagram I attached.

The agent saves the project introduction in `overview.md` and subject detail in `topics/sync.md`, then adds that topic to the index. It separates the information:

```md
## Current behavior

- Saves go directly to the API. Source: user report, 2026-09-30. Unverified against code.

## Requirements and preferences

- Users must be able to read notes offline. Source: user-provided requirement, 2026-09-30. Implementation status not established.

## Proposals and hypotheses

- Offline editing is under consideration. No approach has been chosen. Source: user discussion, 2026-09-30.
```

It includes a text description of the diagram. If it can access the attachment's bytes, it saves them in `assets/`. Otherwise it asks you to save the file and marks the reference pending. It does not claim the file exists before checking.

### Open parallel threads with the same background

In thread A:

> Load context for exploring offline editing. Then assess a CRDT approach, especially conflict handling and library costs.

In thread B:

> Load context for exploring offline editing. Then assess a local edit queue that replays requests when online.

Both threads load the overview and sync topic. They discuss approaches normally. The context skill creates no thread files and records no findings automatically.

### Save a discovery when you choose

Thread B finds a rate limit in the API and suggests:

```text
Context candidate: The API limits each user to 100 requests per minute, verified in api/middleware/rate-limit.ts. Target: .context/topics/sync.md.
```

Nothing is saved. You decide this matters across tasks:

> Add to context: the rate-limit candidate. Include the code location and verification date.

The agent integrates the fact into `topics/sync.md` and reports the change. Its permission to write ends with that operation.

Thread A still has the earlier context in its conversation. To give it the discovery:

> Load context sync again and reconsider the request-volume trade-off.

The agent re-reads the file. Sharing a checkout does not automatically refresh a running thread's knowledge.

### Preserve ideas without choosing one

After discussing the edit queue in thread B:

> Use the context skill to save the queue proposal and its trade-offs. Exclude the prototype details. We have not chosen an approach.

The agent saves the selected material under Proposals and hypotheses. It preserves useful explanations and evidence. It does not create a decision.

In thread A, you can make the same request for the CRDT proposal. Because both threads share the checkout, additions use targeted edits after a fresh read. Overlapping changes that cannot be reconciled require your input.

### Review what to keep before starting fresh

> Use the context skill to suggest useful project context from this conversation.

The agent shows a numbered list of proposed additions with their types, sources, and target files. You respond:

> Add items 1 and 3 to context. Keep item 3 as an unverified hypothesis.

Only those items are saved. You can now start a fresh thread and load them. You do not have to finish the exploration or choose an outcome first.

### Record a choice later

Once you have compared the saved proposals:

> Add to context: we chose a local edit queue with batched replay. It fits the current API and avoids a heavier client dependency. This is a decision, not an implemented feature.

The agent adds a dated entry with the reason and source to `decisions.md` and links it from the sync topic. The prior proposal becomes a reference to the accepted decision. If you replace that decision later, the earlier entry stays as superseded history.

### Reuse the accumulated context

Weeks later:

> Load context for implementing offline sync.

The new thread gets the project overview, relevant sync background, the rate limit, and the decision with its reason. It reports what it loaded and distinguishes saved plans from verified code behavior.

## Corrections and existing context

If loaded context disagrees with code, the agent reports the mismatch without editing. Ask it to save a correction when you choose. If the exact replacement is not already authorized, it shows the old and proposed text before writing.

Existing docs and context files remain useful. Link to them rather than duplicating them. If you already have files from the older exploration layout, the skill preserves them. Moving their selected content into topics requires an explicit request.
