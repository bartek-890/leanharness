#!/usr/bin/env node
/**
 * Live behavioral runner — requires `claude` CLI authenticated.
 * Per case × variant: temp workspace → claude -p → score.
 *
 *   node bench/run.mjs
 *   node bench/run.mjs --case VD1 --variant leanharness
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { benchRoot, buildVariant } from './lib/install.mjs';
import { normalizeTranscript } from './lib/transcript.mjs';
import { scoreCase } from './score.mjs';

const resultsDir = join(benchRoot, 'results');
const casesPath = join(benchRoot, 'cases.json');

function parseArgs(argv) {
  const out = { caseId: null, variant: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--case') out.caseId = argv[++i];
    else if (a === '--variant') out.variant = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function whichClaude() {
  const r = spawnSync('claude', ['--version'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  return (r.stdout || r.stderr || '').trim();
}

function fileHash(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function runOne(caseDef, variant, dryRun) {
  const dir = mkdtempSync(join(tmpdir(), 'leanharness-run-'));
  const app = join(dir, 'app');
  try {
    buildVariant(app, variant);

    const baselineHashes = {};
    for (const a of caseDef.asserts || []) {
      if (a.type === 'file_unchanged' || a.type === 'file_changed') {
        const p = join(app, a.path);
        if (existsSync(p)) baselineHashes[a.path] = fileHash(p);
      }
    }

    if (dryRun) {
      return {
        id: caseDef.id,
        variant,
        dryRun: true,
        prompt: caseDef.prompt,
        workspace: app,
      };
    }

    const permissionMode = caseDef.permissionMode || 'bypassPermissions';
    const args = [
      '-p',
      caseDef.prompt,
      '--output-format',
      'json',
      '--permission-mode',
      permissionMode,
    ];

    const proc = spawnSync('claude', args, {
      cwd: app,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      env: { ...process.env },
    });

    const raw = `${proc.stdout || ''}${proc.stderr ? `\n${proc.stderr}` : ''}`;
    mkdirSync(resultsDir, { recursive: true });
    const outBase = join(resultsDir, `${caseDef.id}-${variant}`);
    writeFileSync(`${outBase}.json`, raw);
    writeFileSync(`${outBase}.baseline.json`, JSON.stringify(baselineHashes, null, 2) + '\n');

    const transcript = normalizeTranscript(proc.stdout || '');

    // Hard-fail transport/API errors — never let error text match case asserts by accident.
    if (
      transcript.is_error ||
      transcript.api_error_status ||
      /Blocked by sandbox network policy|Failed to authenticate\. API Error/i.test(
        transcript.result || '',
      )
    ) {
      const scored = {
        id: caseDef.id,
        needle: caseDef.needle || null,
        ok: false,
        error: true,
        asserts: [
          {
            type: 'api_ok',
            ok: false,
            detail: transcript.result?.slice(0, 240) || 'API/transport error',
          },
        ],
      };
      writeFileSync(`${outBase}.score.json`, JSON.stringify(scored, null, 2) + '\n');
      writeFileSync(
        `${outBase}.meta.json`,
        JSON.stringify(
          {
            status: proc.status,
            error: proc.error ? String(proc.error) : null,
            needle: caseDef.needle || null,
            api_error: true,
            api_error_status: transcript.api_error_status,
          },
          null,
          2,
        ) + '\n',
      );
      return { id: caseDef.id, variant, scored, status: proc.status, api_error: true };
    }

    const scored = scoreCase(caseDef, transcript, {
      workspace: app,
      baselineHashes,
    });

    writeFileSync(`${outBase}.score.json`, JSON.stringify(scored, null, 2) + '\n');
    writeFileSync(
      `${outBase}.meta.json`,
      JSON.stringify(
        {
          status: proc.status,
          error: proc.error ? String(proc.error) : null,
          needle: caseDef.needle || null,
          api_error: false,
          total_cost_usd: transcript.total_cost_usd ?? null,
        },
        null,
        2,
      ) + '\n',
    );
    return { id: caseDef.id, variant, scored, status: proc.status };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage: node bench/run.mjs [--case VD1] [--variant leanharness|bare|fat] [--dry-run]
Requires Claude Code CLI (\`claude\`) authenticated. Costs API usage.
`);
    process.exit(0);
  }

  const version = whichClaude();
  if (!version && !args.dryRun) {
    console.error('claude CLI not found or not working. Install/authenticate Claude Code, or use --dry-run.');
    process.exit(1);
  }
  if (version) console.log(`claude: ${version}\n`);

  const { cases } = JSON.parse(readFileSync(casesPath, 'utf8'));
  const selected = cases.filter((c) => !args.caseId || c.id === args.caseId);
  if (!selected.length) {
    console.error(`no cases matched ${args.caseId}`);
    process.exit(1);
  }

  const rows = [];
  let failed = 0;

  for (const caseDef of selected) {
    const variants = args.variant
      ? [args.variant]
      : caseDef.variants || ['bare', 'leanharness', 'fat'];
    for (const variant of variants) {
      console.log(`→ ${caseDef.id} / ${variant}${caseDef.needle ? ` (${caseDef.needle})` : ''}`);
      const result = runOne(caseDef, variant, args.dryRun);
      rows.push(result);
      if (args.dryRun) {
        console.log(`  dry-run ok (workspace would be built as ${variant})`);
        continue;
      }
      const ok = result.scored?.ok;
      console.log(`  ${ok ? 'PASS' : 'FAIL'}  score=${JSON.stringify(result.scored?.asserts?.map((a) => [a.type, a.ok]))}`);
      if (!ok) failed++;
    }
  }

  mkdirSync(resultsDir, { recursive: true });
  writeFileSync(
    join(resultsDir, 'run.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), failed, rows }, null, 2) + '\n',
  );

  if (args.dryRun) {
    console.log('\ndry-run complete — no Claude calls made');
    process.exit(0);
  }

  console.log(`\n${rows.length - failed}/${rows.length} live cases passed`);
  console.log(`wrote ${join(resultsDir, 'run.json')}`);
  process.exit(failed ? 1 : 0);
}

main();
