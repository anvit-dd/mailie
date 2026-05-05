// @ts-ignore - DOMPurify's CJS typings require a synthetic default import here.
import createDOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'

const domWindow = new JSDOM('').window
const DOMPurify = createDOMPurify(domWindow as never)

/**
 * Rewrites image URLs in HTML so they go through our proxy:
 * - https://  → /api/gmail/proxy?url=<encoded>
 * - http://   → /api/gmail/proxy?url=<encoded>  (avoids browser mixed-content blocking)
 * - cid:     → /api/gmail/proxy?cid=<value>&messageId=<id>  (inline attachments, fetch via Gmail API)
 *
 * IMPORTANT: returns the FULL document HTML (not just body.innerHTML) so that
 * <head> content (viewport meta, <style> blocks, etc.) is preserved. If we return
 * only body.innerHTML, the email's entire CSS is lost before buildSrcdoc() runs.
 */
function proxyImageUrls(html: string, messageId?: string): string {
  const dom = new JSDOM(html)
  const { document } = dom.window

  document.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src') || ''
    let proxyUrl = ''

    if (src.startsWith('https://') || src.startsWith('http://')) {
      // External images: proxy through our server so auth cookies are sent
      proxyUrl = `/api/gmail/proxy?url=${encodeURIComponent(src)}`
    } else if (src.startsWith('cid:')) {
      // Inline attachment (Gmail's cid: scheme) → proxy resolves it via Gmail attachments API
      // messageId is required for CID lookups so we can find the right attachment
      const cidValue = src.slice(4)
      proxyUrl = `/api/gmail/proxy?cid=${encodeURIComponent(cidValue)}${messageId ? `&messageId=${encodeURIComponent(messageId)}` : ''}`
    }

    if (proxyUrl) {
      img.setAttribute('src', proxyUrl)
    }
  })

  // Return the FULL document so <head> and all its contents are preserved.
  // JSDOM always produces a complete document structure even if the input was
  // a body-only fragment, so outerHTML gives us the complete HTML with <html>/<head>/<body>.
  return document.documentElement.outerHTML
}

export function sanitizeAndProxyEmailHtml(html: string, messageId?: string): string {
  const sanitized = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    // Allow <style> tags and inline style attributes so email CSS (background-color,
    // border-radius, padding, etc.) survives sanitization. DOMPurify strips these by
    // default even with html:true profile.
    ADD_TAGS: ['style'],
    ADD_ATTR: ['style'],
  })

  return proxyImageUrls(sanitized, messageId)
}
