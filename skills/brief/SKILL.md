---
name: brief
description: Build up task context in a file that outlives the chat session. Use when the user wants to start, add to, load, or hand off a brief, or says things like "new brief", "add this to the brief", "handoff", "save context", "load brief", "start fresh but keep context".
---

A brief is a folder of files that holds everything an agent needs to do one task. The files are the source of truth. The chat is temporary. Anything that matters must end up in the brief, because the next session only sees what is written there.

## Layout

```
.context/<slug>/
  brief.md     the brief itself, based on template.md in this skill's folder
  assets/      images, screenshots, diagrams, log excerpts, sample data
  notes/       longer write-ups that brief.md links to (concept explanations, module walkthroughs)
```

`<slug>` is a short kebab-case name for the task, such as `invoice-pdf-queue`. `.context/` sits at the repo root. If the user names another location, use it.

Picking the brief: use the slug the user gives. If they give none and the conversation already uses a brief, use that one. If `.context/` holds exactly one brief, use it. Otherwise list the briefs and ask.

## Modes

The user's wording decides the mode. If it is unclear, ask.

### new

1. Ask for a slug if the user did not give one. Suggest one based on the task.
2. The first time you create `.context/` in a repo, ask whether it should be committed or added to `.gitignore`.
3. Create the folder layout and fill `brief.md` from `template.md`.
4. Fill in what the user has already said in this conversation. Leave sections empty rather than guessing. Put anything unknown under "Open questions".
5. Show the user the brief and list the empty sections.

### add

The user gives new information: text, an image, a file path, a decision, a correction.

1. Read the current `brief.md` first.
2. Decide which section or sections the information belongs in. One message can touch several sections.
3. Edit the section so it reads as if it had always been written with this information. Do not append "Update:" paragraphs. If the new information makes existing text wrong, rewrite or remove that text.
4. When a decision changes, replace it and keep the reason for the change in the new entry, for example "Use Postgres for job state. Replaced Redis because ops will not run another service."
5. If the information answers an open question, remove the question and put the answer where it belongs.
6. Long explanations (more than about 20 lines) go in `notes/<topic>.md` with a one-line link from `brief.md`.
7. Tell the user in two or three lines what changed and where.

Images: an image pasted into the chat exists only in this conversation. You cannot save its bytes to disk. Do two things:
- Write a text description of what the image shows, and what it means for the task, into the relevant section. The description must be useful on its own, because some future agent may not be able to view images.
- Ask the user to save the file as `.context/<slug>/assets/<name>.png`, suggest a name, and add the reference `assets/<name>.png` to "References".

If the user gives a file path to an image, copy it into `assets/` and describe it the same way.

### handoff

Run this before the user starts a fresh session, or when the conversation has grown long.

1. Read `brief.md`, then go through the whole conversation since the brief was last updated.
2. Move anything important that is missing into the brief: facts learned, decisions and their reasons, code locations found, approaches that failed and why, progress on the work.
3. Fix anything the conversation proved wrong.
4. Update "Progress" if work has started: what is done, what comes next, what is blocked.
5. Set `Status` and `Updated` at the top.
6. Print a short report: what you changed, what is still open, and the exact prompt for the next session, for example `Load brief invoice-pdf-queue and continue with the next step in Progress.`

Test the result by asking yourself: could an agent with no access to this chat do the next step correctly using only the brief? If not, add what is missing.

### load

1. Read `brief.md`, every file in `notes/` it links to, and every image in `assets/`.
2. Open the code locations it references, enough to confirm they still exist and match the description. If the code has changed, say so.
3. Reply with a summary of five lines or fewer: the goal, the current state, the next step. Then list open questions and anything that looks inconsistent or out of date.
4. Do not start the work until the user says to, unless the load request already told you to continue.

While working after a load, keep "Progress" current. Update it when a step is done and when you learn something the next session needs.

## Writing rules

- Write facts and decisions, not a transcript. "The API calls `renderPdf()` synchronously in `src/invoices/routes.ts:88`" is useful. "We talked about the PDF code" is not.
- Point to code by path and line. Do not paste large code blocks.
- Every decision gets a reason. A decision without a reason is the first thing a later session will undo.
- Mark things you have not verified with "(unverified)". Mark guesses with "(assumption)".
- Keep `brief.md` under about 200 lines. Move detail into `notes/`.
- Knowledge that is useful beyond this task, such as how a module works, belongs in the repo's docs or AGENTS.md. Suggest moving it there and link to it from the brief.
- Never drop information silently. Remove text only when it is wrong or superseded, and tell the user.

## Related

After `new` or a large `add`, suggest the grilling skill to find gaps before execution. Record its answers in the brief with `add`.
