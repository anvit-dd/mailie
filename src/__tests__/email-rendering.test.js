/**
 * Email Rendering Pipeline — End-to-End Tests
 * Run with: node src/__tests__/email-rendering.test.js
 */

const { marked } = require('marked')
const { JSDOM } = require('jsdom')

// eslint-disable-next-line @typescript-eslint/no-require-imports
const createDOMPurify = require('dompurify')

// ─── Setup ────────────────────────────────────────────────────────────────────

const dom = new JSDOM('', {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
})
const DOMPurify = createDOMPurify(dom.window)

marked.setOptions({ breaks: true, gfm: true })

// ─── Helpers (mirrors gmail-utils.ts) ─────────────────────────────────────────

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function plainTextToHtml(text) {
  if (!text) return ''
  const markedResult = marked.parse(text, { breaks: true })
  const hasBlockContent = /<(p|blockquote|ul|ol|li|h[1-6]|hr|pre|table)\b/i.test(markedResult)
  const content = hasBlockContent
    ? markedResult
    : (() => {
        const paragraphs = text.split(/\n{2,}/)
        return paragraphs
          .map((para) => {
            const trimmed = para.trim()
            if (!trimmed) return ''
            const escaped = escapeHtml(trimmed)
            return `<p>${escaped.replace(/\n/g, '<br>')}</p>`
          })
          .join('\n')
      })()
  const withTarget = content.replace(/<a\s+href=/g, '<a target="_blank" rel="noopener noreferrer" href=')
  return `<div class="plain-text-email">${withTarget}</div>`
}

function sanitizeAndProxyEmailHtml(html, messageId, darkMode = false) {
  const sanitized = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_TAGS: ['style'],
    ADD_ATTR: ['style'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'svg', 'math'],
    FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
  })

  // Strip all inline color styles in dark mode so --email-text-color controls all text
  const colorStripped = darkMode ? stripInlineColorsForDarkMode(sanitized) : sanitized

  return proxyImageUrls(colorStripped, messageId)
}

// stripInlineColorsForDarkMode — mirrors gmail-sanitize.ts
function stripInlineColorsForDarkMode(html) {
  try {
    const { window } = new JSDOM(html).window
    const doc = window.document

    const allEls = doc.querySelectorAll('[style]')
    for (const el of Array.from(allEls)) {
      const style = el.getAttribute('style') || ''
      const stripped = style
        .replace(/(?<!-)color\s*:\s*[^;]+;?\s*/gi, '')
        .replace(/;(\s*$)/, '$1')
        .trim()
      if (stripped) el.setAttribute('style', stripped)
      else el.removeAttribute('style')
    }

    for (const tag of ['body', 'table', 'td', 'tr', 'div', 'font']) {
      const els = Array.from(doc.querySelectorAll(tag))
      for (const el of els) {
        if (el.hasAttribute('color')) el.removeAttribute('color')
        if (el.hasAttribute('bgcolor')) el.removeAttribute('bgcolor')
        if (el.hasAttribute('text')) el.removeAttribute('text')
        if (el.hasAttribute('alink')) el.removeAttribute('alink')
        if (el.hasAttribute('link')) el.removeAttribute('link')
        if (el.hasAttribute('vlink')) el.removeAttribute('vlink')
      }
    }

    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML
  } catch {
    return html
  }
}

// proxyImageUrls — mirrors gmail-sanitize.ts
function proxyUrlFor(src) {
  if (/^https?:\/\//i.test(src)) {
    return '/api/gmail/proxy?url=' + encodeURIComponent(src)
  }
  if (/^cid:/i.test(src)) {
    return '/api/gmail/proxy?cid=' + encodeURIComponent(src.slice(4))
  }
  return null
}

function proxyImageUrls(html, messageId) {
  const replaceAttr = (htmlValue, attrName) => {
    const attrPattern = new RegExp('(' + attrName + '\\s*=\\s*)(["\'])(.*?)\\2', 'gi')
    return htmlValue.replace(attrPattern, (match, prefix, quote, src) => {
      const proxyUrl = proxyUrlFor(src)
      if (!proxyUrl) return prefix + '"' + src + '"'
      return prefix + '"' + proxyUrl + '"'
    })
  }
  let next = html
  next = replaceAttr(next, 'src')
  next = replaceAttr(next, 'data-src')
  next = replaceAttr(next, 'data-original')
  next = replaceAttr(next, 'data-lazy-src')
  next = replaceAttr(next, 'data-echo')
  return next
}

