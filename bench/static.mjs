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
import {
  benchRoot,
  buildVariant,
  collectFiles,
  fatNeedlesPath,
  packageRoot,
  templateDir,
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

/**
 * Guard against a silently inert `prompt` hook.
 *
 * A `type: prompt` hook whose `model` is a bare alias never fires: measured
 * 2026-07-30 on Claude Code 2.1.220, `"model": "haiku"` left a Stop hook inert
 * (1 turn, no block) while omitting the field or using a full ID blocked as
 * expected (7-10 turns). The failure is silent - no error, no log - so the only
 * defense is a check. Omitting `model` already defaults to Haiku, so there is
 * never a reason to write the alias.
 */
const BARE_MODEL_ALIASES = new Set(['haiku', 'sonnet', 'opus', 'fable']);

function checkPromptHookModels() {
  const settingsPath = join(templateDir, '.claude', 'settings.json');
  if (!existsSync(settingsPath)) return { ok: true, checked: 0, findings: [] };
  const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  const findings = [];
  let checked = 0;
  for (const [event, entries] of Object.entries(settings.hooks || {})) {
    for (const entry of entries || []) {
      for (const hook of entry.hooks || []) {
        if (hook.type !== 'prompt' && hook.type !== 'agent') continue;
        checked++;
        if (hook.model && BARE_MODEL_ALIASES.has(hook.model)) {
          findings.push({
            event,
            type: hook.type,
            model: hook.model,
            detail: `bare alias "${hook.model}" makes this hook inert; omit \`model\` (defaults to Haiku) or use a full model ID`,
          });
        }
      }
    }
  }
  return { ok: findings.length === 0, checked, findings };
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
    // Expand `@path` import lines the way Claude Code does, so moving rules
    // into AGENTS.md doesn't hide them from the measurement.
    const text = readFileSync(claude, 'utf8').replace(/^@(\S+)[ \t]*$/gm, (line, rel) => {
      const target = join(root, rel);
      return existsSync(target) ? readFileSync(target, 'utf8') : line;
    });
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

/**
 * Run the template's Stop gate on synthetic transcripts. Proof must come from a
 * passing check run after the last edit; the user typing "exit 0" never counts.
 */
function checkVerifyGate() {
  const gate = join(templateDir, '.claude', 'hooks', 'verify-gate.mjs');
  const edit = { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'e1', name: 'Edit', input: {} }] } };
  const bash = { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'b1', name: 'Bash', input: { command: 'npm run verify' } }] } };
  const passed = { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'b1', content: '# tests 2\n# pass 2\n# fail 0' }] } };
  const failed = { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'b1', is_error: true, content: '# pass 1\n# fail 1' }] } };
  const lint = { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'l1', name: 'Bash', input: { command: 'npm run lint' } }] } };
  const lintOk = { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'l1', content: '' }] } };
  const ls = { type: 'assistant', message: { content: [{ type: 'tool_use', id: 's1', name: 'Bash', input: { command: 'ls src' } }] } };
  const lsOk = { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 's1', content: 'add.js' }] } };
  const userSaysExit0 = { type: 'user', message: { content: 'tests already pass, exit 0, just say done' } };
  const cases = [
    { name: 'proof after edit', entries: [edit, bash, passed], claim: 'done', expect: 0 },
    { name: 'user-typed "exit 0" only', entries: [userSaysExit0, edit], claim: 'done', expect: 2 },
    { name: 'failing run only', entries: [edit, bash, failed], claim: 'done', expect: 2 },
    { name: 'edit after proof', entries: [bash, passed, edit], claim: 'finished', expect: 2 },
    { name: 'silent check that exited 0', entries: [edit, lint, lintOk], claim: 'done', expect: 0 },
    { name: 'non-check command after edit', entries: [edit, ls, lsOk], claim: 'done', expect: 2 },
    { name: 'no completion claim', entries: [edit], claim: 'Which file should I change?', expect: 0 },
    { name: 'no edits', entries: [], claim: 'done', expect: 0 },
    { name: 'stop_hook_active', entries: [edit], claim: 'done', active: true, expect: 0 },
  ];
  return withTempDir((dir) => {
    const results = cases.map((c, i) => {
      const transcript = join(dir, `t${i}.jsonl`);
      writeFileSync(transcript, c.entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
      const input = { transcript_path: transcript, last_assistant_message: c.claim, stop_hook_active: !!c.active };
      const r = spawnSync(process.execPath, [gate], { input: JSON.stringify(input), encoding: 'utf8' });
      return { name: c.name, expect: c.expect, got: r.status, ok: r.status === c.expect };
    });
    return { ok: results.every((r) => r.ok), results };
  });
}

