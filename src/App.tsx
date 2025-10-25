import React, { useEffect, useState, useCallback } from "react";
import { supabase, getStoragePublicUrl } from "./lib/supabase";
import Map from "./components/Map";
import { SidebarUser } from "./components/SidebarUser";
import { HorizontalUserScroll } from "./components/UserList";
import { Loader2, MapPin, Wifi, Menu, LogOut, User } from "lucide-react";
import "../index.css";

type User = {
  id: string;
  email: string;
};

type UserProfile = {
  gender: "male" | "female";
  avatar_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_online?: boolean | null;
  username?: string | null;
};

// ✅ Fungsi login dengan Google
const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
      queryParams: { access_type: 'offline', prompt: 'consent' }
    }
  });
  if (error) throw error;
  return data;
};

// ✅ FIXED: createUserProfile yang konsisten
const createUserProfile = async (userId: string, email: string): Promise<UserProfile> => {
  try {
    console.log("🆕 Creating/ensuring profile for:", userId);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No session");

    const profileData = {
      id: userId,
      username: email.split('@')[0] || `user_${userId.slice(0, 8)}`,
      gender: "male" as const,
      is_online: true,
      last_online: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    console.log("📝 Upserting profile...");

    // ✅ GUNAKAN UPSERT (insert or update) untuk menghindari race condition
    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert(profileData, {
        onConflict: 'id',
        ignoreDuplicates: false
      });

    if (upsertError) {
      console.error("❌ Upsert error:", upsertError);
      // Continue anyway - profile mungkin sudah ada
    } else {
      console.log("✅ Profile upserted successfully");
    }

    // ✅ SELALU return profile data yang konsisten
    return {
      gender: "male",
      avatar_url: null,
      is_online: true,
      latitude: null,
      longitude: null,
      username: profileData.username
    };

  } catch (error) {
    console.error("❌ Create profile error:", error);
    return {
      gender: "male",
      avatar_url: null,
      is_online: true,
      latitude: null,
      longitude: null,
      username: email.split('@')[0] || `user_${userId.slice(0, 8)}`
    };
  }
};

// ✅ FIXED: ensureUserProfile yang lebih reliable
const ensureUserProfile = async (userId: string, email: string): Promise<UserProfile> => {
  try {
    console.log("🔍 Ensuring profile for:", userId);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No session");

    // Cek apakah profile sudah ada
    const { data: existingProfile, error: fetchError } = await supabase
      .from("profiles")
      .select('*')
      .eq("id", userId)
      .maybeSingle();

    if (fetchError) {
      console.error("❌ Fetch error:", fetchError);
      // Lanjutkan untuk buat profile
    }

    if (existingProfile) {
      console.log("✅ Profile exists, returning:", existingProfile);
      return {
        gender: existingProfile.gender || "male",
        avatar_url: existingProfile.avatar_url,
        is_online: true, // Always set to true on login
        latitude: existingProfile.latitude,
        longitude: existingProfile.longitude,
        username: existingProfile.username
      };
    }

    console.log("🆕 Profile not found, creating...");
    return await createUserProfile(userId, email);

  } catch (error) {
    console.error("❌ Ensure profile error:", error);
    // Fallback ke create profile
    return await createUserProfile(userId, email);
  }
};

// ✅ LOGOUT function
const handleLogout = async (userId: string) => {
  try {
    // Update status online
    await supabase
      .from("profiles")
      .update({
        is_online: false,
        last_online: new Date().toISOString()
      })
      .eq("id", userId);

    // Sign out
    await supabase.auth.signOut();

    // Clear storage
    localStorage.removeItem("user");
    localStorage.removeItem("userLocation");
    localStorage.removeItem("userLocationTime");

    window.location.reload();
  } catch (error) {
    console.error("Logout error:", error);
    window.location.reload();
  }
};

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentUserGender, setCurrentUserGender] = useState<"male" | "female">("male");
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadStep, setLoadStep] = useState<string>("Mengecek sesi...");
  const [showSidebar, setShowSidebar] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState<any[]>([]);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [profileCreated, setProfileCreated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // ✅ FIXED: Single source of truth untuk profile state
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // ✅ Auth state listener
  useEffect(() => {
    const { subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`🔄 Auth state: ${event}`);
      
      try {
        if (event === 'SIGNED_IN' && session) {
          console.log("✅ User signed in");
          setAuthError(null);
          
          const userData = { 
            id: session.user.id, 
            email: session.user.email! 
          };
          
          setUser(userData);
          setUserEmail(session.user.email!);
          localStorage.setItem("user", JSON.stringify(userData));

          setLoadStep("Membuat profil...");
          
          // Tunggu untuk session stabil
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const userProfile = await ensureUserProfile(session.user.id, session.user.email!);
          
          // ✅ SET SEMUA STATE SEKALIGUS - hindari race condition
          setUserProfile(userProfile);
          setCurrentUserGender(userProfile.gender || "male");
          setCurrentUserAvatar(userProfile.avatar_url ? getStoragePublicUrl(userProfile.avatar_url) : null);
          setCurrentUsername(userProfile.username || userData.email.split('@')[0]);
          setProfileCreated(true);
          
          console.log("✅ Profile setup completed - all states set");
          
          // Set online status
          try {
            await supabase
              .from("profiles")
              .update({ 
                is_online: true,
                last_online: new Date().toISOString()
              })
              .eq("id", session.user.id);
          } catch (error) {
            console.error("Online status update failed:", error);
          }
          
          setLoading(false);
          setIsRedirecting(false);
        }
        else if (event === 'SIGNED_OUT') {
          setUser(null);
          setUserEmail("");
          setAuthError(null);
          setUserProfile(null);
          localStorage.removeItem("user");
          setProfileCreated(false);
          setLoading(false);
        }
      } catch (error) {
        console.error("❌ Auth state error:", error);
        setAuthError("Terjadi kesalahan saat memproses login.");
        setLoading(false);
        setIsRedirecting(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ✅ Initialize app
  useEffect(() => {
    const init = async () => {
      try {
        setLoadStep("Mengecek sesi pengguna...");

        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log("✅ Existing session found:", session.user.id);
          const userData = { 
            id: session.user.id, 
            email: session.user.email! 
          };
          setUser(userData);
          setUserEmail(session.user.email!);
          localStorage.setItem("user", JSON.stringify(userData));

          setLoadStep("Menyiapkan profil...");
          
          const userProfile = await ensureUserProfile(session.user.id, session.user.email!);
          
          // ✅ SET SEMUA STATE SEKALIGUS
          setUserProfile(userProfile);
          setCurrentUserGender(userProfile.gender || "male");
          setCurrentUserAvatar(userProfile.avatar_url ? getStoragePublicUrl(userProfile.avatar_url) : null);
          setCurrentUsername(userProfile.username || userData.email.split('@')[0]);
          setProfileCreated(true);

          setLoadStep("Menyiapkan peta...");
          
          // Load initial location
          const cachedLocation = getCachedLocation();
          if (cachedLocation) {
            setLocation(cachedLocation);
            // ✅ PASTIKAN profileCreated sudah true sebelum load nearby users
            setTimeout(() => {
              loadNearbyUsers(session.user.id, cachedLocation);
            }, 1000);
          }

          setLoading(false);
          
        } else {
          console.log("🔐 No session found");
          setLoading(false);
        }
      } catch (error) {
        console.error("❌ Initialization error:", error);
        setAuthError("Gagal memuat aplikasi.");
        setLoading(false);
      }
    };

    init();
  }, []);

  // ✅ Location tracking - FIXED: Gunakan userProfile sebagai dependency
  const startLocationTracking = useCallback((userId: string) => {
    if (!userProfile) {
      console.log("⏳ Waiting for userProfile...");
      return () => {};
    }

    console.log("🚀 Starting location tracking...");
    
    let watchId: number;

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation: [number, number] = [
          position.coords.latitude,
          position.coords.longitude
        ];

        setLocation(newLocation);
        cacheLocation(newLocation);

        // Update location to server
        try {
          supabase
            .from("profiles")
            .update({ 
              latitude: newLocation[0], 
              longitude: newLocation[1],
              location_updated_at: new Date().toISOString(),
              last_online: new Date().toISOString()
            })
            .eq("id", userId);
        } catch (error) {
          console.error("Location update failed:", error);
        }
      },
      (error) => {
        console.error("Location error:", error);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
    );

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [userProfile]); // ✅ Dependency pada userProfile, bukan profileCreated

  useEffect(() => {
    if (user?.id && userProfile) {
      console.log("📍 Starting location tracking with userProfile:", userProfile);
      const cleanup = startLocationTracking(user.id);
      return cleanup;
    }
  }, [user?.id, userProfile, startLocationTracking]);

  // ✅ Nearby users loading - FIXED: Gunakan userProfile sebagai condition
  const loadNearbyUsers = useCallback(async (currentUserId: string, userLocation: [number, number] | null) => {
    if (!userLocation || !userProfile) {
      console.log("❌ Cannot load nearby users: No location or userProfile not ready");
      return;
    }

    try {
      console.log("📍 Loading nearby users...");
      
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id, username, avatar_url, age, bio, interests, 
          location, is_online, last_online, latitude, longitude, gender,
          location_updated_at
        `)
        .neq("id", currentUserId)
        .eq("is_online", true)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .gte("location_updated_at", twoHoursAgo)
        .limit(25);

      if (error) {
        console.error("Supabase query error:", error);
        return;
      }

      console.log("📊 Raw users from database:", data?.length || 0);

      if (data && data.length > 0) {
        const usersWithDistance = data
          .map(user => ({
            ...user,
            avatar_url: user.avatar_url ? getStoragePublicUrl(user.avatar_url) : null,
            distance: calculateDistance(
              userLocation[0], userLocation[1],
              user.latitude!, user.longitude!
            )
          }))
          .filter(user => user.distance <= 50)
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 20);

        setNearbyUsers(usersWithDistance);
        console.log(`📍 Loaded ${usersWithDistance.length} nearby users`);
      } else {
        console.log("❌ No nearby users found");
        setNearbyUsers([]);
      }
    } catch (error) {
      console.error("Nearby users error:", error);
    }
  }, [userProfile]); // ✅ Dependency pada userProfile

  // ✅ Real-time updates
  useEffect(() => {
    if (!user?.id || !userProfile) return;

    let mounted = true;

    const subscription = supabase
      .channel(`online-status-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          if (mounted && location) {
            loadNearbyUsers(user.id, location);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [user?.id, userProfile, location, loadNearbyUsers]);

  // ✅ Helper functions
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const getCachedLocation = (): [number, number] | null => {
    try {
      const cached = localStorage.getItem("userLocation");
      const cacheTime = localStorage.getItem("userLocationTime");
      if (cached && cacheTime) {
        const isFresh = (Date.now() - parseInt(cacheTime)) < 60 * 60 * 1000;
        if (isFresh) return JSON.parse(cached);
      }
    } catch (error) {
      console.error('Error reading cached location:', error);
    }
    return null;
  };

  const cacheLocation = (coords: [number, number]) => {
    try {
      localStorage.setItem("userLocation", JSON.stringify(coords));
      localStorage.setItem("userLocationTime", Date.now().toString());
    } catch (error) {
      console.error('Error caching location:', error);
    }
  };

  // ✅ Manual login handler
  const handleManualLogin = async () => {
    setIsRedirecting(true);
    setAuthError(null);
    setLoadStep("Mengarahkan ke Google...");
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error("❌ Manual login failed:", error);
      if (error.message?.includes('popup')) {
        setAuthError("Popup login diblokir. Izinkan popup untuk website ini.");
      } else {
        setAuthError("Login gagal. Coba lagi.");
      }
      setIsRedirecting(false);
    }
  };

  // ✅ Logout handler
  const handleLogoutClick = () => {
    if (user?.id) handleLogout(user.id);
  };

  // ✅ Toggle sidebar handler
  const toggleSidebar = () => setShowSidebar(prev => !prev);

  // ... (rest of the component JSX remains the same)
  // ✅ Loading screen
  if (loading || isRedirecting) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center max-w-sm mx-auto px-6">
          <div className="relative mb-6">
            <div className="w-16 h-16 mx-auto bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <MapPin className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            {isRedirecting ? "Mengarahkan ke Login" : "Memuat Aplikasi"}
          </h2>
          <p className="text-gray-600 mb-4 text-sm">{loadStep}</p>
          <div className="flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        </div>
      </div>
    );
  }

  // ✅ Login screen
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-20 h-20 mx-auto bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-lg mb-4">
            <Wifi className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Jomblo Locator</h2>
          <p className="text-gray-600 mb-6">Temukan teman sekitar Anda</p>

          {authError && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
              {authError}
            </div>
          )}

          <button
            onClick={handleManualLogin}
            disabled={isRedirecting}
            className="px-8 py-3 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto w-full"
          >
            {isRedirecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Mengarahkan...
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4" />
                Login dengan Google
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ✅ Main application
  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 overflow-hidden">
      {/* HEADER */}
      <header className="flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm z-30">
        <div className="flex items-center gap-3">
          <button
            className={`bg-white p-2 rounded-xl shadow-md hover:bg-blue-50 transition-all duration-200 ${
              showSidebar ? "rotate-90 bg-blue-100" : "rotate-0"
            }`}
            onClick={toggleSidebar}
          >
            <Menu className="w-6 h-6 text-gray-700 transition-transform" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800 select-none">
            🗺️ Jomblo Locator
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {/* User info dengan avatar */}
          <div className="hidden md:flex items-center gap-2 text-gray-600">
            {currentUserAvatar ? (
              <img src={currentUserAvatar} alt="Avatar" className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <User className="w-4 h-4" />
            )}
            <span className="text-sm font-medium truncate max-w-32">
              {currentUsername || userEmail.split('@')[0]}
            </span>
          </div>

          {/* Online status */}
          <div className="hidden md:flex items-center gap-2 text-gray-500">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium">Online</span>
          </div>

          {/* Logout button */}
          <button
            onClick={handleLogoutClick}
            className="bg-white p-2 rounded-xl shadow-md hover:bg-red-50 transition-all duration-200"
          >
            <LogOut className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </header>

      {/* HORIZONTAL USER SCROLL */}
      <div className="w-full bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm z-20">
        <HorizontalUserScroll
          currentUserId={user.id}
          currentUserGender={currentUserGender}
        />
      </div>

      {/* MAIN CONTENT */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* SIDEBAR */}
        <div className={`
          fixed md:relative
          top-0 left-0 h-full
          transform transition-transform duration-300 
          ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0'}
          bg-white/95 backdrop-blur-md border-r border-gray-200
          shadow-xl md:shadow-none
          w-80 z-50
          pt-16
          overflow-y-auto
        `}>
          {showSidebar && (
            <SidebarUser
              userId={user.id}
              isOpen={showSidebar}
              onClose={() => setShowSidebar(false)}
            />
          )}
        </div>

        {/* MAP */}
        <div className={`
          flex-1 transition-all duration-300 relative z-10
          ${showSidebar ? 'md:ml-80' : 'ml-0'}
          w-full h-full
        `}>
          <Map
            currentUserId={user.id}
            currentUserGender={currentUserGender}
            currentUserAvatar={currentUserAvatar}
            userLocation={location}
            nearbyUsers={nearbyUsers}
          />
        </div>
      </div>

      {/* MOBILE OVERLAY */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}
    </div>
  );
};

export default App;
