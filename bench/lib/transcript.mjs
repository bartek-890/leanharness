import { readFileSync } from 'node:fs';

/**
 * Normalize a Claude Code headless transcript into a common shape.
 * Accepts: plain text, single JSON result, or NDJSON stream-json lines.
 */
export function normalizeTranscript(raw) {
  const text = typeof raw === 'string' ? raw : String(raw ?? '');
  const trimmed = text.trim();
  if (!trimmed) {
    return { result: '', events: [], raw: text };
  }

  // Single JSON object (claude -p --output-format json)
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed);
      return {
        result: extractResult(obj),
        events: Array.isArray(obj.events) ? obj.events : [obj],
        usage: obj.usage,
        total_cost_usd: obj.total_cost_usd,
        is_error: Boolean(obj.is_error),
        api_error_status: obj.api_error_status ?? null,
        raw: text,
        parsed: obj,
      };
    } catch {
      // fall through — may be stream-json first line only incomplete
    }
  }

  // NDJSON / stream-json
  if (trimmed.includes('\n') && trimmed.split('\n').some((l) => l.trim().startsWith('{'))) {
    const events = [];
    for (const line of trimmed.split(/\r?\n/)) {
      const t = line.trim();
      if (!t.startsWith('{')) continue;
      try {
        events.push(JSON.parse(t));
      } catch {
        /* ignore bad lines */
      }
    }
    if (events.length) {
      const resultEvent = [...events].reverse().find((e) => e.type === 'result' || e.result);
      return {
        result: resultEvent ? extractResult(resultEvent) : events.map(extractResult).filter(Boolean).join('\n'),
        events,
        usage: resultEvent?.usage,
        total_cost_usd: resultEvent?.total_cost_usd,
        raw: text,
      };
    }
  }

  return { result: text, events: [], raw: text };
}

function extractResult(obj) {
  if (!obj || typeof obj !== 'object') return '';
  if (typeof obj.result === 'string') return obj.result;
  if (typeof obj.message === 'string') return obj.message;
  if (typeof obj.content === 'string') return obj.content;
  if (Array.isArray(obj.content)) {
    return obj.content
      .filter((b) => b && b.type === 'text')
      .map((b) => b.text)
      .join('');
  }
  return '';
}

export function loadTranscript(path) {
  return normalizeTranscript(readFileSync(path, 'utf8'));
}

export function resultLineCount(transcript) {
  const r = transcript.result || '';
  if (!r.trim()) return 0;
  return r.split(/\r?\n/).length;
}
