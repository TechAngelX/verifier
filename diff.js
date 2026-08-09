// diff.js — line & character diff utilities for Verifier (loaded before renderer.js)
'use strict';

/**
 * Line-level diff between two arrays of lines.
 * Comparison happens on `normA`/`normB` (normalized lines) so options like
 * case-insensitive or trim-whitespace are respected, while callers render raw text.
 *
 * Returns an array of ops:
 *   {type:'equal',   aStart, bStart, count}
 *   {type:'delete',  aStart, aCount, bStart}
 *   {type:'insert',  aStart, bStart, bCount}
 *   {type:'replace', aStart, aCount, bStart, bCount}
 */
function computeLineDiff(normA, normB) {
  const lenA = normA.length;
  const lenB = normB.length;

  // Trim common prefix / suffix first — makes big similar inputs cheap.
  let start = 0;
  while (start < lenA && start < lenB && normA[start] === normB[start]) start++;
  let endA = lenA;
  let endB = lenB;
  while (endA > start && endB > start && normA[endA - 1] === normB[endB - 1]) {
    endA--;
    endB--;
  }

  const ops = [];
  if (start > 0) ops.push({ type: 'equal', aStart: 0, bStart: 0, count: start });

  const midA = endA - start;
  const midB = endB - start;

  if (midA > 0 && midB > 0) {
    if (midA * midB > 4_000_000) {
      // Too large for the DP table — treat the whole middle as one replace block.
      ops.push({ type: 'replace', aStart: start, aCount: midA, bStart: start, bCount: midB });
    } else {
      lcsOps(normA, normB, start, endA, endB, ops);
    }
  } else if (midA > 0) {
    ops.push({ type: 'delete', aStart: start, aCount: midA, bStart: start });
  } else if (midB > 0) {
    ops.push({ type: 'insert', aStart: endA, bStart: start, bCount: midB });
  }

  const tail = lenA - endA;
  if (tail > 0) ops.push({ type: 'equal', aStart: endA, bStart: endB, count: tail });
  return ops;
}

// LCS dynamic programming over the middle section, appending ops in place.
function lcsOps(normA, normB, start, endA, endB, ops) {
  const n = endA - start;
  const m = endB - start;
  const W = m + 1;
  const dp = new Uint32Array((n + 1) * W);

  for (let i = 1; i <= n; i++) {
    const ai = normA[start + i - 1];
    for (let j = 1; j <= m; j++) {
      dp[i * W + j] = ai === normB[start + j - 1]
        ? dp[(i - 1) * W + (j - 1)] + 1
        : Math.max(dp[(i - 1) * W + j], dp[i * W + (j - 1)]);
    }
  }

  // Backtrack into a reversed edit script.
  const rev = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (normA[start + i - 1] === normB[start + j - 1]) { rev.push('e'); i--; j--; }
    else if (dp[(i - 1) * W + j] > dp[i * W + (j - 1)]) { rev.push('d'); i--; }
    else { rev.push('i'); j--; }
  }
  while (i > 0) { rev.push('d'); i--; }
  while (j > 0) { rev.push('i'); j--; }
  rev.reverse();

  // Compress runs; a delete run directly followed by an insert run becomes a replace.
  let ai = start;
  let bi = start;
  let k = 0;
  while (k < rev.length) {
    const t = rev[k];
    let len = 0;
    while (k < rev.length && rev[k] === t) { k++; len++; }

    if (t === 'e') {
      ops.push({ type: 'equal', aStart: ai, bStart: bi, count: len });
      ai += len; bi += len;
    } else if (t === 'd') {
      let insLen = 0;
      while (k < rev.length && rev[k] === 'i') { k++; insLen++; }
      if (insLen > 0) {
        ops.push({ type: 'replace', aStart: ai, aCount: len, bStart: bi, bCount: insLen });
        ai += len; bi += insLen;
      } else {
        ops.push({ type: 'delete', aStart: ai, aCount: len, bStart: bi });
        ai += len;
      }
    } else {
      let delLen = 0;
      while (k < rev.length && rev[k] === 'd') { k++; delLen++; }
      if (delLen > 0) {
        ops.push({ type: 'replace', aStart: ai, aCount: delLen, bStart: bi, bCount: len });
        ai += delLen; bi += len;
      } else {
        ops.push({ type: 'insert', aStart: ai, bStart: bi, bCount: len });
        bi += len;
      }
    }
  }
}

/**
 * Character-level highlight boundaries for a pair of modified lines.
 * Returns {prefix, sufA, sufB}: chars equal at the start, and chars equal at
 * the end of each line — everything in between is the changed region.
 */
function charHighlight(a, b, caseSens) {
  const eq = caseSens
    ? (x, y) => x === y
    : (x, y) => x === y || x.toLowerCase() === y.toLowerCase();

  const max = Math.min(a.length, b.length);
  let prefix = 0;
  while (prefix < max && eq(a[prefix], b[prefix])) prefix++;

  let sufA = a.length;
  let sufB = b.length;
  while (sufA > prefix && sufB > prefix && eq(a[sufA - 1], b[sufB - 1])) {
    sufA--;
    sufB--;
  }
  return { prefix, sufA, sufB };
}

/**
 * Levenshtein edit distance with two-row memory. Returns null when either
 * string exceeds `cap` chars (quadratic time gets too slow beyond that).
 */
function levenshtein(a, b, cap = 6000) {
  if (a.length > cap || b.length > cap) return null;
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = new Uint32Array(b.length + 1);
  let curr = new Uint32Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      curr[j] = ca === b.charCodeAt(j - 1)
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Build a unified-diff style report from line ops + raw lines. */
function buildUnifiedDiff(ops, aLines, bLines, context = 2) {
  const out = ['--- Column A', '+++ Column B'];

  for (let idx = 0; idx < ops.length; idx++) {
    const op = ops[idx];
    if (op.type === 'equal') continue;

    const aCount = op.aCount || 0;
    const bCount = op.bCount || 0;

    // Leading context from the previous equal run.
    const prevOp = ops[idx - 1];
    const pre = [];
    if (prevOp && prevOp.type === 'equal') {
      const take = Math.min(context, prevOp.count);
      for (let i = prevOp.count - take; i < prevOp.count; i++) {
        pre.push(' ' + aLines[prevOp.aStart + i]);
      }
    }
    // Trailing context from the next equal run.
    const nextOp = ops[idx + 1];
    const post = [];
    if (nextOp && nextOp.type === 'equal') {
      const take = Math.min(context, nextOp.count);
      for (let i = 0; i < take; i++) {
        post.push(' ' + aLines[nextOp.aStart + i]);
      }
    }

    const hunkAStart = op.aStart - pre.length + 1;
    const hunkBStart = op.bStart - pre.length + 1;
    out.push(`@@ -${hunkAStart},${aCount + pre.length + post.length} +${hunkBStart},${bCount + pre.length + post.length} @@`);
    out.push(...pre);
    for (let i = 0; i < aCount; i++) out.push('-' + aLines[op.aStart + i]);
    for (let i = 0; i < bCount; i++) out.push('+' + bLines[op.bStart + i]);
    out.push(...post);
  }
  return out.join('\n');
}
