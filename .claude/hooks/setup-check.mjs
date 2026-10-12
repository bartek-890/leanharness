#!/usr/bin/env node
// SessionStart check for an unfinished install: deterministic code, not a
// model call. Prints facts about AGENTS.md / CLAUDE.md that the harness-setup
// skill resolves; prints nothing once setup is complete, so a finished repo
// pays zero tokens.
//
// Contract (Claude Code, Codex): plain stdout on exit 0 is added to the
// session context. Always exits 0 — SessionStart cannot block.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const read = (name) => {
  try {
    return readFileSync(join(root, name), 'utf8');
  } catch {
    return null; // missing or unreadable: nothing to report about it
  }
};

const facts = [];
const agents = read('AGENTS.md');
const claude = read('CLAUDE.md');

if (agents !== null) {
  const body = agents.replace(/<!--[\s\S]*?-->/g, '');
  const placeholders = [...body.matchAll(/`<[^`>]+>`/g)].map((m) => m[0]);
  if (placeholders.length) {
    facts.push(`AGENTS.md has ${placeholders.length} unfilled placeholders: ${placeholders.join(', ')}.`);
  }
  if (!/^## Non-negotiables/m.test(body)) {
    facts.push(
      'AGENTS.md predates leanharness: it has no Non-negotiables section. The rules to merge are in .claude/skills/harness-setup/references/AGENTS.template.md.',
    );
  }
}
if (claude !== null && !/^@AGENTS\.md\s*$/m.test(claude)) {
  facts.push('CLAUDE.md does not import AGENTS.md (no `@AGENTS.md` line), so Claude Code does not load the harness rules.');
}

if (facts.length) {
  console.log(`leanharness setup is incomplete. ${facts.join(' ')} The harness-setup skill proposes the fix as a diff for the user to approve.`);
}
