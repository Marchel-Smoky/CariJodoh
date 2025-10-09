// src/components/UserList.tsx
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

interface HorizontalUserScrollProps {
  currentUserId: string;
  currentUserGender: "male" | "female";
}

type User = {
  id: string;
  username: string;
  avatar_url: string | null;
  is_online: boolean;
  gender: "male" | "female";
};

export const HorizontalUserScroll: React.FC<HorizontalUserScrollProps> = ({
  currentUserId,
  currentUserGender,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, is_online, gender")
          .neq("id", currentUserId) // Exclude current user
          .eq("is_online", true) // Only online users
          .limit(20);

        if (!error && data) {
          setUsers(data as User[]);
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [currentUserId]);

  // Auto scroll effect
  useEffect(() => {
    const container = scrollContainerRef.current;
    const content = scrollContentRef.current;

    if (!container || !content || users.length === 0) return;

    const containerWidth = container.offsetWidth;
    const contentWidth = content.scrollWidth;
    
    if (contentWidth <= containerWidth) return;

    let scrollPosition = 0;
    const scrollSpeed = 0.5; // pixels per frame

    const animateScroll = () => {
      scrollPosition += scrollSpeed;
      
      if (scrollPosition >= contentWidth - containerWidth) {
        scrollPosition = 0;
      }
      
      container.scrollLeft = scrollPosition;
      requestAnimationFrame(animateScroll);
    };

    const animationId = requestAnimationFrame(animateScroll);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [users]);

  if (loading) {
    return (
      <div className="w-full bg-white/80 backdrop-blur-md border-b border-gray-200 py-3 px-4">
        <div className="flex space-x-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex flex-col items-center space-y-2">
              <div className="w-16 h-16 bg-gray-200 rounded-full animate-pulse"></div>
              <div className="w-12 h-3 bg-gray-200 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="w-full bg-white/80 backdrop-blur-md border-b border-gray-200 py-3 px-4">
        <div className="text-center text-gray-500 text-sm">
          Tidak ada pengguna online saat ini
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div 
        ref={scrollContainerRef}
        className="overflow-hidden py-3 px-4 scrollbar-hide"
        style={{ 
          scrollBehavior: 'auto',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none'
        }}
      >
        <div 
          ref={scrollContentRef}
          className="flex space-x-6 items-center"
          style={{ width: 'max-content' }}
        >
          {users.map((user) => (
            <div
              key={user.id}
              className="flex flex-col items-center space-y-2 flex-shrink-0 group cursor-pointer transition-transform duration-200 hover:scale-110"
            >
              {/* Avatar dengan border berdasarkan gender */}
              <div className="relative">
                <img
                  src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}&background=random`}
                  alt={user.username}
                  className={`w-16 h-16 rounded-full object-cover border-3 shadow-lg ${
                    user.gender === "male" 
                      ? "border-blue-400" 
                      : "border-pink-400"
                  } group-hover:shadow-xl transition-all duration-200`}
                />
                {/* Online indicator */}
                {user.is_online && (
                  <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full animate-pulse"></div>
                )}
              </div>
              
              {/* Username */}
              <div className="text-center max-w-20">
                <p className="text-xs font-medium text-gray-700 truncate group-hover:text-gray-900 transition-colors">
                  {user.username}
                </p>
                <div className="flex items-center justify-center space-x-1 mt-1">
                  <div className={`w-2 h-2 rounded-full ${
                    user.is_online ? "bg-green-500" : "bg-gray-400"
                  }`}></div>
                  <span className="text-xs text-gray-500">
                    {user.gender === "male" ? "♂" : "♀"}
                  </span>
                </div>
              </div>
            </div>
          ))}
          
          {/* Duplicate users untuk infinite scroll effect */}
          {users.map((user) => (
            <div
              key={`${user.id}-duplicate`}
              className="flex flex-col items-center space-y-2 flex-shrink-0 group cursor-pointer transition-transform duration-200 hover:scale-110"
            >
              <div className="relative">
                <img
                  src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}&background=random`}
                  alt={user.username}
                  className={`w-16 h-16 rounded-full object-cover border-3 shadow-lg ${
                    user.gender === "male" 
                      ? "border-blue-400" 
                      : "border-pink-400"
                  } group-hover:shadow-xl transition-all duration-200`}
                />
                {user.is_online && (
                  <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full animate-pulse"></div>
                )}
              </div>
              <div className="text-center max-w-20">
                <p className="text-xs font-medium text-gray-700 truncate group-hover:text-gray-900 transition-colors">
                  {user.username}
                </p>
                <div className="flex items-center justify-center space-x-1 mt-1">
                  <div className={`w-2 h-2 rounded-full ${
                    user.is_online ? "bg-green-500" : "bg-gray-400"
                  }`}></div>
                  <span className="text-xs text-gray-500">
                    {user.gender === "male" ? "♂" : "♀"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};