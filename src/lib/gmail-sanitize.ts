// Create JSDOM once at module load (server-side only — API routes in Next.js)
import { JSDOM } from 'jsdom'

const dom = new JSDOM('', {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
})

// eslint-disable-next-line @typescript-eslint/no-require-imports
const createDOMPurify = require('dompurify') as (window: unknown) => { sanitize: (html: string, config?: object) => string }
const DOMPurify = createDOMPurify(dom.window)

/** Regex-based color stripper for dark mode.
 *  Strips color= in [style] attributes and legacy HTML color attributes.
 *  Preserves background-color, background, font-size, font-family, margin, padding. */
function stripInlineColorsForDarkMode(html: string): string {
  return html
    // Strip color: ...; from [style] attributes (preserves background-color, etc.)
    .replace(/\bstyle=(["'])(.*?)\1/gi, (_match: string, quote: string, styles: string) => {
      const cleaned = styles
        .replace(/(?<!-)color\s*:\s*[^;]+;?\s*/gi, '')
        .replace(/(?<!-)color\s*:\s*[^;]+$/gi, '')
        .trim()
      return cleaned ? `style=${quote}${cleaned}${quote}` : ''
    })
    // Strip legacy color/text attributes on common email HTML elements
    .replace(/\s(color|text|alink|vlink|link)\s*=\s*(["'])(.*?)\2/gi, '')
    // Strip font[size] and font[color] (legacy font tag attrs)
    .replace(/<font\b([^>]*)>/gi, (match: string, attrs: string) => {
      const cleaned = attrs.replace(/\s*(color|size)\s*=\s*(["'])(.*?)\2/gi, '')
      return cleaned ? `<font${cleaned}>` : '<font>'
    })
}

/** Rewrites image src attributes to go through the proxy. */
function proxyImageUrls(html: string, messageId?: string): string {
  const proxyUrlFor = (src: string): string | null => {
    if (/^https?:\/\//i.test(src)) {
      return `/api/gmail/proxy?url=${encodeURIComponent(src)}`
    }
    if (/^cid:/i.test(src)) {
      const cidValue = src.slice(4)
      return `/api/gmail/proxy?cid=${encodeURIComponent(cidValue)}${messageId ? `&messageId=${encodeURIComponent(messageId)}` : ''}`
    }
    return null
  }

  const replaceAttr = (htmlValue: string, attrName: string): string => {
    const attrPattern = new RegExp(`(${attrName}\\s*=\\s*)(["'])(.*?)\\2`, 'gi')
    return htmlValue.replace(attrPattern, (_match: string, prefix: string, quote: string, src: string) => {
      const proxyUrl = proxyUrlFor(src)
      return proxyUrl ? `${prefix}${quote}${proxyUrl}${quote}` : `${prefix}${quote}${src}${quote}`
    })
  }

  let next = html
  next = replaceAttr(next, 'src')
  next = replaceAttr(next, 'data-src')
  next = replaceAttr(next, 'data-original')
  next = replaceAttr(next, 'data-lazy-src')
  next = replaceAttr(next, 'data-echo')

  // Rewrite url() values in inline styles (background-image, etc.)
  next = next.replace(/style=(["'])(.*?)\1/gi, (outerMatch: string, quote: string, styles: string) => {
    const rewritten = styles.replace(/url\((['"]?)(.*?)\1\)/gi, (urlMatch: string, urlQuote: string, url: string) => {
      const proxyUrl = proxyUrlFor(url)
      return proxyUrl ? `url("${proxyUrl}")` : `url("${url}")`
    })
    return `style=${quote}${rewritten}${quote}`
  })

  return next
}

/**
 * Full email HTML sanitization pipeline:
 *  1. Strip unsafe tags  (script, iframe, object, embed, form, svg, math)
 *  2. Strip event handlers (onclick, onerror, etc.)
 *  3. Proxy image URLs through /api/gmail/proxy
 *  4. Optionally strip inline colors for dark mode (LinkedIn grey-text fix)
 *  5. DOMPurify final XSS pass
 */
export function sanitizeAndProxyEmailHtml(
  html: string,
  messageId?: string,
  darkMode = false
): string {
  let sanitized = html

  // Step 1: Remove dangerous tags (regex before DOMPurify so they don't need removal later)
  sanitized = sanitized
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object\b[\s\S]*?<\/object>/gi, '')
    .replace(/<embed\b[\s\S]*?<\/embed>/gi, '')
    .replace(/<form\b[\s\S]*?<\/form>/gi, '')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, '')
    .replace(/<math\b[\s\S]*?<\/math>/gi, '')

  // Step 2: Remove event handler attributes
  sanitized = sanitized.replace(/\son[a-z-]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '')

  // Step 3: Proxy image URLs (must run before color stripping so URL rewriting is clean)
  sanitized = proxyImageUrls(sanitized, messageId)

  // Step 4: Dark mode — strip inline colors so email's hardcoded grey/black text
  // doesn't show up invisible on dark backgrounds. Background-color is preserved.
  if (darkMode) {
    sanitized = stripInlineColorsForDarkMode(sanitized)
  }

  // Step 5: DOMPurify final XSS sanitization
  // ADD_ATTR must include 'style' so inline styles survive.
  // 'bgcolor' and 'align' are email essentials (table layout, backgrounds).
  // In dark mode, buildSrcdoc converts bgcolor→style.background-color so
  // CSS variables can override them. In light mode original bgcolor is preserved.
  return DOMPurify.sanitize(sanitized, {
    USE_PROFILES: { html: true },
    ADD_TAGS: ['style'],
    ADD_ATTR: ['style', 'target', 'rel', 'bgcolor', 'align'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'svg', 'math'],
    FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit', 'oninput'],
  })
}
