import { useEffect, useRef, useState } from "react"
import Peer, { MediaConnection } from "peerjs"

export function usePeer(userId: string) {
  const [peer, setPeer] = useState<Peer | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const currentCall = useRef<MediaConnection | null>(null)

  useEffect(() => {
    if (!userId) return

    // Membuat koneksi PeerJS baru
    const newPeer = new Peer(userId, {
      host: "peerjs-server.herokuapp.com",
      secure: true,
      port: 443,
    })

    setPeer(newPeer)

    // Ketika peer sudah siap
    newPeer.on("open", (id) => {
      console.log("✅ Peer connected with ID:", id)
    })

    // Ketika menerima panggilan video
    newPeer.on("call", async (call) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        call.answer(stream)

        call.on("stream", (remoteStream) => {
          setRemoteStream(remoteStream)
        })

        currentCall.current = call
      } catch (err) {
        console.error("❌ Error accessing camera/mic:", err)
      }
    })

    newPeer.on("error", (err) => {
      console.error("❌ PeerJS Error:", err)
    })

    return () => {
      newPeer.destroy()
    }
  }, [userId])

  // 🔹 Memanggil pengguna lain
  const callUser = async (remotePeerId: string) => {
    if (!peer) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      const call = peer.call(remotePeerId, stream)

      call.on("stream", (remoteStream) => {
        setRemoteStream(remoteStream)
      })

      currentCall.current = call
    } catch (err) {
      console.error("❌ Error saat memulai call:", err)
    }
  }

  // 🔹 Mengakhiri panggilan
  const endCall = () => {
    currentCall.current?.close()
    setRemoteStream(null)
    console.log("🔴 Call ended.")
  }

  return { peer, remoteStream, callUser, endCall }
}
