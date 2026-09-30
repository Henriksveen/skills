# Repository guidance

This repository contains Markdown-based agent skills for OpenCode and Codex, distributed through the Skills CLI.

For installation and the skill catalog, see [README.md](README.md). No build, typecheck, or test commands are configured.

When editing a skill, read its `SKILL.md` and relevant supporting files first. Keep workflow-specific instructions in the skill rather than duplicating them here.

Keep user-facing skill guides in `docs/<skill-name>.md`. Skill folders should contain only agent instructions and required supporting files.

## Task-specific guidance

- For task briefs and session handoffs, see [brief](skills/brief/SKILL.md).
- For user-controlled project knowledge, see [context](skills/context/SKILL.md).
- For stress-testing plans through questions, see [grilling](skills/grilling/SKILL.md).
- For writing and editing prose, follow [unslop](skills/unslop/SKILL.md).

Read these documents when relevant to the task. Their activation conditions still apply.
