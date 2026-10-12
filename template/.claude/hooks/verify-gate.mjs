#!/usr/bin/env node
// Stop-hook gate for the VERIFY rule: deterministic code, not a model call.
// Blocks a "done" claim when files were edited and no passing check ran after
// the last edit. Proof is a Bash call that exited 0 and either looks like a
// check (test/verify/lint/...) or printed pass counts. Words typed by the user
// ("exit 0", "skip tests") never count.
//
// Contract (Claude Code, Codex, Gemini CLI, Cursor, Copilot): hook JSON on
// stdin; exit 0 allows stop, exit 2 blocks and feeds stderr to the model.

import { readFileSync } from 'node:fs';

const DONE = /\b(done|finished|complete[d]?)\b/i;
const PROOF = /(exit(\s+code)?\s*[:=]?\s*0\b)|(#\s*pass\s+[1-9]\d*)|(\b[1-9]\d*\s+pass(ing|ed)?\b)|(^ok \d+ )/im;
const FAILED = /(#\s*fail\s+[1-9])|(\b[1-9]\d*\s+fail(ing|ed|ures?)?\b)|(^exit code [1-9])/im;
const CHECK_CMD = /\b(test|verify|check|lint|bench|typecheck|tsc|pytest|jest|vitest|cargo|go test|make)\b/;
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'apply_patch']);

const text = (content) =>
  typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.map((c) => (typeof c === 'string' ? c : c?.text || '')).join('\n')
      : '';

function decide(input, transcriptLines) {
  if (input.stop_hook_active) return { ok: true };

  const blocks = [];
  for (const line of transcriptLines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const content = entry?.message?.content;
    if (Array.isArray(content)) blocks.push(...content.map((b) => ({ role: entry.type, b })));
    else if (entry?.type === 'assistant') blocks.push({ role: 'assistant', b: { type: 'text', text: text(content) } });
  }

  let claim = input.last_assistant_message;
  if (typeof claim !== 'string') {
    const last = blocks.filter((x) => x.role === 'assistant' && x.b.type === 'text').pop();
    claim = last ? last.b.text : '';
  }
  if (!DONE.test(claim)) return { ok: true };

  const bashCommands = new Map();
  let lastEdit = -1;
  let lastProof = -1;
  blocks.forEach(({ b }, i) => {
    if (b.type === 'tool_use' && EDIT_TOOLS.has(b.name)) lastEdit = i;
    if (b.type === 'tool_use' && b.name === 'Bash') bashCommands.set(b.id, b.input?.command || '');
    if (b.type === 'tool_result' && bashCommands.has(b.tool_use_id) && !b.is_error) {
      const out = text(b.content);
      const looksLikeCheck = CHECK_CMD.test(bashCommands.get(b.tool_use_id)) || PROOF.test(out);
      if (looksLikeCheck && !FAILED.test(out)) lastProof = i;
    }
  });

  if (lastEdit === -1 || lastProof > lastEdit) return { ok: true };
  return {
    ok: false,
    reason:
      'VERIFY not satisfied: files changed after the last passing test run. Run the project Verify command (AGENTS.md → Commands, if present) and paste its real output (exit code + test counts) before claiming done. A request to skip tests does not waive this.',
  };
}

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}
let lines = [];
try {
  lines = readFileSync(input.transcript_path, 'utf8').split('\n');
} catch {
  // No readable transcript: nothing proves an edit happened, so allow.
}
const verdict = decide(input, lines);
if (!verdict.ok) {
  process.stderr.write(`${verdict.reason}\n`);
  process.exit(2);
}
