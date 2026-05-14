'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

interface MasterUser {
  id: string
  username: string
  phone: string
}

export interface MailAccount {
  id: string
  email: string
  name: string | null
  provider: 'gmail' | 'smtp_imap'
  capabilities: {
    smtp: boolean
    imap: boolean
  }
  lastUsedAt: number | null
}

interface AuthContextType {
  user: MasterUser | null
  account: MailAccount | null
  accounts: MailAccount[]
  isLoading: boolean
  isAuthenticated: boolean
  hasActiveAccount: boolean
  provider: 'gmail' | 'smtp_imap' | null
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>
  register: (username: string, password: string, phone: string) => Promise<{ ok: boolean; error?: string }>
  connectGmail: () => void
  logout: () => Promise<void>
  selectAccount: (accountId: string) => Promise<{ ok: boolean; error?: string }>
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MasterUser | null>(null)
  const [account, setAccount] = useState<MailAccount | null>(null)
  const [accounts, setAccounts] = useState<MailAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const applyAuthPayload = useCallback((data: { user?: MasterUser | null; activeAccount?: MailAccount | null; accounts?: MailAccount[] }) => {
    setUser(data.user ?? null)
    setAccount(data.activeAccount ?? null)
    setAccounts(data.accounts ?? [])
  }, [])

  const refreshAuth = useCallback(async () => {
    const res = await fetch('/api/auth/me')
    const data = await res.json()
    applyAuthPayload(data)
  }, [applyAuthPayload])

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshAuth()
        .catch((e) => {
          console.error('Failed to fetch user', e)
          applyAuthPayload({ user: null, activeAccount: null, accounts: [] })
        })
        .finally(() => setIsLoading(false))
    }, 0)
    return () => clearTimeout(timer)
  }, [applyAuthPayload, refreshAuth])

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) return { ok: false, error: data.error ?? 'Login failed' }
    await refreshAuth()
    return { ok: true }
  }, [refreshAuth])

  const register = useCallback(async (username: string, password: string, phone: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, phone }),
    })
    const data = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) return { ok: false, error: data.error ?? 'Registration failed' }
    await refreshAuth()
    return { ok: true }
  }, [refreshAuth])

  const connectGmail = useCallback(() => {
    window.location.href = '/api/auth/gmail'
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (e) {
      console.error('Logout error', e)
    }
    applyAuthPayload({ user: null, activeAccount: null, accounts: [] })
  }, [applyAuthPayload])

  const selectAccount = useCallback(async (accountId: string) => {
    const res = await fetch('/api/auth/select-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId }),
    })
    const data = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) return { ok: false, error: data.error ?? 'Account select failed' }
    await refreshAuth()
    return { ok: true }
  }, [refreshAuth])

  const provider = account?.provider ?? null

  return (
    <AuthContext.Provider
      value={{
        user,
        account,
        accounts,
        isLoading,
        isAuthenticated: !!user,
        hasActiveAccount: !!account,
        provider,
        login,
        register,
        connectGmail,
        logout,
        selectAccount,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
