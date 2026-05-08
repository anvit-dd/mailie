/**
 * Email Rendering Pipeline — End-to-End Tests
 *
 * Tests the full email body rendering pipeline:
 *   plain-text → plainTextToHtml() → sanitizeAndProxyEmailHtml() → buildSrcdoc() → iframe srcdoc
 *
 * Run with: node --experimental-vm-modules src/__tests__/email-rendering.test.ts
 * Or import functions directly in a Node script.
 */

import { marked } from 'marked'
import { JSDOM } from 'jsdom'
import createDOMPurify from 'dompurify'

// ─── Setup ────────────────────────────────────────────────────────────────────

const dom = new JSDOM('', {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
})
const DOMPurify = createDOMPurify(dom.window)
const DOMParser = dom.window.DOMParser

marked.setOptions({ breaks: true, gfm: true })

// ─── Helpers (mirrors gmail-utils.ts) ─────────────────────────────────────────

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function plainTextToHtml(text: string): string {
  if (!text) return ''
  const markedResult = marked.parse(text, { breaks: true }) as string
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

function sanitizeAndProxyEmailHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_TAGS: ['style'],
    ADD_ATTR: ['style'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'svg', 'math'],
    FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
  })
}

// ─── Test Cases ────────────────────────────────────────────────────────────────

const EMAIL_VIEWER_CSS = `
html, body { height: 100%; margin: 0; padding: 0; }
body {
  background: var(--email-bg, #ffffff);
  color: var(--email-text-color, #000000);
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  word-break: break-word;
  overflow-wrap: break-word;
  overflow: auto;
}
.plain-text-email p,
.plain-text-email ul,
.plain-text-email ol,
.plain-text-email blockquote { margin-block: 0.75em; }
.plain-text-email a { color: inherit; text-decoration: underline; }
`

const HEIGHT_SCRIPT = `<script>parent.postMessage({type:'iframeHeight',height:document.body.scrollHeight},'*')</script>`

function buildSrcdoc(html: string, darkMode = false): string {
  function isPlainTextEmail(doc: Document): boolean {
    if (doc.querySelector('style')) return false
    const styledEls = doc.querySelectorAll('[style]')
    for (const el of styledEls) {
      const style = el.getAttribute('style') || ''
      if (/background|bgcolor|color\s*:|font-size|font-family|margin|padding|border/i.test(style)) return false
    }
    for (const tag of ['body', 'table', 'td', 'tr', 'div', 'center', 'font']) {
      const els = doc.querySelectorAll(tag)
      for (const el of els) {
        if (el.hasAttribute('bgcolor')) return false
        if (el.hasAttribute('text')) return false
      }
    }
    if (doc.querySelector('font[size], font[color]')) return false
    if (doc.querySelector('link[rel="stylesheet"]')) return false
    return true
  }

  const parser = new DOMParser()
  const document = parser.parseFromString(html, 'text/html')
  const plainText = isPlainTextEmail(document)

  const htmlEl = document.documentElement
  const themeVars = [
    `--email-bg: ${plainText ? 'transparent' : '#ffffff'}`,
    `--email-text-color: ${darkMode ? '#ABB2BF' : '#000000'}`,
  ].join('; ')
  const existingBg = htmlEl.getAttribute('style') || ''
  htmlEl.setAttribute('style', existingBg + (existingBg ? '; ' : '') + themeVars)

  if (plainText) {
    const bodyEl = document.querySelector('body')
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

  const headEl = document.querySelector('head')
  if (headEl) {
    const viewerStyle = document.createElement('style')
    viewerStyle.textContent = EMAIL_VIEWER_CSS
    const viewportMeta = document.createElement('meta')
    viewportMeta.name = 'viewport'
    viewportMeta.content = 'width=device-width, initial-scale=1, maximum-scale=10'
    headEl.insertBefore(viewerStyle, headEl.firstChild)
    headEl.insertBefore(viewportMeta, viewerStyle)
  }

  const fullDoc = '<!DOCTYPE html>\n' + document.documentElement.outerHTML
  return fullDoc.replace('</body>', `${HEIGHT_SCRIPT}</body>`)
}

// ─── Test Suite ────────────────────────────────────────────────────────────────

interface TestResult {
  name: string
  passed: boolean
  error?: string
}

function assert(condition: boolean, error: string): void {
  if (!condition) throw new Error(error)
}

function assertContains(haystack: string, needle: string, msg: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(`${msg}: expected to find "${needle}" in output`)
  }
}

