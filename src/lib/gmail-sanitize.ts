function stripUnsafeTags(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object\b[\s\S]*?<\/object>/gi, '')
    .replace(/<embed\b[\s\S]*?<\/embed>/gi, '')
    .replace(/<form\b[\s\S]*?<\/form>/gi, '')
}

function stripEventHandlers(html: string): string {
  return html.replace(/\son[a-z-]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '')
}

function proxyImageUrls(html: string, messageId?: string): string {
  return html.replace(/<img\b([^>]*?)src=(["'])(.*?)\2([^>]*)>/gi, (_match, before, quote, src, after) => {
    let proxyUrl = ''

    if (/^https?:\/\//i.test(src)) {
      proxyUrl = `/api/gmail/proxy?url=${encodeURIComponent(src)}`
    } else if (/^cid:/i.test(src)) {
      const cidValue = src.slice(4)
      proxyUrl = `/api/gmail/proxy?cid=${encodeURIComponent(cidValue)}${messageId ? `&messageId=${encodeURIComponent(messageId)}` : ''}`
    }

    if (!proxyUrl) {
      return `<img${before}src=${quote}${src}${quote}${after}>`
    }

    return `<img${before}src=${quote}${proxyUrl}${quote}${after}>`
  })
}

export function sanitizeAndProxyEmailHtml(html: string, messageId?: string): string {
  const stripped = stripUnsafeTags(stripEventHandlers(html))
  return proxyImageUrls(stripped, messageId)
}
