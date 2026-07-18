#!/usr/bin/env node
/**
 * Static bench: always-loaded token/instruction tax + install smoke.
 * Zero network. Writes bench/results/static.json and prints a markdown table.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  benchRoot,
  buildVariant,
  collectFiles,
  fatNeedlesPath,
  packageRoot,
  withTempDir,
} from './lib/install.mjs';
import {
  approxTokens,
  countInstructions,
  frontmatterDescription,
} from './lib/tokens.mjs';

function loadFatNeedles() {
  if (!existsSync(fatNeedlesPath)) return null;
  return JSON.parse(readFileSync(fatNeedlesPath, 'utf8'));
}

/** Locate NEEDLE_* markers in a CLAUDE.md (for lost-instruction experiments). */
function findNeedles(root, needleMeta) {
  const claude = join(root, 'CLAUDE.md');
  if (!existsSync(claude) || !needleMeta?.needles) return null;
  const lines = readFileSync(claude, 'utf8').split(/\r?\n/);
  return needleMeta.needles.map((n) => {
    const idx = lines.findIndex((l) => l.includes(n.id));
    return {
      id: n.id,
      present: idx >= 0,
      line: idx >= 0 ? idx + 1 : null,
      rule: n.rule,
    };
  });
}

const resultsDir = join(benchRoot, 'results');
mkdirSync(resultsDir, { recursive: true });

function alwaysLoadedPayload(root) {
  const chunks = [];
  const files = [];

  const claude = join(root, 'CLAUDE.md');
  if (existsSync(claude)) {
    const text = readFileSync(claude, 'utf8');
    chunks.push(text);
    files.push({ path: 'CLAUDE.md', chars: text.length });
  }

  const settings = join(root, '.claude', 'settings.json');
  if (existsSync(settings)) {
    const text = readFileSync(settings, 'utf8');
    chunks.push(text);
    files.push({ path: '.claude/settings.json', chars: text.length });
  }

  const agentsDir = join(root, '.claude', 'agents');
  for (const src of collectFiles(agentsDir)) {
    const text = readFileSync(src, 'utf8');
    const desc = frontmatterDescription(text);
    // Agent name + description load at startup; body is on-demand.
    const name = relative(agentsDir, src).replace(/\.md$/, '');
    const payload = `agent:${name}\n${desc}`;
    chunks.push(payload);
    files.push({ path: relative(root, src), chars: payload.length, kind: 'agent-desc' });
  }

  const skillsDir = join(root, '.claude', 'skills');
  for (const src of collectFiles(skillsDir)) {
    if (!src.endsWith('SKILL.md')) continue;
    const text = readFileSync(src, 'utf8');
    const desc = frontmatterDescription(text);
    const name = relative(skillsDir, dirname(src));
    const payload = `skill:${name}\n${desc}`;
    chunks.push(payload);
    files.push({ path: relative(root, src), chars: payload.length, kind: 'skill-desc' });
  }

  const combined = chunks.join('\n\n');
  return {
    chars: combined.length,
    approx_tokens: approxTokens(combined),
    instructions: countInstructions(combined),
    files,
  };
}

function measureVariant(variant, needleMeta) {
  return withTempDir((dir) => {
    const root = join(dir, 'app');
    buildVariant(root, variant);
    const payload = alwaysLoadedPayload(root);
    const needles = variant === 'fat' ? findNeedles(root, needleMeta) : null;
    return { variant, ...payload, needles };
  });
}

