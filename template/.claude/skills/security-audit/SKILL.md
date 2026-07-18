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
   not apply (e.g. no network surface). End with `Score: N/10`:

   | Score | Meaning |
   | --- | --- |
   | 9–10 | No findings, or nits only |
   | 7–8 | Warnings, no blockers |
   | 5–6 | At least one blocker |
   | ≤4 | Multiple blockers or secrets exposed |

7. **Fix loop.** Below 8/10 (below 9/10 when real user data is involved):
   apply the fixes — blockers first — then re-run the audit from step 2.
   Cap at 3 rounds; after that, the remaining findings are a human
   decision. Never raise the score without the finding actually fixed.

## Constraints

- Every finding needs evidence (`path:line`, command output) — no
  speculative findings without a concrete location.
- The score must be justified by the listed findings — a bare number is
  worthless.
- This is a first pass, not a substitute for deterministic SAST/DAST in CI.
  Say so in the report when the stakes warrant it.
