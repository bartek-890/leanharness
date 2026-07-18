<!-- Keep this file under 60 lines. Only include what an agent cannot infer
     from the code. One-minute test: if a competent new contributor could
     figure it out from the repo in a minute, it does not belong here.
     Order matters: models attend most to the start and end of context, so
     keep the load-bearing rules first — never buried mid-file.
     Delete these comments as you fill in the placeholders. -->

## Rules

1. **Think before coding** — state assumptions; ask when uncertain; present
   alternatives instead of picking silently; push back when a simpler
   approach exists.
2. **Simplicity first** — the minimum code that solves the problem. No
   unrequested features, abstractions, configurability, or error handling
   for impossible cases.
3. **Surgical changes** — touch only what the task requires; match existing
   style; remove only imports, variables, and functions your changes
   orphaned; mention pre-existing dead code, don't delete it.
4. **Goal-driven execution** — turn every task into a verifiable goal; for
   multi-step work, state brief plan steps with a check per step. Run the
   Verify command below and report its real output before claiming
   completion.

## Commands

<!-- Only non-guessable commands. Delete lines that are obvious. -->

- Install: `<install command>`
- Dev: `<dev command>`
- Test: `<test runner — include how to run a single test>`
- Verify (before "done"): `<lint && typecheck && test>`

## Architecture

<!-- 3–5 lines max. Decisions and boundaries, not a file tree. -->

- `<what lives where and why — only what directory names don't already say>`

## Conventions

<!-- Only rules that differ from language/framework defaults. Anything a
     formatter or linter can enforce belongs in that tool, not here. -->

- `<e.g. "server code never imports from ui/">`

## Compact Instructions

When compacting, always preserve: the current task's goal and its verify
command, the paths of files already edited, and decisions made this session.

<!-- Task-specific guidance goes behind progressive disclosure, not here:
     docs/agent-checklist.md — human pre-flight before an agent session
     .claude/skills/       — repeatable workflows, loaded on demand
     nested CLAUDE.md      — subtree-specific rules, loaded when relevant -->
