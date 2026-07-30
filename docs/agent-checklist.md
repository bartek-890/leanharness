# Agent pre-flight checklist

Run through this before starting an agent session. It takes a minute and is
the difference between a session that converges and one that wanders. (This
is the per-session pre-flight; the full idea → shipped procedure lives in
[start.md](./start.md).)

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
- Second opinion before committing: run the `code-reviewer` agent on the
  diff — it reads the changes with no memory of how they were written.
- Review the diff yourself too. Small diffs; one task, one commit.
- For unattended runs, hand the **Done when** line to `/goal` — the session
  keeps working until a separate evaluator confirms the condition from the
  transcript, so the proof must land there.
- Same instructions pasted three times? Codify them as a skill:
  `.claude/skills/<name>/SKILL.md` — copy the frontmatter shape of
  `verify-done`, and make the description say *when* to use it.

## 4. When it breaks

Escalate in order; each step is cheaper than the next.

1. Paste the full error message verbatim — the stack trace is the context,
   don't summarize it.
2. Still failing? Have the agent add logs around the suspect path, rerun,
   and paste the output.
3. Bug returns after "fixes"? Demand a list of every possible cause before
   the next patch — diagnosis over symptom-patching.
4. Once the bug is understood, have the agent write the breaking test first,
   then fix until it passes.
5. Three failed prompts on the same problem? Stop. `/clear` and rephrase
   from scratch — a poisoned session keeps producing poisoned answers.
