import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "./lib/supabase";
import { Map } from "./components/Map";
import { SidebarUser } from "./components/SidebarUser";
import { HorizontalUserScroll } from "./components/UserList";
import { Loader2, MapPin, Wifi, Menu, LogOut, User } from "lucide-react";
import "./index.css";

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
};

// ✅ Fungsi login dengan Google
const signInWithGoogle = async () => {
  try {
    console.log("🔐 Starting Google OAuth...");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin
      }
    });
    
    if (error) {
      console.error("Login error:", error.message);
      throw error;
    }
    
    console.log("✅ Google OAuth initiated successfully");
    return data;
  } catch (error) {
    console.error("Google sign in failed:", error);
    throw error;
  }
};

// ✅ FIXED: Auto create profile dengan error handling yang better
const createUserProfile = async (userId: string, email: string): Promise<UserProfile> => {
  try {
    console.log("🆕 Creating new user profile for:", userId);
    
    const newProfile = {
      id: userId,
      username: email.split('@')[0],
      email: email,
      gender: "male",
      avatar_url: null,
      is_online: true,
      last_online: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      latitude: null,
      longitude: null,
      location_updated_at: new Date().toISOString()
    };

    console.log("📝 Profile data to insert:", newProfile);

    const { data, error } = await supabase
      .from("profiles")
      .insert(newProfile)
      .select("gender, avatar_url, latitude, longitude, is_online")
      .single();

    if (error) {
      console.error("❌ Error creating profile:", error);
      
      // Coba lagi tanpa field yang mungkin bermasalah
      const fallbackProfile = {
        id: userId,
        username: email.split('@')[0],
        gender: "male",
        is_online: true,
        last_online: new Date().toISOString()
      };

      const { data: fallbackData, error: fallbackError } = await supabase
        .from("profiles")
        .insert(fallbackProfile)
        .select("gender, avatar_url, latitude, longitude, is_online")
        .single();

      if (fallbackError) {
        console.error("❌ Fallback profile creation also failed:", fallbackError);
        throw fallbackError;
      }

      console.log("✅ Fallback profile created successfully");
      return fallbackData!;
    }

    console.log("✅ New profile created successfully");
    return data!;

  } catch (error) {
    console.error("❌ Create profile error:", error);
    // Return default profile sebagai fallback
    return {
      gender: "male",
      avatar_url: null,
      is_online: true
    };
  }
};

// ✅ FIXED: Cek dan ensure user profile dengan retry logic
const ensureUserProfile = async (userId: string, email: string): Promise<UserProfile> => {
  try {
    console.log("🔍 Checking if profile exists for:", userId);
    
    // Cek apakah profile sudah ada
    const { data: existingProfile, error } = await supabase
      .from("profiles")
      .select("gender, avatar_url, latitude, longitude, is_online")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error checking profile:", error);
    }

    console.log("📊 Existing profile check result:", existingProfile);

    // Jika profile sudah ada, return
    if (existingProfile) {
      console.log("✅ Profile already exists");
      return existingProfile;
    }

    // Jika belum ada, buat profile baru
    console.log("🆕 Profile not found, creating new one...");
    return await createUserProfile(userId, email);

  } catch (error) {
    console.error("❌ Ensure profile error:", error);
    return {
      gender: "male",
      avatar_url: null,
      is_online: true
    };
  }
};