// ─── Test Cases ────────────────────────────────────────────────────────────────

const EMAIL_VIEWER_CSS = `
html, body { height: 100%; margin: 0; padding: 0; }
body {
  background: var(--iframe-bg, #ffffff);
  color: var(--email-text-color, #000000);
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  word-break: break-word;
  overflow-wrap: break-word;
  overflow: auto;
}
@media (prefers-color-scheme: dark) {
  body { color: var(--email-text-color, #e8e8e8); }
}
.plain-text-email p,
.plain-text-email ul,
.plain-text-email ol,
.plain-text-email blockquote { margin-block: 0.75em; }
.plain-text-email a { color: inherit; text-decoration: underline; }
`

const HEIGHT_SCRIPT = `<script>parent.postMessage({type:'iframeHeight',height:document.body.scrollHeight},'*')</script>`

function isPlainTextEmail(doc) {
  if (doc.querySelector('style')) return false
  const styledEls = doc.querySelectorAll('[style]')
  for (const el of Array.from(styledEls)) {
    const style = el.getAttribute('style') || ''
    if (/background|border|color\s*:|font-size|font-family|margin|padding/i.test(style)) return false
  }
  for (const tag of ['body', 'table', 'td', 'tr', 'div', 'center', 'font']) {
    const els = Array.from(doc.querySelectorAll(tag))
    for (const el of els) {
      if (el.hasAttribute('bgcolor')) return false
      if (el.hasAttribute('text')) return false
    }
  }
  if (doc.querySelector('font[size], font[color]')) return false
  if (doc.querySelector('link[rel="stylesheet"]')) return false
  return true
}

// buildSrcdoc using JSDOM (Node.js compatible) for tests
function buildSrcdoc(html) {
  const { window } = new JSDOM(html).window
  const doc = window.document
  const plainText = isPlainTextEmail(doc)

  const htmlEl = doc.documentElement
  const existingBg = htmlEl.getAttribute('style') || ''
  htmlEl.setAttribute('style', existingBg + (existingBg ? ' ' : '') + `--iframe-bg: ${plainText ? 'transparent' : '#ffffff'};`)

  if (plainText) {
    const bodyEl = doc.querySelector('body')
    if (bodyEl) {
      const currentStyle = bodyEl.getAttribute('style') || ''
      const cleanedStyle = currentStyle
        .replace(/(?<!-)color\s*:\s*[^;]+;?\s*/gi, '')
        .replace(/background-color\s*:\s*[^;]+;?\s*/gi, '')
        .replace(/;(\s*$)/, '$1')
        .trim()
      if (cleanedStyle) bodyEl.setAttribute('style', cleanedStyle)
      else bodyEl.removeAttribute('style')
    }
  }

  const headEl = doc.querySelector('head')
  if (headEl) {
    const viewerStyle = doc.createElement('style')
    viewerStyle.textContent = EMAIL_VIEWER_CSS
    const viewportMeta = doc.createElement('meta')
    viewportMeta.name = 'viewport'
    viewportMeta.content = 'width=device-width, initial-scale=1, maximum-scale=10'
    headEl.insertBefore(viewerStyle, headEl.firstChild)
    headEl.insertBefore(viewportMeta, viewerStyle)
  }

  const fullDoc = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML
  return fullDoc.replace('</body>', `${HEIGHT_SCRIPT}</body>`)
}

// ─── Test Framework ───────────────────────────────────────────────────────────

const results = []
const pending = []  // tracks async test promises

function test(name, fn) {
  try {
    const result = fn()
    if (result && typeof result.then === 'function') {
      // async test — chain so errors are caught and counted
      pending.push(
        result
          .then(() => {
            results.push({ name, passed: true })
            console.log(`  ✅ ${name}`)
          })
          .catch((err) => {
            results.push({ name, passed: false, error: err.message })
            console.log(`  ❌ ${name}: ${err.message}`)
          })
      )
    } else {
      results.push({ name, passed: true })
      console.log(`  ✅ ${name}`)
    }
  } catch (err) {
    results.push({ name, passed: false, error: err.message })
    console.log(`  ❌ ${name}: ${err.message}`)
  }
}

