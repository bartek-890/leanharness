---
name: format-everything
description: >-
  Re-apply Prettier and ESLint preferences whenever JS files change. Use when
  the user asks to format, clean style, or before opening a PR.
---

# Format everything

1. Run `npx prettier --write` on touched files.
2. Run `npx eslint` on the same paths.
3. Do not mix formatting-only churn into unrelated behavioral diffs when avoidable.
4. If the tool config disagrees with CLAUDE.md style notes, the tool wins.
