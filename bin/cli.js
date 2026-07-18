#!/usr/bin/env node
// leanharness — drops a minimal Claude Code harness into the current directory.
// No prompts, no network, no dependencies. Existing files are skipped; --force overwrites.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const templateDir = join(rootDir, 'template');
const { version } = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));

const useColor = !process.env.NO_COLOR && (process.stdout.isTTY || process.env.FORCE_COLOR);
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = paint('1');
const dim = paint('2');
const green = paint('32');
const yellow = paint('33');

function collect(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const src = join(dir, entry.name);
    if (entry.isDirectory()) collect(src, out);
    else out.push(src);
  }
  return out;
}

const posix = (p) => p.split(sep).join('/');
const files = collect(templateDir)
  .map((src) => ({ src, rel: relative(templateDir, src) }))
  .sort(
    (a, b) =>
      a.rel.split(sep).length - b.rel.split(sep).length || a.rel.localeCompare(b.rel)
  );

const banner = `${bold('leanharness')} ${dim(`v${version}`)} — a lean Claude Code harness in ${files.length} files`;

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
${banner}

Usage: npx leanharness [--force]

Copies the harness into the current directory: CLAUDE.md, AGENTS.md,
docs/agent-checklist.md, .claude/ (skills, read-only agents, permission
defaults). Existing files are never touched without --force.

Options:
  --force      overwrite files that already exist
  -h, --help   show this help

Docs: https://github.com/bartek-890/leanharness
`);
  process.exit(0);
}

const force = args.includes('--force');
const targetDir = process.cwd();

console.log(`\n${banner}\n`);

let created = 0;
let replaced = 0;
let skipped = 0;

for (const { src, rel } of files) {
  const dest = join(targetDir, rel);
  const exists = existsSync(dest);
  if (exists && !force) {
    skipped++;
    console.log(`  ${dim(`· skipped   ${posix(rel)} (exists)`)}`);
    continue;
  }
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  if (exists) {
    replaced++;
    console.log(`  ${yellow('~ replaced')}  ${posix(rel)}`);
  } else {
    created++;
    console.log(`  ${green('+ created')}   ${posix(rel)}`);
  }
}

const summary = [`${created} created`];
if (replaced) summary.push(`${replaced} replaced`);
if (skipped) summary.push(`${skipped} skipped`);
console.log(`\n  ${dim(summary.join(' · '))}`);

if (created === 0 && replaced === 0) {
  console.log(`
  Nothing to do — every harness file already exists.
  Rerun with ${bold('--force')} to overwrite.
`);
} else {
  console.log(`
  ${bold('Next steps')}
  ${dim('1.')} Fill in the placeholders in CLAUDE.md — Commands, Architecture, Conventions
  ${dim('2.')} Delete the guidance comments as you go
  ${dim('3.')} Start Claude Code — the harness loads at session start
`);
  if (skipped) {
    console.log(`  ${dim('Skipped files stay untouched — rerun with --force to overwrite.')}\n`);
  }
}