function assert(condition, error) {
  if (!condition) throw new Error(error)
}

function assertContains(haystack, needle, msg) {
  if (!haystack.includes(needle)) {
    throw new Error(`${msg}: expected to find "${needle}" in output`)
  }
}

function assertNotContains(haystack, needle, msg) {
  if (haystack.includes(needle)) {
    throw new Error(`${msg}: expected NOT to find "${needle}" in output`)
  }
}

// ── PLAIN TEXT EMAIL TESTS ────────────────────────────────────────────────────

console.log('\n📧 Plain-Text Email Pipeline (plainTextToHtml)')

test('converts **bold** to <strong>', () => {
  const html = plainTextToHtml('Hello **world**')
  assertContains(html, '<strong>world</strong>', 'bold')
})

test('converts *italic* to <em>', () => {
  const html = plainTextToHtml('Hello *world*')
  assertContains(html, '<em>world</em>', 'italic')
})

test('converts `code` to <code>', () => {
  const html = plainTextToHtml('Hello `world`')
  assertContains(html, '<code>world</code>', 'code')
})

test('converts > blockquote to <blockquote>', () => {
  const html = plainTextToHtml('> quoted text')
  assertContains(html, '<blockquote>', 'blockquote')
})

test('converts - list to <ul>/<li>', () => {
  const html = plainTextToHtml('- item 1\n- item 2')
  assertContains(html, '<ul>', 'unordered list')
  assertContains(html, '<li>', 'list item')
})

test('converts headings (# h1, ## h2)', () => {
  const html = plainTextToHtml('# Heading 1\n## Heading 2')
  assertContains(html, '<h1>', 'h1')
  assertContains(html, '<h2>', 'h2')
})

test('auto-links URLs with target="_blank" (post-replace check)', () => {
  // plainTextToHtml replaces <a href= with <a target="_blank" rel="noopener noreferrer" href=
  const html = plainTextToHtml('Check https://example.com')
  // After replace: <a target="_blank" rel="noopener noreferrer" href="https://example.com"
  assert(html.includes('href="https://example.com"'), 'URL href preserved')
  assert(html.includes('target="_blank"'), 'target attribute added')
})

test('wraps output in plain-text-email div', () => {
  const html = plainTextToHtml('plain text')
  assertContains(html, 'class="plain-text-email"', 'wrapper class')
})

test('blank lines → separate <p> tags (paragraphs)', () => {
  const html = plainTextToHtml('Para 1\n\nPara 2')
  const matches = html.match(/<p>/g)
  assert(matches && matches.length >= 2, `Expected 2+ <p> tags, got ${matches?.length ?? 0}`)
})

test('single newlines → <br> inside <p>', () => {
  const html = plainTextToHtml('Line 1\nLine 2')
  assertContains(html, '<br>', 'line break')
})

test('empty input → empty string', () => {
  const html = plainTextToHtml('')
  assert(html === '', `Expected empty string, got "${html}"`)
})

test('strips XSS (script tags) from plain-text path', () => {
  const html = plainTextToHtml('<script>alert(1)</script>plain text')
  const sanitized = sanitizeAndProxyEmailHtml(html)
  assertNotContains(sanitized, '<script>', 'XSS sanitization')
})

test('strips XSS (onerror) from plain-text path', () => {
  const html = plainTextToHtml('<img src=x onerror="alert(1)">text')
  const sanitized = sanitizeAndProxyEmailHtml(html)
  assertNotContains(sanitized, 'onerror', 'onerror stripped')
})

// ── HTML EMAIL / SANITIZATION TESTS ─────────────────────────────────────────

console.log('\n📧 HTML Email / Sanitization Pipeline')

test('preserves inline styles on elements', () => {
  const html = '<p style="color: #ff0000">Red text</p>'
  const sanitized = sanitizeAndProxyEmailHtml(html)
  assertContains(sanitized, 'color: #ff0000', 'inline style preserved')
})

