import React, { useEffect, useRef } from "react"
import { usePeer } from "../hooks/usePeer"

interface VideoCallProps {
  myId: string
  peerId: string
  onClose: () => void
}

export const VideoCall: React.FC<VideoCallProps> = ({ myId, peerId, onClose }) => {
  const { peer, remoteStream, callUser, endCall } = usePeer(myId)
  const myVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  useEffect(() => {
    // Mulai panggilan otomatis ketika peer siap
    if (peer && peerId) {
      callUser(peerId)
    }
  }, [peer, peerId])

  useEffect(() => {
    // Tampilkan video lokal
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      if (myVideoRef.current) {
        myVideoRef.current.srcObject = stream
      }
    })
  }, [])

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-900 text-white">
      <div className="relative w-full max-w-4xl">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full rounded-2xl shadow-lg"
        />
        <video
          ref={myVideoRef}
          autoPlay
          muted
          playsInline
          className="absolute bottom-4 right-4 w-40 rounded-lg border-2 border-white"
        />
      </div>

      <div className="mt-4 flex gap-4">
        <button
          onClick={() => {
            endCall()
            onClose()
          }}
          className="bg-red-600 px-4 py-2 rounded-lg hover:bg-red-700"
        >
          Akhiri Panggilan
        </button>
      </div>
    </div>
  )
}