function installSmoke() {
  const dir = mkdtempSync(join(tmpdir(), 'leanharness-smoke-'));
  const cli = join(packageRoot, 'bin', 'cli.js');
  const run = (args = []) =>
    spawnSync(process.execPath, [cli, ...args], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
    });

  try {
    const first = run();
    if (first.status !== 0) {
      return { ok: false, error: `first install exit ${first.status}`, stderr: first.stderr };
    }
    const created = (first.stdout.match(/\+ created/g) || []).length;
    if (created < 10) {
      return { ok: false, error: `expected ≥10 created, got ${created}`, stdout: first.stdout };
    }

    const second = run();
    if (second.status !== 0) {
      return { ok: false, error: `second install exit ${second.status}`, stderr: second.stderr };
    }
    if (!/Nothing to do|skipped/i.test(second.stdout)) {
      return { ok: false, error: 'second run should skip existing files', stdout: second.stdout };
    }
    if (/\+ created/i.test(second.stdout) && !/0 created/.test(second.stdout)) {
      // allow "0 created" summary; fail if new creates appeared
      const created2 = (second.stdout.match(/\+ created/g) || []).length;
      if (created2 > 0) {
        return { ok: false, error: `second run created files (${created2})`, stdout: second.stdout };
      }
    }

    // Existing file without --force stays untouched
    const marker = 'KEEP_ME_UNTOUCHED';
    writeFileSync(join(dir, 'AGENTS.md'), marker);
    const third = run();
    const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf8');
    if (agents !== marker) {
      return { ok: false, error: 'AGENTS.md was overwritten without --force' };
    }
    if (!/skipped\s+AGENTS\.md/i.test(third.stdout)) {
      return { ok: false, error: 'expected AGENTS.md to be listed as skipped', stdout: third.stdout };
    }

    return { ok: true, created_first: created };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const needleMeta = loadFatNeedles();
const variants = ['bare', 'leanharness', 'fat'].map((v) => measureVariant(v, needleMeta));
const smoke = installSmoke();

const lean = variants.find((v) => v.variant === 'leanharness');
const fat = variants.find((v) => v.variant === 'fat');
const report = {
  generatedAt: new Date().toISOString(),
  token_method: 'approx chars/4',
  note:
    'fat/CLAUDE.md is a realistic bloated instruction file with NEEDLE_* rules; compare behavioral adherence on those needles vs leanharness.',
  variants,
  comparison:
    lean && fat
      ? {
          fat_vs_lean_token_ratio: Number((fat.approx_tokens / Math.max(lean.approx_tokens, 1)).toFixed(2)),
          fat_extra_approx_tokens: fat.approx_tokens - lean.approx_tokens,
          fat_extra_instructions: fat.instructions - lean.instructions,
          fat_needles_present: (fat.needles || []).filter((n) => n.present).length,
          fat_needles_total: (fat.needles || []).length,
        }
      : null,
  install_smoke: smoke,
};

writeFileSync(join(resultsDir, 'static.json'), JSON.stringify(report, null, 2) + '\n');

const pad = (s, n) => String(s).padEnd(n);
console.log('\nleanharness static bench\n');
console.log(
  `| ${pad('variant', 14)} | ${pad('approx_tokens', 13)} | ${pad('instructions', 12)} | ${pad('chars', 8)} |`,
);
console.log(`| ${'-'.repeat(14)} | ${'-'.repeat(13)} | ${'-'.repeat(12)} | ${'-'.repeat(8)} |`);
for (const v of variants) {
  console.log(
    `| ${pad(v.variant, 14)} | ${pad(v.approx_tokens, 13)} | ${pad(v.instructions, 12)} | ${pad(v.chars, 8)} |`,
  );
}

if (lean && fat && !(lean.approx_tokens < fat.approx_tokens)) {
  console.error('\nFAIL: leanharness approx_tokens should be << fat');
  process.exit(1);
}

if (fat?.needles) {
  console.log('\nfat NEEDLE_* markers (for adherence experiments):');
  for (const n of fat.needles) {
    console.log(`  ${n.present ? '✓' : '✗'} ${n.id} @ line ${n.line ?? '?'}`);
  }
  if (report.comparison) {
    console.log(
      `\nfat vs leanharness: +${report.comparison.fat_extra_approx_tokens} approx tokens, +${report.comparison.fat_extra_instructions} instructions (${report.comparison.fat_vs_lean_token_ratio}x)`,
    );
  }
}

console.log(`\ninstall smoke: ${smoke.ok ? 'PASS' : 'FAIL'}`);
if (!smoke.ok) {
  console.error(smoke);
  process.exit(1);
}
console.log(`wrote ${join(resultsDir, 'static.json')}\n`);
