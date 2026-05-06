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
    return htmlValue.replace(attrPattern, (_match, prefix, quote, src) => {
      const proxyUrl = proxyUrlFor(src)
      if (!proxyUrl) return `${prefix}${quote}${src}${quote}`
      return `${prefix}${quote}${proxyUrl}${quote}`
    })
  }

  let next = html
  next = replaceAttr(next, 'src')
  next = replaceAttr(next, 'data-src')
  next = replaceAttr(next, 'data-original')
  next = replaceAttr(next, 'data-lazy-src')
  next = replaceAttr(next, 'data-echo')

  next = next.replace(/style=(["'])(.*?)\1/gi, (match, quote: string, style: string) => {
    const rewritten = style.replace(/url\((['"]?)(.*?)\1\)/gi, (_urlMatch, _urlQuote, url: string) => {
      const proxyUrl = proxyUrlFor(url)
      return proxyUrl ? `url("${proxyUrl}")` : `url("${url}")`
    })
    return `style=${quote}${rewritten}${quote}`
  })

  return next
}

export function sanitizeAndProxyEmailHtml(html: string, messageId?: string): string {
  const stripped = stripUnsafeTags(stripEventHandlers(html))
  return proxyImageUrls(stripped, messageId)
}
