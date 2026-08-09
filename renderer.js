'use strict';

// ── Elements ──────────────────────────────────────────────────────────────
const colA = document.getElementById('colA');
const colB = document.getElementById('colB');
const resultBadge = document.getElementById('resultBadge');
const resultDetail = document.getElementById('resultDetail');
const hashLine = document.getElementById('hashLine');
const badgeAura = document.getElementById('badgeAura');
const countA = document.getElementById('countA');
const countB = document.getElementById('countB');
const liveToggle = document.getElementById('liveToggle');
const liveDot = document.getElementById('liveDot');
const caseSensitive = document.getElementById('caseSensitive');
const trimWhitespace = document.getElementById('trimWhitespace');
const ignoreNewlines = document.getElementById('ignoreNewlines');
const ignoreAllWs = document.getElementById('ignoreAllWs');
const syncScroll = document.getElementById('syncScroll');
const editorView = document.getElementById('editorView');
const diffView = document.getElementById('diffView');
const diffTable = document.getElementById('diffTable');
const diffScroll = document.getElementById('diffScroll');
const diffEmpty = document.getElementById('diffEmpty');
const diffStats = document.getElementById('diffStats');
const viewEditorBtn = document.getElementById('viewEditorBtn');
const viewDiffBtn = document.getElementById('viewDiffBtn');
const viewChecksumBtn = document.getElementById('viewChecksumBtn');
const checksumView = document.getElementById('checksumView');
const checksumVerdict = document.getElementById('checksumVerdict');
const expectedHash = document.getElementById('expectedHash');
const expectedResult = document.getElementById('expectedResult');

const OPTION_BOXES = [liveToggle, caseSensitive, trimWhitespace, ignoreNewlines, ignoreAllWs, syncScroll];

const state = {
  ops: null,          // last computed line diff ops
  aLines: [],
  bLines: [],
  diffDirty: true,
  expandedRuns: new Set(),
  chunkIndex: -1,
  lastResult: null,   // 'true' | 'false' | null
  hashA: '',
  hashB: ''
};

// ── Normalization ─────────────────────────────────────────────────────────
function normalize(str) {
  let s = str;
  if (trimWhitespace.checked) s = s.trim();
  if (ignoreNewlines.checked) s = s.replace(/\r?\n/g, ' ');
  if (ignoreAllWs.checked) s = s.replace(/\s+/g, '');
  if (!caseSensitive.checked) s = s.toLowerCase();
  return s;
}

// Per-line normalization used by the line diff.
function normLine(line) {
  let s = line;
  if (trimWhitespace.checked || ignoreAllWs.checked) s = s.trim();
  if (ignoreAllWs.checked) s = s.replace(/\s+/g, '');
  if (!caseSensitive.checked) s = s.toLowerCase();
  return s;
}

// ── Small helpers ─────────────────────────────────────────────────────────
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmt(n) { return n.toLocaleString(); }

function colStats(str) {
  if (!str) return '0 chars';
  const lines = str.split('\n').length;
  return `${fmt(str.length)} chars · ${fmt(lines)} ${lines === 1 ? 'line' : 'lines'}`;
}

function firstDiffPosition(a, b) {
  const min = Math.min(a.length, b.length);
  let idx = -1;
  for (let i = 0; i < min; i++) {
    if (a[i] !== b[i]) { idx = i; break; }
  }
  if (idx === -1) {
    if (a.length === b.length) return null;
    idx = min;
  }
  let line = 1;
  let col = 1;
  for (let i = 0; i < idx; i++) {
    if (a[i] === '\n') { line++; col = 1; } else { col++; }
  }
  return { index: idx, line, col };
}

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(x => x.toString(16).padStart(2, '0')).join('');
}

async function sha256(str) {
  return bufToHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)));
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let u = -1;
  do { n /= 1024; u++; } while (n >= 1024 && u < units.length - 1);
  return `${n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2)} ${units[u]}`;
}

function flashButton(btn, label) {
  const orig = btn.dataset.label || btn.textContent;
  btn.dataset.label = orig;
  btn.textContent = label;
  setTimeout(() => { btn.textContent = orig; }, 1200);
}

