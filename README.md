# agentharness

Minimal agent harness starter for [Claude Code](https://claude.com/claude-code).
One command, seven files, zero dependencies, zero lock-in.

```bash
npx agentharness
```

Existing files are never touched — rerun with `--force` to overwrite. After
installing, fill in the placeholders in `CLAUDE.md` (Commands, Architecture,
Conventions) and delete the guidance comments.

## Why so small

An agent is ~10% model and ~90% harness — and the always-loaded part of that
harness is the expensive part. `CLAUDE.md` is read into context at the start
of **every** session and competes with your actual task for attention, so a
bloated rule file doesn't make an agent obedient; it makes the whole file get
discounted as noise. This starter ships only what changes agent behavior
mechanically, and every file maps to a rule published (with sources and
numbers) on [bartlomiejkrupa.dev](https://bartlomiejkrupa.dev).

## What you get

| File | What it does | The rule behind it |
| --- | --- | --- |
| `CLAUDE.md` | ~50-line skeleton: 4 behavioral rules, placeholders for non-guessable commands, architecture, non-default conventions, a Compact Instructions block | [Why agents ignore your CLAUDE.md](https://bartlomiejkrupa.dev/articles/why-agents-ignore-your-claude-md), [Keep CLAUDE.md universal](https://bartlomiejkrupa.dev/notes/claude-md-universal-only) |
| `AGENTS.md` | Points every non-Claude tool at `CLAUDE.md` — one source of truth | [Why agents ignore your CLAUDE.md](https://bartlomiejkrupa.dev/articles/why-agents-ignore-your-claude-md) |
| `docs/agent-checklist.md` | Human pre-flight: scoped-prompt template (Goal / Touch only / Do not touch / Done when), session hygiene, closing the loop | [The vibe-coding field manual](https://bartlomiejkrupa.dev/articles/vibe-coding-field-manual), [Verifiable completion condition](https://bartlomiejkrupa.dev/notes/verifiable-completion-condition) |
| `.claude/skills/verify-done/SKILL.md` | Agent must prove completion in the transcript (exit codes, clean `git status`) before saying "done" | [Verifiable completion condition](https://bartlomiejkrupa.dev/notes/verifiable-completion-condition), [The /goal evaluator only reads the transcript](https://bartlomiejkrupa.dev/notes/goal-evaluator-transcript-only) |
| `.claude/skills/add-skill/SKILL.md` | Teaches the agent to codify recurring workflows as new skills — the harness extends itself | [Claude Code skill composition](https://bartlomiejkrupa.dev/notes/claude-code-skill-composition) |
| `.claude/agents/explorer.md` | Read-only recon subagent on Haiku: verbose reads happen in its window, only a summary reaches yours | [Subagent context isolation](https://bartlomiejkrupa.dev/notes/subagent-context-isolation), [Why most agents default to the wrong Claude tier](https://bartlomiejkrupa.dev/articles/claude-model-tier-comparison) |
| `.claude/settings.json` | Denies agent reads of `~/.ssh`, `~/.aws`, and `.env*` — there is no built-in credential deny list | [Claude Code security in 2026](https://bartlomiejkrupa.dev/articles/claude-code-security-sandboxing-2026) |

## What's deliberately NOT here

- **`llms.txt`** — a spec for websites, not repositories. In a repo it would
  duplicate `CLAUDE.md`.
- **Session-hygiene automation** — `/clear` and `/compact` are human moves;
  they live in the checklist, not in a file the agent loads.
- **A pile of agents and MCP config** — every name loads at session start.
  Start lean; add via `/add-skill` when a workflow actually repeats.

## Other tools

Claude Code reads `CLAUDE.md`, `.claude/skills/`, `.claude/agents/`, and
`.claude/settings.json` natively. Tools that read `AGENTS.md` (Codex, Cursor,
and others) are pointed at `CLAUDE.md` by it — keep the rules in one file.

## License

MIT
