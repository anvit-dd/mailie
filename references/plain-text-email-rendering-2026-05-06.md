# Plain-Text Email Rendering — Research & Fix Notes
**Date:** 2026-05-06
**Status:** COMPLETE

---

## Root Causes Found

### 1. `plainTextToHtml` was dead code (critical bug)
`plainTextToHtml` was added to `src/lib/gmail-utils.ts` but **never called anywhere**. The route `src/app/api/gmail/body/route.ts` still used `autoLinkPlainText` for plain-text emails.

**Evidence:**
```bash
grep -r "plainTextToHtml" src/
# → Only the definition in gmail-utils.ts line 24
# → ZERO call sites
```

### 2. `<pre>` wrapper forced monospace font
`autoLinkPlainText` wraps output in `<pre class="plain-text-email">`. `<pre>` has `white-space: pre` (browser default) which:
- Forces monospace font (Courier/system mono) — wrong for prose
- Does NOT wrap long URLs → horizontal overflow
- Does NOT create paragraph margins (just tiny blank lines)

### 3. No markdown rendering
`autoLinkPlainText` only does URL auto-linking + HTML entity escaping. It does NOT process markdown patterns. `**bold**` stayed as literal asterisks.

**Old pipeline:**
```
plain-text email body
  → autoLinkPlainText(bodyPlain)
  → HTML-escaped text with <a href> for URLs
  → wrapped in <pre>
  → DOMPurify sanitize
  → rendered in iframe
```
Result: `Hello **bold** and *italic*` displayed as `Hello **bold** and *italic*` (literal asterisks)

### 4. HTML escaping before `marked` broke blockquotes
`plainTextToHtml` previously called `escapeHtml()` BEFORE `marked.parse()`. This converted `>` to `&gt;`, which prevented markdown blockquote parsing.

---

## Fixes Applied

### Fix 1: `route.ts` — use `plainTextToHtml` instead of `autoLinkPlainText`
**File:** `src/app/api/gmail/body/route.ts`

```diff
- import { extractBody, autoLinkPlainText, type GmailMessage } from '@/lib/gmail-utils'
+ import { extractBody, plainTextToHtml, type GmailMessage } from '@/lib/gmail-utils'

- // Plain-text email: wrap in <pre> with URL auto-linking so URLs are clickable
+ // Plain-text email: convert to HTML with proper markdown rendering
  const htmlBody = body
    ? body
    : bodyPlain
-     ? `<pre class="plain-text-email">${autoLinkPlainText(bodyPlain)}</pre>`
+     ? plainTextToHtml(bodyPlain)
      : ''
```

### Fix 2: `gmail-utils.ts` — `plainTextToHtml` improvements
**File:** `src/lib/gmail-utils.ts`

Key changes:
1. **Removed pre-escaping** — `marked.parse()` receives raw plain-text. Escaping `<>` before marked broke blockquote parsing (`>` → `&gt;`).
2. **Added wrapper div** — output wrapped in `<div class="plain-text-email">` for CSS scoping.
3. **Added `target="_blank"` to links** — post-processing replaces `<a href=` with `<a target="_blank" rel="noopener noreferrer" href=`.
4. **XSS safety** — `DOMPurify.sanitize()` in the API route strips `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<svg>`, `<math>` from `marked.parse()` output. Raw `<script>` in email body → marked passes through → DOMPurify strips. Safe.

### Fix 3: `gmail-viewer-css.ts` — comprehensive plain-text CSS
**File:** `src/lib/gmail-viewer-css.ts`

Old CSS only handled links inside `<pre>`:
```css
.plain-text-email a.plain-text-link { color: inherit; text-decoration: underline; }
```

New CSS handles full block-level rendering:
```css
/* Block elements — proper paragraph spacing */
.plain-text-email p,
.plain-text-email ul,
.plain-text-email ol,
.plain-text-email blockquote,
.plain-text-email h1..h6,
.plain-text-email pre,
.plain-text-email hr {
  margin-block: 0.75em;
}
.plain-text-email p:first-child { margin-top: 0; }
.plain-text-email p:last-child { margin-bottom: 0; }

/* Links */
.plain-text-email a { color: inherit; text-decoration: underline; }
.plain-text-email a:hover { color: #60a5fa; }

/* Code */
.plain-text-email code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.875em;
  background: rgba(128, 128, 128, 0.15);
  padding: 0.1em 0.3em;
  border-radius: 3px;
}

/* Code blocks */
.plain-text-email pre {
  font-family: ui-monospace, monospace;
  overflow-x: auto;
  white-space: pre;
}

/* Blockquotes */
.plain-text-email blockquote {
  border-left: 3px solid currentColor;
  padding-left: 1em;
  opacity: 0.8;
}

/* Lists */
.plain-text-email ul, .plain-text-email ol { padding-left: 1.5em; }
.plain-text-email li { margin-block: 0.25em; }
```

---

## Rendering Comparison

### Old pipeline output:
```html
<pre class="plain-text-email">Hello **bold** and *italic*.

New paragraph.

- list item 1
- list item 2

Visit https://example.com for more.</pre>
```

### New pipeline output:
```html
<div class="plain-text-email">
  <p>Hello <strong>bold</strong> and <em>italic</em>.</p>
  <p>New paragraph.</p>
  <ul>
    <li>list item 1</li>
    <li>list item 2</li>
  </ul>
  <p>Visit <a target="_blank" rel="noopener noreferrer" href="https://example.com">https://example.com</a> for more.</p>
</div>
```

---

## Security Notes

- **XSS in plain-text emails:** Raw `<script>alert(1)</script>` in email body → `marked.parse()` passes it through as `<script>` → `DOMPurify.sanitize()` strips it (FORBID_TAGS includes `script`). User sees "Click  here." — correct.
- **Links always get `target="_blank"` + `rel="noopener noreferrer"`** — prevents tab stealing.
- **No raw HTML rendered** — DOMPurify FORBID_TAGS: `['script', 'iframe', 'object', 'embed', 'form', 'svg', 'math']`.

---

## Dark Mode Mechanism

The `--email-text-color` CSS custom property is set on the iframe element by `MessageBodyContent` in `message-body.tsx`:
```tsx
style={{
  '--email-text-color': theme === 'dark' ? '#e8e8e8' : '#000000',
} as React.CSSProperties}
```

CSS custom properties on an `<iframe>` element **DO inherit into `srcdoc` documents** — this is standard CSS inheritance across frame boundaries (confirmed by W3C CSS working group discussions and browser behavior).

The `body { color: var(--email-text-color, #000000); }` in `gmail-viewer-css.ts` uses this inherited variable.

The `@media (prefers-color-scheme: dark)` fallback only fires when the OS is in dark mode — this is a fallback, not the primary mechanism.

---

## `marked` Version
`marked@^18.0.3` — verified working for: bold (`**`), italic (`*`), inline code (backticks), code blocks (```), blockquotes (`>`), lists (`-`, `*`, `1.`), headings (`#`), horizontal rules (`---`), URL autolinks, email autolinks.

---

## Key Files Modified

| File | Change |
|---|---|
| `src/app/api/gmail/body/route.ts` | Replaced `autoLinkPlainText` + `<pre>` with `plainTextToHtml` |
| `src/lib/gmail-utils.ts` | Updated `plainTextToHtml`: no pre-escape, `<div>` wrapper, `target="_blank"` on links |
| `src/lib/gmail-viewer-css.ts` | Complete plain-text CSS: paragraph margins, link styles, code styling, blockquotes |