// ── Compare ───────────────────────────────────────────────────────────────
function compare() {
  const rawA = colA.value;
  const rawB = colB.value;

  countA.textContent = colStats(rawA);
  countB.textContent = colStats(rawB);

  state.diffDirty = true;
  state.expandedRuns.clear();
  state.chunkIndex = -1;

  if (!rawA && !rawB) {
    setBadge(null);
    resultDetail.innerHTML = 'Enter content in both columns to compare.';
    hashLine.textContent = '';
    if (!diffView.hidden) renderDiff();
    return;
  }

  if (!rawA || !rawB) {
    setBadge(null);
    resultDetail.innerHTML = 'Waiting for both columns&hellip;';
    hashLine.textContent = '';
    if (!diffView.hidden) renderDiff();
    return;
  }

  const a = normalize(rawA);
  const b = normalize(rawB);
  const isMatch = a === b;

  setBadge(isMatch);

  if (isMatch) {
    const lines = rawA.split('\n').length;
    const words = rawA.trim().split(/\s+/).filter(Boolean).length;
    resultDetail.innerHTML =
      `<span class="match-count">Exact match</span> &mdash; ${fmt(rawA.length)} chars &nbsp;·&nbsp; ${fmt(words)} words &nbsp;·&nbsp; ${fmt(lines)} lines`;
  } else {
    const dist = levenshtein(a, b);
    const lenDiff = Math.abs(rawA.length - rawB.length);
    const pos = firstDiffPosition(rawA, rawB);

    let detail = `<span class="diff-count">No match</span>`;
    if (pos) detail += ` &mdash; first diff at line ${fmt(pos.line)}, col ${fmt(pos.col)}`;
    if (dist !== null) {
      const sim = (1 - dist / Math.max(a.length, b.length)) * 100;
      detail += ` &nbsp;·&nbsp; similarity ${sim.toFixed(1)}%`;
      detail += ` &nbsp;·&nbsp; edit distance ${fmt(dist)}`;
    }
    if (lenDiff > 0) detail += ` &nbsp;·&nbsp; Δ length ${fmt(lenDiff)}`;
    detail += ` &nbsp;·&nbsp; <a id="viewDiffLink">view diff →</a>`;
    resultDetail.innerHTML = detail;

    const link = document.getElementById('viewDiffLink');
    if (link) link.addEventListener('click', () => setView('diff'));
  }

  updateHashes(rawA, rawB);
  if (!diffView.hidden) renderDiff();
}

function setBadge(isMatch) {
  if (isMatch === null) {
    state.lastResult = null;
    resultBadge.textContent = '—';
    resultBadge.className = 'badge empty';
    badgeAura.className = 'badge-aura';
    return;
  }
  state.lastResult = isMatch ? 'true' : 'false';
  resultBadge.textContent = isMatch ? 'TRUE' : 'FALSE';
  resultBadge.className = `badge ${isMatch ? 'true' : 'false'}`;
  badgeAura.className = `badge-aura ${isMatch ? 'true' : 'false'}`;
}

let hashToken = 0;
async function updateHashes(rawA, rawB) {
  const token = ++hashToken;
  try {
    const [ha, hb] = await Promise.all([sha256(rawA), sha256(rawB)]);
    if (token !== hashToken) return; // stale — a newer compare ran
    state.hashA = ha;
    state.hashB = hb;
    const cls = ha === hb ? 'match' : 'mismatch';
    hashLine.innerHTML =
      `SHA-256 &nbsp; A <span class="h ${cls}" id="hashA" title="${ha}\n(click to copy)">${ha.slice(0, 16)}…</span>` +
      ` &nbsp; B <span class="h ${cls}" id="hashB" title="${hb}\n(click to copy)">${hb.slice(0, 16)}…</span>`;
    document.getElementById('hashA').addEventListener('click', () => navigator.clipboard.writeText(state.hashA));
    document.getElementById('hashB').addEventListener('click', () => navigator.clipboard.writeText(state.hashB));
  } catch {
    hashLine.textContent = '';
  }
}

// ── Diff rendering ────────────────────────────────────────────────────────
const COLLAPSE_THRESHOLD = 9; // equal runs longer than this collapse
const CONTEXT = 3;            // visible context lines around changes

