// src/hooks/useAuth.tsx
import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export function useAuth() {
  const [user, setUser] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser()
        if (mounted) setUser(currentUser ?? null)
      } catch (err) {
        console.error("useAuth: getUser error", err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()

    const { subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      // session may contain user
      setUser(session?.user ?? null)
    })

    return () => {
      mounted = false
      // unsubscribe
      if (subscription) subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
    } catch (err) {
      console.error("Sign out error:", err)
    }
  }

  return { user, loading, signOut }
}
