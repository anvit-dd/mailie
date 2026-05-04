'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

interface Account {
  id: string
  email: string
  name: string | null
}

interface AuthContextType {
  account: Account | null
  isLoading: boolean
  isAuthenticated: boolean
  login: () => void
  logout: () => Promise<void>
  refreshToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch current user on mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json()
        if (data.user) {
          setAccount(data.user)
        }
      } catch (e) {
        console.error('Failed to fetch user', e)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUser()
  }, [])

  const login = useCallback(() => {
    // Redirect to server-side OAuth initiation
    window.location.href = '/api/auth/gmail'
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (e) {
      console.error('Logout error', e)
    }
    setAccount(null)
  }, [])

  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST' })
      if (!res.ok) return null
      const data = await res.json()
      return data.access_token
    } catch {
      return null
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        account,
        isLoading,
        isAuthenticated: !!account,
        login,
        logout,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