function renderDiff() {
  const rawA = colA.value;
  const rawB = colB.value;

  if (!rawA || !rawB) {
    showDiffEmpty('&mdash;', 'Fill both columns to see a diff.');
    diffStats.textContent = '';
    return;
  }

  state.aLines = rawA.split('\n');
  state.bLines = rawB.split('\n');
  const normA = state.aLines.map(normLine);
  const normB = state.bLines.map(normLine);
  state.ops = computeLineDiff(normA, normB);
  state.diffDirty = false;

  let del = 0, ins = 0, mod = 0;
  for (const op of state.ops) {
    if (op.type === 'delete') del += op.aCount;
    else if (op.type === 'insert') ins += op.bCount;
    else if (op.type === 'replace') mod += Math.max(op.aCount, op.bCount);
  }

  if (del + ins + mod === 0) {
    showDiffEmpty('<span class="ok">✓ No line differences</span>',
      'Lines are identical under the current options.');
    diffStats.innerHTML = 'no differences';
    return;
  }

  diffEmpty.hidden = true;
  diffScroll.hidden = false;

  const caseSens = caseSensitive.checked;
  const rows = [];
  let chunkCount = 0;

  for (let idx = 0; idx < state.ops.length; idx++) {
    const op = state.ops[idx];

    if (op.type === 'equal') {
      const isFirst = idx === 0;
      const isLast = idx === state.ops.length - 1;
      const expanded = state.expandedRuns.has(idx);

      if (!expanded && op.count > COLLAPSE_THRESHOLD) {
        const head = isFirst ? 0 : CONTEXT;
        const tail = isLast ? 0 : CONTEXT;
        for (let i = 0; i < head; i++) pushEqualRow(rows, op, i);
        const hiddenCount = op.count - head - tail;
        rows.push(
          `<tr class="row-expander" data-run="${idx}"><td colspan="4">⋯ ${fmt(hiddenCount)} unchanged lines — click to expand ⋯</td></tr>`
        );
        for (let i = op.count - tail; i < op.count; i++) pushEqualRow(rows, op, i);
      } else {
        for (let i = 0; i < op.count; i++) pushEqualRow(rows, op, i);
      }
      continue;
    }

    const chunkAttr = `data-chunk="${chunkCount++}"`;

    if (op.type === 'delete') {
      for (let i = 0; i < op.aCount; i++) {
        rows.push(
          `<tr class="row-del" ${i === 0 ? chunkAttr : ''}>` +
          `<td class="ln a">${op.aStart + i + 1}</td><td class="code a">${escapeHtml(state.aLines[op.aStart + i])}</td>` +
          `<td class="ln b"></td><td class="code b void"></td></tr>`
        );
      }
    } else if (op.type === 'insert') {
      for (let i = 0; i < op.bCount; i++) {
        rows.push(
          `<tr class="row-ins" ${i === 0 ? chunkAttr : ''}>` +
          `<td class="ln a"></td><td class="code a void"></td>` +
          `<td class="ln b">${op.bStart + i + 1}</td><td class="code b">${escapeHtml(state.bLines[op.bStart + i])}</td></tr>`
        );
      }
    } else { // replace — pair lines side by side with char-level highlights
      const pairs = Math.max(op.aCount, op.bCount);
      for (let i = 0; i < pairs; i++) {
        const hasA = i < op.aCount;
        const hasB = i < op.bCount;
        let aHtml = '', bHtml = '';

        if (hasA && hasB) {
          const la = state.aLines[op.aStart + i];
          const lb = state.bLines[op.bStart + i];
          const { prefix, sufA, sufB } = charHighlight(la, lb, caseSens);
          aHtml = escapeHtml(la.slice(0, prefix)) +
            (sufA > prefix ? `<mark class="d">${escapeHtml(la.slice(prefix, sufA))}</mark>` : '') +
            escapeHtml(la.slice(sufA));
          bHtml = escapeHtml(lb.slice(0, prefix)) +
            (sufB > prefix ? `<mark class="i">${escapeHtml(lb.slice(prefix, sufB))}</mark>` : '') +
            escapeHtml(lb.slice(sufB));
        } else if (hasA) {
          aHtml = escapeHtml(state.aLines[op.aStart + i]);
        } else {
          bHtml = escapeHtml(state.bLines[op.bStart + i]);
        }

        rows.push(
          `<tr class="row-mod" ${i === 0 ? chunkAttr : ''}>` +
          `<td class="ln a">${hasA ? op.aStart + i + 1 : ''}</td><td class="code a${hasA ? '' : ' void'}">${aHtml}</td>` +
          `<td class="ln b">${hasB ? op.bStart + i + 1 : ''}</td><td class="code b${hasB ? '' : ' void'}">${bHtml}</td></tr>`
        );
      }
    }
  }

  diffTable.innerHTML =
    `<colgroup><col style="width:48px"><col><col style="width:48px"><col></colgroup>` +
    rows.join('');

  const parts = [];
  if (mod) parts.push(`<span class="mod">~${fmt(mod)}</span> changed`);
  if (del) parts.push(`<span class="del">−${fmt(del)}</span> removed`);
  if (ins) parts.push(`<span class="ins">+${fmt(ins)}</span> added`);
  diffStats.innerHTML = `${parts.join(' &nbsp; ')} &nbsp;·&nbsp; ${fmt(chunkCount)} ${chunkCount === 1 ? 'block' : 'blocks'}`;

  // Expander clicks (event delegation set up once below).
  state.chunkIndex = -1;
}

