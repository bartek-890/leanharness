# Start here: idea → shipped, with an agent

This is the operating procedure for building with a coding agent. It is
written for both readers: **you** (the human steering) and **the agent**.
Point your agent at it any time:

```text
Read docs/start.md and drive this process. We are at stage <N>.
```

The process:

```text
IDEA → PLAN (strongest model) → BUILD (loop per feature)
     → REFACTOR (on a schedule) → AUDIT (scored 1–10, fix until it passes) → SHIP
```

## Stage 0 — Setup (once, 5 minutes)

1. `git init` before the agent touches anything — every change must be a
   commit you can revert.
2. `npx leanharness`, then fill in the three placeholder sections in
   `CLAUDE.md` (Commands, Architecture, Conventions). Placeholders left
   unfilled = an agent guessing your test runner forever.
3. Optional but recommended: `/sandbox` (fewer permission prompts, OS-level
   boundaries) and `/permissions` to see what the agent may do.

## Stage 1 — Plan with the strongest model

Planning mistakes are the most expensive kind: a wrong plan is executed at
high speed. So plan with the **strongest model you have**, in plan mode,
before any code exists.

1. Switch up: `/model opus` (or the strongest tier your plan allows).
2. Enter plan mode: `Shift+Tab`. The agent reads and proposes; nothing on
   disk changes until you approve.
3. Prompt shape:

   ```text
   Here's the idea: <2–5 sentences>.
   Define the MVP (the smallest version that works), then phase the rest.
   For each phase: files to create, data shapes, and a "done when" check
   I can run. Write the result to docs/plan.md.
   ```

4. Edit the plan (`Ctrl+G` opens it in your editor). Cut scope — the plan
   is the cheapest place to say no.
5. Approve, then **switch back down**: `/model sonnet`. Planning is the
   only stage that defaults to the expensive tier.

**Agent rule:** for any multi-file task with no approved plan, propose one
first — do not start editing.

## Stage 2 — Build: one feature per session

Default model: **Sonnet**. Per feature:

1. Scope the prompt (four lines — full template in
   [agent-checklist.md](./agent-checklist.md)):

   ```text
   Goal: <one feature, one sentence — from docs/plan.md>
   Touch only: <files/dirs>
   Do not touch: <auth, billing, migrations, generated code>
   Done when: <a command and its expected result>
   ```

2. The agent implements, runs the Verify command (`CLAUDE.md` → Commands),
   and shows real output — the `verify-done` skill enforces this.
3. Review the diff. Commit. `/clear`. Next feature.

Delegation while building — this is where the harness earns its keep:

| Work | Delegate to | Why |
| --- | --- | --- |
| Heavy reads: logs, multi-file surveys, test triage | `explorer` agent (Haiku) | Verbose output stays out of your window; you get a ~30-line summary |
| "How does library X do Y?" / comparing approaches | `researcher` agent | One topic, primary sources, recommendation back |
| Pre-commit second opinion | `code-reviewer` agent | Fresh context — it never saw the implementation happen |

Hands-off variants:

- `/goal <the "Done when" line>` — the agent keeps taking turns until a
  separate evaluator confirms the condition **from the transcript**. Write
  the condition as something a command can prove ("`npm test` exits 0"),
  never prose ("works correctly").
- `/loop` — re-runs a prompt on an interval; for recurring chores, not
  one-off features.

**Agent rule:** one feature per session. If asked to start feature B with
feature A's context still loaded, suggest `/clear` first.

## Stage 3 — Refactor on a schedule

Generated code accumulates mess faster than handwritten code. Every 3–5
features, run a refactor session instead of a feature session:

1. Fresh session, Sonnet, scoped prompt: "Review `src/` for duplication,
   dead code, and oversized modules. Propose the 3 highest-value cleanups,
   then apply them one at a time; run Verify after each."
2. Tests must exist before the refactor and pass after each step — that is
   what makes it safe. No tests yet? Then the refactor session writes them
   first ("add tests covering current behavior of `<module>`; don't change
   the code yet"), and the cleanup starts in the next session.
3. Commit each cleanup separately.

## Stage 4 — Audit, scored 1–10, fixed until it passes

Before anything goes public, run both audits. Each ends with a score and a
fix loop — not a vibe check.

**The rubric (both audits use it):**

| Score | Meaning |
| --- | --- |
| 9–10 | No findings, or nits only |
| 7–8 | Warnings, no blockers |
| 5–6 | At least one blocker |
| ≤4 | Multiple blockers, secrets exposed, or Verify failing |

**The gate:** a score of **8 or higher ships** — except security when real
user data is involved, which needs **9 or higher**. Below the gate, the fix
loop runs.

**The loop** (the prompts to paste):

1. ```text
   Run the security-audit skill on the whole repo.
   ```
   → findings (secrets, entry points, input validation, data exposure,
   dependencies) + `Score: N/10`.
2. ```text
   Run the code-reviewer agent on the diff since <last release tag/commit>.
   ```
   → findings + `Score: N/10`.
3. Below the gate? The main session applies the fixes — blockers first —
   then re-runs the audit.
4. Cap: 3 rounds. Still below the gate → the remaining findings are a
   human decision, not something to loop on. The score must never go up
   without the finding actually fixed — evidence or it didn't happen.

**Agent rule:** report scores with the findings that justify them. An
audit that returns a bare number is worthless.

## Which model for which task

Model choice is a per-stage decision, not a one-time setting (`/model` to
switch):

| Task | Model | Rationale |
| --- | --- | --- |
| Architecture, planning, hard debugging | Strongest available (Opus tier) | Errors here compound; pay for depth once |
| Implementation, refactors, reviews | Sonnet tier | The default worker — near-top quality at a fraction of the price |
| Recon, log reading, test triage | Haiku tier (the `explorer` agent already does this) | Cheap, fast, and the summary is all you need |

## Command hints

| When | Use |
| --- | --- |
| Before a feature, to think first | `Shift+Tab` (plan mode) |
| Between features | `/clear` |
| Long session, still on-topic | `/compact` |
| See what's eating the window | `/context` |
| Agent mid-edit, going wrong | `Esc`, then `/rewind` if it landed |
| Unattended work toward a checkable end state | `/goal <condition>` |
| Recurring chore on an interval | `/loop` |
| Switch model tier between stages | `/model` |
| Fewer prompts, hard boundaries | `/sandbox`, `/permissions` |
| Three failed attempts at the same thing | Stop. `/clear`, rephrase from scratch |
| A bug that keeps coming back | The debug escalation ladder in [agent-checklist.md](./agent-checklist.md) |

## The contract, in one paragraph

You bring the idea, the taste, and the final say. The agent brings speed.
The harness — this repo's `CLAUDE.md`, skills, and agents — brings the
discipline neither of you wants to hold in working memory: plans before
code, proof before "done", scores before shipping. Trust the process
exactly as far as its checks pass, and no further.
