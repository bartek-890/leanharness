---
name: harness-setup
description: >-
  Fill in or merge the leanharness AGENTS.md for this repo. Use when AGENTS.md
  still has placeholders in angle brackets, when leanharness was installed
  into a repo that already had AGENTS.md or CLAUDE.md, when CLAUDE.md does
  not import AGENTS.md, or when the user asks to set up the harness.
---

# Set up the harness for this repo

Every value you write into AGENTS.md comes from a file in this repo, never
from what a typical project of this kind usually does. You propose; the user
approves; only then do you write.

## Procedure

1. **Classify the repo.** No manifest and no source files → the repo is
   empty. Stop and point to `docs/start.md` Stage 0 (run the stack's official
   scaffolder first). The placeholders stay until there is code to read.
2. **Collect evidence (read-only).**
   - Manifests and scripts: `package.json` scripts, `pyproject.toml`,
     `Cargo.toml`, `go.mod`, `Makefile`, `justfile`. The lockfile names the
     package manager.
   - CI workflows (`.github/workflows/*`, `.gitlab-ci.yml`): the commands CI
     runs are the best Verify candidate, because they already pass.
   - `README`, `CONTRIBUTING`, `docs/`: setup steps and architecture notes.
   - Other agents' instruction files: `CLAUDE.md`, `.cursor/rules/*`,
     `.github/copilot-instructions.md`, `GEMINI.md`, `.windsurfrules`,
     nested `AGENTS.md`.
   - Off-limits candidates: generated code, vendored code, migrations,
     billing or auth modules.
   - Monorepo workspaces: one root AGENTS.md, plus a nested one only where a
     package has its own commands.
3. **Prove the Verify candidate.** Run it once and report its exit code. A
   command that fails now is not a Verify command until the user decides
   what to do about it.
4. **Propose one diff.** Cite the source file next to each value. Leave a
   placeholder and ask a question for anything the repo does not answer.
   - AGENTS.md written by the user: keep their content and add the
     Non-negotiables and Rules from `references/AGENTS.template.md` without
     duplicating what they already say.
   - CLAUDE.md without an `@AGENTS.md` line: add the import. Propose moving
     tool-agnostic content from CLAUDE.md into AGENTS.md.
   - Other agents' files: propose a one-line pointer to AGENTS.md, not a
     copy. If `GEMINI.md` exists, propose `.gemini/settings.json` with
     `{"context": {"fileName": ["AGENTS.md", "GEMINI.md"]}}`.
   - Architecture: link existing docs instead of summarizing them.
   - `.github/workflows/verify.yml` present: its `run:` line must match the
     Verify command.
5. **After approval:** apply the diff, delete the `## Setup pending`
   section, keep AGENTS.md under ~65 lines, and run
   `node .claude/hooks/setup-check.mjs`. No output means setup is complete.

## Constraints

- Never write to AGENTS.md or CLAUDE.md before the user approves the diff.
- Never read `.env*` files to discover commands or settings.
- Delete the template's HTML comments as you fill the sections.
