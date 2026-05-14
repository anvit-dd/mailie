import dns from 'dns/promises'
import net from 'net'

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true
  }

  const [a, b] = parts
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 0
  )
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase()
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  )
}

export function isPrivateIp(ip: string): boolean {
  const version = net.isIP(ip)
  if (version === 4) return isPrivateIpv4(ip)
  if (version === 6) return isPrivateIpv6(ip)
  return true
}

export async function assertPublicHostname(hostname: string, options: { allowPrivate?: boolean } = {}) {
  if (options.allowPrivate) return

  const normalized = hostname.trim().toLowerCase()
  if (!normalized) throw new Error('Host is required')
  if (['localhost', 'localhost.localdomain'].includes(normalized)) {
    throw new Error('Private/local hosts are not allowed')
  }

  if (net.isIP(normalized)) {
    if (isPrivateIp(normalized)) throw new Error('Private/local hosts are not allowed')
    return
  }

  const results = await dns.lookup(normalized, { all: true, verbatim: true })
  if (!results.length || results.some((result) => isPrivateIp(result.address))) {
    throw new Error('Private/local hosts are not allowed')
  }
}

export function allowPrivateMailHosts(): boolean {
  return process.env.MAILIE_ALLOW_PRIVATE_MAIL_HOSTS === 'true' || process.env.NODE_ENV !== 'production'
}