function pushEqualRow(rows, op, i) {
  rows.push(
    `<tr class="row-equal">` +
    `<td class="ln a">${op.aStart + i + 1}</td><td class="code a">${escapeHtml(state.aLines[op.aStart + i])}</td>` +
    `<td class="ln b">${op.bStart + i + 1}</td><td class="code b">${escapeHtml(state.bLines[op.bStart + i])}</td></tr>`
  );
}

function showDiffEmpty(big, msg) {
  diffScroll.hidden = true;
  diffEmpty.hidden = false;
  diffEmpty.innerHTML = `<div class="big">${big}</div><div>${msg}</div>`;
}

diffTable.addEventListener('click', (e) => {
  const tr = e.target.closest('tr.row-expander');
  if (!tr) return;
  state.expandedRuns.add(Number(tr.dataset.run));
  renderDiff();
});

// ── Diff navigation ───────────────────────────────────────────────────────
function jumpToChunk(dir) {
  const chunks = diffTable.querySelectorAll('tr[data-chunk]');
  if (!chunks.length) return;
  state.chunkIndex = (state.chunkIndex + dir + chunks.length) % chunks.length;
  const row = chunks[state.chunkIndex];
  row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  row.classList.remove('flash');
  void row.offsetWidth; // restart animation
  row.classList.add('flash');
}

document.getElementById('nextDiffBtn').addEventListener('click', () => jumpToChunk(1));
document.getElementById('prevDiffBtn').addEventListener('click', () => jumpToChunk(-1));

// ── View switching ────────────────────────────────────────────────────────
const VIEWS = {
  editor: { el: editorView, btn: viewEditorBtn },
  diff: { el: diffView, btn: viewDiffBtn },
  checksum: { el: checksumView, btn: viewChecksumBtn }
};

let currentView = 'editor';

function setView(view) {
  currentView = view;
  for (const [name, { el, btn }] of Object.entries(VIEWS)) {
    const active = name === view;
    el.hidden = !active;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  }
  if (view === 'editor') colA.focus();
  if (view === 'checksum') updateChecksumVerdict();
  else compare();
}

viewEditorBtn.addEventListener('click', () => setView('editor'));
viewDiffBtn.addEventListener('click', () => setView('diff'));
viewChecksumBtn.addEventListener('click', () => setView('checksum'));

// ── Live compare wiring ───────────────────────────────────────────────────
function updateLiveDot() {
  liveDot.classList.toggle('off', !liveToggle.checked);
}

let debounceTimer;
function debouncedCompare() {
  if (!liveToggle.checked) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(compare, 120);
}

colA.addEventListener('input', () => {
  countA.textContent = colStats(colA.value);
  state.diffDirty = true;
  debouncedCompare();
});

colB.addEventListener('input', () => {
  countB.textContent = colStats(colB.value);
  state.diffDirty = true;
  debouncedCompare();
});

// ── Options: persistence + change handling ────────────────────────────────
const STORAGE_KEY = 'verifier-options';

