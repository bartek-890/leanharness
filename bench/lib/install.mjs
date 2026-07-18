import {
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
 * @param {'bare'|'leanharness'|'fat'} variant
 */
export function buildVariant(dest, variant) {
  copyMiniApp(dest);
  if (variant === 'leanharness') installLeanHarness(dest);
  else if (variant === 'fat') installFat(dest);
  else if (variant !== 'bare') throw new Error(`unknown variant: ${variant}`);
  return dest;
}
