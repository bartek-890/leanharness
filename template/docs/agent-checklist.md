# Agent pre-flight checklist

Run through this before starting an agent session. It takes a minute and is
the difference between a session that converges and one that wanders.

## 1. Scope the task

Write the prompt in four lines:

- **Goal:** one sentence, one outcome.
- **Touch only:** the files or directories the agent may edit.
- **Do not touch:** off-limits zones — auth, billing, migrations, generated
  code, anything you can't easily review.
- **Done when:** a machine-checkable condition — a named command and its
  expected result (e.g. "`npm test -- test/auth` exits 0 and no other test
  file is modified"), never prose like "works correctly".

## 2. Keep the window clean

- `/clear` between unrelated tasks — never let task B inherit task A's debris.
- `/compact` proactively at a natural checkpoint, not when forced at the limit.
- Plan first (plan mode, or a separate session), then execute the approved
  plan in a clean window.
- Heavy reads — logs, large files, multi-file surveys — go to the `explorer`
  subagent, so only its summary enters your window.

## 3. Close the loop

- Make the agent **run** the verify command. Proof belongs in the transcript
  (exit codes, test counts, clean `git status`), not in the agent's prose.
- Review the diff before committing. Small diffs; one task, one commit.
- Same instructions pasted three times? Codify them as a skill (`/add-skill`).