function saveOptions() {
  const opts = {};
  for (const box of OPTION_BOXES) opts[box.id] = box.checked;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(opts)); } catch {}
}

function loadOptions() {
  try {
    const opts = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    for (const box of OPTION_BOXES) {
      if (typeof opts[box.id] === 'boolean') box.checked = opts[box.id];
    }
  } catch {}
}

loadOptions();
updateLiveDot();
liveToggle.addEventListener('change', () => { updateLiveDot(); saveOptions(); });
syncScroll.addEventListener('change', saveOptions);

[caseSensitive, trimWhitespace, ignoreNewlines, ignoreAllWs].forEach(el => {
  el.addEventListener('change', () => {
    saveOptions();
    state.diffDirty = true;
    if (liveToggle.checked || !diffView.hidden) compare();
  });
});

// ── Synchronized scrolling (editor view) ──────────────────────────────────
let syncing = false;
function mirrorScroll(src, dst) {
  if (!syncScroll.checked || syncing) return;
  syncing = true;
  const srcMax = src.scrollHeight - src.clientHeight;
  const dstMax = dst.scrollHeight - dst.clientHeight;
  if (srcMax > 0 && dstMax > 0) {
    dst.scrollTop = (src.scrollTop / srcMax) * dstMax;
  }
  syncing = false;
}

colA.addEventListener('scroll', () => mirrorScroll(colA, colB));
colB.addEventListener('scroll', () => mirrorScroll(colB, colA));

// ── Per-column paste / clear ──────────────────────────────────────────────
async function pasteInto(textarea) {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) return;
    textarea.value = text;
    textarea.dispatchEvent(new Event('input'));
    if (!liveToggle.checked) compare();
  } catch {}
}

document.getElementById('pasteA').addEventListener('click', () => pasteInto(colA));
document.getElementById('pasteB').addEventListener('click', () => pasteInto(colB));
document.getElementById('clearA').addEventListener('click', () => {
  colA.value = '';
  colA.dispatchEvent(new Event('input'));
  compare();
});
document.getElementById('clearB').addEventListener('click', () => {
  colB.value = '';
  colB.dispatchEvent(new Event('input'));
  compare();
});

// ── Drag & drop files onto a column ──────────────────────────────────────
for (const ta of [colA, colB]) {
  ta.addEventListener('dragover', (e) => {
    e.preventDefault();
    ta.classList.add('drag-over');
  });
  ta.addEventListener('dragleave', () => ta.classList.remove('drag-over'));
  ta.addEventListener('drop', async (e) => {
    ta.classList.remove('drag-over');
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return; // plain text drags keep their default behavior
    e.preventDefault();
    try {
      ta.value = await file.text();
      ta.dispatchEvent(new Event('input'));
      compare();
    } catch {}
  });
}

// ── Tab inserts a tab character in the editors ────────────────────────────
for (const ta of [colA, colB]) {
  ta.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    e.preventDefault();
    const { selectionStart, selectionEnd, value } = ta;
    ta.value = value.slice(0, selectionStart) + '\t' + value.slice(selectionEnd);
    ta.selectionStart = ta.selectionEnd = selectionStart + 1;
    ta.dispatchEvent(new Event('input'));
  });
}

// ── Checksum view ─────────────────────────────────────────────────────────
const CS_ALGOS = ['SHA-256', 'SHA-512', 'SHA-1'];
const csFiles = { A: null, B: null };
const csTokens = { A: 0, B: 0 };

async function loadChecksumFile(side, file) {
  const token = ++csTokens[side];
  csFiles[side] = { name: file.name, size: file.size, modified: file.lastModified, hashes: null, error: null };
  renderDropZone(side);
  updateChecksumVerdict();

  try {
    const buf = await file.arrayBuffer();
    if (token !== csTokens[side]) return;
    const hashes = {};
    for (const alg of CS_ALGOS) {
      hashes[alg] = bufToHex(await crypto.subtle.digest(alg, buf));
      if (token !== csTokens[side]) return;
    }
    csFiles[side].hashes = hashes;
  } catch {
    if (token !== csTokens[side]) return;
    csFiles[side].error = 'Could not read or hash this file (too large, or no permission).';
  }
  renderDropZone(side);
  updateChecksumVerdict();
}