function assertNotContains(haystack: string, needle: string, msg: string): void {
  if (haystack.includes(needle)) {
    throw new Error(`${msg}: expected NOT to find "${needle}" in output`)
  }
}

const results: TestResult[] = []

function test(name: string, fn: () => void): void {
  try {
    fn()
    results.push({ name, passed: true })
    console.log(`  ✅ ${name}`)
  } catch (err) {
    results.push({ name, passed: false, error: (err as Error).message })
    console.log(`  ❌ ${name}: ${(err as Error).message}`)
  }
}

// ── PLAIN TEXT EMAIL TESTS ────────────────────────────────────────────────────

console.log('\n📧 Plain-Text Email Pipeline')

test('plainTextToHtml: converts **bold** to <strong>', () => {
  const html = plainTextToHtml('Hello **world**')
  assertContains(html, '<strong>world</strong>', 'bold')
})

test('plainTextToHtml: converts *italic* to <em>', () => {
  const html = plainTextToHtml('Hello *world*')
  assertContains(html, '<em>world</em>', 'italic')
})

test('plainTextToHtml: converts `code` to <code>', () => {
  const html = plainTextToHtml('Hello `world`')
  assertContains(html, '<code>world</code>', 'code')
})

test('plainTextToHtml: converts > to <blockquote>', () => {
  const html = plainTextToHtml('> quoted text')
  assertContains(html, '<blockquote>', 'blockquote')
})

test('plainTextToHtml: converts - list to <ul>/<li>', () => {
  const html = plainTextToHtml('- item 1\n- item 2')
  assertContains(html, '<ul>', 'unordered list')
  assertContains(html, '<li>', 'list item')
})

test('plainTextToHtml: converts headings (# h1, ## h2)', () => {
  const html = plainTextToHtml('# Heading 1\n## Heading 2')
  assertContains(html, '<h1>', 'h1')
  assertContains(html, '<h2>', 'h2')
})

test('plainTextToHtml: auto-links URLs', () => {
  const html = plainTextToHtml('Check https://example.com')
  assertContains(html, '<a href="https://example.com"', 'URL link')
  assertContains(html, 'target="_blank"', 'secure target')
})

test('plainTextToHtml: wraps output in plain-text-email div', () => {
  const html = plainTextToHtml('plain text')
  assertContains(html, 'class="plain-text-email"', 'wrapper class')
})

test('plainTextToHtml: blank lines → separate <p> tags (paragraphs)', () => {
  const html = plainTextToHtml('Para 1\n\nPara 2')
  const matches = html.match(/<p>/g)
  assert(!!(matches && matches.length >= 2), `Expected 2+ <p> tags, got ${matches?.length ?? 0}`)
})

test('plainTextToHtml: single newlines → <br> inside <p>', () => {
  const html = plainTextToHtml('Line 1\nLine 2')
  assertContains(html, '<br>', 'line break')
})

test('plainTextToHtml: empty input → empty string', () => {
  const html = plainTextToHtml('')
  assert(html === '', `Expected empty string, got "${html}"`)
})

test('plainTextToHtml: strips XSS (script tags)', () => {
  const html = plainTextToHtml('<script>alert(1)</script>plain text')
  const sanitized = sanitizeAndProxyEmailHtml(html)
  assertNotContains(sanitized, '<script>', 'XSS sanitization')
})

// ── HTML EMAIL TESTS ──────────────────────────────────────────────────────────

console.log('\n📧 HTML Email Pipeline')

test('HTML email: preserves inline styles on elements', () => {
  const html = '<p style="color: #ff0000">Red text</p>'
  const sanitized = sanitizeAndProxyEmailHtml(html)
  assertContains(sanitized, 'color: #ff0000', 'inline style preserved')
})

