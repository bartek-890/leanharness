---
name: dependency-change
description: >-
  Guide adding or upgrading npm dependencies with audit and justification. Use
  when the user wants a new package or a major upgrade.
---

# Dependency change

1. Prefer Node builtins when they suffice.
2. Justify new runtime deps in the PR body (one line minimum).
3. Run tests after the lockfile changes.
4. Do not pin to `latest`.