function renderDropZone(side) {
  const f = csFiles[side];
  document.getElementById('dzEmpty' + side).hidden = !!f;
  document.getElementById('dzClear' + side).hidden = !f;
  const info = document.getElementById('dzInfo' + side);
  info.hidden = !f;
  if (!f) { info.innerHTML = ''; return; }

  let html =
    `<div class="dz-name">${escapeHtml(f.name)}</div>` +
    `<div class="dz-meta">${formatBytes(f.size)} (${fmt(f.size)} bytes)` +
    `${f.modified ? ' · modified ' + new Date(f.modified).toLocaleString() : ''}</div>`;

  if (f.error) {
    html += `<div class="dz-meta error">${escapeHtml(f.error)}</div>`;
  } else if (!f.hashes) {
    html += `<div class="dz-meta">Hashing&hellip;</div>`;
  } else {
    for (const alg of CS_ALGOS) {
      html += `<div class="dz-hash"><span class="alg">${alg}</span>` +
        `<span class="val" title="Click to copy" data-copy="${f.hashes[alg]}" data-alg="${alg}">${f.hashes[alg]}</span></div>`;
    }
  }
  info.innerHTML = html;
}

function checksumStatus() {
  const a = csFiles.A;
  const b = csFiles.B;
  if ((a && !a.hashes && !a.error) || (b && !b.hashes && !b.error)) return 'hashing';
  if (a?.hashes && b?.hashes) return 'ready';
  return 'waiting';
}

function updateChecksumVerdict() {
  const a = csFiles.A;
  const b = csFiles.B;
  const status = checksumStatus();
  let verdict;
  let badge = null;
  let detail = 'Drop two copies of a file to verify their integrity.';
  let hashes = '';

  if (status === 'hashing') {
    verdict = 'Hashing&hellip;';
    detail = 'Hashing&hellip;';
  } else if (status === 'ready') {
    const match = CS_ALGOS.every(alg => a.hashes[alg] === b.hashes[alg]);
    if (match) {
      verdict = `<span class="ok">✓ MATCH</span> — the files are byte-for-byte identical. SHA-256, SHA-512 and SHA-1 all agree.`;
      badge = true;
      detail = `<span class="match-count">Checksums match</span> &mdash; ` +
        `${escapeHtml(a.name)} ≡ ${escapeHtml(b.name)} &nbsp;·&nbsp; ${formatBytes(a.size)}`;
    } else if (a.size === b.size) {
      verdict = `<span class="bad">✗ MISMATCH</span> — same size (${formatBytes(a.size)}) but different content. ` +
        `This is <b>not</b> the same file, no matter how identical it looks.`;
      badge = false;
      detail = `<span class="diff-count">Checksums differ</span> &mdash; identical size (${formatBytes(a.size)}), different content`;
    } else {
      verdict = `<span class="bad">✗ MISMATCH</span> — different content ` +
        `(A: ${formatBytes(a.size)}, B: ${formatBytes(b.size)}).`;
      badge = false;
      detail = `<span class="diff-count">Checksums differ</span> &mdash; ` +
        `A: ${formatBytes(a.size)}, B: ${formatBytes(b.size)} &nbsp;·&nbsp; Δ ${formatBytes(Math.abs(a.size - b.size))}`;
    }
    hashes = `SHA-256 &nbsp; A <span class="h ${badge ? 'match' : 'mismatch'}">${a.hashes['SHA-256'].slice(0, 16)}…</span>` +
      ` &nbsp; B <span class="h ${badge ? 'match' : 'mismatch'}">${b.hashes['SHA-256'].slice(0, 16)}…</span>`;
  } else if (a || b) {
    verdict = 'Waiting for the second file&hellip; (or paste an expected checksum below)';
    detail = 'Waiting for the second file&hellip;';
  } else {
    verdict = 'Drop the same file from two different sources — matching hashes prove they are truly identical, byte for byte.';
  }

  checksumVerdict.innerHTML = verdict;
  updateExpectedResult();

  if (currentView === 'checksum') {
    setBadge(badge);
    resultDetail.innerHTML = detail;
    hashLine.innerHTML = hashes;
  }
}

