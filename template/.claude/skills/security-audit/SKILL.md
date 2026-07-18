---
name: security-audit
description: >-
  Pre-ship security pass: secrets in code or history, unprotected entry
  points, missing input validation, exposed data. Use before anything goes
  public — a deploy, a repo made public, a demo link — or whenever the user
  asks for a security review.
---

# Security audit

A mandatory launch step, not an optional extra — prototypes ship more often
than anyone admits.

## Procedure

1. **Scope.** Audit the given diff if there is one; otherwise the whole repo.
2. **Secrets.** Grep code and config for API keys, tokens, and passwords.
   Confirm `.env*` files are gitignored, and check `git log -p` for secrets
   already committed — a leaked key in history is still leaked.
3. **Entry points.** List every route, handler, and CLI input. For each:
   is authentication/authorization present where required? Is input
   validated before use (queries, shell, file paths, templates)?
4. **Data exposure.** Check what responses, logs, and error messages reveal —
   stack traces, internal identifiers, other users' data.
5. **Dependencies.** Run the ecosystem's audit command (`npm audit`,
   `pip-audit`, `cargo audit`, …) and report its real output.
6. **Report.** Findings ranked by severity, each with a `path:line`
   reference and a concrete fix. State explicitly when a check class did
   not apply (e.g. no network surface).

## Constraints

- Every finding needs evidence (`path:line`, command output) — no
  speculative findings without a concrete location.
- This is a first pass, not a substitute for deterministic SAST/DAST in CI.
  Say so in the report when the stakes warrant it.
