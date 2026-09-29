---
name: context
description: Project-wide context stored in .context/ that many threads read from and add to. Only use when the user explicitly invokes it, for example "load context", "add to context", "explore <idea>", "conclude <idea>", "init context". Never load it on your own.
---

`.context/` holds what an agent needs to know about this project beyond the code: architecture, domain, constraints, product direction, past decisions, and ideas being explored. Many threads use it at the same time, often from the same checkout. Each thread loads the parts it needs, and the user decides what gets added.

The user controls all writes to the shared files. Change `.context/` only in the mode the user invoked, and only in the files that mode allows.

## Layout

```
.context/
  index.md                 map of everything below, one line per file. Always read first.
  decisions.md             dated project decisions, each with a reason
  topics/<topic>.md        lasting knowledge about the project, one subject per file
  ideas/<idea>/overview.md the question being explored, the angles, the outcome
  ideas/<idea>/<angle>.md  one view on the idea, owned by one thread
  assets/                  images, diagrams, sample data
  briefs/                  used by the brief skill, not by this one
```

Templates for every file are in `templates.md` in this skill's folder.

## Modes

### init

1. If `.context/index.md` exists, stop and tell the user.
2. Create `index.md` and `decisions.md` from the templates, plus empty `topics/`, `ideas/`, and `assets/`.
3. Add the AGENTS.md snippet from `templates.md` to the repo's AGENTS.md. If there is no AGENTS.md, ask before creating one.
4. Ask whether to draft first topics from the codebase. If yes, send sub-agents to explore the code and draft each topic, such as architecture and domain. Show the drafts before writing them.

### load

The user says `load context`, possibly followed by topic names or by what the thread will work on.

1. Read `index.md`.
2. If the user named topics, read those. If they described a task, choose the relevant files from the index and say which ones you chose. If they gave neither, list what is available and ask.
3. Look at any images in `assets/` that the loaded files reference.
4. Reply with at most five lines on what you now know, then list anything that looks out of date compared with the code.

### add

The user says `add to context: ...`, or asks you to add something from the conversation, or answers a context candidate you suggested.

1. Choose the target: an existing topic, a new topic, `decisions.md`, or the angle file of the current exploration. If more than one fits, choose the narrowest one. If none fits well, propose a new topic name and ask.
2. Re-read the target file and `index.md` right before editing, even if you read them earlier. Other threads may have changed them.
3. Pure additions: edit the right section so it reads as if it had always said this. Do not append "Update:" paragraphs.
4. Changes that contradict or remove existing text: show the old and new text and wait for the user to confirm. Other threads may rely on what is there.
5. A fact that came out of an exploration links to it, for example "(from ideas/offline-mode)".
6. Set `Updated:` in each file you changed. Update `index.md` if you added a file or a file's scope changed.
7. Report in two or three lines what changed and where.

Images: an image pasted into the chat exists only in the conversation. You cannot save its bytes. Write a text description of what it shows into the target file, then ask the user to save the image to `.context/assets/<name>.png` and reference that path. If the user gives a file path, copy the file into `assets/` yourself.

### explore

The user says `explore <idea>`, optionally with an angle: `explore offline-mode from the sync-queue angle`.

1. If `ideas/<idea>/overview.md` does not exist, create it from the template with the user's question and add the idea to `index.md` with status `exploring`.
2. Choose an angle name for this thread. Suggest one if the user gave none. If `ideas/<idea>/<angle>.md` already exists, ask whether to continue it or start a new angle, because another thread may own it.
3. Create the angle file from the template and add it to the Angles list in `overview.md`.
4. Load `index.md`, the topics relevant to the idea, and `overview.md`. Do not read the other angle files unless the user asks, so that each view stays independent.
5. For the rest of the thread, keep the angle file current without asking: the approach, findings, trade-offs, evidence, open questions. This file belongs to this thread only.
6. Do not edit topics or `decisions.md` during exploration. Suggest context candidates instead (see below).

### conclude

The user says `conclude <idea>`.

1. Read `overview.md` and every angle file.
2. Write a comparison of the angles into `overview.md`: what each found, where they agree, where they differ.
3. Ask the user for the outcome (`adopted`, `rejected`, or `parked`) and the reason.
4. Record the outcome in `overview.md` and in `index.md`. For adopted or rejected, add an entry to `decisions.md` that links to the idea.
5. Collect the context candidates from all angle files. Ask the user which to add, then add those with the add mode rules.

## Context candidates

In any thread where this skill is loaded, when you learn something that belongs in the shared context, end your reply with:

```
Context candidate: <the fact or decision in one sentence>. Target: <file>.
```

Also append it under "Context candidates" in the angle file if you are exploring. Do not write it to the target yourself. The user adds it with `add` when they choose to.

## Rules for writing to shared files

Several threads share the same checkout, so two threads may write the same file at nearly the same time.

- Re-read a shared file right before each edit. Never write a whole file from memory.
- Use small edits that replace an exact piece of text. If an edit fails because the text changed, re-read and try again. Never overwrite the file.
- A thread writes only its own angle file freely. Everything else follows the add mode.

## Writing rules

- Write facts and decisions, not a transcript of the discussion.
- Point to code by path, and to a line when it matters. Do not paste large code blocks.
- Every decision gets a reason.
- Mark what you have not verified with "(unverified)".
- Keep each topic under about 150 lines. When one grows past that, propose splitting it.
- Keep `index.md` short enough to read at the start of every thread: one line per file.
- Never drop information silently. Remove text only when it is wrong or replaced, and tell the user.