function updateExpectedResult() {
  // Reset any per-hash highlight from a previous check.
  document.querySelectorAll('.dz-hash .val').forEach(el => el.classList.remove('hl-ok', 'hl-bad'));

  const raw = expectedHash.value.trim();
  if (!raw) { expectedResult.innerHTML = ''; return; }

  const cleaned = raw.toLowerCase().replace(/^0x/, '').replace(/[\s:,-]/g, '');
  if (!/^[0-9a-f]+$/.test(cleaned)) {
    expectedResult.innerHTML = '<span class="bad">Not a valid hex hash.</span>';
    return;
  }
  const alg = { 40: 'SHA-1', 64: 'SHA-256', 128: 'SHA-512' }[cleaned.length];
  if (!alg) {
    expectedResult.innerHTML =
      `<span class="bad">Unrecognised hash length (${cleaned.length} hex chars — expected 40 for SHA-1, 64 for SHA-256, or 128 for SHA-512).</span>`;
    return;
  }

  const parts = [`Detected ${alg}`];
  let anyFile = false;
  for (const side of ['A', 'B']) {
    const f = csFiles[side];
    if (!f?.hashes) continue;
    anyFile = true;
    const ok = f.hashes[alg] === cleaned;
    parts.push(`File ${side}: ${ok ? '<span class="ok">✓ matches</span>' : '<span class="bad">✗ does NOT match</span>'}`);
    const el = document.querySelector(`#dzInfo${side} .val[data-alg="${alg}"]`);
    if (el) el.classList.add(ok ? 'hl-ok' : 'hl-bad');
  }
  if (!anyFile) parts.push('drop a file to check it against this hash');
  expectedResult.innerHTML = parts.join(' &nbsp;·&nbsp; ');
}

expectedHash.addEventListener('input', updateExpectedResult);

for (const side of ['A', 'B']) {
  const zone = document.getElementById('dropZone' + side);
  const input = document.getElementById('fileInput' + side);
  const other = side === 'A' ? 'B' : 'A';

  zone.addEventListener('click', (e) => {
    if (e.target.closest('.dz-info') || e.target.closest('.dz-clear')) return;
    input.click();
  });

  input.addEventListener('change', () => {
    if (input.files && input.files[0]) loadChecksumFile(side, input.files[0]);
    input.value = '';
  });

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (!files || !files.length) return;
    loadChecksumFile(side, files[0]);
    // Dropping two files at once fills both zones.
    if (files.length > 1 && !csFiles[other]) loadChecksumFile(other, files[1]);
  });

  document.getElementById('dzClear' + side).addEventListener('click', (e) => {
    e.stopPropagation();
    csTokens[side]++;
    csFiles[side] = null;
    renderDropZone(side);
    updateChecksumVerdict();
  });
}

// Click a hash to copy it.
checksumView.addEventListener('click', (e) => {
  const val = e.target.closest('.val[data-copy]');
  if (val) navigator.clipboard.writeText(val.dataset.copy);
});

function clearChecksums() {
  csTokens.A++;
  csTokens.B++;
  csFiles.A = null;
  csFiles.B = null;
  expectedHash.value = '';
  renderDropZone('A');
  renderDropZone('B');
  updateChecksumVerdict();
}

function swapChecksums() {
  [csFiles.A, csFiles.B] = [csFiles.B, csFiles.A];
  renderDropZone('A');
  renderDropZone('B');
  updateChecksumVerdict();
}

function buildChecksumReport() {
  const lines = [
    '═══ VERIFIER CHECKSUM REPORT ═══',
    `Generated: ${new Date().toISOString()}`,
    `Result: ${resultBadge.textContent}`
  ];
  for (const side of ['A', 'B']) {
    const f = csFiles[side];
    if (!f) continue;
    lines.push('', `File ${side}: ${f.name} (${fmt(f.size)} bytes)`);
    if (f.hashes) for (const alg of CS_ALGOS) lines.push(`  ${alg}: ${f.hashes[alg]}`);
  }
  if (expectedHash.value.trim()) {
    lines.push('', `Expected hash: ${expectedHash.value.trim()}`);
    lines.push(`Check: ${expectedResult.textContent}`);
  }
  return lines.join('\n');
}

