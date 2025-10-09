// ==============================================
// src/lib/supabase.ts
// ==============================================

import { createClient } from "@supabase/supabase-js"

// ==============================================
// 1️⃣ Ambil konfigurasi dari environment (Vite)
// ==============================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("❌ Missing Supabase environment variables. Pastikan .env berisi VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY")
}

// ==============================================
// 2️⃣ Inisialisasi Supabase Client
// ==============================================
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// ==============================================
// 3️⃣ TypeScript Type Definitions
// ==============================================

/**
 * Tabel `profiles`
 * Pastikan sesuai dengan definisi database kamu:
 * id (uuid), username, avatar_url, age, bio, interests, latitude, longitude, dll.
 */
export interface UserProfile {
  id: string
  username: string | null
  avatar_url: string | null // contoh: "avatars/<user>.jpg"
  age: number | null
  bio: string | null
  interests: string[] | null
  location: string | null
  is_online: boolean | null
  last_online: string | null
  created_at: string | null
  latitude: number | null
  longitude: number | null
  gender: "male" | "female" | null
}

/**
 * Tabel `chat_messages`
 * Untuk pesan antar user.
 */
export interface ChatMessage {
  id: string
  sender_id: string
  receiver_id: string
  message: string
  created_at: string
  is_read: boolean
}

/**
 * Tabel `video_sessions`
 * Untuk fitur video call.
 */
export interface VideoSession {
  id: string
  initiator_id: string
  receiver_id: string
  status: "pending" | "accepted" | "rejected" | "ended"
  created_at: string
  ended_at: string | null
}

// ==============================================
// 4️⃣ Helper: Generate public image URL dari Supabase Storage
// ==============================================
/**
 * Contoh:
 * getPublicUrl("avatars/john_doe.jpg")
 */
export const getPublicUrl = (path: string | null): string => {
  if (!path) return "/noprofile.png"
  return `${SUPABASE_URL}/storage/v1/object/public/${path}`
}