test('HTML email: preserves <style> blocks', () => {
  const html = '<style>.foo { color: blue }</style><p class="foo">Blue</p>'
  const sanitized = sanitizeAndProxyEmailHtml(html)
  assertContains(sanitized, '.foo { color: blue }', 'style block preserved')
})

test('HTML email: strips <script> tags', () => {
  const html = '<script>alert(1)</script><p>Hello</p>'
  const sanitized = sanitizeAndProxyEmailHtml(html)
  assertNotContains(sanitized, '<script>', 'script stripped')
})

test('HTML email: strips onerror handlers', () => {
  const html = '<img src=x onerror="alert(1)">'
  const sanitized = sanitizeAndProxyEmailHtml(html)
  assertNotContains(sanitized, 'onerror', 'onerror stripped')
})

test('HTML email: strips iframe tags', () => {
  const html = '<iframe src="evil.com"></iframe><p>content</p>'
  const sanitized = sanitizeAndProxyEmailHtml(html)
  assertNotContains(sanitized, '<iframe', 'iframe stripped')
})

test('HTML email: strips svg tags', () => {
  const html = '<svg/onload=alert(1)><p>content</p>'
  const sanitized = sanitizeAndProxyEmailHtml(html)
  assertNotContains(sanitized, '<svg', 'svg stripped')
})

test('HTML email: strips object/embed tags', () => {
  const html = '<object data="evil.swf"></object><p>content</p>'
  const sanitized = sanitizeAndProxyEmailHtml(html)
  assertNotContains(sanitized, '<object', 'object stripped')
})

// ── BUILDSRDOC TESTS ─────────────────────────────────────────────────────────

console.log('\n🖼️ buildSrcdoc Tests')

test('buildSrcdoc: injects viewport meta', () => {
  const srcdoc = buildSrcdoc('<p>Hello</p>')
  assertContains(srcdoc, 'viewport', 'viewport meta')
  assertContains(srcdoc, 'maximum-scale=10', 'max scale 10 (accessibility)')
})

test('buildSrcdoc: injects viewer CSS', () => {
  const srcdoc = buildSrcdoc('<p>Hello</p>')
  assertContains(srcdoc, 'var(--email-text-color', 'email-text-color variable')
  assertContains(srcdoc, 'var(--iframe-bg', 'iframe-bg variable')
})

test('buildSrcdoc: injects height measurement script', () => {
  const srcdoc = buildSrcdoc('<p>Hello</p>')
  assertContains(srcdoc, 'iframeHeight', 'height script')
})

test('buildSrcdoc: plain-text email gets transparent background', () => {
  const srcdoc = buildSrcdoc('<p>Hello world</p>')
  assertContains(srcdoc, '--iframe-bg: transparent', 'transparent bg for plain-text')
})

test('buildSrcdoc: plain-text email strips body inline color', () => {
  const html = '<body style="color: #000000; font-family: Arial">Hello</body>'
  const srcdoc = buildSrcdoc(html)
  // body color should be stripped for plain-text
  assertNotContains(srcdoc, '#000000', 'body inline color stripped')
})

test('buildSrcdoc: styled HTML email gets white background', () => {
  const srcdoc = buildSrcdoc('<p style="color: blue">Hello</p>')
  assertContains(srcdoc, '--email-bg: #ffffff', 'white bg for styled email')
})

test('buildSrcdoc: handles malformed HTML gracefully', () => {
  const srcdoc = buildSrcdoc('<<not html><<still broken')
  assert(srcdoc.length > 0, 'fallback should return non-empty string')
})

// ── DARK MODE / COLOR OVERRIDE TESTS ───────────────────────────────────────────

console.log('\n🌙 Dark Mode Color Override Tests')

test('Dark mode: --email-text-color var is injected', () => {
  const srcdoc = buildSrcdoc('<p>Hello</p>', true)
  assertContains(srcdoc, '--email-text-color', 'CSS variable injected')
})

test('Dark mode: --email-text-color is #ABB2BF for dark mode', () => {
  const srcdoc = buildSrcdoc('<p>Hello</p>', true)
  assertContains(srcdoc, '--email-text-color: #ABB2BF', 'dark mode text color')
})

