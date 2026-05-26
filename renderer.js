const colA = document.getElementById('colA');
const colB = document.getElementById('colB');
const resultBadge = document.getElementById('resultBadge');
const resultDetail = document.getElementById('resultDetail');
const badgeAura = document.getElementById('badgeAura');
const countA = document.getElementById('countA');
const countB = document.getElementById('countB');
const liveToggle = document.getElementById('liveToggle');
const liveDot = document.getElementById('liveDot');
const caseSensitive = document.getElementById('caseSensitive');
const trimWhitespace = document.getElementById('trimWhitespace');
const ignoreNewlines = document.getElementById('ignoreNewlines');

function normalize(str) {
  let s = str;
  if (trimWhitespace.checked) s = s.trim();
  if (ignoreNewlines.checked) s = s.replace(/\r?\n/g, ' ');
  if (!caseSensitive.checked) s = s.toLowerCase();
  return s;
}

function charCount(str) {
  return str.length === 1 ? '1 char' : `${str.length.toLocaleString()} chars`;
}

function levenshteinDistance(a, b) {
  // Only compute for strings under 5000 chars to keep it fast
  if (a.length > 5000 || b.length > 5000) return null;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function compare() {
  const rawA = colA.value;
  const rawB = colB.value;

  countA.textContent = charCount(rawA);
  countB.textContent = charCount(rawB);

  if (!rawA && !rawB) {
    resultBadge.textContent = '—';
    resultBadge.className = 'badge empty';
    badgeAura.className = 'badge-aura';
    resultDetail.innerHTML = 'Enter content in both columns to compare.';
    return;
  }

  if (!rawA || !rawB) {
    resultBadge.textContent = '—';
    resultBadge.className = 'badge empty';
    badgeAura.className = 'badge-aura';
    resultDetail.innerHTML = 'Waiting for both columns&hellip;';
    return;
  }

  const a = normalize(rawA);
  const b = normalize(rawB);
  const isMatch = a === b;

  resultBadge.textContent = isMatch ? 'TRUE' : 'FALSE';
  resultBadge.className = `badge ${isMatch ? 'true' : 'false'}`;
  badgeAura.className = `badge-aura ${isMatch ? 'true' : 'false'}`;

  if (isMatch) {
    const lines = rawA.split('\n').length;
    const words = rawA.trim().split(/\s+/).filter(Boolean).length;
    resultDetail.innerHTML =
      `<span class="match-count">Exact match</span> &mdash; ${rawA.length.toLocaleString()} chars &nbsp;|&nbsp; ${words.toLocaleString()} words &nbsp;|&nbsp; ${lines.toLocaleString()} lines`;
  } else {
    const dist = levenshteinDistance(a, b);
    const lenDiff = Math.abs(rawA.length - rawB.length);
    let detail = `<span class="diff-count">No match</span>`;
    detail += ` &mdash; A: ${rawA.length.toLocaleString()} chars, B: ${rawB.length.toLocaleString()} chars`;
    if (lenDiff > 0) detail += ` &nbsp;|&nbsp; length diff: ${lenDiff.toLocaleString()}`;
    if (dist !== null) detail += ` &nbsp;|&nbsp; edit distance: ${dist.toLocaleString()}`;
    resultDetail.innerHTML = detail;
  }
}

// Live compare wiring
function updateLiveDot() {
  liveDot.classList.toggle('off', !liveToggle.checked);
}

liveToggle.addEventListener('change', updateLiveDot);
updateLiveDot();

let debounceTimer;
function debouncedCompare() {
  if (!liveToggle.checked) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(compare, 120);
}

colA.addEventListener('input', () => {
  countA.textContent = charCount(colA.value);
  debouncedCompare();
});

colB.addEventListener('input', () => {
  countB.textContent = charCount(colB.value);
  debouncedCompare();
});

[caseSensitive, trimWhitespace, ignoreNewlines].forEach(el => {
  el.addEventListener('change', () => {
    if (liveToggle.checked) compare();
  });
});

// Buttons
document.getElementById('compareBtn').addEventListener('click', compare);

document.getElementById('clearBtn').addEventListener('click', () => {
  colA.value = '';
  colB.value = '';
  countA.textContent = '0 chars';
  countB.textContent = '0 chars';
  resultBadge.textContent = '—';
  resultBadge.className = 'badge empty';
  resultDetail.innerHTML = 'Enter content in both columns to compare.';
});

document.getElementById('swapBtn').addEventListener('click', () => {
  const tmp = colA.value;
  colA.value = colB.value;
  colB.value = tmp;
  compare();
});

document.getElementById('copyBtn').addEventListener('click', () => {
  const text = resultBadge.textContent;
  if (text === '—') return;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copyBtn');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy Result'; }, 1200);
  });
});

// Screenshot demo data (triggered by main process)
if (window.verifier?.onDemo) {
  window.verifier.onDemo(({ a, b }) => {
    colA.value = a;
    colB.value = b;
    compare();
  });
}
