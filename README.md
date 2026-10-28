# Media Manipulation Signal Analyzer

**Creathon edition: "The Truth in the Age of AI"**. *Think before you share.*

This is an interactive, single-page teaching tool. You paste a news article, viral post, caption, speech or transcript, and it shows which **observable manipulation signals** the text contains. It checks the text against the 20 indicators of the **PSYOPS Identification Tool V8.3**.

It is a plain static site: no build step, no dependencies, no server. It works offline, from GitHub Pages, or by double-clicking `index.html`.

## Run it

- **Locally:** open `index.html` in a browser, or run `python3 -m http.server` in this folder and visit <http://localhost:8000>.
- **GitHub Pages:** go to *Settings → Pages → Build and deployment*, choose **Deploy from a branch**, then pick `main` and `/ (root)`. The site is published at `https://<user>.github.io/<repo>/`.
- **Stage shortcuts:** `index.html#preset=wwiii`, `#preset=crisis` or `#preset=wire` loads a preset and analyzes it straight away. In the text box, <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> runs the analysis.

## What's inside

| Area | What it does |
|---|---|
| Input workspace | A textarea with live word and character counters, plus optional metadata (source, platform, date label, virality notes). It also has three one-click presets, **Analyze Signals** (with a scanning animation), **Compare Presets** and **Clear / Reset**. |
| Signal Intensity Index | A semicircle gauge, computed as `round(((avg of assessed scores − 1) / 4) × 100)`, with green, yellow, orange and red bands. It shows **Insufficient Evidence** when nothing can be assessed. Below it are the methodological notice and the coverage badge. |
| Interpretation banner | A measured summary that answers *"What potential manipulation signals can we observe in this content?"* It never gives a yes/no answer on whether something is a PSYOP. |
| Annotated text | Each verbatim evidence quote is highlighted inline. Clicking a highlight opens its finding card, and opening a card highlights its quote. |
| 20-indicator chart | Horizontal bars on a 1–5 scale. Rows that cannot be assessed show **N/A: Context Needed**. You can sort and filter the rows, and hovering shows a tooltip. |
| Distribution | A donut and a stacked bar showing weak, moderate, strong and N/A counts. |
| Findings & missing context | Expandable cards for all 20 indicators, plus a panel that explains how to investigate each indicator that can't be judged from the text alone. |
| Scoring worksheet (Creathon edition) | A reworked version of the PSYOPS V8.3 sheet. The 20 indicators are grouped into five themes, each with a subtotal: Emotion & urgency, Story & framing, Evidence & authority, Us vs. them, and Context & motive. Each row has a plain-language question with the original wording underneath, a modern example, "look for" hints and an optional evidence note. A 1–5 scoring guide is included. Rows are prefilled by the analyzer and can be edited, and N/A is never counted as 0. Three AI-era add-ons (recycled media, AI/3D CGI, untraceable source) are scored separately. |
| Video verification lab | You load a video locally, and it is never uploaded. The lab shows file details and extracts 8 key frames, which you can zoom into or download for reverse image search (links to Google Lens, TinEye, Bing and Yandex). An 11-question ground-truth and AI/CGI warning-sign checklist comes with the WWIII case answers. An optional AI frame check sends up to 6 frames to Claude with your own key and describes clues, never giving a verdict. |
| Before You Share | The 3-step verification companion (origin check, ground truth, AI/CGI). The WWIII case has a reveal that shows how fact-checkers exposed the 2021 Blender video. |
| Questions to ask next | Critical-thinking prompts chosen from the highest-scoring indicators and the ones that couldn't be assessed. |
| Export | **Copy Structured Report** copies a Markdown report. **Print / Save as PDF** uses clean `@media print` styles. |

## Architecture

```
index.html          page shell (strict Content-Security-Policy, no inline scripts)
css/styles.css      theme, responsive layout, print styles
js/framework.js     the 20 V8.3 indicators: verbatim names, questions, examples, how to verify
js/engine.js        deterministic heuristic engine (offline), summary and index maths
js/ai.js            optional AI-assisted engine (Claude API, bring your own key)
js/presets.js       the three workshop presets
js/video.js         video verification lab (local frames, warning-sign checklist, optional AI clues)
js/dashboard.js     visualisation layer (gauge, highlighter, bars, donut, cards, checklist, Markdown)
js/app.js           controller that wires input, engines and dashboard together
tests/              node tests for the engine contract
```

**Engines.** The default **offline heuristic engine** scans the text for lexical and structural cues for each indicator. It looks at fear and outrage vocabulary, urgency phrases, absolutes, either/or constructions, unsourced statistics, labels aimed at critics, attribution and hedging, ALL-CAPS ratio, exclamation marks, and so on. The same input always produces the same output, so it is reliable on stage. Indicators that depend on outside evidence (1 Timing, 3 Uniform Messaging, 10 Financial/Political Gain, 13 Bandwagon, 19 Rapid Behavior Shifts, 20 Historical Parallels) are scored only when the text or the context notes contain explicit cues. Otherwise they are marked **Cannot assess**.

**AI-assisted mode** is optional and clearly labelled. The presenter pastes their own Anthropic API key at runtime. The key stays in memory for that tab only and is never stored or committed. The text is wrapped as untrusted data and the response is constrained to a JSON schema. Every field is then re-validated with the same rules as the offline engine: quotes that are not verbatim substrings are dropped, and invalid status/score pairs are corrected. If the call fails, the app falls back to the offline engine.

**Security.** All user text is rendered with `textContent`, never as HTML. A strict CSP blocks inline and third-party scripts and allows network access only to the optional AI endpoint.

## Tests

```
node --test tests/*.test.js
```

## Disclaimer

> Educational analysis only. Communication patterns can suggest rhetorical manipulation, but they cannot establish the existence of a psychological operation, its intent, coordination, or authorship. The scoring index is illustrative and has not been scientifically validated. Think before you share.

Preset 1 is an educational recreation of the April 13, 2024 viral post. It is not a verbatim copy. Presets 2 and 3 are fictional.
