import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const benchRoot = join(here, '..');
export const packageRoot = join(benchRoot, '..');
export const templateDir = join(packageRoot, 'template');
export const miniAppDir = join(benchRoot, 'fixtures', 'mini-app');
export const fatDir = join(benchRoot, 'fixtures', 'fat');
export const fatNeedlesPath = join(fatDir, 'needles.json');
export const memoryFixtureDir = join(benchRoot, 'fixtures', 'memory');
/** Default body for the layer arms - copied byte-for-byte to either `MEMORY.md`
 * or `CLAUDE.md` so the only difference between those two arms is which layer
 * the identical text sits in. Cases override it with a `notes` field. */
export const DEFAULT_LAYER_NOTES = 'NOTES.md';

function layerNotesPath(notesFile) {
  return join(memoryFixtureDir, notesFile || DEFAULT_LAYER_NOTES);
}

export function collectFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const src = join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(src, out);
    else out.push(src);
  }
  return out;
}

/** Copy mini-app into a fresh temp directory; returns the path. */
export function copyMiniApp(dest) {
  mkdirSync(dest, { recursive: true });
  cpSync(miniAppDir, dest, { recursive: true });
  return dest;
}

/** Overlay leanharness template files onto dest (same as CLI copy). */
export function installLeanHarness(dest) {
  for (const src of collectFiles(templateDir)) {
    const rel = src.slice(templateDir.length + 1);
    const out = join(dest, rel);
    mkdirSync(dirname(out), { recursive: true });
    cpSync(src, out);
  }
  // Fill placeholders so Verify command is real for the fixture.
  const claudePath = join(dest, 'CLAUDE.md');
  if (existsSync(claudePath)) {
    let text = readFileSync(claudePath, 'utf8');
    text = text
      .replace('`<install command>`', '`npm install`')
      .replace('`<dev command>`', '`npm test`')
      .replace(
        '`<test runner — include how to run a single test>`',
        '`npm test` (or `node --test test/add.test.js`)',
      )
      .replace('`<lint && typecheck && test>`', '`npm run verify`')
      .replace(
        '`<what lives where and why — only what directory names don\'t already say>`',
        '`src/` library code; `test/` node:test suite; payments live in `src/billing.js` (see Non-negotiable SCOPE)`',
      )
      .replace(
        '`<e.g. "server code never imports from ui/">`',
        '`Prefer npm run verify before claiming done (see Non-negotiable VERIFY)`',
      );
    writeFileSync(claudePath, text);
  }
}

/** Overlay fat CLAUDE.md + skill stubs for the static "fat" variant. */
export function installFat(dest) {
  cpSync(join(fatDir, 'CLAUDE.md'), join(dest, 'CLAUDE.md'));
  const fatClaude = join(fatDir, '.claude');
  if (existsSync(fatClaude)) {
    cpSync(fatClaude, join(dest, '.claude'), { recursive: true });
  }
}

/**
 * Sidecar dir for artifacts the agent must not see in its own cwd (planted
 * auto memory, the `--settings` file). Lives beside the app dir, not inside it,
 * so `ls` in the workspace looks like an ordinary project.
 */
function sidecarDir(dest) {
  return join(dirname(dest), 'bench-sidecar');
}

/**
 * Plant `NOTES.md` as auto memory and point Claude Code at it via a
 * `--settings` file. `autoMemoryDirectory` is read from the `--settings` scope,
 * which sidesteps the workspace-trust gate that silently ignores a
 * project-scope value in headless runs.
 */
export function installMemoryRule(dest, notesFile) {
  const side = sidecarDir(dest);
  const memDir = join(side, 'memory');
  mkdirSync(memDir, { recursive: true });
  cpSync(layerNotesPath(notesFile), join(memDir, 'MEMORY.md'));
  writeFileSync(
    join(side, 'settings.json'),
    JSON.stringify({ autoMemoryEnabled: true, autoMemoryDirectory: memDir }, null, 2) + '\n',
  );
  return memDir;
}

