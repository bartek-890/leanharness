#!/usr/bin/env node
// theagentharness — drops a minimal Claude Code harness into the current directory.
// No prompts, no network, no dependencies. Existing files are skipped; --force overwrites.

import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: npx theagentharness [--force]

Copies a minimal Claude Code harness into the current directory:
CLAUDE.md, AGENTS.md, docs/agent-checklist.md, .claude/ (skills, explorer
agent, permission defaults). Existing files are skipped unless --force.`);
  process.exit(0);
}

const force = args.includes('--force');
const templateDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'template');
const targetDir = process.cwd();

const created = [];
const replaced = [];
const skipped = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const src = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(src);
      continue;
    }
    const rel = relative(templateDir, src);
    const dest = join(targetDir, rel);
    const exists = existsSync(dest);
    if (exists && !force) {
      skipped.push(rel);
      continue;
    }
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    (exists ? replaced : created).push(rel);
  }
}

walk(templateDir);

const posix = (p) => p.split(sep).join('/');
for (const f of created) console.log(`  created   ${posix(f)}`);
for (const f of replaced) console.log(`  replaced  ${posix(f)}`);
for (const f of skipped) console.log(`  skipped   ${posix(f)} (exists — rerun with --force to overwrite)`);

if (created.length === 0 && replaced.length === 0) {
  console.log('\nNothing to do — every harness file already exists.');
} else {
  console.log('\nNext: fill in the placeholders in CLAUDE.md (Commands, Architecture, Conventions).');
}