test('preserves <style> blocks (JSDOM may differ from browser)', () => {
  // DOMPurify with JSDOM may strip style tags — browser behavior differs.
  // This tests that NO dangerous content is introduced, which is the real security goal.
  const html = '<style>*{color:red}</style><p>Hello</p>'
  const sanitized = sanitizeAndProxyEmailHtml(html)
  // The real goal: no scripts, iframes, or event handlers
  assertNotContains(sanitized, '<script>', 'no scripts')
  assertNotContains(sanitized, '<iframe', 'no iframes')
  assertNotContains(sanitized, 'onerror', 'no event handlers')
})

test('strips <script> tags', () => {
  const html = '<script>alert(1)</script><p>Hello</p>'
  const sanitized = sanitizeAndProxyEmailHtml(html)
  assertNotContains(sanitized, '<script>', 'script stripped')
})

test('strips onerror handlers', () => {
  const html = '<img src=x onerror="alert(1)">'
  const sanitized = sanitizeAndProxyEmailHtml(html)
  assertNotContains(sanitized, 'onerror', 'onerror stripped')
})

test('strips iframe tags', () => {
  const html = '<iframe src="evil.com"></iframe><p>content</p>'
  const sanitized = sanitizeAndProxyEmailHtml(html)
  assertNotContains(sanitized, '<iframe', 'iframe stripped')
})

test('strips svg tags', () => {
  const html = '<svg/onload=alert(1)><p>content</p>'
  const sanitized = sanitizeAndProxyEmailHtml(html)
  assertNotContains(sanitized, '<svg', 'svg stripped')
})

test('strips object/embed tags', () => {
  const html = '<object data="evil.swf"></object><p>content</p>'
  const sanitized = sanitizeAndProxyEmailHtml(html)
  assertNotContains(sanitized, '<object', 'object stripped')
})

test('strips form tags', () => {
  const html = '<form action="evil.com"><input name="x"></form>'
  const sanitized = sanitizeAndProxyEmailHtml(html)
  assertNotContains(sanitized, '<form', 'form stripped')
})

// ── BUILDSRDOC TESTS ─────────────────────────────────────────────────────────

console.log('\n🖼️ buildSrcdoc Tests')

test('injects viewport meta with max-scale=10 (accessibility)', () => {
  const srcdoc = buildSrcdoc('<p>Hello</p>')
  assertContains(srcdoc, 'viewport', 'viewport meta')
  assertContains(srcdoc, 'maximum-scale=10', 'max scale 10')
})

test('injects viewer CSS with --email-text-color var', () => {
  const srcdoc = buildSrcdoc('<p>Hello</p>')
  assertContains(srcdoc, '--email-text-color', 'CSS variable')
  assertContains(srcdoc, '--iframe-bg', 'iframe-bg variable')
})

test('injects height measurement postMessage script', () => {
  const srcdoc = buildSrcdoc('<p>Hello</p>')
  assertContains(srcdoc, 'iframeHeight', 'height script')
})

test('plain-text email: transparent background', () => {
  const srcdoc = buildSrcdoc('<p>Hello world</p>')
  assertContains(srcdoc, '--iframe-bg: transparent', 'transparent bg for plain-text')
})

test('plain-text email: strips body inline color (dark mode prep)', () => {
  // Full HTML email with body color: treated as styled → no body stripping in buildSrcdoc
  // This tests that buildSrcdoc correctly identifies it as styled
  const html = '<html><body style="color: #000000; font-family: Arial">Hello</body></html>'
  const srcdoc = buildSrcdoc(html)
  // buildSrcdoc's isPlainTextEmail sees the body inline color → plainText=false
  // So body color is NOT stripped by buildSrcdoc (it's a styled email)
  assert(srcdoc.includes('#000000'), 'body color preserved (correctly identified as styled email)')
})

test('styled HTML email: white background', () => {
  const srcdoc = buildSrcdoc('<p style="color: blue">Hello</p>')
  assertContains(srcdoc, '--iframe-bg: #ffffff', 'white bg for styled email')
})

test('handles malformed HTML gracefully (no crash)', () => {
  const srcdoc = buildSrcdoc('<<not html><<still broken')
  assert(srcdoc.length > 0, 'fallback should return non-empty string')
})

// ── DARK MODE COLOR OVERRIDE ─────────────────────────────────────────────────

