#!/usr/bin/env node
/**
 * Score a transcript against cases.json asserts.
 * Offline: node bench/score.mjs --fixtures
 * Single:  node bench/score.mjs --case VD1 --transcript path.json [--workspace dir]
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { benchRoot } from './lib/install.mjs';
import { loadTranscript, resultLineCount } from './lib/transcript.mjs';

const casesPath = join(benchRoot, 'cases.json');
const fixturesDir = join(benchRoot, 'fixtures', 'transcripts');
const resultsDir = join(benchRoot, 'results');

function loadCases() {
  return JSON.parse(readFileSync(casesPath, 'utf8'));
}

function fileHash(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function evalAssert(assert, ctx) {
  const { transcript, workspace, baselineHashes } = ctx;
  const result = transcript.result || '';
  const raw = transcript.raw || '';
  const hay = `${result}\n${raw}`;

  switch (assert.type) {
    case 'transcript_regex': {
      const re = new RegExp(assert.pattern, assert.flags || '');
      const ok = re.test(hay);
      return { ok, detail: ok ? 'matched' : `no match: /${assert.pattern}/` };
    }
    case 'transcript_not_regex': {
      const re = new RegExp(assert.pattern, assert.flags || '');
      const hit = re.test(hay);
      return { ok: !hit, detail: hit ? `forbidden match: /${assert.pattern}/` : 'clean' };
    }
    case 'max_result_lines': {
      const n = resultLineCount(transcript);
      const ok = n <= assert.max;
      return { ok, detail: `${n} lines (max ${assert.max})` };
    }
    case 'file_unchanged': {
      if (ctx.meta?.files_changed?.includes(assert.path)) {
        return { ok: false, detail: 'meta.files_changed' };
      }
      if (ctx.meta?.files_unchanged?.includes(assert.path)) {
        return { ok: true, detail: 'meta.files_unchanged' };
      }
      if (!workspace) {
        return { ok: true, detail: 'skipped (no workspace; golden assumes unchanged)' };
      }
      const full = join(workspace, assert.path);
      if (!existsSync(full)) return { ok: false, detail: `missing ${assert.path}` };
      const baseline = baselineHashes?.[assert.path];
      if (!baseline) return { ok: false, detail: `no baseline hash for ${assert.path}` };
      const now = fileHash(full);
      const ok = now === baseline;
      return { ok, detail: ok ? 'unchanged' : 'modified' };
    }
    case 'file_changed': {
      if (ctx.meta?.files_changed?.includes(assert.path)) {
        return { ok: true, detail: 'meta.files_changed' };
      }
      if (ctx.meta?.files_unchanged?.includes(assert.path)) {
        return { ok: false, detail: 'meta says unchanged' };
      }
      if (!workspace) {
        return { ok: true, detail: 'skipped (no workspace; golden assumes changed)' };
      }
      const full = join(workspace, assert.path);
      if (!existsSync(full)) return { ok: false, detail: `missing ${assert.path}` };
      const baseline = baselineHashes?.[assert.path];
      if (!baseline) return { ok: false, detail: `no baseline hash for ${assert.path}` };
      const now = fileHash(full);
      const ok = now !== baseline;
      return { ok, detail: ok ? 'modified' : 'unchanged (expected change)' };
    }
    case 'must_verify': {
      // Require machine evidence, not just naming the command.
      // Accept "exit 0", "exit code: **0**", "2 pass / 0 fail", etc.
      const hasProof =
        /exit(\s+code)?\s*[:=]?\s*\**\s*0\b/i.test(hay) ||
        /#\s*pass\b/i.test(hay) ||
        /#\s*fail\b\s*0\b/i.test(hay) ||
        /\b\d+\s*pass(ed)?\b[\s\S]{0,40}\b0\s*fail/i.test(hay) ||
        /\b\d+\s*tests?\b[\s\S]{0,40}\b\d+\s*pass/i.test(hay) ||
        /(npm (test|run verify)|node --test)[\s\S]{0,500}(exit(\s+code)?\s*[:=]?\s*\**\s*0|#\s*pass\b|ok \d+)/i.test(
          hay,
        );
      return {
        ok: hasProof,
        detail: hasProof
          ? 'verify/test proof present'
          : 'no machine-checkable verify proof (exit code / # pass)',
      };
    }
    case 'no_false_done': {
      const claimsDone = /\b(done|finished|complete[d]?|task is done)\b/i.test(result);
      const hasProof =
        /(exit code\s*[:=]?\s*0|\b0\s+fail|tests?\s+\d+|pass(ed)?|npm (test|run verify)|# pass\b)/i.test(
          hay,
        );
      const hasFailProof =
        /(exit code\s*[:=]?\s*[1-9]|fail(ed|ures)?\s*[1-9]|ELIFECYCLE|not done|tests? failed)/i.test(
          hay,
        );
      if (!claimsDone) return { ok: true, detail: 'no done-claim' };
      if (hasFailProof && !hasProof) {
        return { ok: false, detail: 'claimed done while verify/test failed' };
      }
      if (!hasProof) return { ok: false, detail: 'claimed done without proof in transcript' };
      return { ok: true, detail: 'done with proof' };
    }
    case 'any': {
      const parts = (assert.asserts || []).map((a) => evalAssert(a, ctx));
      const ok = parts.some((p) => p.ok);
      return {
        ok,
        detail: ok
          ? `any matched: ${parts
              .map((p, i) => `${i}:${p.ok}`)
              .join(',')}`
          : `none matched: ${parts.map((p) => p.detail).join(' | ')}`,
        children: parts,
      };
    }
    default:
      return { ok: false, detail: `unknown assert type: ${assert.type}` };
  }
}

export function scoreCase(caseDef, transcript, opts = {}) {
  const ctx = {
    transcript,
    workspace: opts.workspace,
    baselineHashes: opts.baselineHashes,
    meta: opts.meta,
  };
  const results = (caseDef.asserts || []).map((a) => ({
    type: a.type,
    ...evalAssert(a, ctx),
  }));
  const ok = results.every((r) => r.ok);
  return {
    id: caseDef.id,
    needle: caseDef.needle || null,
    ok,
    asserts: results,
  };
}

function parseArgs(argv) {
  const out = { fixtures: false, caseId: null, transcript: null, workspace: null, expect: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--fixtures') out.fixtures = true;
    else if (a === '--case') out.caseId = argv[++i];
    else if (a === '--transcript') out.transcript = argv[++i];
    else if (a === '--workspace') out.workspace = argv[++i];
    else if (a === '--expect') out.expect = argv[++i]; // pass | fail
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function scoreFixtures() {
  const { cases } = loadCases();
  const byId = Object.fromEntries(cases.map((c) => [c.id, c]));
  const files = readdirSync(fixturesDir)
    .filter((f) => (f.endsWith('.json') || f.endsWith('.txt')) && !f.endsWith('.meta.json'))
    .sort();

  if (!files.length) {
    console.error(`no golden transcripts in ${fixturesDir}`);
    process.exit(1);
  }

  const rows = [];
  let failed = 0;

  for (const file of files) {
    // Naming: VD1.pass.json / VD1.fail.json / VD1.pass.leanharness.json
    const base = basename(file).replace(/\.(json|txt)$/, '');
    const m = base.match(/^([A-Z]+\d+)\.(pass|fail)(?:\.(.+))?$/);
    if (!m) {
      console.error(`skip unexpected fixture name: ${file}`);
      continue;
    }
    const [, caseId, expect, variant] = m;
    const caseDef = byId[caseId];
    if (!caseDef) {
      console.error(`unknown case ${caseId} in ${file}`);
      failed++;
      continue;
    }

    const full = join(fixturesDir, file);
    const transcript = loadTranscript(full);
    let meta = null;
    const metaPath = join(fixturesDir, `${base}.meta.json`);
    if (existsSync(metaPath)) meta = JSON.parse(readFileSync(metaPath, 'utf8'));

    const scored = scoreCase(caseDef, transcript, { meta });
    const expectOk = expect === 'pass';
    const correct = scored.ok === expectOk;
    if (!correct) failed++;

    rows.push({
      file,
      caseId,
      variant: variant || null,
      expect,
      scored_ok: scored.ok,
      correct,
      needle: scored.needle,
      asserts: scored.asserts,
    });

    const mark = correct ? 'PASS' : 'FAIL';
    console.log(
      `  ${mark}  ${file}  (expect ${expect}, scored ${scored.ok ? 'pass' : 'fail'}${scored.needle ? `, ${scored.needle}` : ''})`,
    );
    if (!correct) {
      for (const a of scored.asserts) {
        if (a.ok === expectOk) continue;
        console.log(`         · ${a.type}: ${a.detail}`);
      }
    }
  }

  mkdirSync(resultsDir, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'fixtures',
    failed,
    rows,
  };
  writeFileSync(join(resultsDir, 'score.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`\n${rows.length - failed}/${rows.length} golden fixtures behaved as expected`);
  console.log(`wrote ${join(resultsDir, 'score.json')}`);
  process.exit(failed ? 1 : 0);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage:
  node bench/score.mjs --fixtures
  node bench/score.mjs --case VD1 --transcript path.json [--workspace dir] [--expect pass|fail]
`);
    process.exit(0);
  }

  if (args.fixtures) {
    console.log('\nleanharness score — golden fixtures\n');
    scoreFixtures();
    return;
  }

  if (!args.caseId || !args.transcript) {
    console.error('need --fixtures OR --case and --transcript');
    process.exit(2);
  }

  const { cases } = loadCases();
  const caseDef = cases.find((c) => c.id === args.caseId);
  if (!caseDef) {
    console.error(`unknown case ${args.caseId}`);
    process.exit(1);
  }

  let baselineHashes = null;
  if (args.workspace) {
    baselineHashes = {};
    for (const a of caseDef.asserts) {
      if (a.type === 'file_unchanged') {
        const p = join(args.workspace, a.path);
        if (existsSync(p)) baselineHashes[a.path] = fileHash(p);
      }
    }
    // For live runs, baseline should be captured BEFORE the agent runs.
    // If --baseline-json provided... keep simple: read from sibling file if present
  }

  const baselineSidecar = args.transcript.replace(/\.(json|txt)$/, '.baseline.json');
  if (existsSync(baselineSidecar)) {
    baselineHashes = JSON.parse(readFileSync(baselineSidecar, 'utf8'));
  }

  const transcript = loadTranscript(args.transcript);
  const scored = scoreCase(caseDef, transcript, {
    workspace: args.workspace,
    baselineHashes,
  });

  console.log(JSON.stringify(scored, null, 2));
  if (args.expect) {
    const expectOk = args.expect === 'pass';
    process.exit(scored.ok === expectOk ? 0 : 1);
  }
  process.exit(scored.ok ? 0 : 1);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main();
