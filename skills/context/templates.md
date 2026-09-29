# Templates

Copy the part between the markers when creating a file. Replace `<...>` placeholders. Delete HTML comments once a section has content.

## index.md

```md
# Project context

Read this file first. Load other files only when the task needs them.
Only change `.context/` through the context skill.

## Topics

<!-- - topics/<topic>.md: <what it covers>. Load when <situation>. -->

## Decisions

- decisions.md: <n> decisions, latest <YYYY-MM-DD>.

## Ideas

<!-- - ideas/<idea>/: <one-line question>. Status: exploring | adopted | rejected | parked. Angles: <a>, <b>. -->
```

## decisions.md

```md
# Decisions

Newest first. Each entry says what was decided, why, and where it came from.

<!-- Entry format:
## YYYY-MM-DD: <short title>

<The decision in one or two sentences.>

Why: <reason>.
Source: <ideas/<idea>/ or a conversation summary>.
Replaces: <earlier entry title, if any>.
-->
```

## topics/<topic>.md

```md
# <Topic>

Updated: YYYY-MM-DD

<One or two sentences on what this topic covers.>

## <Section>

<!-- Facts, each with a code path where it applies. Use as many sections as the subject needs. -->

## References

<!-- - assets/<file>: what it shows -->
<!-- - path/to/code: why it matters -->
```

## ideas/<idea>/overview.md

```md
# <Idea>

Status: exploring
Updated: YYYY-MM-DD

## Question

<What we want to find out. What would make this idea worth doing?>

## Background

<Why this came up. Links to relevant topics.>

## Angles

<!-- - <angle>.md: <the view this angle takes>. -->

## Comparison

<!-- Filled by conclude: what each angle found, where they agree, where they differ. -->

## Outcome

<!-- Filled by conclude: adopted | rejected | parked, and why. -->
```

## ideas/<idea>/<angle>.md

```md
# <Idea>: <angle>

Updated: YYYY-MM-DD

## Approach

<The view this angle takes and how it would work.>

## Findings

<!-- What was learned, with evidence: code paths, measurements, links, assets. -->

## Trade-offs

<!-- What this approach gains and what it costs. -->

## Open questions

<!-- - [ ] question -->

## Context candidates

<!-- - <fact or decision>. Target: <file>. -->
```

## AGENTS.md snippet

```md
## Project context

Background on this project lives in `.context/`. When a task needs it, read `.context/index.md` and load the files it points to.

Do not edit anything in `.context/` unless the user invokes the context skill. If you learn something that belongs there, end your reply with:

Context candidate: <the fact or decision in one sentence>. Target: <file in .context/>.
```