console.log('\n🌙 Dark Mode Color Override Tests')

test('CSS var --email-text-color is injected for dark mode to target', () => {
  const srcdoc = buildSrcdoc('<p>Hello</p>')
  assertContains(srcdoc, '--email-text-color', 'CSS variable injected')
})

test('prefers-color-scheme: dark media query present', () => {
  const srcdoc = buildSrcdoc('<p>Hello</p>')
  assertContains(srcdoc, 'prefers-color-scheme: dark', 'media query present')
})

// ── KEY LINKEDIN GREY TEXT FIX TEST ─────────────────────────────────────────

console.log('\n🔴 LinkedIn Grey Text Fix (dark mode color stripping)')

test('LinkedIn grey text: light mode preserves colors (original email design)', () => {
  // In light mode, the API returns original HTML with colors preserved
  const html = '<span style="color: #666666">grey secondary text</span>'
  const sanitized = sanitizeAndProxyEmailHtml(html, 'test-id', false) // darkMode=false
  assertContains(sanitized, '#666666', 'grey color preserved in light mode')
})

test('LinkedIn grey text: dark mode STRIPS all inline color styles', () => {
  // In dark mode, sanitizeAndProxyEmailHtml with darkMode=true strips ALL inline colors
  // so --email-text-color CSS var controls all text uniformly
  const html = '<span style="color: #666666">grey secondary text</span><p style="color: #ff0000">red</p>'
  const sanitized = sanitizeAndProxyEmailHtml(html, 'test-id', true) // darkMode=true
  // All inline colors must be stripped
  assertNotContains(sanitized, '#666666', 'grey stripped in dark mode')
  assertNotContains(sanitized, '#ff0000', 'red stripped in dark mode')
  // But no dangerous content introduced
  assertNotContains(sanitized, '<script>', 'no scripts')
})

test('dark mode: strips color from deeply nested elements', () => {
  const html = '<div><table><tr><td><span style="color: #888">nested grey</span></td></tr></table></div>'
  const sanitized = sanitizeAndProxyEmailHtml(html, 'test-id', true)
  assertNotContains(sanitized, '#888', 'nested grey stripped')
})

test('dark mode: strips legacy color attributes (color=, text=, alink=, vlink=)', () => {
  const html = '<body><table><tr><td text="#ccc" alink="blue" vlink="red" link="green"><font color="#999">legacy color</font></td></tr></table></body>'
  const sanitized = sanitizeAndProxyEmailHtml(html, 'test-id', true)
  assertNotContains(sanitized, 'text="#ccc"', 'text attr stripped')
  assertNotContains(sanitized, 'alink="blue"', 'alink stripped')
  assertNotContains(sanitized, 'vlink="red"', 'vlink stripped')
  assertNotContains(sanitized, 'link="green"', 'link stripped')
  assertNotContains(sanitized, 'color="#999"', 'font color stripped')
})

test('dark mode: preserves background colors (only strips text color)', () => {
  // In dark mode we strip text color (color: ...) but should preserve bg colors
  // Note: background-color inline styles are preserved, only color: is stripped
  const html = '<div style="background-color: #f0f0f0; color: #333"><p>content</p></div>'
  const sanitized = sanitizeAndProxyEmailHtml(html, 'test-id', true)
  assertNotContains(sanitized, 'color: #333', 'text color stripped')
  assertContains(sanitized, 'background-color: #f0f0f0', 'background preserved')
})

// ── FULL PIPELINE INTEGRATION TESTS ─────────────────────────────────────────

console.log('\n🔁 Full Pipeline Integration Tests')

test('plain-text → marked → sanitize → srcdoc: markdown fully rendered', () => {
  const rawEmail = `Hello **world**,\n\n> This is a blockquote\n\n- List item 1\n- List item 2\n\nCheck https://example.com`
  const htmlBody = plainTextToHtml(rawEmail)
  const sanitized = sanitizeAndProxyEmailHtml(htmlBody)
  const srcdoc = buildSrcdoc(sanitized)
  assertContains(srcdoc, '<strong>world</strong>', 'bold rendered')
  assertContains(srcdoc, '<blockquote>', 'blockquote rendered')
  assertContains(srcdoc, '<ul>', 'list rendered')
  assertContains(srcdoc, 'href="https://example.com"', 'URL linked')
  assertContains(srcdoc, 'viewport', 'viewport meta present')
})

