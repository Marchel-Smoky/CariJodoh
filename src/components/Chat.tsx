import React, { useEffect, useState, useRef } from "react"
import { supabase } from "../lib/supabase"
import { ArrowLeft, Send } from "lucide-react"

interface ChatProps {
  senderId: string
  receiverId: string
  onClose: () => void
}

export const Chat: React.FC<ChatProps> = ({ senderId, receiverId, onClose }) => {
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [receiver, setReceiver] = useState<any>(null)
  const messageEndRef = useRef<HTMLDivElement | null>(null)

  // 🔹 Ambil pesan dan info pengguna penerima
  useEffect(() => {
    const fetchChatData = async () => {
      // ambil profil penerima
      const { data: userData } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .eq("id", receiverId)
        .single()
      setReceiver(userData)

      // ambil semua pesan
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`)
        .order("created_at", { ascending: true })

      if (!error && data) setMessages(data)
    }

    fetchChatData()

    // 🔹 Realtime pesan baru
    const subscription = supabase
      .channel("realtime:messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as any
          if (
            (msg.sender_id === senderId && msg.receiver_id === receiverId) ||
            (msg.sender_id === receiverId && msg.receiver_id === senderId)
          ) {
            setMessages((prev) => [...prev, msg])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [senderId, receiverId])

  // 🔹 Scroll otomatis ke pesan terbaru
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // 🔹 Kirim pesan baru
  const sendMessage = async () => {
    if (!newMessage.trim()) return
    await supabase.from("messages").insert([
      {
        sender_id: senderId,
        receiver_id: receiverId,
        content: newMessage.trim(),
      },
    ])
    setNewMessage("")
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 shadow-md border-l border-gray-300">
      {/* 🔹 Header Chat */}
      <div className="p-4 bg-blue-600 text-white flex items-center gap-3 shadow">
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-blue-700 transition"
          title="Kembali"
        >
          <ArrowLeft size={22} />
        </button>

        {receiver ? (
          <div className="flex items-center gap-3">
            <img
              src={receiver.avatar_url || "https://ui-avatars.com/api/?name=" + receiver.username}
              alt={receiver.username}
              className="w-10 h-10 rounded-full object-cover border-2 border-white"
            />
            <div>
              <h2 className="font-semibold text-lg">{receiver.username}</h2>
              <p className="text-sm text-blue-200">Online</p>
            </div>
          </div>
        ) : (
          <div className="text-white text-sm">Memuat...</div>
        )}
      </div>

      {/* 🔹 Area Pesan */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${
              msg.sender_id === senderId ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`p-3 max-w-xs rounded-2xl shadow text-sm ${
                msg.sender_id === senderId
                  ? "bg-blue-600 text-white rounded-br-none"
                  : "bg-gray-200 text-gray-900 rounded-bl-none"
              }`}
            >
              {msg.content}
              <div className="text-[10px] opacity-70 mt-1 text-right">
                {new Date(msg.created_at).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        ))}
        <div ref={messageEndRef} />
      </div>

      {/* 🔹 Input Pesan */}
      <div className="p-3 flex items-center bg-white border-t border-gray-200">
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ketik pesan..."
          className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={sendMessage}
          className="ml-2 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition"
          title="Kirim pesan"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}
