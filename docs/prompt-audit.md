# Prompt audit (Claude 5.5)

Claude Code 2.1.283 (2026-09-25) added `/doctor prompt-audit`: it audits
`CLAUDE.md`, skills, subagents and commands for prompting patterns written for
older models, and leads the report with stale paths, stale commands and
contradicting instruction files. This file records two runs on 2026-09-30
(Claude Code 2.1.285, target model Claude Opus 5.5).

Write-up: [Claude 5.5 prompt audit: the bad lines weren't there](https://bartlomiejkrupa.dev/articles/claude-5-5-prompt-audit).

## The four 5.5 habits

Anthropic's Sonnet 5.5 and Opus 5.5 prompting guides retire four habits:
discouraging tool use ("minimize tool calls"), asking for reasoning in the
response (`reasoning_extraction` refusals), telling the model not to think, and
harness text after every tool result. **Hits in this template: 0.** Hits in
the field repo below: 0.

## Run 1 - this template (v0.7.0)

| # | Location | Finding | Pattern | Conf. | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | `template/CLAUDE.md:20-21` | Non-negotiable SCOPE named `src/billing.js` - a bench-fixture file - in the template every user installs | stale path | Medium | **fixed**: now the `<off-limits path>` placeholder; `bench/lib/install.mjs` fills it with `src/billing.js`, so the bench-installed `CLAUDE.md` is byte-identical and every published result still reproduces |
| 2 | `code-reviewer.md:38`, `researcher.md:27` | `Keep the whole response under ~60 lines`, `Maximum ~40 lines` | numeric output ceiling | Medium | proposed, not applied |
| 3 | `code-reviewer.md:26`, `explorer.md:23` | `You NEVER edit files.` | all-caps pressure | Medium | proposed, not applied |
| 4 | `explorer.md:33` | `Maximum ~30 lines` | numeric output ceiling | Low | flag: backs the measured LOGS non-negotiable |
| 5 | `code-reviewer.md:14` | `git diff main...HEAD` | volatile specific | Low | flag: wrong on repos whose default branch is not `main` |
| 6 | `AGENTS.md:1` | `@CLAUDE.md` | duplication | Low | flag: loads twice if a tool reads both; copies agree |

**Why 2 and 3 are not applied:** they change the harness the bench measured.
Applying them without re-running `npm run bench:run` would leave the README's
pass/fail table describing a configuration that no longer ships.

**Kept on purpose** (the audit's keep list): the Non-negotiables' `Never`
lines and the `~15 summary lines` log cap - each guards a failure the bench
reproduced; and `verify-done`'s `REQUIRED` description - routing text that
VD1 measured.

## Run 2 - field repo: bartlomiejkrupa.dev

Scope: `CLAUDE.md`, `AGENTS.md` and imports, 4 subagents, 14 skills; 66
installed skills report-only.

| Group | Before |
| --- | --- |
| Dated prompt text | 4 |
| Config rot (stale paths, commands, contradictions) | 10 |
| **Total** | **14** (10 with a proposed fix, 4 flag-only) |

High-confidence findings were all rot: three subagents copied from a
multi-repo setup still named repos that don't exist (`b24`, `react_panel`,
`b24depot`, `product_ops`); the reviewer ran `git diff master...HEAD` on a
`main` repo; two vendored skills called four uninstalled slash commands.

After applying all 10 fixes, a re-scan caught one more instance the first
run missed (a `~50 lines` cap in a fourth agent). Run the audit twice.

Full report, before and after:
<https://gist.github.com/bartek-890/b6f0d1ad2d2603072a4857c7004fbb0a>