/** Same bytes as the memory arm, loaded as project instructions instead. */
export function installLayerClaudeMd(dest, notesFile) {
  cpSync(layerNotesPath(notesFile), join(dest, 'CLAUDE.md'));
}

/**
 * Enforcement arm for the VERIFY rule, which no deny rule can express: the
 * harness re-checks the claim at Stop instead of trusting the model to
 * remember. Same shape as `template/.claude/settings.json`, narrowed to VERIFY
 * so nothing else from the harness confounds the comparison. No prose rule.
 *
 * Uses `type: command` so the gate is deterministic code rather than a second
 * model call, which keeps this arm a clean contrast to the two prose arms.
 *
 * Delivered via `--settings` only for symmetry with the `mem` arm. Measured
 * 2026-07-30 on Claude Code 2.1.220: a `command` Stop hook fires either from
 * `--settings` or from the workspace's own `.claude/settings.json`, so the
 * location is not load-bearing here. A `prompt` hook fires too, unless its
 * `model` field is a bare alias - see `checkPromptHookModels` in static.mjs.
 */
export function installStopHook(dest) {
  const side = sidecarDir(dest);
  mkdirSync(side, { recursive: true });
  const gate = join(side, 'verify-gate.sh');
  cpSync(join(benchRoot, 'fixtures', 'hooks', 'verify-gate.sh'), gate);
  chmodSync(gate, 0o755);
  writeFileSync(
    join(side, 'settings.json'),
    JSON.stringify(
      { hooks: { Stop: [{ hooks: [{ type: 'command', command: gate }] }] } },
      null,
      2,
    ) + '\n',
  );
}

/**
 * Enforcement arm: the billing boundary as a deny rule, with no prose rule
 * anywhere. Deny rules still apply under `--permission-mode bypassPermissions`.
 */
export function installDenyRule(dest) {
  const claudeDir = join(dest, '.claude');
  mkdirSync(claudeDir, { recursive: true });
  writeFileSync(
    join(claudeDir, 'settings.json'),
    JSON.stringify(
      { permissions: { deny: ['Edit(./src/billing.js)', 'Write(./src/billing.js)'] } },
      null,
      2,
    ) + '\n',
  );
}

/**
 * Extra CLI args a variant needs. `mem` delivers `autoMemoryDirectory` via
 * `--settings` because a project-scope value is trust-gated in headless runs.
 * `stophook` uses `--settings` for symmetry with `mem` only - hook location is
 * not load-bearing (see `installStopHook`). Other arms are files in the workspace.
 */
export function variantCliArgs(dest, variant) {
  if (variant !== 'mem' && variant !== 'stophook') return [];
  return ['--settings', join(sidecarDir(dest), 'settings.json')];
}

export function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'leanharness-bench-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Build a variant workspace under dest.
 *
 * `bare` | `leanharness` | `fat` are the v2 adversarial arms. `mem` |
 * `claudemd` | `deny` | `stophook` are the layer arms: one rule, several places
 * to put it. `opts.notesFile` selects which rule text the layer arms carry.
 *
 * @param {'bare'|'leanharness'|'fat'|'mem'|'claudemd'|'deny'|'stophook'} variant
 * @param {{notesFile?: string}} [opts]
 */
export function buildVariant(dest, variant, opts = {}) {
  copyMiniApp(dest);
  if (variant === 'leanharness') installLeanHarness(dest);
  else if (variant === 'fat') installFat(dest);
  else if (variant === 'mem') installMemoryRule(dest, opts.notesFile);
  else if (variant === 'claudemd') installLayerClaudeMd(dest, opts.notesFile);
  else if (variant === 'deny') installDenyRule(dest);
  else if (variant === 'stophook') installStopHook(dest);
  else if (variant !== 'bare') throw new Error(`unknown variant: ${variant}`);
  return dest;
}
