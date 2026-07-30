# Changelog

## 0.6.1 — 2026-07-30

### Fixed

- **The Stop hook was inert in 0.6.0.** `"model": "haiku"` in a `type: prompt`
  hook is a bare alias, and a prompt hook with a bare alias never fires - no
  error, no log. The VERIFY gate silently stopped enforcing anything in 0.6.0.
  Fixed by dropping the field: `model` already defaults to Haiku, so 0.6.0's
  "lower hook eval cost" intent is preserved for free.

  Measured on Claude Code 2.1.220 with a Stop hook told to block unconditionally:

  | `model` | Result |
  | --- | --- |
  | `"haiku"` | 1 turn, no block (inert) |
  | `"claude-haiku-4-5-20251001"` | 7 turns, blocked |
  | omitted | 10 turns, blocked |

  If you installed 0.6.0, re-copy `.claude/settings.json` or delete the
  `"model": "haiku"` line from your `Stop` hook.

### Bench

- `bench/static.mjs` fails the build if any template `prompt`/`agent` hook uses a
  bare model alias, so this cannot regress silently again.
- New **layer arms** (`mem`, `claudemd`, `deny`, `stophook`) holding rule text
  constant while changing which layer carries it, plus cases `MEMLOAD1`
  (manipulation check), `MEM1` (indirect pressure), `MEM2` (direct conflict).
- `--repeat N` for multiple runs per cell; run 1 keeps its legacy filename.
- Cases can select rule text with a `notes` field.
- Four golden fixtures from real transcripts; `npm run bench` covers 12.
- Results: a rule in auto memory held 3/3 under indirect pressure and 0/3 under
  direct conflict, matching `CLAUDE.md` on both. Summary in
  `bench/results/proof-mem.json`.

No breaking CLI changes.

## 0.6.0 — 2026-07-29

### Documentation

- README links the full measured write-up ([bench article](https://bartlomiejkrupa.dev/articles/claude-md-adherence-bench)).
- VD1 byte-identical failure quoted verbatim; SEC1 non-discrimination caveat added.
- Benchmark limitations section (n=1, rescoring, synthetic fat file, etc.).
- Added `bench/README.md` with reproduction steps and limitations.

### Bench

- `bench/run.mjs` pins `--model claude-sonnet-5` by default (override with `--model`).
- Model ID recorded in `run.json` and per-cell `*.meta.json`.

### Template

- Stop hook uses Haiku explicitly (`"model": "haiku"`) for lower hook eval cost.
- `CLAUDE.md` header comment: ~65 lines (was ~70).

No breaking CLI changes.

## 0.5.1 — 2026-07-18

- Initial adversarial bench results in README.
- Four Non-negotiables, Stop hook, verify-done skill, explorer/code-reviewer/researcher agents.
