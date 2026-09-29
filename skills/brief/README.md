# brief

A skill for building up the context for a task over several sessions, then handing it to an agent to execute.

The context lives in `.context/<slug>/` in the repo. You add to it while you think, research, and discuss. When the chat gets long or messy, you run a handoff, start a new session, and load the brief. Nothing important is lost, because nothing important lives only in the chat.

## Commands

You don't need exact wording. These phrases trigger the skill:

| You say | Mode | What happens |
| --- | --- | --- |
| `new brief <slug>` | new | Creates `.context/<slug>/` with `brief.md`, `assets/`, `notes/`, and fills in what you have said so far. |
| `add to brief: ...` | add | Puts the information in the right section and rewrites anything it makes outdated. |
| `handoff` | handoff | Copies everything important from the chat into the brief and prints the prompt for the next session. |
| `load brief <slug>` | load | Reads the brief, notes, images, and referenced code, then summarizes and lists gaps. |

## Walkthrough

The task in this example: invoice PDFs are generated inside the HTTP request, and it is slow. You want to move generation to a background job.

### Session 1: collect what you know

You start a session and talk through the problem the way you normally would:

> The `GET /invoices/:id/pdf` endpoint is slow. It renders the PDF inside the request. p95 is around 8 seconds and it times out for big invoices. I want PDFs generated in the background and cached. new brief invoice-pdf-queue

The agent asks whether `.context/` should be committed or ignored (first time only), then creates:

```
.context/invoice-pdf-queue/
  brief.md
  assets/
  notes/
```

It fills in Goal, Current state, and Desired change from your message and puts the rest under Open questions:

```md
## Open questions
- [ ] Which job queue should run the work? Is one already in the repo?
- [ ] Where are generated PDFs stored?
- [ ] What should the endpoint return while a PDF is still being generated?
```

**Add an image.** You paste a Grafana screenshot of endpoint latency and write:

> add to brief: this is the latency for the last 30 days. The spikes are month-end billing runs.

The agent cannot save a pasted image to disk, so it does two things. It writes a description into Current state ("p95 is about 8 s on normal days and 25 to 30 s on the 1st of each month during billing runs, see assets/latency-30d.png"). Then it asks you to save the screenshot as `.context/invoice-pdf-queue/assets/latency-30d.png`. You save it. Next session, the agent can look at the real image, and the text description still works for agents that can't.

**Add an explanation.** You want the agent to understand how rendering works, so you ask it to look:

> Find out how PDF rendering works today and add it to the brief.

The agent reads the code and writes `notes/pdf-rendering.md` (about 40 lines covering the template engine, the Puppeteer call, and where fonts are loaded). In `brief.md` it adds only a short summary and a link:

```md
## Current state
- `src/invoices/routes.ts:88` calls `renderInvoicePdf()` synchronously.
- Rendering launches a new Puppeteer browser for every request. Details in notes/pdf-rendering.md.
```

**Add a constraint that came up in passing.** Mid-discussion you remember:

> add to brief: the mobile app calls that endpoint directly and we can't ship an app update this quarter. It has to keep returning the PDF bytes.

This goes under Constraints. It also changes one of the open questions: "what should the endpoint return while generating?" now has a hard limit. The agent rewrites that question instead of leaving two lines that contradict each other:

```md
- [ ] The endpoint must still return PDF bytes (mobile app). On a cache miss, do we wait for the job with a timeout, or render inline as a fallback?
```

**Fill the gaps.** You ask for a grilling session on the brief. It asks about the queue, storage, cache invalidation when an invoice is edited, and retries. It finds that the repo already uses BullMQ for emails. You answer, and the answers go into Decisions:

```md
## Decisions
- Use the existing BullMQ setup (`src/jobs/queue.ts`). Why: already deployed and monitored, no new infrastructure.
- Store PDFs in the existing S3 bucket under `invoices/<id>/<version>.pdf`. Why: the version in the key means an edited invoice never serves a stale PDF.
- On a cache miss, enqueue the job and wait up to 10 s, then render inline. Why: the mobile app needs bytes, and the inline path already exists.
```

**Handoff.** The chat is now long and has several side discussions. You type:

> handoff

The agent reviews the whole conversation. It finds two things that never reached the brief: you ruled out a Lambda-based approach because of cold starts, and invoice edits bump `invoice.version` in `src/invoices/model.ts:31`. It adds the first under Dead ends and the second under Current state. It sets `Status: ready` and prints:

```
Updated: Current state (+1), Dead ends (+1), Status -> ready.
Open: none.
Next session: "Load brief invoice-pdf-queue and implement it. Keep Progress updated."
```

### Session 2: execute from a clean context

You open a new session and paste the prompt:

> Load brief invoice-pdf-queue and implement it. Keep Progress updated.

The agent reads `brief.md`, `notes/pdf-rendering.md`, and `assets/latency-30d.png`, checks that `src/invoices/routes.ts:88` and `src/jobs/queue.ts` still look like the brief says, and summarizes the task. It then starts the work because the prompt said to. As it finishes steps it updates Progress:

```md
## Progress
### Done
- Added `generateInvoicePdf` job in `src/jobs/invoice-pdf.ts`.
- S3 upload with versioned key.
### Next
- Change the endpoint to check S3, enqueue, and wait with a timeout.
### Dead ends
- Lambda renderer: cold starts of 3 to 6 s cancel out the gain.
```

**New information during execution.** Someone from finance messages you, and you pass it on:

> add to brief: finance says generated invoice PDFs must be kept for 7 years, they are legal documents.

The agent adds a constraint. It also sees that this conflicts with a lifecycle rule it planned to add (delete old versions after 30 days), so it changes that step in Next and tells you.

The session runs out of room before the endpoint change is done. You type `handoff`, then start session 3 with the printed prompt. Session 3 picks up at "Change the endpoint" with the 7-year retention constraint already in the brief.

## Tips

- **Talk freely, then add.** You don't need to write the brief yourself. Explain things in the chat the way you normally would, and say "add that to the brief" when something is worth keeping.
- **Hand off early.** Run `handoff` when the chat starts to drift, not when it is full. A handoff done late has less room to work with.
- **Read the brief now and then.** It is a normal markdown file. Edit it by hand if the agent got something wrong. Hand edits are just as valid as agent edits.
- **Keep durable knowledge out of the brief.** `notes/pdf-rendering.md` explains a module that other tasks will need too. When the task is done, move it to `docs/` or AGENTS.md.
- **Use it with sub-agents.** Tell a sub-agent to "load brief invoice-pdf-queue" instead of writing a long prompt for it. It gets the same context the main agent has.
- **Close it out.** When the task is done, set `Status: done`. Delete the folder, or keep it as a record of why decisions were made.
