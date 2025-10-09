import React, { useState } from "react";
import { Profile } from "./Profile";
import { Chat } from "./Chat";
import { X, Users, MessageCircle } from "lucide-react";
import { supabase } from "../lib/supabase"; // Sesuaikan path

type SidebarUserProps = {
  userId: string;
  isOpen: boolean;
  onClose?: () => void;
};

export const SidebarUser: React.FC<SidebarUserProps> = ({
  userId,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<"profile" | "chat">("profile");
  const [selectedReceiver, setSelectedReceiver] = useState<string | null>(null);

  // Function untuk memulai chat dengan user tertentu
  const startChat = (receiverId: string) => {
    setSelectedReceiver(receiverId);
    setActiveTab("chat");
  };

  // Function untuk kembali ke list chat
  const backToChatList = () => {
    setSelectedReceiver(null);
  };

  // Function untuk menutup sidebar
  const handleClose = () => {
    setSelectedReceiver(null);
    setActiveTab("profile");
    onClose?.();
  };

  return (
    <>
      {/* Overlay hitam untuk mobile */}
      <div
        onClick={handleClose}
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-30 transition-all duration-300 md:hidden ${
          isOpen ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
      />

      {/* Sidebar utama */}
      <div
        className={`fixed md:static left-0 top-0 w-72 md:w-80 h-full bg-white/90 backdrop-blur-lg border-r border-gray-200 flex flex-col shadow-2xl z-40 transform transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Tombol Tutup */}
        {onClose && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 md:hidden transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        )}
        
        {/* Tab Navigasi - Hanya tampil jika tidak di dalam chat spesifik */}
        {!selectedReceiver && (
          <div className="flex border-b border-gray-200 bg-white/90">
            <button
              className={`flex items-center justify-center gap-2 flex-1 py-3 text-center font-medium transition-all duration-200 ${
                activeTab === "profile"
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50 shadow-inner"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setActiveTab("profile")}
            >
              <Users className="w-4 h-4" />
              <span>Profil</span>
            </button>
            <button
              className={`flex items-center justify-center gap-2 flex-1 py-3 text-center font-medium transition-all duration-200 ${
                activeTab === "chat"
                  ? "text-green-600 border-b-2 border-green-600 bg-green-50 shadow-inner"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setActiveTab("chat")}
            >
              <MessageCircle className="w-4 h-4" />
              <span>Chat</span>
            </button>
          </div>
        )}

        {/* Isi Tab */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "profile" ? (
            <Profile userId={userId} />
          ) : selectedReceiver ? (
            // Tampilkan chat dengan user tertentu
            <Chat 
              senderId={userId}
              receiverId={selectedReceiver}
              onClose={backToChatList}
            />
          ) : (
            // Tampilkan list user untuk memulai chat
            <ChatList 
              currentUserId={userId}
              onSelectUser={startChat}
            />
          )}
        </div>
      </div>
    </>
  );
};

// Komponen untuk menampilkan list user yang bisa diajak chat
interface ChatListProps {
  currentUserId: string;
  onSelectUser: (userId: string) => void;
}

const ChatList: React.FC<ChatListProps> = ({ currentUserId, onSelectUser }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch users dari database (contoh implementation)
  React.useEffect(() => {
    const fetchUsers = async () => {
      try {
        // Ganti dengan query sesuai database Anda
        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, is_online")
          .neq("id", currentUserId) // Exclude current user
          .limit(20);

        if (!error && data) {
          setUsers(data);
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [currentUserId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Memuat percakapan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header Chat List */}
      <div className="p-4 border-b border-gray-200 bg-white/80">
        <h2 className="text-lg font-semibold text-gray-800">Percakapan</h2>
        <p className="text-sm text-gray-500">Pilih user untuk memulai chat</p>
      </div>

      {/* List Users */}
      <div className="flex-1 overflow-y-auto">
        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-medium text-gray-700 mb-2">Belum ada pengguna</h3>
            <p className="text-gray-500 text-sm">
              Pengguna lain akan muncul di sini
            </p>
          </div>
        ) : (
          users.map((user) => (
            <button
              key={user.id}
              onClick={() => onSelectUser(user.id)}
              className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 border-b border-gray-100 transition-colors"
            >
              <div className="relative">
                <img
                  src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}`}
                  alt={user.username}
                  className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                />
                {user.is_online && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                )}
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-semibold text-gray-800">{user.username}</h3>
                <p className="text-sm text-gray-500">
                  {user.is_online ? "Online" : "Offline"}
                </p>
              </div>
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};