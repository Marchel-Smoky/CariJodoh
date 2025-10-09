import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import defaultIcon from "../asset/noprofile.png";

// 🔧 Type user aktif
type ActiveUser = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  is_online: boolean | null;
  last_online?: string | null;
};

interface ActiveUsersBarProps {
  currentUserId: string;
}

export const ActiveUsersBar: React.FC<ActiveUsersBarProps> = ({ currentUserId }) => {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(true);

  // 🔄 Ambil user aktif
  const fetchActiveUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, is_online, last_online")
        .neq("id", currentUserId)
        .eq("is_online", true)
        .order("last_online", { ascending: false })
        .limit(8);

      if (error) throw error;
      if (data) setActiveUsers(data);
    } catch (error) {
      console.error("Error fetching active users:", error);
    } finally {
      setLoading(false);
    }
  };

  // 📡 Realtime listener
  useEffect(() => {
    fetchActiveUsers();

    const channel = supabase
  .channel("realtime-active-users")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "profiles",
    },
    (payload: any) => {
      const newRow = payload?.new;
      if (!newRow) return;
      // pastikan properti ada dan bukan milik current user
      if (typeof newRow.is_online === "undefined") return;
      if (newRow.id === currentUserId) return;
      fetchActiveUsers();
    }
  )
  .subscribe();


    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // 💫 Loading state
  if (loading) {
    return (
      <div className="p-3 bg-white/80 backdrop-blur-md border-t border-gray-200">
        <div className="flex items-center justify-center gap-2">
          <div className="w-3 h-3 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
          <span className="text-xs text-gray-500">Memuat user online...</span>
        </div>
      </div>
    );
  }

  // 👥 Tampilan utama
  return (
    <div className="p-3 bg-white/80 backdrop-blur-md border-t border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Online ({activeUsers.length})
        </h4>
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {activeUsers.length > 0 ? (
          activeUsers.map((user) => (
            <div key={user.id} className="flex flex-col items-center flex-shrink-0 group">
              <div className="relative">
                <img
                  src={user.avatar_url || defaultIcon}
                  onError={(e) => {
                    e.currentTarget.src = defaultIcon;
                    e.currentTarget.onerror = null;
                  }}
                  className="w-10 h-10 rounded-full border-2 border-green-400 object-cover shadow-sm group-hover:scale-110 transition-transform duration-200"
                  alt={user.username || "User"}
                  title={user.username || "Unknown User"}
                />
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
              </div>
              <span className="text-xs text-gray-600 mt-1 max-w-[60px] truncate group-hover:text-gray-800 transition-colors">
                {user.username || "User"}
              </span>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-400 text-sm py-2 w-full">
            <div className="w-8 h-8 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-1">
              <span className="text-lg">👥</span>
            </div>
            Belum ada user online
          </div>
        )}
      </div>
    </div>
  );
};