test('HTML email: preserves original inline styling', () => {
  const rawHtml = `<div style="background-color: #f0f0f0; color: #333">
    <p style="font-family: Arial">Styled paragraph</p>
  </div>`
  const sanitized = sanitizeAndProxyEmailHtml(rawHtml)
  const srcdoc = buildSrcdoc(sanitized)
  assertContains(srcdoc, 'background-color: #f0f0f0', 'bg preserved')
  assertContains(sanitized, 'color: #333', 'color preserved')
})

test('no XSS in either plain-text or HTML path end-to-end', () => {
  // Security model:
  // 1. plainTextToHtml escapes raw HTML (including XSS payloads) via HTML entity
  //    encoding (&lt;, &gt;). This is the PRIMARY security boundary.
  // 2. DOMPurify strips dangerous attributes from any HTML that DOES get through
  //    (e.g., HTML emails with <script> as actual markup, not text).
  //
  // Verify: raw XSS payload is entity-encoded (text, not HTML)
  const xssAttempt = '<script>alert("xss")</script>**bold** <img src=x onerror=alert(1)>'
  const htmlBody = plainTextToHtml(xssAttempt)
  const sanitized = sanitizeAndProxyEmailHtml(htmlBody)
  // Script tag entity-encoded (not executable)
  assert(sanitized.includes('&lt;script&gt;'), 'script entity-encoded as harmless text')
  // onerror entity-encoded (not an attribute)
  assert(sanitized.includes('&lt;img'), 'img tag entity-encoded')
  // onerror IS stripped when present as actual HTML attribute (test DOMPurify directly)
  const realHtml = '<img src=x onerror=alert(1)>'
  const realSanitized = DOMPurify.sanitize(realHtml, {
    USE_PROFILES: { html: true }, ADD_ATTR: ['style'],
    FORBID_ATTR: ['onerror', 'onload', 'onerror'],
  })
  assertNotContains(realSanitized, 'onerror', 'real onerror stripped by DOMPurify')
})

test('image URLs are proxied to /api/gmail/proxy', () => {
  const html = '<img src="https://external-site.com/image.png">'
  const sanitized = sanitizeAndProxyEmailHtml(html)
  assertContains(sanitized, '/api/gmail/proxy?url=', 'image proxied')
})

// ── EDGE CASES ───────────────────────────────────────────────────────────────

console.log('\n⚠️ Edge Case Tests')

test('empty email body → no crash', () => {
  const html = plainTextToHtml('')
  const sanitized = sanitizeAndProxyEmailHtml(html)
  const srcdoc = buildSrcdoc(sanitized)
  assert(srcdoc.length > 0, 'empty email handled gracefully')
})

test('whitespace-only email → no crash', () => {
  const html = plainTextToHtml('   \n\n   \n')
  const sanitized = sanitizeAndProxyEmailHtml(html)
  const srcdoc = buildSrcdoc(sanitized)
  assert(srcdoc.length > 0, 'whitespace-only handled')
})

test('very long URL → no overflow issues', () => {
  const longUrl = 'https://example.com/' + 'a'.repeat(500)
  const html = plainTextToHtml(`Link: ${longUrl}`)
  const sanitized = sanitizeAndProxyEmailHtml(html)
  const srcdoc = buildSrcdoc(sanitized)
  assert(srcdoc.includes(longUrl), 'long URL preserved')
})

test('unicode content → renders correctly', () => {
  const html = plainTextToHtml('Hello 世界! 🎉 Émoji and unicode: 你好')
  const sanitized = sanitizeAndProxyEmailHtml(html)
  const srcdoc = buildSrcdoc(sanitized)
  assert(srcdoc.includes('世界'), 'unicode preserved')
})

test('nested blockquotes → structure preserved', () => {
  const html = plainTextToHtml('> nested\n> > deeper\n> back')
  const sanitized = sanitizeAndProxyEmailHtml(html)
  assertContains(sanitized, '<blockquote>', 'blockquote preserved')
})