// Stop dropped files from navigating the window when they miss a drop target.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

// ── Bottom buttons ────────────────────────────────────────────────────────
document.getElementById('compareBtn').addEventListener('click', () => {
  if (currentView === 'checksum') updateChecksumVerdict();
  else compare();
});

function clearAll() {
  colA.value = '';
  colB.value = '';
  countA.textContent = '0 chars';
  countB.textContent = '0 chars';
  setBadge(null);
  resultDetail.innerHTML = 'Enter content in both columns to compare.';
  hashLine.textContent = '';
  state.diffDirty = true;
  if (!diffView.hidden) renderDiff();
  colA.focus();
}

document.getElementById('clearBtn').addEventListener('click', () => {
  if (currentView === 'checksum') clearChecksums();
  else clearAll();
});

function swap() {
  const tmp = colA.value;
  colA.value = colB.value;
  colB.value = tmp;
  compare();
}

document.getElementById('swapBtn').addEventListener('click', () => {
  if (currentView === 'checksum') swapChecksums();
  else swap();
});

function buildReport() {
  const rawA = colA.value;
  const rawB = colB.value;
  const lines = [
    '═══ VERIFIER REPORT ═══',
    `Generated: ${new Date().toISOString()}`,
    `Result: ${resultBadge.textContent}`,
    `Column A: ${fmt(rawA.length)} chars, ${fmt(rawA.split('\n').length)} lines`,
    `Column B: ${fmt(rawB.length)} chars, ${fmt(rawB.split('\n').length)} lines`,
    `Options: case-sensitive=${caseSensitive.checked}, trim=${trimWhitespace.checked}, ` +
      `ignore-newlines=${ignoreNewlines.checked}, ignore-all-whitespace=${ignoreAllWs.checked}`
  ];
  if (state.hashA) {
    lines.push(`SHA-256 A: ${state.hashA}`);
    lines.push(`SHA-256 B: ${state.hashB}`);
  }
  if (state.lastResult === 'false') {
    if (state.diffDirty) renderDiff();
    if (state.ops) {
      lines.push('', buildUnifiedDiff(state.ops, state.aLines, state.bLines));
    }
  }
  return lines.join('\n');
}

document.getElementById('copyBtn').addEventListener('click', () => {
  let report;
  if (currentView === 'checksum') {
    if (!csFiles.A && !csFiles.B) return;
    report = buildChecksumReport();
  } else {
    if (state.lastResult === null) return;
    report = buildReport();
  }
  navigator.clipboard.writeText(report).then(() => {
    flashButton(document.getElementById('copyBtn'), 'Copied!');
  });
});

document.getElementById('copyDiffBtn').addEventListener('click', () => {
  if (state.diffDirty) renderDiff();
  if (!state.ops) return;
  navigator.clipboard.writeText(buildUnifiedDiff(state.ops, state.aLines, state.bLines)).then(() => {
    flashButton(document.getElementById('copyDiffBtn'), 'Copied!');
  });
});

// ── Keyboard shortcuts ────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return;
  switch (e.key) {
    case 'Enter':
      e.preventDefault();
      compare();
      break;
    case 'd':
    case 'D':
      e.preventDefault();
      setView(diffView.hidden ? 'diff' : 'editor');
      break;
    case '1':
      e.preventDefault();
      setView('editor');
      break;
    case '2':
      e.preventDefault();
      setView('diff');
      break;
    case '3':
      e.preventDefault();
      setView('checksum');
      break;
    case 'k':
    case 'K':
      e.preventDefault();
      if (currentView === 'checksum') clearChecksums();
      else clearAll();
      break;
    case 'e':
    case 'E':
      e.preventDefault();
      if (currentView === 'checksum') swapChecksums();
      else swap();
      break;
  }
});

// ── Screenshot demo data (triggered by main process) ─────────────────────
if (window.verifier?.onDemo) {
  window.verifier.onDemo(({ a, b, view, files }) => {
    if (files) {
      loadChecksumFile('A', new File([files.a.content], files.a.name));
      loadChecksumFile('B', new File([files.b.content], files.b.name));
    } else {
      colA.value = a;
      colB.value = b;
      compare();
    }
    if (view) setView(view);
  });
}

colA.focus();
