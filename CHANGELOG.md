# Changelog

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
