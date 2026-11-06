# a11y-checker

> Lightweight browser-side WCAG 2.2 accessibility scanner — zero dependencies, ~8KB gzipped.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![WCAG 2.2](https://img.shields.io/badge/WCAG-2.2%20AA-green.svg)](https://www.w3.org/WAI/WCAG22/quickref/)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](package.json)

Built by [Hoju LLC](https://hoju.us) — the same team behind [ScanCompliant](https://scancompliant.com).

---

## Features

- ♿ **WCAG 2.2 Level AA & AAA** checks
- 🖼️ Missing / improper alt text on images and SVGs
- 📋 Heading hierarchy violations (skipped levels, multiple H1s)
- 🏷️ Unlabelled form controls
- 🔗 Generic link text (`click here`, `read more`, etc.)
- 🎨 Color contrast ratio checking (1.4.3 / 1.4.6)
- ⌨️ Positive `tabindex` warnings
- 🧩 Invalid ARIA roles and broken `aria-labelledby` / `aria-describedby` references
- 🌐 Missing `lang` attribute
- 📐 Table accessibility (missing `<th>`, `scope`, `<caption>`)
- 🖼️ Unlabelled iframes
- 🔍 Skip navigation detection
- 🎞️ `prefers-reduced-motion` checks for animation-heavy pages
- 🪟 **In-page results panel** — click any issue to highlight the element on screen
- 📤 JSON export for CI/reporting

---

## Quick Start

### Drop-in script tag
```html
<script src="https://cdn.jsdelivr.net/gh/hojullc/a11y-checker/src/a11y-checker.js"></script>
<script>
  A11yChecker.run();
</script>
```

### npm
```bash
npm install a11y-checker
```
```js
const A11yChecker = require('a11y-checker');
A11yChecker.run({ showPanel: false });
```

---

## API

### `A11yChecker.run(options?)`
Runs all checks and returns an array of issue objects.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `scope` | `Element` | `document.body` | Root element to scan |
| `showPanel` | `boolean` | `true` | Inject floating results panel |
| `wcagLevel` | `'AA'` \| `'AAA'` | `'AA'` | Conformance level for contrast checks |

```js
const issues = A11yChecker.run({
  scope: document.querySelector('#main'),
  showPanel: true,
  wcagLevel: 'AA'
});
```

### `A11yChecker.summary()`
Returns a summary object after `run()`.
```js
// { total: 12, errors: 3, warnings: 7, notices: 2, score: 67 }
const summary = A11yChecker.summary();
console.log(`Accessibility score: ${summary.score}/100`);
```

### `A11yChecker.exportJSON()`
Exports full results as a JSON string — useful for CI pipelines.
```js
const report = A11yChecker.exportJSON();
// Save to file, POST to API, etc.
```

---

## Issue Object Shape

```js
{
  severity: 'error' | 'warning' | 'notice',
  criterion: '1.1.1',          // WCAG success criterion
  message: 'Image missing alt attribute.',
  selector: 'section > img',   // CSS path to element
  element: HTMLElement,         // Direct DOM reference
  fix: 'Add alt="" for decorative images...'
}
```

---

## WCAG Criteria Covered

| Criterion | Description |
|-----------|-------------|
| 1.1.1 | Non-text Content (images, SVGs) |
| 1.3.1 | Info and Relationships (forms, tables, headings) |
| 1.4.3 | Contrast (Minimum) |
| 1.4.6 | Contrast (Enhanced) |
| 2.1.1 | Keyboard (tabindex) |
| 2.3.3 | Animation from Interactions |
| 2.4.1 | Bypass Blocks (skip nav) |
| 2.4.4 | Link Purpose |
| 2.4.6 | Headings and Labels |
| 2.4.11 | Focus Not Obscured |
| 3.1.1 | Language of Page |
| 3.3.2 | Labels or Instructions |
| 4.1.2 | Name, Role, Value (ARIA, buttons, iframes) |

---

## Demo

Open `demo/index.html` in your browser — it contains intentional accessibility issues so you can see the scanner in action.

---

## License

MIT © [Hoju LLC](https://hoju.us)