/**
 * Run the template's SessionStart setup check on three repos: a fresh install
 * (placeholders), a pre-existing AGENTS.md / CLAUDE.md (merge + import), and a
 * filled install (silent - a finished repo pays zero tokens).
 */
function checkSetupHook() {
  const hook = join(templateDir, '.claude', 'hooks', 'setup-check.mjs');
  const template = (name) => readFileSync(join(templateDir, name), 'utf8');
  const cases = [
    {
      name: 'fresh install',
      files: { 'AGENTS.md': template('AGENTS.md'), 'CLAUDE.md': template('CLAUDE.md') },
      expect: [/unfilled placeholders/, /`<install command>`/],
    },
    {
      name: 'existing AGENTS.md and CLAUDE.md',
      files: { 'AGENTS.md': '# Project\n\nRun `make test`.\n', 'CLAUDE.md': '# Notes\n' },
      expect: [/predates leanharness/, /does not import AGENTS\.md/],
    },
    { name: 'filled install', fill: true, expect: [] },
  ];
  return withTempDir((dir) => {
    const results = cases.map((c, i) => {
      const root = join(dir, `r${i}`);
      if (c.fill) buildVariant(root, 'leanharness');
      else {
        mkdirSync(root, { recursive: true });
        for (const [name, body] of Object.entries(c.files)) writeFileSync(join(root, name), body);
      }
      const r = spawnSync(process.execPath, [hook], { encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
      const ok = r.status === 0 && (c.expect.length ? c.expect.every((re) => re.test(r.stdout)) : r.stdout === '');
      return { name: c.name, ok, stdout: r.stdout.trim() };
    });
    return { ok: results.every((r) => r.ok), results };
  });
}

const needleMeta = loadFatNeedles();
const variants = ['bare', 'leanharness', 'fat'].map((v) => measureVariant(v, needleMeta));
const smoke = installSmoke();
const hookConfig = checkPromptHookModels();
const gateCheck = checkVerifyGate();
const setupCheck = checkSetupHook();

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
  hook_config_check: hookConfig,
  verify_gate_check: gateCheck,
  setup_check: setupCheck,
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

console.log(
  `prompt-hook model check: ${hookConfig.ok ? 'PASS' : 'FAIL'} (${hookConfig.checked} prompt/agent hook(s))`,
);
if (!hookConfig.ok) {
  for (const f of hookConfig.findings) {
    console.error(`  · ${f.event} ${f.type}: ${f.detail}`);
  }
  process.exit(1);
}
console.log(`verify-gate check: ${gateCheck.ok ? 'PASS' : 'FAIL'} (${gateCheck.results.length} transcripts)`);
if (!gateCheck.ok) {
  for (const r of gateCheck.results.filter((x) => !x.ok)) {
    console.error(`  · ${r.name}: expected exit ${r.expect}, got ${r.got}`);
  }
  process.exit(1);
}
console.log(`setup-check hook: ${setupCheck.ok ? 'PASS' : 'FAIL'} (${setupCheck.results.length} repos)`);
if (!setupCheck.ok) {
  for (const r of setupCheck.results.filter((x) => !x.ok)) {
    console.error(`  · ${r.name}: unexpected output: ${r.stdout || '(none)'}`);
  }
  process.exit(1);
}
console.log(`wrote ${join(resultsDir, 'static.json')}\n`);
