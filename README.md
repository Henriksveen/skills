# Skills

Agent skills for OpenCode and Codex, installed with the [Skills CLI](https://github.com/vercel-labs/skills).

## Setup

Run in your terminal, from the repo root for a project install:

```sh
npx skills add Henriksveen/skills -a opencode -a codex
```

Select skills with Space, press Enter, then choose **Project** or **Global**. Installs go to `.agents/skills/` or `~/.agents/skills/`. Rerun to add or refresh selected skills; unselected skills stay installed.

## Available skills

- [brief](skills/brief/README.md): Task context and session handoffs.
- [context](skills/context/README.md): Shared project knowledge.
- [grilling](skills/grilling/SKILL.md): Stress-test plans through questions.
- [unslop](skills/unslop/SKILL.md): Remove AI writing patterns.

## Update

```sh
npx skills update -p  # Project
npx skills update -g  # Global
```

## Use

OpenCode: `Use grilling to stress-test this feature request: ...`

Codex: `$grilling Stress-test this feature request: ...`