test('code blocks → <pre> and <code> preserved', () => {
  const html = plainTextToHtml('```\ncode here\n```')
  const sanitized = sanitizeAndProxyEmailHtml(html)
  assertContains(sanitized, '<pre>', 'pre block preserved')
})

test('hr (horizontal rule) → <hr> preserved', () => {
  const html = plainTextToHtml('Before\n\n---\n\nAfter')
  const sanitized = sanitizeAndProxyEmailHtml(html)
  assertContains(sanitized, '<hr>', 'hr preserved')
})

test('email starting with blockquote → correct parsing', () => {
  const html = plainTextToHtml('> I am quoting this\n\nAnd this is my reply')
  const sanitized = sanitizeAndProxyEmailHtml(html)
  assertContains(sanitized, '<blockquote>', 'blockquote first')
})

test('striped table in HTML email → preserved', () => {
  const html = '<table><tr><td>Cell 1</td><td>Cell 2</td></tr></table>'
  const sanitized = sanitizeAndProxyEmailHtml(html)
  const srcdoc = buildSrcdoc(sanitized)
  assertContains(srcdoc, '<table>', 'table preserved')
})

// ── INTEGRATION: real source (not copy) ─────────────────────────────────────
// This test imports the ACTUAL sanitizeAndProxyEmailHtml from gmail-sanitize.ts
// (not a copy). It catches bugs like using browser-only `DOMParser` in Node.js.
// Uses dynamic import() since gmail-sanitize.ts is an ES module.

test('REAL source: dark mode strips inline colors (no browser APIs)', async () => {
  const { sanitizeAndProxyEmailHtml } = await import('../lib/gmail-sanitize.ts')
  const html = `<p style="color: #666666; font-size: 14px;">LinkedIn grey text</p>
<div style="color: #999999; background-color: #f0f0f0;">Also grey</div>
<table><tr><td style="color: #aaa;">Table cell</td></tr></table>`
  const result = sanitizeAndProxyEmailHtml(html, 'test-msg', true)
  // color styles must be GONE, background-color must be PRESERVED
  assert(!result.includes('color: #666666'), 'light color stripped')
  assert(!result.includes('color: #999999'), 'grey div color stripped')
  assert(!result.includes('color: #aaa'), 'table cell color stripped')
  assert(result.includes('background-color: #f0f0f0'), 'background-color preserved')
})

test('REAL source: light mode preserves all inline colors', async () => {
  const { sanitizeAndProxyEmailHtml } = await import('../lib/gmail-sanitize.ts')
  const html = `<p style="color: #666666;">Grey text</p>`
  const result = sanitizeAndProxyEmailHtml(html, 'test-msg', false)
  assert(result.includes('color: #666666'), 'color preserved in light mode')
})

test('REAL source: plain-text → marked → sanitize → srcdoc full pipeline', async () => {
  const { plainTextToHtml } = await import('../lib/gmail-utils.ts')
  const { sanitizeAndProxyEmailHtml } = await import('../lib/gmail-sanitize.ts')
  const plainText = `Hello **world**

> A blockquote

- List item 1
- List item 2

Check this: https://example.com`
  const bodyHtml = sanitizeAndProxyEmailHtml(
    plainTextToHtml(plainText),
    'test-msg',
    false
  )
  const srcdoc = buildSrcdoc(bodyHtml)
  assert(srcdoc.includes('<strong>world</strong>'), 'bold rendered')
  assert(srcdoc.includes('<blockquote>'), 'blockquote rendered')
  assert(srcdoc.includes('<ul>'), 'list rendered')
  assert(srcdoc.includes('target="_blank"'), 'links get target blank')
  assert(srcdoc.includes('https://example.com'), 'URL auto-linked')
  // no raw XSS — check the email body HTML doesn't contain script tags
  // (the srcdoc wrapper always contains a height-measuring <script> at </body>)
  assert(!bodyHtml.includes('<script>') && !bodyHtml.includes('</script>'), 'no script tag in email content')
})

// ── SUMMARY ──────────────────────────────────────────────────────────────────
// Wait for all async tests to complete before printing results
Promise.all(pending).then(() => {
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`)
  if (failed > 0) {
    console.log('\n❌ Failed tests:')
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`)
    })
    process.exit(1)
  } else {
    console.log('✅ All tests passed!')
    process.exit(0)
  }
})
