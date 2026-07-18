---
name: verify-done
description: >-
  Turn a task into a verifiable completion condition and prove it before
  declaring the task done. Use whenever you are about to report a task as
  complete, fixed, or finished.
---

# Verify before done

A task is done when a check proves it — not when the code looks right.

## Procedure

1. **State the condition.** Write the completion condition as: measurable end
   state + the command that checks it + constraints. If the task arrived
   without one, derive it and state it before finishing.
   - Bad: "Fix the auth bug."
   - Good: "`npm test -- test/auth` exits 0; no other test file modified."
2. **Run the check.** Execute the project's Verify command (CLAUDE.md →
   Commands) plus the task-specific check. The proof must land in the
   transcript as real output — exit codes, test counts, `git status`.
3. **Report honestly.** Paste the actual result. If anything fails, the task
   is not done — say so and keep working; never soften a failure into
   "mostly working".

## Constraints

- Machine-checkable beats prose: an exit code outranks your own assessment.
- If no check can exist (a pure prose change), say so explicitly and list
  exactly what changed instead.
