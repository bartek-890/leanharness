# leanharness

> The minimal [Claude Code](https://claude.com/claude-code) harness that respects your context window.

[![npm version](https://img.shields.io/npm/v/leanharness)](https://www.npmjs.com/package/leanharness)
[![node](https://img.shields.io/node/v/leanharness)](https://github.com/bartek-890/leanharness/blob/main/package.json)
![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
[![license](https://img.shields.io/npm/l/leanharness)](./LICENSE)

**One command. Ten files. Zero dependencies. Zero lock-in.**

An agent is ~10% model and ~90% harness — and the always-loaded part of that
harness is the expensive part. `CLAUDE.md` is read into context at the start
of **every** session and competes with your actual task for attention:
frontier models hold reliable adherence to roughly 150–200 instructions, and
Claude Code's own system prompt spends about 50 of them before your file is
read. A bloated rule file doesn't make an agent obedient — it makes the whole
file get discounted as noise.

leanharness ships only what changes agent behavior mechanically. Every file
maps to a rule published — with sources and numbers — on
[bartlomiejkrupa.dev](https://bartlomiejkrupa.dev).

## Quick start

```bash
npx leanharness
```

```text
leanharness v0.4.1 — a lean Claude Code harness in 10 files

  + created   AGENTS.md
  + created   CLAUDE.md
  + created   .claude/settings.json
  + created   docs/agent-checklist.md
  + created   docs/start.md
  + created   .claude/agents/code-reviewer.md
  + created   .claude/agents/explorer.md
  + created   .claude/agents/researcher.md
  + created   .claude/skills/security-audit/SKILL.md
  + created   .claude/skills/verify-done/SKILL.md
  + linked    .agents → .claude
  + linked    .cursor → .claude

  10 created · 2 linked

  Next steps
  1. Fill in the placeholders in CLAUDE.md — Commands, Architecture, Conventions
  2. Open docs/start.md — the idea → shipped operating procedure
  3. Start Claude Code — the harness loads at session start
```

Existing files are **never touched** — rerun with `--force` to overwrite.
Then fill in the three placeholder sections in `CLAUDE.md` and delete the
guidance comments. Two minutes, total.

## What's inside

```text
your-repo/
├── CLAUDE.md                    ~60-line rule skeleton — fill in 3 sections
├── AGENTS.md                    points Codex, Cursor & co. at CLAUDE.md
├── docs/
│   ├── start.md                 idea → shipped operating procedure
│   └── agent-checklist.md       per-session pre-flight + debug escalation
├── .claude/
│   ├── settings.json            credential deny rules (~/.ssh, ~/.aws, .env*)
│   ├── agents/
│   │   ├── explorer.md          read-only recon on Haiku — summary only
│   │   ├── code-reviewer.md     fresh-context diff review, scored 1–10
│   │   └── researcher.md        one topic per run, sources, recommendation
│   └── skills/
│       ├── verify-done/         proof in the transcript before "done"
│       └── security-audit/      pre-ship security pass, scored 1–10
├── .agents  → .claude           symlink, so tools reading .agents/ see the harness
└── .cursor  → .claude           symlink, created only if the path is free
```

| File | What it does | The rule behind it |
| --- | --- | --- |
| `CLAUDE.md` | ~60-line skeleton: 4 behavioral rules, placeholders for non-guessable commands, architecture, non-default conventions, a Compact Instructions block | [Why agents ignore your CLAUDE.md](https://bartlomiejkrupa.dev/articles/why-agents-ignore-your-claude-md), [Keep CLAUDE.md universal](https://bartlomiejkrupa.dev/notes/claude-md-universal-only) |
| `AGENTS.md` | Points every non-Claude tool at `CLAUDE.md` — one source of truth | [Why agents ignore your CLAUDE.md](https://bartlomiejkrupa.dev/articles/why-agents-ignore-your-claude-md) |
| `docs/start.md` | The operating procedure: plan with the strongest model, build one feature per session, refactor on a schedule, audit scored 1–10 with a fix loop, model-per-task table, command hints (`/goal`, `/loop`, plan mode) | [The vibe-coding field manual](https://bartlomiejkrupa.dev/articles/vibe-coding-field-manual), [Why most agents default to the wrong Claude tier](https://bartlomiejkrupa.dev/articles/claude-model-tier-comparison) |
| `docs/agent-checklist.md` | Human pre-flight and recovery: scoped-prompt template (Goal / Touch only / Do not touch / Done when), session hygiene, closing the loop, the debug escalation ladder | [The vibe-coding field manual](https://bartlomiejkrupa.dev/articles/vibe-coding-field-manual), [Verifiable completion condition](https://bartlomiejkrupa.dev/notes/verifiable-completion-condition) |
| `.claude/skills/verify-done/SKILL.md` | Agent must prove completion in the transcript (exit codes, clean `git status`) before saying "done" | [Verifiable completion condition](https://bartlomiejkrupa.dev/notes/verifiable-completion-condition), [The /goal evaluator only reads the transcript](https://bartlomiejkrupa.dev/notes/goal-evaluator-transcript-only) |
| `.claude/skills/security-audit/SKILL.md` | Pre-ship security pass: secrets in code and history, unprotected entry points, input validation, data exposure — ends with a 1–10 score and a fix loop | [The vibe-coding field manual](https://bartlomiejkrupa.dev/articles/vibe-coding-field-manual), [Claude Code security in 2026](https://bartlomiejkrupa.dev/articles/claude-code-security-sandboxing-2026) |
| `.claude/agents/explorer.md` | Read-only recon subagent on Haiku: verbose reads happen in its window, only a summary reaches yours | [Subagent context isolation](https://bartlomiejkrupa.dev/notes/subagent-context-isolation), [Why most agents default to the wrong Claude tier](https://bartlomiejkrupa.dev/articles/claude-model-tier-comparison) |
| `.claude/agents/code-reviewer.md` | Fresh-context diff review before commit/PR, scored 1–10 — the reviewer never sees how the code was written, only what it says | [The vibe-coding field manual](https://bartlomiejkrupa.dev/articles/vibe-coding-field-manual), [Subagent context isolation](https://bartlomiejkrupa.dev/notes/subagent-context-isolation) |
| `.claude/agents/researcher.md` | One self-contained topic per run — docs, APIs, approach comparisons — researched outside your window, summary back | [Subagent context isolation](https://bartlomiejkrupa.dev/notes/subagent-context-isolation), [Context engineering beats a bigger window](https://bartlomiejkrupa.dev/articles/context-engineering-beats-a-bigger-window) |
| `.claude/settings.json` | Denies agent reads of `~/.ssh`, `~/.aws`, and `.env*` — there is no built-in credential deny list | [Claude Code security in 2026](https://bartlomiejkrupa.dev/articles/claude-code-security-sandboxing-2026) |

## Three files work even if you forget they exist

Most harness advice requires discipline. Three of these files don't:

1. **`settings.json`** — Claude Code has no built-in credential deny list;
   by default the agent can read `~/.ssh` and `~/.aws/credentials`. The
   installed deny rules close that from the first session.
2. **`explorer.md`** — heavy reads (logs, multi-file surveys, test triage)
   run in a subagent's own context window on Haiku, the cheapest capable
   tier, and return a ~30-line summary. Your window stays clean.
3. **`verify-done`** — triggers when the agent is about to say "done" and
   demands proof in the transcript: a named check, its real exit code, an
   honest report if it fails. "Mostly working" stops being a final answer.

## What's deliberately NOT here

The cut list is the product:

- **`llms.txt`** — a spec for websites, not repositories. In a repo it would
  duplicate `CLAUDE.md`.
- **Session-hygiene automation** — `/clear` and `/compact` are human moves;
  they live in the checklist, not in a file the agent loads.
- **MCP config and agent sprawl** — every registered name loads at session
  start. The three shipped agents are read-only and have non-overlapping
  jobs (recon, review, research); add a skill or agent only when a workflow
  actually repeats (the checklist shows the skill format).

## Beyond Claude Code

Claude Code reads `CLAUDE.md`, `.claude/skills/`, `.claude/agents/`, and
`.claude/settings.json` natively. Two bridges cover everything else:

- **`AGENTS.md`** points tools that read it (Codex, Cursor, and others) at
  `CLAUDE.md` — the rules live in one file, not two drifting copies.
- **`.agents` and `.cursor` symlinks** mirror `.claude`, so tools that look
  for those folders find the same skills and agents. Visible is not
  executable: subagents, skills, and `settings.json` permission rules only
  run in Claude Code. The installer never replaces an existing folder — if
  you already have a real `.cursor/`, the link is skipped and your files
  stay untouched.

## FAQ

**Is it safe to run in an existing repo?**
Yes. Files that already exist are skipped and listed; overwriting requires
an explicit `--force`. No prompts, no postinstall, no network calls.

**Why symlink `.agents` and `.cursor` instead of copying?**
One folder, zero drift: every tool that resolves those paths sees the same
harness, and an update to `.claude` updates all of them. Existing paths are
never touched.

**Why does the CLI have zero dependencies?**
It copies ten files. Anything more would be someone else's supply chain in
your dev setup.

**Where do the rules come from?**
Each file's row in the table above links to the published article or note it
implements, with sources and numbers.

## License

[MIT](./LICENSE)
