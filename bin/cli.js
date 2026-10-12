#!/usr/bin/env node
// leanharness — drops a minimal Claude Code harness into the current directory.
// No prompts, no network, no dependencies. Existing files are skipped; --force overwrites.

import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
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

Usage: npx leanharness [--force] [--sandbox] [--ci]

Copies the harness into the current directory: AGENTS.md (the rules),
CLAUDE.md (imports AGENTS.md), docs/, .claude/ (skills, read-only agents,
permission defaults, verify gate). Existing files are never touched
without --force.

Options:
  --force      overwrite files that already exist
  --sandbox    add an OS-level Bash sandbox to .claude/settings.json that
               blocks reading ~/.ssh, ~/.aws and .env files (macOS, Linux,
               WSL2; hosts outside the allowlist prompt)
  --ci         add .github/workflows/verify.yml running the Verify command
               on every push and pull request
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

// Mirror .claude as .agents and .cursor so tools that look for those
// folders see the same harness. Existing paths are never touched.
let linked = 0;
for (const name of ['.agents', '.cursor']) {
  const linkPath = join(targetDir, name);
  let exists = true;
  try {
    lstatSync(linkPath);
  } catch {
    exists = false;
  }
  if (exists) {
    skipped++;
    console.log(`  ${dim(`· skipped   ${name} (exists)`)}`);
    continue;
  }
  try {
    symlinkSync('.claude', linkPath, 'junction');
    linked++;
    console.log(`  ${green('+ linked')}    ${name} ${dim('→ .claude')}`);
  } catch {
    console.log(`  ${dim(`· no link   ${name} (symlinks unavailable — AGENTS.md still bridges other tools)`)}`);
  }
}

// Opt-in extras: kept out of template/ so a plain install stays unchanged.
if (args.includes('--sandbox')) {
  const settingsPath = join(targetDir, '.claude', 'settings.json');
  const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  if (settings.sandbox) {
    skipped++;
    console.log(`  ${dim('· skipped   sandbox (already in .claude/settings.json)')}`);
  } else {
    settings.sandbox = {
      enabled: true,
      allowUnsandboxedCommands: false,
      failIfUnavailable: true,
      filesystem: { denyRead: ['~/.ssh', '~/.aws', './**/.env*'] },
      network: { allowedDomains: ['registry.npmjs.org', 'github.com'] },
    };
    writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
    created++;
    console.log(`  ${green('+ created')}   sandbox ${dim('in .claude/settings.json')}`);
  }
}

if (args.includes('--ci')) {
  const workflow = join(targetDir, '.github', 'workflows', 'verify.yml');
  if (existsSync(workflow)) {
    skipped++;
    console.log(`  ${dim('· skipped   .github/workflows/verify.yml (exists)')}`);
  } else {
    mkdirSync(dirname(workflow), { recursive: true });
    writeFileSync(
      workflow,
      `name: verify
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      # Keep in sync with the Verify command in AGENTS.md.
      - run: npm run verify
`,
    );
    created++;
    console.log(`  ${green('+ created')}   .github/workflows/verify.yml`);
  }
}

const summary = [`${created} created`];
if (linked) summary.push(`${linked} linked`);
if (replaced) summary.push(`${replaced} replaced`);
if (skipped) summary.push(`${skipped} skipped`);
console.log(`\n  ${dim(summary.join(' · '))}`);

if (created === 0 && replaced === 0 && linked === 0) {
  console.log(`
  Nothing to do — every harness file already exists.
  Rerun with ${bold('--force')} to overwrite.
`);
} else {
  console.log(`
  ${bold('Next steps')}
  ${dim('1.')} Fill in the placeholders in AGENTS.md — Commands, Architecture, Conventions
  ${dim('2.')} Open docs/start.md — the idea → shipped operating procedure
  ${dim('3.')} Start Claude Code — the harness loads at session start
`);
  if (skipped) {
    console.log(`  ${dim('Skipped files stay untouched — rerun with --force to overwrite.')}\n`);
  }
}
