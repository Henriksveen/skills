# Writing project context

Read this file for `init` and `add`. Authorization, layout, claim types, sources, and correction approval are defined in `SKILL.md`.

## Integrate the authorized information

- Preserve useful explanations, examples, and reasons. Write enough prose to explain a concept rather than reducing it to a cryptic fact list.
- Integrate claims into the relevant sections. A claim already present needs no new entry; avoid disconnected "Update:" paragraphs.
- Keep the overview brief and the index one line per topic or relevant document, with loading guidance. Link to topic detail rather than duplicating it in either file.
- Aim for about 150 lines per topic. Suggest splitting large topics and wait for permission before splitting.
- Use code references rather than copying large code blocks. Add line numbers when helpful.
- Set `Updated:` on changed context files. Update the index for new files or changes of scope. Update linked summaries only as needed for the authorized change and keep unrelated structure intact.

## Record decisions

Record the chosen decision, its reason, and accepted status. Ask for a missing reason. Keep earlier decisions as history and mark them superseded when the user replaces them.

## Save assets

When the user asks to save images, diagrams, or sample data, include a useful text description of what the asset shows and why it matters. Link to the asset so future agents can check your description against it. Describe only details you can see.

If the bytes are accessible through the available tools, copy them into `assets/` without replacing another file. Otherwise, ask the user to save the attachment to a suggested path and mark the reference pending until the file exists. Claim it was saved only after confirming that it exists.

## Edit shared files

Several threads share the checkout. A fresh read reduces conflicts; it is not a lock or a guarantee against concurrent writes.

1. Read each target immediately before editing. For a new file, check that the destination is still absent and use a create operation that fails if it exists when supported.

   Complete when you have current contents or a confirmed absent destination.
2. Use targeted edits with expected old text, rather than whole-file writes based on an earlier read. Use an atomic content check when the tool supports it. If content changed, re-read it and retry only if the authorized change still applies without disturbing the other edit. For overlapping edits or changes to the request's meaning, stop and ask the user to resolve them.

   Complete when the authorized edit has been applied or the conflict has been reported.
3. Re-read affected sections and index links. Check that the intended information and any required dates or links are present, and that unrelated content remains intact. Report inconsistencies without overwriting another thread's work.

   Complete when every affected section and index link has been checked, with any remaining inconsistency reported.
