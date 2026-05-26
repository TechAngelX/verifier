# Verifier

**Instantly know if two things match.**

Paste any string, hash, paragraph, code block, or essay into Column A and Column B — Verifier returns a bold **TRUE** or **FALSE** in real time.

Built for developers, security researchers, and anyone who's ever squinted at two lines of text wondering if they're actually identical.

![Verifier – match](readme_images/02-match.png)

---

## What it's for

**Compare hashes at a glance — instantly.**
Verify transaction hashes, checksums, API keys, wallet addresses, or any token without squinting character by character. Paste both sides and the answer is immediate.

**Catch changes in code.**
Paste two versions of a function, config block, or environment variable side by side. Verifier tells you if they're identical — and if not, shows the exact edit distance so you know how far apart they are.

**Verify essays, notes, and documents.**
Checking that a submitted essay matches a saved draft? Confirming a contract clause wasn't altered? Paste both versions — TRUE means nothing changed, FALSE shows you exactly how much did.

---

## Why

![Verifier – mismatch](readme_images/03-mismatch.png)

---

## Features

| | |
|---|---|
| **Live compare** | Updates TRUE/FALSE as you type |
| **Case sensitive** | Toggle on/off |
| **Trim whitespace** | Strips leading/trailing space before comparing |
| **Ignore newlines** | Flatten multi-line content for comparison |
| **Edit distance** | Levenshtein score shown on every mismatch |
| **Stats** | Char count, word count, line count, length diff |
| **Swap A ↔ B** | One click |
| **Copy Result** | Copies TRUE or FALSE to clipboard |

![Verifier – empty](readme_images/01-empty.png)

---

## Install

Download **Verifier.dmg**, open it, drag to Applications.

> **File size:** The DMG is ~95MB and the installed app is **280MB+**. This is expected — Electron bundles a full Chromium engine and Node.js runtime so the app has zero external dependencies and runs completely offline.

> **macOS Gatekeeper:** Because the app isn't signed with an Apple Developer certificate, macOS will block it on first launch with *"Verifier cannot be opened because it is from an unidentified developer."*
>
> To clear it:
> 1. In Finder, locate **Verifier.app** in your Applications folder
> 2. **Right-click → Open**
> 3. Click **Open** in the dialog that appears
>
> You only need to do this once. After that it launches normally.

---

## Run locally

```bash
npm install
npm start
```

## Build DMG

```bash
npm run build
```

Outputs `Verifier.dmg` directly to `~/Desktop`.

---

## Stack

Pure Electron — no backend, no network, fully offline. Zero telemetry.
