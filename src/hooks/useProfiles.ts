import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { UserProfile } from "../types"

export function useProfiles() {
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProfiles()
    const sub = supabase
      .channel("realtime:profiles")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchProfiles())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  const fetchProfiles = async () => {
    setLoading(true)
    const { data } = await supabase.from("profiles").select("*")
    setProfiles(data ?? [])
    setLoading(false)
  }

  return { profiles, loading }
}
