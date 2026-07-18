---
name: add-skill
description: >-
  Create a new Claude Code skill in this repo — correct format, frontmatter,
  and invocation settings. Use when the user wants to codify a recurring
  workflow or repeated prompt as a skill.
---

# Add a skill

Codify a workflow as a skill once you've pasted the same instructions into
prompts three times. One skill = one repeatable job (test generation,
security review, a migration recipe) — not a grab-bag.

## Format

Create `.claude/skills/<kebab-name>/SKILL.md`:

    ---
    name: <kebab-name>
    description: >-
      <What it does AND when to use it, 1–3 sentences. This is the trigger:
      the agent decides from this text alone whether to load the skill.>
    ---

    # <Title>

    <Numbered procedure. Concrete steps, commands, constraints — not
    philosophy. Put long reference material in a sibling file and link it
    instead of inlining.>

## Settings that matter

- `disable-model-invocation: true` — add when the skill should run only when
  the user asks by name (`/<name>`). Keeps its description out of the
  startup context.
- `context: fork` + `agent: <name>` — runs the skill in a subagent with its
  own context window. Use for stages that need a fresh, unbiased read (e.g.
  reviews); keep the default (inline) when the skill continues current work.

## Rules

- The description states *when to use*, not just what — a skill that never
  triggers is dead weight.
- Keep SKILL.md under ~80 lines; move reference tables to sibling files.
- Test it: start a task that should trigger the skill and confirm it loads.