// ✅ LOGOUT dengan delete data user
const handleLogout = async (userId: string) => {
  try {
    console.log("🚪 Logging out and cleaning up user data...");
    
    // 1. Update status online menjadi false
    await supabase
      .from("profiles")
      .update({
        is_online: false,
        last_online: new Date().toISOString()
      })
      .eq("id", userId);

    // 2. Sign out dari auth (ini akan trigger ON DELETE CASCADE di database)
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Sign out error:", error);
      throw error;
    }

    // 3. Clear local storage
    localStorage.removeItem("user");
    localStorage.removeItem("userLocation");
    localStorage.removeItem("userLocationTime");

    console.log("✅ Logout successful");
    
    // 4. Redirect ke halaman login
    window.location.reload();
    
  } catch (error) {
    console.error("Logout error:", error);
    // Force reload anyway
    window.location.reload();
  }
};

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentUserGender, setCurrentUserGender] = useState<"male" | "female">("male");
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadStep, setLoadStep] = useState<string>("Mengecek sesi...");
  const [showSidebar, setShowSidebar] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState<any[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [profileCreated, setProfileCreated] = useState(false);

  // ✅ FIXED: Auth state listener untuk handle login success
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`🔄 Auth state changed: ${event}`, session);
      
      if (event === 'SIGNED_IN' && session) {
        console.log("✅ User signed in, setting up profile...");
        
        const userData = { 
          id: session.user.id, 
          email: session.user.email! 
        };
        
        setUser(userData);
        setUserEmail(session.user.email!);
        localStorage.setItem("user", JSON.stringify(userData));

        setLoadStep("Membuat profil...");
        
        // Auto create profile dengan delay untuk memastikan session sudah ready
        setTimeout(async () => {
          try {
            const userProfile = await ensureUserProfile(session.user.id, session.user.email!);
            setCurrentUserGender(userProfile.gender || "male");
            setCurrentUserAvatar(userProfile.avatar_url || null);
            setProfileCreated(true);
            
            console.log("✅ Profile setup completed");
            
            // Set online status
            await updateOnlineStatus(session.user.id, true);
            
            setLoading(false);
            setIsRedirecting(false);
          } catch (error) {
            console.error("❌ Profile setup failed:", error);
            setLoading(false);
            setIsRedirecting(false);
          }
        }, 1000);
      }
      else if (event === 'SIGNED_OUT') {
        console.log("🚪 User signed out");
        setUser(null);
        setUserEmail("");
        localStorage.removeItem("user");
        setProfileCreated(false);
        setLoading(false);
      }
      else if (event === 'INITIAL_SESSION') {
        console.log("🔧 Initial session loaded");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ✅ Initialize app - cek session yang ada
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
          
          // Ensure profile exists
          const userProfile = await ensureUserProfile(session.user.id, session.user.email!);
          setCurrentUserGender(userProfile.gender || "male");
          setCurrentUserAvatar(userProfile.avatar_url || null);
          setProfileCreated(true);

          setLoadStep("Menyiapkan peta...");
          
          // Load initial nearby users
          const cachedLocation = getCachedLocation();
          if (cachedLocation) {
            setLocation(cachedLocation);
            loadNearbyUsers(session.user.id, cachedLocation);
          }

          await updateOnlineStatus(session.user.id, true);
          setLoading(false);
          
        } else {
          // Tidak ada session, tampilkan login screen
          console.log("🔐 No session found");
          setLoading(false);
        }
      } catch (error) {
        console.error("❌ Initialization error:", error);
        setLoading(false);
      }
    };

    init();
  }, []);

  // ✅ HYBRID: Smart location tracking dengan optimized updates
  const startLocationTracking = useCallback((userId: string) => {
    if (!profileCreated) {
      console.log("⏳ Waiting for profile to be created before starting location tracking...");
      return () => {};
    }

    console.log("🚀 Starting hybrid location tracking...");
    
    let lastServerUpdate = 0;
    let lastSavedLocation: [number, number] | null = null;
    let watchId: number;

    const updateLocationToServer = async (newLocation: [number, number], reason: string) => {
      try {
        await supabase
          .from("profiles")
          .update({ 
            latitude: newLocation[0], 
            longitude: newLocation[1],
            location_updated_at: new Date().toISOString(),
            last_online: new Date().toISOString()
          })
          .eq("id", userId);
        
        lastServerUpdate = Date.now();
        lastSavedLocation = newLocation;
        console.log(`📍 Location updated (${reason})`);
      } catch (error) {
        console.error("Location update failed:", error);
      }
    };

    const shouldUpdateToServer = (newLocation: [number, number]): boolean => {
      const now = Date.now();
      
      if (!lastSavedLocation) return true;
      
      const distance = calculateDistance(
        lastSavedLocation[0], lastSavedLocation[1],  
        newLocation[0], newLocation[1]
      );
      if (distance > 0.5) return true;
      
      if (now - lastServerUpdate > 15 * 60 * 1000) return true;
      
      return false;
    };

    // Start GPS tracking
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation: [number, number] = [
          position.coords.latitude,
          position.coords.longitude
        ];

        setLocation(newLocation);
        cacheLocation(newLocation);

        if (shouldUpdateToServer(newLocation)) {
          updateLocationToServer(newLocation, "movement/periodic");
        }
      },
      (error) => {
        console.error("Location tracking error:", error);
        getCityLevelLocation().then(fallbackLocation => {
          if (fallbackLocation) {
            setLocation(fallbackLocation);
            cacheLocation(fallbackLocation);
            updateLocationToServer(fallbackLocation, "fallback");
          }
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 30000
      }
    );

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [profileCreated]);

  // ✅ Start location tracking setelah profile dibuat
  useEffect(() => {
    if (user?.id && profileCreated) {
      const cleanup = startLocationTracking(user.id);
      return cleanup;
    }
  }, [user?.id, profileCreated, startLocationTracking]);

  // ✅ HYBRID: Optimized nearby users loading
  const loadNearbyUsers = useCallback(async (currentUserId: string, userLocation: [number, number] | null) => {
    if (!userLocation || !profileCreated) return;

    try {
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
        throw error;
      }

      if (data) {
        const usersWithDistance = data
          .map(user => ({
            ...user,
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
      }
    } catch (error) {
      console.error("Nearby users error:", error);
    }
  }, [profileCreated]);

  // ✅ Real-time updates untuk nearby users
  useEffect(() => {
    if (!user?.id || !profileCreated) return;

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
            console.log('🔄 Real-time update, refreshing nearby users...');
            loadNearbyUsers(user.id, location);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [user?.id, profileCreated, location, loadNearbyUsers]);

  // ✅ Auto update online status
  useEffect(() => {
    if (!user?.id || !profileCreated) return;

    let mounted = true;

    const interval = setInterval(() => {
      if (mounted) {
        updateOnlineStatus(user.id, true);
      }
    }, 2 * 60 * 1000);

    updateOnlineStatus(user.id, true);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [user?.id, profileCreated]);

  // ✅ HELPER FUNCTIONS
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
        if (isFresh) {
          return JSON.parse(cached);
        }
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

  const getCityLevelLocation = async (): Promise<[number, number]> => {
    try {
      const response = await fetch("https://ipapi.co/json/");
      const data = await response.json();
      if (data.latitude && data.longitude) {
        return [data.latitude, data.longitude];
      }
    } catch (error) {
      console.log("IPAPI failed, using fallback");
    }
    return getIndonesianCity();
  };

  const getIndonesianCity = (): [number, number] => {
    const cities: [number, number][] = [
      [-6.2088, 106.8456], [-6.9175, 107.6191], [-7.2504, 112.7688],
      [-6.5942, 106.7890], [-6.9667, 110.4167], [-0.7893, 113.9213],
      [-2.5489, 118.0149], [-5.1477, 119.4327], [1.4748, 124.8426],
    ];
    return cities[Math.floor(Math.random() * cities.length)];
  };

  const updateOnlineStatus = async (userId: string, isOnline: boolean) => {
    if (!profileCreated) return;
    
    try {
      await supabase
        .from("profiles")
        .update({
          is_online: isOnline,
          last_online: new Date().toISOString()
        })
        .eq("id", userId);
    } catch (error) {
      console.error("Error updating online status:", error);
    }
  };

  // ✅ Manual login handler
  const handleManualLogin = async () => {
    setIsRedirecting(true);
    setLoadStep("Mengarahkan ke Google...");
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Manual login failed:", error);
      setIsRedirecting(false);
    }
  };

  // ✅ Logout handler
  const handleLogoutClick = () => {
    if (user?.id) {
      handleLogout(user.id);
    }
  };

  // ✅ Loading screen
  if (loading || isRedirecting) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center max-w-sm mx-auto px-6">
          <div className="relative mb-6">
            <div className="w-16 h-16 mx-auto bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <MapPin className="w-8 h-8 text-white" />
            </div>
            <div className="absolute -inset-3 bg-blue-500/20 rounded-2xl blur-xl animate-pulse"></div>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            {isRedirecting ? "Mengarahkan ke Login" : "Memuat Aplikasi"}
          </h2>
          <p className="text-gray-600 mb-4 text-sm">{loadStep}</p>
          <div className="flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
          {isRedirecting && (
            <p className="text-sm text-gray-500 mt-4">
              Sedang mengarahkan ke halaman login Google...
            </p>
          )}
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
      <header className="flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm z-50">
        <div className="flex items-center gap-3">
          <button
            className={`bg-white p-2 rounded-xl shadow-md hover:bg-blue-50 transition-all duration-200 ${
              showSidebar ? "rotate-90 bg-blue-100" : "rotate-0"
            }`}
            onClick={() => setShowSidebar((prev) => !prev)}
            aria-label={showSidebar ? "Tutup menu" : "Buka menu"}
          >
            <Menu className="w-6 h-6 text-gray-700 transition-transform" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800 select-none">
            🗺️ Jomblo Locator
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {/* User info */}
          <div className="hidden md:flex items-center gap-2 text-gray-600">
            <User className="w-4 h-4" />
            <span className="text-sm font-medium truncate max-w-32">
              {userEmail.split('@')[0]}
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
            aria-label="Logout"
            title="Logout"
          >
            <LogOut className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </header>

      {/* HORIZONTAL USER SCROLL */}
      <div className="w-full bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm z-30">
        <HorizontalUserScroll
          currentUserId={user.id}
          currentUserGender={currentUserGender}
        />
      </div>

      {/* MAIN CONTENT - FIXED LAYOUT */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* SIDEBAR - FIXED: Pastikan sidebar di atas peta */}
        <div className={`
          fixed md:relative
          top-0 left-0 h-full
          transform transition-transform duration-300 z-40
          ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0'}
          bg-white/90 backdrop-blur-md border-r border-gray-200
          shadow-lg md:shadow-none
        `}>
          {showSidebar && (
            <SidebarUser
              userId={user.id}
              isOpen={showSidebar}
              onClose={() => setShowSidebar(false)}
            />
          )}
        </div>

        {/* MAP - FIXED: Adjust width berdasarkan sidebar state */}
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

      {/* MOBILE OVERLAY - FIXED: Tutup sidebar ketika klik overlay */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}
    </div>
  );
};

export default App;
