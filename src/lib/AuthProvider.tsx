import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabaseClient'
import type { Profile } from './types'

// Set before redirecting to Google when sign-in was triggered by "Post a
// listing", so the modal can be reopened once the OAuth round-trip lands
// back on this page. Read/cleared by App.tsx's Layout.
export const POST_INTENT_KEY = 'imoti-post-intent'

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setSessionLoading(false)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const user = session?.user ?? null

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single()
      if (error) throw error
      return data as Profile
    },
    enabled: !!user,
  })

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    queryClient.removeQueries({ queryKey: ['profile'] })
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile: profile ?? null,
        isLoading: sessionLoading || (!!user && profileLoading),
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
