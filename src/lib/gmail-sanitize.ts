// @ts-ignore - DOMPurify's CJS typings require a synthetic default import here.
import createDOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'

const domWindow = new JSDOM('').window
const DOMPurify = createDOMPurify(domWindow as never)

function proxyImageUrls(html: string): string {
  const dom = new JSDOM(html)
  const { document } = dom.window

  document.querySelectorAll('img[src^="https://"]').forEach((img) => {
    const originalSrc = img.getAttribute('src')
    if (!originalSrc) return

    img.setAttribute('src', `/api/gmail/proxy?url=${encodeURIComponent(originalSrc)}`)
  })

  return document.body.innerHTML
}

export function sanitizeAndProxyEmailHtml(html: string): string {
  const sanitized = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  })

  return proxyImageUrls(sanitized)
}
