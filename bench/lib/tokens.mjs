/** Approximate token and instruction counts for always-loaded harness files. */

/** Rough token estimate used for relative comparisons (chars / 4). */
export function approxTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Count discrete instruction-like units: numbered rules, bullets, and
 * non-empty markdown headings that look like directives.
 */
export function countInstructions(text) {
  if (!text) return 0;
  let n = 0;
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('<!--') || t.startsWith('-->')) continue;
    if (/^\d+\.\s/.test(t)) n += 1;
    else if (/^[-*]\s+\S/.test(t)) n += 1;
    else if (/^#{1,3}\s+\S/.test(t)) n += 1;
  }
  return n;
}

/** Extract YAML frontmatter description from a skill/agent markdown file. */
export function frontmatterDescription(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return '';
  const block = m[1];
  const folded = block.match(/^description:\s*>-?\s*\n((?:[ \t]+.+\n?)*)/m);
  if (folded) {
    return folded[1]
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .join(' ');
  }
  const plain = block.match(/^description:\s*(.+)$/m);
  return plain ? plain[1].trim() : '';
}