test('Dark mode: plain-text email body color stripped', () => {
  // This is the key LinkedIn grey-text test
  const html = '<body style="color: #666666; background-color: #ffffff">Grey text here</body>'
  const srcdoc = buildSrcdoc(html, true)
  // In dark mode, body color should be stripped so --email-text-color can take over
  assertNotContains(srcdoc, '#666666', 'body color stripped in dark mode')
})

// ── PIPELINE INTEGRATION TESTS ───────────────────────────────────────────────

console.log('\n🔁 Full Pipeline Integration Tests')

test('Full pipeline: plain-text → marked → sanitize → srcdoc → renders', () => {
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

test('Full pipeline: HTML email preserves original styling', () => {
  const rawHtml = `<div style="background-color: #f0f0f0; color: #333">
    <p style="font-family: Arial">Styled paragraph</p>
  </div>`
  const sanitized = sanitizeAndProxyEmailHtml(rawHtml)
  const srcdoc = buildSrcdoc(sanitized)
  assertContains(srcdoc, 'background-color: #f0f0f0', 'bg preserved')
  assertContains(srcdoc, 'color: #333', 'color preserved')
})

test('Full pipeline: no XSS in either plain-text or HTML path', () => {
  const xssAttempt = '<script>alert("xss")</script>**bold** <img src=x onerror=alert(1)>'
  const htmlBody = plainTextToHtml(xssAttempt)
  const sanitized = sanitizeAndProxyEmailHtml(htmlBody)
  const srcdoc = buildSrcdoc(sanitized)
  assertNotContains(srcdoc, '<script>', 'script stripped end-to-end')
  assertNotContains(sanitized, 'onerror', 'onerror stripped')
})

test('Full pipeline: image URLs are proxied', () => {
  const html = '<img src="https://external-site.com/image.png">'
  const sanitized = sanitizeAndProxyEmailHtml(html)
  assertContains(sanitized, '/api/gmail/proxy?url=', 'image proxied')
})

// ── EDGE CASES ────────────────────────────────────────────────────────────────

console.log('\n⚠️ Edge Case Tests')

test('Empty email body → no crash', () => {
  const html = plainTextToHtml('')
  const sanitized = sanitizeAndProxyEmailHtml(html)
  const srcdoc = buildSrcdoc(sanitized)
  assert(srcdoc.length > 0, 'empty email handled gracefully')
})

test('Email with only whitespace → no crash', () => {
  const html = plainTextToHtml('   \n\n   \n')
  const sanitized = sanitizeAndProxyEmailHtml(html)
  const srcdoc = buildSrcdoc(sanitized)
  assert(srcdoc.length > 0, 'whitespace-only email handled')
})

test('Very long URL → no overflow', () => {
  const longUrl = 'https://example.com/' + 'a'.repeat(500)
  const html = plainTextToHtml(`Link: ${longUrl}`)
  const sanitized = sanitizeAndProxyEmailHtml(html)
  const srcdoc = buildSrcdoc(sanitized)
  assertNotContains(srcdoc, 'overflow-x', 'no unwanted overflow-x')
})

test('Unicode content → renders correctly', () => {
  const html = plainTextToHtml('Hello 世界! 🎉 Émoji and unicode: 你好')
  const sanitized = sanitizeAndProxyEmailHtml(html)
  const srcdoc = buildSrcdoc(sanitized)
  assertContains(srcdoc, '世界', 'unicode preserved')
})

test('Email with nested blockquotes → preserves structure', () => {
  const html = plainTextToHtml('> nested\n> > deeper\n> back')
  const sanitized = sanitizeAndProxyEmailHtml(html)
  assertContains(sanitized, '<blockquote>', 'blockquote preserved')
})

test('Email with code blocks → <pre> and <code> preserved', () => {
  const html = plainTextToHtml('```\ncode here\n```')
  const sanitized = sanitizeAndProxyEmailHtml(html)
  assertContains(sanitized, '<pre>', 'pre block preserved')
})

// ── SUMMARY ──────────────────────────────────────────────────────────────────

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
