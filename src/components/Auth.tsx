// src/components/Auth.tsx
import React, { useState } from "react"
import { supabase } from "../lib/supabase"

export default function Auth(): JSX.Element {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const signInWithEmail = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
      })
      if (error) throw error
      setMessage("Link magic telah dikirim ke emailmu. Cek inbox.")
      setEmail("")
    } catch (err: any) {
      console.error(err)
      setMessage(err.message ?? "Gagal mengirim link.")
    } finally {
      setLoading(false)
    }
  }

  const signInWithGoogle = async () => {
    try {
      setLoading(true)
      await supabase.auth.signInWithOAuth({
        provider: "google",
      })
      // redirect handled by supabase
    } catch (err) {
      console.error("Google login error", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-600 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Jomblo Locator</h2>

        <form onSubmit={signInWithEmail} className="space-y-4">
          <input
            type="email"
            placeholder="Email kamu"
            className="w-full px-4 py-3 border rounded-lg"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold"
            disabled={loading}
          >
            {loading ? "Mengirim..." : "Kirim Link Masuk"}
          </button>
        </form>

        <div className="my-4 text-center text-gray-400">atau</div>

        <button
          onClick={signInWithGoogle}
          className="w-full border px-4 py-3 rounded-lg flex items-center justify-center gap-2"
        >
          <img src="https://www.svgrepo.com/show/355037/google.svg" alt="g" className="w-5 h-5" />
          Masuk dengan Google
        </button>

        {message && <p className="mt-4 text-sm text-gray-600">{message}</p>}
      </div>
    </div>
  )
}
