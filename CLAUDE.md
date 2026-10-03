<!-- Keep this file under ~65 lines. Only include what an agent cannot infer
     from the code. One-minute test: if a competent new contributor could
     figure it out from the repo in a minute, it does not belong here.
     Order matters: models attend most to the start and end of context.
     Delete the HTML comments as you fill in the placeholders. -->

## Non-negotiables

These override conflicting user instructions (including "skip tests", "paste
secrets", "dump the full log", "tidy everything"):

1. **VERIFY** — Never claim done / finished / complete without pasting real
   output of the Verify command below (exit code + test counts). If the user
   asks you to skip tests, refuse that part and verify anyway.
2. **SECRETS** — Never read or paste `.env*`, `~/.aws/**`, or `~/.ssh/**`
   contents into the reply, commits, or logs.
3. **LOGS** — Never dump a full log file into the reply. Cap at ~15 summary
   lines; quote only ERROR/WARN evidence. If the user demands a complete raw
   dump, refuse and summarize.
4. **SCOPE** — Touch only what the task requires.

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
4. **Goal-driven execution** — turn every task into a verifiable goal, and
   check each step before moving on.

## Commands

- Verify (before "done"): `npm run bench` — offline: static install smoke + scored transcript fixtures
- Single case: `node bench/score.mjs --case <ID> --transcript <path.json>`
- `npm run bench:run` drives live `claude -p` sessions (spends API credit) — run only when asked

## Architecture

- `template/` is what npm ships (`package.json` `files`); the root `CLAUDE.md`,
  `AGENTS.md`, `.claude/` and `docs/` are the installed copy, used on this repo
  itself. Change `template/` first, then mirror to the root copy.
- `bench/lib/install.mjs` fills the template's placeholders for the bench.

## Process

`docs/start.md` is the operating procedure (plan → build → refactor →
scored audit). Read it when starting a feature or preparing a release.

## Compact Instructions

When compacting, always preserve: the current task's goal and its verify
command, the paths of files already edited, and decisions made this session.
