/*!
 * a11y-checker v1.0.0
 * Browser-side WCAG 2.2 accessibility scanner
 * https://github.com/hojullc/a11y-checker
 * MIT License — Hoju LLC (hoju.us)
 */
(function (global) {
  'use strict';

  /* ─────────────────────────────────────────
     WCAG 2.2 contrast ratios
  ───────────────────────────────────────── */
  const CONTRAST = { AA_NORMAL: 4.5, AA_LARGE: 3.0, AAA_NORMAL: 7.0, AAA_LARGE: 4.5 };

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const full = h.length === 3
      ? h.split('').map(c => c + c).join('')
      : h;
    const n = parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function parseCssColor(color) {
    if (!color || color === 'transparent') return null;
    const tmp = document.createElement('div');
    tmp.style.color = color;
    document.body.appendChild(tmp);
    const computed = getComputedStyle(tmp).color;
    document.body.removeChild(tmp);
    const m = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3] };
  }

  function relativeLuminance({ r, g, b }) {
    const chan = [r, g, b].map(c => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
  }

  function contrastRatio(c1, c2) {
    const l1 = relativeLuminance(c1);
    const l2 = relativeLuminance(c2);
    const lighter = Math.max(l1, l2);
    const darker  = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /* ─────────────────────────────────────────
     GENERIC HELPERS
  ───────────────────────────────────────── */
  const GENERIC_LINK_TEXT = /^(click here|here|read more|more|link|this|details|learn more|view|go)$/i;

  function getTextContent(el) {
    return (el.textContent || el.innerText || '').trim().replace(/\s+/g, ' ');
  }

  function fontSize(el) {
    return parseFloat(getComputedStyle(el).fontSize) || 16;
  }

  function isBold(el) {
    const w = getComputedStyle(el).fontWeight;
    return parseInt(w) >= 700 || w === 'bold' || w === 'bolder';
  }

  function isLargeText(el) {
    const size = fontSize(el);
    return size >= 18 || (size >= 14 && isBold(el));
  }

  function isHidden(el) {
    const s = getComputedStyle(el);
    return s.display === 'none' || s.visibility === 'hidden' || el.getAttribute('aria-hidden') === 'true';
  }

  function xPath(el) {
    if (el.id) return `#${el.id}`;
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1) {
      let selector = cur.tagName.toLowerCase();
      if (cur.className) selector += '.' + [...cur.classList].slice(0, 2).join('.');
      parts.unshift(selector);
      cur = cur.parentElement;
      if (parts.length > 4) break;
    }
    return parts.join(' > ');
  }

  /* ─────────────────────────────────────────
     RESULT BUILDER
  ───────────────────────────────────────── */
  function issue(severity, criterion, message, element, fix) {
    return { severity, criterion, message, selector: xPath(element), element, fix };
  }

  /* ═══════════════════════════════════════
     A11Y CHECKER
  ═══════════════════════════════════════ */
  const A11yChecker = {
    version: '1.0.0',
    results: [],

    /**
     * Run all WCAG 2.2 checks.
     * @param {Object} options
     * @param {Element}  [options.scope=document.body] - Root element to scan
     * @param {boolean}  [options.showPanel=true]      - Inject results panel into the page
     * @param {'AA'|'AAA'} [options.wcagLevel='AA']    - Conformance level
     * @returns {Array} Array of issue objects
     */
    run(options = {}) {
      this.options = Object.assign({ scope: document.body, showPanel: true, wcagLevel: 'AA' }, options);
      this.results = [];

      this._checkImages();
      this._checkHeadings();
      this._checkForms();
      this._checkLinks();
      this._checkButtons();
      this._checkColorContrast();
      this._checkARIA();
      this._checkLanguage();
      this._checkSkipNav();
      this._checkTabIndex();
      this._checkFocusVisible();
      this._checkTables();
      this._checkIframes();
      this._checkMotion();

      if (this.options.showPanel) this._renderPanel();

      console.group('%ca11y-checker results', 'color:#58a6ff;font-weight:700;font-size:14px');
      const errors   = this.results.filter(r => r.severity === 'error');
      const warnings = this.results.filter(r => r.severity === 'warning');
      const notices  = this.results.filter(r => r.severity === 'notice');
      console.log(`%c✗ ${errors.length} Errors  ⚠ ${warnings.length} Warnings  ℹ ${notices.length} Notices`,
        'color:#f78166;font-weight:600');
      this.results.forEach(r => {
        const color = r.severity === 'error' ? '#f78166' : r.severity === 'warning' ? '#e3b341' : '#8b949e';
        console.log(`%c[${r.criterion}] ${r.message}\n  → ${r.selector}`, `color:${color}`);
      });
      console.groupEnd();

      return this.results;
    },

    /* ── 1.1.1 Non-text Content ── */
    _checkImages() {
      const imgs = this.options.scope.querySelectorAll('img');
      imgs.forEach(img => {
        if (isHidden(img)) return;
        const alt = img.getAttribute('alt');
        const role = img.getAttribute('role');
        if (alt === null) {
          this.results.push(issue('error', '1.1.1', 'Image missing alt attribute.', img,
            'Add alt="" for decorative images, or a descriptive alt for meaningful ones.'));
        } else if (alt === '' && role !== 'presentation' && role !== 'none') {
          this.results.push(issue('notice', '1.1.1', 'Image has empty alt — verify it is decorative.', img,
            'If decorative, also add role="presentation". If meaningful, add descriptive alt text.'));
        } else if (alt.match(/^(image|photo|picture|img|graphic|icon)\s/i)) {
          this.results.push(issue('warning', '1.1.1', `Alt text starts with redundant word: "${alt}"`, img,
            'Screen readers already announce "image". Start the alt with the subject directly.'));
        }
      });

      /* SVG */
      this.options.scope.querySelectorAll('svg').forEach(svg => {
        if (isHidden(svg)) return;
        const hasTitle = svg.querySelector('title');
        const hasLabel = svg.getAttribute('aria-label') || svg.getAttribute('aria-labelledby');
        const isDecorative = svg.getAttribute('aria-hidden') === 'true' || svg.getAttribute('role') === 'presentation';
        if (!hasTitle && !hasLabel && !isDecorative) {
          this.results.push(issue('warning', '1.1.1', 'SVG has no accessible name and is not marked decorative.', svg,
            'Add a <title> child element, or aria-label, or aria-hidden="true" if decorative.'));
        }
      });
    },

    /* ── 1.3.1 Info & Relationships / 2.4.6 Headings ── */
    _checkHeadings() {
      const headings = [...this.options.scope.querySelectorAll('h1,h2,h3,h4,h5,h6')]
        .filter(h => !isHidden(h));

      /* Multiple H1s */
      const h1s = headings.filter(h => h.tagName === 'H1');
      if (h1s.length === 0) {
        this.results.push(issue('warning', '2.4.6', 'No H1 found on the page.', document.body,
          'Every page should have exactly one H1 describing the main content.'));
      } else if (h1s.length > 1) {
        h1s.slice(1).forEach(h => this.results.push(issue('warning', '2.4.6',
          'Multiple H1 elements found — only one is recommended.', h,
          'Use H2–H6 for sub-sections. Reserve H1 for the page title.')));
      }

      /* Heading hierarchy — no skips */
      let prev = 0;
      headings.forEach(h => {
        const level = parseInt(h.tagName[1], 10);
        if (prev && level > prev + 1) {
          this.results.push(issue('error', '1.3.1',
            `Heading level skipped: H${prev} → H${level} ("${getTextContent(h).slice(0, 60)}")`, h,
            `Change this to H${prev + 1}, or restructure the content hierarchy.`));
        }
        prev = level;
      });

      /* Empty headings */
      headings.forEach(h => {
        if (!getTextContent(h) && !h.getAttribute('aria-label')) {
          this.results.push(issue('error', '2.4.6', `Empty ${h.tagName} element.`, h,
            'Remove the heading or add meaningful text content.'));
        }
      });
    },

    /* ── 1.3.1 / 3.3.2 Labels & Instructions ── */
    _checkForms() {
      const inputs = this.options.scope.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), textarea, select'
      );
      inputs.forEach(input => {
        if (isHidden(input)) return;
        const id = input.id;
        const hasLabel = id && document.querySelector(`label[for="${id}"]`);
        const hasAriaLabel = input.getAttribute('aria-label');
        const hasAriaLabelledby = input.getAttribute('aria-labelledby');
        const hasTitle = input.getAttribute('title');

        if (!hasLabel && !hasAriaLabel && !hasAriaLabelledby && !hasTitle) {
          this.results.push(issue('error', '3.3.2',
            `Form control has no accessible label (${input.tagName.toLowerCase()}${input.type ? '[type=' + input.type + ']' : ''}).`,
            input, 'Add a <label for="id">, aria-label, or aria-labelledby attribute.'));
        }

        /* Required fields */
        if (input.required && !input.getAttribute('aria-required')) {
          this.results.push(issue('notice', '3.3.2',
            'Required field uses HTML "required" but not aria-required="true".', input,
            'Add aria-required="true" for broader screen reader support.'));
        }

        /* Placeholder as label substitute */
        if (input.placeholder && !hasLabel && !hasAriaLabel) {
          this.results.push(issue('warning', '3.3.2',
            'Placeholder text is used as the only label — it disappears when typing.', input,
            'Add a persistent visible label. Placeholder can supplement but not replace it.'));
        }
      });
    },

    /* ── 2.4.4 Link Purpose ── */
    _checkLinks() {
      this.options.scope.querySelectorAll('a[href]').forEach(a => {
        if (isHidden(a)) return;
        const text = getTextContent(a);
        const ariaLabel = a.getAttribute('aria-label');
        const ariaLabelledby = a.getAttribute('aria-labelledby');
        const title = a.getAttribute('title');
        const accessibleName = ariaLabel || ariaLabelledby || text || title;

        if (!accessibleName) {
          this.results.push(issue('error', '2.4.4', 'Link has no accessible name.', a,
            'Add descriptive text content, or aria-label if the link is icon-only.'));
        } else if (GENERIC_LINK_TEXT.test(accessibleName.trim())) {
          this.results.push(issue('warning', '2.4.4',
            `Generic link text: "${accessibleName}" — not descriptive out of context.`, a,
            'Use descriptive text like "Read the accessibility guide" instead of "Click here".'));
        }

        /* Opens in new tab warning */
        if ((a.target === '_blank' || a.rel === 'noopener') && !accessibleName.match(/new tab|new window/i)) {
          this.results.push(issue('notice', '2.4.4', 'Link opens in new tab with no warning.', a,
            'Add (opens in new tab) to link text or aria-label, or add a visible icon with alt text.'));
        }
      });
    },

    /* ── 4.1.2 Name, Role, Value — Buttons ── */
    _checkButtons() {
      this.options.scope.querySelectorAll('button, [role="button"]').forEach(btn => {
        if (isHidden(btn)) return;
        const text = getTextContent(btn);
        const ariaLabel = btn.getAttribute('aria-label');
        const ariaLabelledby = btn.getAttribute('aria-labelledby');
        const title = btn.getAttribute('title');

        if (!text && !ariaLabel && !ariaLabelledby && !title) {
          this.results.push(issue('error', '4.1.2', 'Button has no accessible name.', btn,
            'Add text content or aria-label. For icon buttons, aria-label is preferred.'));
        }
      });

      /* DIV/SPAN acting as button without role */
      this.options.scope.querySelectorAll('div[onclick], span[onclick]').forEach(el => {
        if (el.getAttribute('role')) return;
        this.results.push(issue('warning', '4.1.2',
          `<${el.tagName.toLowerCase()}> with onclick has no role="button".`, el,
          'Add role="button" and tabindex="0" and keyboard event handlers, or use a real <button>.'));
      });
    },

    /* ── 1.4.3 / 1.4.6 Color Contrast ── */
    _checkColorContrast() {
      const level = this.options.wcagLevel;
      const textEls = this.options.scope.querySelectorAll('p,span,a,li,td,th,label,h1,h2,h3,h4,h5,h6,button,div');

      let checked = 0;
      textEls.forEach(el => {
        if (isHidden(el) || checked > 200) return; // limit for perf
        const text = getTextContent(el);
        if (!text || text.length < 1) return;

        const style = getComputedStyle(el);
        const fgColor = parseCssColor(style.color);
        const bgColor = parseCssColor(style.backgroundColor);
        if (!fgColor || !bgColor) return;

        const ratio = contrastRatio(fgColor, bgColor);
        const large = isLargeText(el);
        const required = large
          ? (level === 'AAA' ? CONTRAST.AAA_LARGE : CONTRAST.AA_LARGE)
          : (level === 'AAA' ? CONTRAST.AAA_NORMAL : CONTRAST.AA_NORMAL);

        if (ratio < required) {
          this.results.push(issue('error', '1.4.3',
            `Contrast ratio ${ratio.toFixed(2)}:1 — required ${required}:1 (${large ? 'large' : 'normal'} text, WCAG ${level}).`,
            el, `Increase contrast between text and background. Current ratio: ${ratio.toFixed(2)}:1.`));
        }
        checked++;
      });
    },

    /* ── 4.1.2 ARIA ── */
    _checkARIA() {
      /* aria-required attributes */
      const validARIARoles = ['alert','alertdialog','application','article','banner','button',
        'cell','checkbox','columnheader','combobox','complementary','contentinfo','definition',
        'dialog','directory','document','feed','figure','form','grid','gridcell','group',
        'heading','img','link','list','listbox','listitem','log','main','marquee','math',
        'menu','menubar','menuitem','menuitemcheckbox','menuitemradio','navigation','none',
        'note','option','presentation','progressbar','radio','radiogroup','region','row',
        'rowgroup','rowheader','scrollbar','search','searchbox','separator','slider',
        'spinbutton','status','switch','tab','table','tablist','tabpanel','term','textbox',
        'timer','toolbar','tooltip','tree','treegrid','treeitem'];

      this.options.scope.querySelectorAll('[role]').forEach(el => {
        const role = el.getAttribute('role');
        if (role && !validARIARoles.includes(role)) {
          this.results.push(issue('error', '4.1.2', `Invalid ARIA role: "${role}"`, el,
            `Use a valid WAI-ARIA role. Valid options include: ${validARIARoles.slice(0, 8).join(', ')}, …`));
        }
      });

      /* aria-labelledby targets */
      this.options.scope.querySelectorAll('[aria-labelledby]').forEach(el => {
        const ids = el.getAttribute('aria-labelledby').split(/\s+/);
        ids.forEach(id => {
          if (!document.getElementById(id)) {
            this.results.push(issue('error', '4.1.2',
              `aria-labelledby references non-existent ID: "${id}"`, el,
              `Ensure an element with id="${id}" exists on the page.`));
          }
        });
      });

      /* aria-describedby targets */
      this.options.scope.querySelectorAll('[aria-describedby]').forEach(el => {
        const ids = el.getAttribute('aria-describedby').split(/\s+/);
        ids.forEach(id => {
          if (!document.getElementById(id)) {
            this.results.push(issue('warning', '4.1.2',
              `aria-describedby references non-existent ID: "${id}"`, el,
              `Ensure an element with id="${id}" exists on the page.`));
          }
        });
      });
    },

    /* ── 3.1.1 Language of Page ── */
    _checkLanguage() {
      const html = document.documentElement;
      if (!html.getAttribute('lang')) {
        this.results.push(issue('error', '3.1.1', 'Page <html> element has no lang attribute.', html,
          'Add lang="en" (or appropriate BCP47 language tag) to <html>.'));
      } else {
        const lang = html.getAttribute('lang');
        if (!/^[a-z]{2,3}(-[A-Z]{2,3})?$/.test(lang)) {
          this.results.push(issue('warning', '3.1.1', `lang="${lang}" may not be a valid BCP47 tag.`, html,
            'Use a valid BCP47 language tag, e.g. "en", "en-US", "fr", "es-MX".'));
        }
      }
    },

    /* ── 2.4.1 Bypass Blocks ── */
    _checkSkipNav() {
      const skipLinks = document.querySelectorAll('a[href^="#"]');
      let hasSkip = false;
      skipLinks.forEach(a => {
        const text = getTextContent(a).toLowerCase();
        if (text.includes('skip') || text.includes('jump') || text.includes('main')) {
          hasSkip = true;
        }
      });
      if (!hasSkip) {
        this.results.push(issue('warning', '2.4.1', 'No skip navigation link detected.', document.body,
          'Add a "Skip to main content" link as the first focusable element on the page.'));
      }
    },

    /* ── 2.1.1 Keyboard / tabindex ── */
    _checkTabIndex() {
      this.options.scope.querySelectorAll('[tabindex]').forEach(el => {
        const ti = parseInt(el.getAttribute('tabindex'), 10);
        if (ti > 0) {
          this.results.push(issue('warning', '2.1.1',
            `tabindex="${ti}" — positive tabindex values disrupt natural focus order.`, el,
            'Use tabindex="0" to include in natural order, or tabindex="-1" to exclude.'));
        }
      });
    },

    /* ── 2.4.11 Focus Not Obscured ── */
    _checkFocusVisible() {
      const interactive = this.options.scope.querySelectorAll('a,button,input,select,textarea,[tabindex="0"]');
      let obscuredCount = 0;
      interactive.forEach(el => {
        if (isHidden(el)) return;
        const style = getComputedStyle(el, ':focus');
        if (style.outlineStyle === 'none' && style.outlineWidth === '0px' &&
            style.boxShadow === 'none' && !el.closest('[data-focus-visible]')) {
          obscuredCount++;
        }
      });
      if (obscuredCount > 3) {
        this.results.push(issue('warning', '2.4.11',
          `${obscuredCount} interactive elements may have no visible focus indicator.`, document.body,
          'Ensure :focus or :focus-visible styles are set for all interactive elements. Minimum 2px outline.'));
      }
    },

    /* ── 1.3.1 Tables ── */
    _checkTables() {
      this.options.scope.querySelectorAll('table').forEach(table => {
        if (isHidden(table)) return;
        const hasCaption = table.querySelector('caption');
        const hasAriaLabel = table.getAttribute('aria-label') || table.getAttribute('aria-labelledby');
        if (!hasCaption && !hasAriaLabel) {
          this.results.push(issue('warning', '1.3.1', 'Data table has no caption or aria-label.', table,
            'Add a <caption> element or aria-label to describe the table\'s purpose.'));
        }

        const headers = table.querySelectorAll('th');
        if (headers.length === 0) {
          this.results.push(issue('error', '1.3.1', 'Table has no <th> header cells.', table,
            'Add <th> elements with appropriate scope attributes (scope="col" or scope="row").'));
        } else {
          headers.forEach(th => {
            if (!th.getAttribute('scope') && !th.getAttribute('id')) {
              this.results.push(issue('warning', '1.3.1', '<th> missing scope attribute.', th,
                'Add scope="col" for column headers or scope="row" for row headers.'));
            }
          });
        }
      });
    },

    /* ── 4.1.2 Iframes ── */
    _checkIframes() {
      this.options.scope.querySelectorAll('iframe').forEach(frame => {
        const title = frame.getAttribute('title');
        const ariaLabel = frame.getAttribute('aria-label');
        if (!title && !ariaLabel) {
          this.results.push(issue('error', '4.1.2', '<iframe> has no title attribute.', frame,
            'Add title="Description of frame content" or aria-label to every iframe.'));
        }
      });
    },

    /* ── 2.3.3 Animation from Interactions ── */
    _checkMotion() {
      const hasParallax = document.querySelectorAll('[data-parallax],[data-aos],[data-sal]').length > 0;
      if (hasParallax) {
        const hasMotionQuery = [...document.styleSheets].some(sheet => {
          try {
            return [...sheet.cssRules].some(rule =>
              rule.media && rule.media.mediaText.includes('prefers-reduced-motion')
            );
          } catch { return false; }
        });
        if (!hasMotionQuery) {
          this.results.push(issue('warning', '2.3.3',
            'Scroll/parallax animations detected but no prefers-reduced-motion media query found.', document.body,
            'Add @media (prefers-reduced-motion: reduce) { ... } to disable animations for users who prefer it.'));
        }
      }
    },

    /* ─────────────────────────────────────────
       RESULTS PANEL
    ───────────────────────────────────────── */
    _renderPanel() {
      const existing = document.getElementById('a11y-checker-panel');
      if (existing) existing.remove();

      const errors   = this.results.filter(r => r.severity === 'error').length;
      const warnings = this.results.filter(r => r.severity === 'warning').length;
      const notices  = this.results.filter(r => r.severity === 'notice').length;

      const panel = document.createElement('div');
      panel.id = 'a11y-checker-panel';
      panel.setAttribute('role', 'complementary');
      panel.setAttribute('aria-label', 'Accessibility issues panel');
      panel.style.cssText = `
        position:fixed;bottom:20px;right:20px;width:380px;max-height:520px;
        background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:12px;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;
        box-shadow:0 20px 60px rgba(0,0,0,0.6);z-index:999999;overflow:hidden;
        display:flex;flex-direction:column;
      `;

      const header = document.createElement('div');
      header.style.cssText = 'padding:14px 16px;background:#161b22;border-bottom:1px solid #30363d;display:flex;align-items:center;justify-content:space-between;cursor:move;';
      header.innerHTML = `
        <div>
          <strong style="color:#58a6ff;font-size:14px">a11y-checker</strong>
          <span style="color:#8b949e;margin-left:8px;font-size:11px">v${this.version}</span>
        </div>
        <div style="display:flex;gap:10px;align-items:center">
          <span style="color:#f78166">✗ ${errors}</span>
          <span style="color:#e3b341">⚠ ${warnings}</span>
          <span style="color:#8b949e">ℹ ${notices}</span>
          <button id="a11y-close" style="background:none;border:none;color:#8b949e;cursor:pointer;font-size:16px;padding:0;line-height:1" aria-label="Close panel">×</button>
        </div>
      `;

      const body = document.createElement('div');
      body.style.cssText = 'overflow-y:auto;flex:1;padding:8px 0;';

      this.results.forEach((r, i) => {
        const item = document.createElement('div');
        const color = r.severity === 'error' ? '#f78166' : r.severity === 'warning' ? '#e3b341' : '#8b949e';
        const icon  = r.severity === 'error' ? '✗' : r.severity === 'warning' ? '⚠' : 'ℹ';
        item.style.cssText = `padding:10px 16px;border-bottom:1px solid #21262d;cursor:pointer;transition:background .15s;`;
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');
        item.setAttribute('aria-label', `Issue ${i+1}: ${r.message}`);
        item.innerHTML = `
          <div style="display:flex;align-items:flex-start;gap:8px">
            <span style="color:${color};flex-shrink:0;font-size:12px;margin-top:1px">${icon}</span>
            <div>
              <div style="color:#e6edf3;line-height:1.4;margin-bottom:4px">${r.message}</div>
              <div style="color:#58a6ff;font-size:11px;font-family:monospace">${r.selector}</div>
              <div style="color:#8b949e;font-size:11px;margin-top:3px">WCAG ${r.criterion}</div>
            </div>
          </div>
        `;
        item.addEventListener('mouseover', () => item.style.background = '#161b22');
        item.addEventListener('mouseout',  () => item.style.background = '');
        item.addEventListener('click', () => {
          if (r.element && r.element.scrollIntoView) {
            r.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const prev = r.element.style.outline;
            r.element.style.outline = '3px solid #f78166';
            setTimeout(() => { r.element.style.outline = prev; }, 2000);
          }
        });
        body.appendChild(item);
      });

      if (this.results.length === 0) {
        body.innerHTML = '<div style="padding:24px;text-align:center;color:#3fb950">✓ No issues found! Great work.</div>';
      }

      panel.appendChild(header);
      panel.appendChild(body);
      document.body.appendChild(panel);

      document.getElementById('a11y-close').addEventListener('click', () => panel.remove());
    },

    /**
     * Get a summary of results.
     * @returns {Object} { total, errors, warnings, notices, score }
     */
    summary() {
      const errors   = this.results.filter(r => r.severity === 'error').length;
      const warnings = this.results.filter(r => r.severity === 'warning').length;
      const notices  = this.results.filter(r => r.severity === 'notice').length;
      const total    = this.results.length;
      const score    = Math.max(0, Math.round(100 - errors * 10 - warnings * 3 - notices * 1));
      return { total, errors, warnings, notices, score };
    },

    /**
     * Export results as JSON.
     * @returns {string} JSON string
     */
    exportJSON() {
      return JSON.stringify({
        version: this.version,
        url: location.href,
        timestamp: new Date().toISOString(),
        summary: this.summary(),
        issues: this.results.map(r => ({
          severity: r.severity,
          criterion: r.criterion,
          message: r.message,
          selector: r.selector,
          fix: r.fix
        }))
      }, null, 2);
    }
  };

  /* Expose globally */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = A11yChecker;
  } else {
    global.A11yChecker = A11yChecker;
  }

}(typeof window !== 'undefined' ? window : this));
