# context

Shared context for a whole project, stored in `.context/` in the repo. Any number of threads can load it, explore ideas on top of it, and add what they learn. You decide what gets added. Agents only suggest.

Use the `brief` skill for context that belongs to one task. Briefs live in `.context/briefs/` and can link to the topics here.

## Commands

The skill runs only when you invoke it.

| You say | What happens |
| --- | --- |
| `init context` | Creates `.context/` and adds a short section to AGENTS.md. Can draft first topics from the codebase. |
| `load context [topics or task]` | Reads the index and the topics you name, or picks the ones relevant to the task. |
| `add to context: ...` | Puts the information in the right file. Asks first if it contradicts or removes existing text. |
| `explore <idea> [angle]` | Starts an exploration. This thread gets its own angle file and keeps it current. |
| `conclude <idea>` | Compares all angles, records the outcome and decision, and asks which findings to add to the shared context. |

## What goes where

```
.context/
  index.md                  one line per file. Every thread reads this first.
  decisions.md              what was decided, when, and why
  topics/                   lasting knowledge: architecture, domain, constraints, product direction
  ideas/<idea>/overview.md  the question, the list of angles, the comparison, the outcome
  ideas/<idea>/<angle>.md   one thread's view on the idea
  assets/                   images and diagrams
  briefs/                   task briefs from the brief skill
```

Topics hold what is true about the project. Ideas hold what is being considered. When an idea is concluded, the parts that turned out to be true move into topics and `decisions.md`.

## Example: exploring offline mode for a notes app

### Thread 1: set up the shared context

> init context

The agent creates `.context/` and adds this to AGENTS.md:

```md
## Project context
Background on this project lives in `.context/`. When a task needs it, read `.context/index.md` and load the files it points to.
Do not edit anything in `.context/` unless the user invokes the context skill. ...
```

It asks whether to draft topics from the code. You say yes. Sub-agents read the repo, and the agent shows you drafts of `topics/architecture.md` (React Native client, REST API, Postgres) and `topics/sync.md` (how the client fetches and saves notes today). You fix one mistake and it writes them.

You paste a diagram of how notes move between client and server:

> add to context: this is the current data flow. Every save is a direct PUT to the API.

The agent describes the diagram in `topics/sync.md` and asks you to save the image as `.context/assets/data-flow.png`. You do.

### Threads 2 and 3: explore two views at the same time

You open two new threads in the same checkout.

Thread 2:

> explore offline-mode from the crdt angle. Can we make notes editable offline and merge edits with a CRDT library?

The agent creates `ideas/offline-mode/overview.md` with the question and adds the idea to `index.md` as `exploring`. It creates `ideas/offline-mode/crdt.md` for this thread, then loads the index, `topics/architecture.md`, `topics/sync.md`, and the diagram.

Thread 3:

> explore offline-mode from the sync-queue angle. Queue edits locally and replay them when the device is back online.

The overview already exists, so the agent adds `sync-queue.md` to its Angles list and creates the angle file. It does not read `crdt.md`, so this thread's view stays independent.

Both threads now work: they read code, try libraries, and write small prototypes. Each keeps its own angle file up to date with findings, trade-offs, and open questions. They never write to the same file, except for the one-line additions to the overview and index, and those re-read the file right before editing.

### A finding that affects the whole project

While testing, thread 3 finds that the API rate limits each user to 100 requests per minute. A replayed queue would hit that limit. The agent ends its reply with:

```
Context candidate: The API rate limits each user to 100 requests per minute (api/middleware/rate-limit.ts). Target: topics/architecture.md.
```

It also writes this under "Context candidates" in `sync-queue.md`. You think it matters beyond this idea, so you type in thread 3:

> add to context: the rate limit candidate

The agent re-reads `topics/architecture.md`, adds the fact to the API section with "(from ideas/offline-mode)", and updates the `Updated:` date.

Thread 2 is still running and doesn't know about this yet. You type there:

> load context architecture

Thread 2 reads the updated topic and notes in `crdt.md` that the CRDT approach sends fewer requests.

### Wrong information in the shared context

Thread 2 finds that `topics/sync.md` says saves are debounced by 500 ms, but the code no longer does that. It suggests a candidate. You type `add to context: that correction`. Because this changes existing text, the agent shows the old and new lines and waits for your confirmation before writing.

### Thread 4: conclude

A few days later, in a new thread:

> conclude offline-mode

The agent reads the overview and both angle files and writes a comparison into the overview. The CRDT approach handles conflicts better but adds 180 KB to the app bundle. The sync queue is simpler but needs batching because of the rate limit. It asks for the outcome. You answer:

> adopted, sync-queue with batching. The bundle size matters more than rare conflicts right now.

The agent:

- sets the idea to `adopted` in `overview.md` and `index.md`
- adds an entry to `decisions.md`:

  ```md
  ## 2026-10-02: Offline mode uses a local sync queue with batched replay

  Edits are queued on the device and replayed in batches when online.

  Why: the CRDT library adds 180 KB to the bundle, and conflicts are rare for single-user notes.
  Source: ideas/offline-mode/
  ```

- lists the remaining context candidates from both angle files and asks which to add. You pick two. It adds them to `topics/sync.md`.

### Later: a task that uses the context

Weeks later you start a thread to build the feature:

> load context for implementing offline sync

The agent reads the index, picks `topics/sync.md`, `topics/architecture.md`, and the offline-mode decision, and summarizes them in five lines. It already knows about the rate limit, the batching decision, and why CRDTs were rejected, without you explaining any of it again. For a long task you can create a brief with the brief skill that links to these topics.

## Tips

- **Load only what the thread needs.** The index exists so a thread doesn't have to read everything. As the context grows, this keeps each thread's context small.
- **Reload after an add.** Threads that were already running don't see changes made by other threads. Run `load context <topic>` again when a running thread needs them.
- **Keep angles independent until you conclude.** If you want a thread to see another view, ask it to read that angle file directly.
- **Read and edit the files yourself.** They are plain markdown in git. Hand edits are as valid as agent edits, and `git log .context/` shows how the project's understanding changed.
- **Park ideas instead of deleting them.** A parked idea keeps its findings. Starting it again later is a new `explore` on the same idea with a new angle.
