<div align="center">

# Verifier

### A lightweight, instant text string comparison tool.
### Paste anything into Column A and Column B — get **TRUE** or **FALSE** in real time.

*Built for essay writers, copy bloggers, code devs, and anyone who has ever squinted at two lines of text wondering if they are actually identical.*

![Verifier – mismatch](readme_images/03-mismatch.png)

### Can you tell the difference?

*Both columns contain 1,000+ characters of EVM bytecode. One character has been changed. Verifier catches it instantly.*

![Verifier – bytecode diff](readme_images/02-match.png)

---

## What it's for

</div>

**Catch changes in any text.**
Paste two versions of anything — a paragraph, a config, a snippet of code, a form response — side by side. Verifier tells you if they're identical, and if not, shows exactly how far apart they are.

<br>

**Writers, bloggers, and editors.**
Paste your draft and your final version to confirm exactly what changed — or that nothing did. Checking a submitted piece matches a saved copy? Confirming a clause wasn't quietly altered? TRUE means nothing changed. FALSE tells you exactly how much did.

<br>

**Compare hashes at a glance — instantly.**
Verify transaction hashes, checksums, API keys, or any identifier without squinting character by character. Paste both sides and the answer is immediate.

<br>

<div align="center">

<br>

---

<br>

## Features

<br>

| | |
|:---|:---|
| **Live compare** | Updates TRUE / FALSE as you type |
| **Unlimited size** | Paste entire essays, codebases, or documents — no character limit |
| **Case sensitive** | Toggle on / off |
| **Trim whitespace** | Strips leading and trailing space before comparing |
| **Ignore newlines** | Flatten multi-line content for comparison |
| **Edit distance** | Levenshtein score shown on every mismatch |
| **Stats** | Char count, word count, line count, length diff |
| **Swap A ↔ B** | One click |
| **Copy Result** | Copies TRUE or FALSE to clipboard |

<br>

![Verifier – empty](readme_images/01-empty.png)

<br>

---

<br>

## Install

</div>

Download **Verifier.dmg**, open it, drag to Applications.

<br>

> **File size:** The DMG is ~95 MB and the installed app is **280 MB+**. This is expected — Electron bundles a complete Chromium engine and Node.js runtime so the app has zero external dependencies and runs fully offline.

<br>

> **macOS Gatekeeper:** Because the app isn't signed with an Apple Developer certificate, macOS will block it on first launch.
>
> To clear it:
> 1. In Finder, locate **Verifier.app** in your Applications folder
> 2. **Right-click → Open**
> 3. Click **Open** in the dialog that appears
>
> You only need to do this once. After that it launches normally.

<br>

---

<br>

## Run locally

```bash
npm install
npm start
```

<br>

## Build DMG

```bash
npm run build
```

Outputs `Verifier.dmg` directly to `~/Desktop`.

<br>

---

<div align="center">

<br>

*Pure Electron — no backend, no network, fully offline. Zero telemetry. Plug 'n' Play.*

<br>

</div>

---

## Future Implementations

- **Hash functions** — compute and compare MD5, SHA-256, SHA-512, and Keccak-256 digests on the fly, without needing to pre-hash your input
- **Inline diff viewer** — highlight the exact characters and lines that differ between Column A and Column B
- **File drag and drop** — drop any `.txt`, `.json`, `.sol`, `.js`, or `.md` file directly into a column instead of pasting
- **Similarity score** — show a percentage match alongside TRUE / FALSE for fuzzy comparisons
- **Line-by-line diff mode** — toggle a Git-style diff view showing added, removed, and unchanged lines
- **Encoding detection** — auto-detect and normalise Base64, hex, and UTF-8 encoded strings before comparing
- **Comparison history** — save and revisit previous comparisons within the session
- **Windows and Linux builds** — cross-platform DMG / EXE / AppImage releases
- **Keyboard shortcuts** — compare, swap, clear, and copy without touching the mouse

---

## Contributing

Contributions are welcome. Feel free to open an issue or submit a pull request.

---

## Licence

Distributed under the MIT Licence. See `LICENCE` for more information.

---

<div align="center">

## Disclaimer

</div>

This tool is provided as-is for general use. The authors are not responsible for any misuse or unintended consequences.

<br />
<br />

<div align="center">
  <a href="https://techangelx.com" target="_blank">
    <img src="./readme_images/logo.png" alt="Tech Angel X Logo" width="70" height="70">
  </a>
  <br /><br />
  <span style="font-size: 1.4em; font-weight: 300;">
    Built by Ricki Angel • <a href="https://techangelx.com" target="_blank" style="text-decoration: none;">Tech Angel X</a>
  </span>
</div>
