import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "./lib/supabase";
import  Map  from "./components/Map";
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
  age?: number | null;
  bio?: string | null;
  interests?: string[] | null;
  location?: string | null;
  last_online?: string | null;
  public_key?: string | null;
};

// ✅ Fungsi untuk mendapatkan URL avatar dari Supabase Storage
const getAvatarUrl = (avatarUrl: string | null | undefined): string | null => {
  if (!avatarUrl) return null;
  
  try {
    if (avatarUrl.startsWith('http')) {
      return avatarUrl;
    }
    
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(avatarUrl);
    
    return data.publicUrl;
  } catch (error) {
    console.error('Error getting avatar URL:', error);
    return null;
  }
};

// ✅ Fungsi login dengan Google
const signInWithGoogle = async () => {
  try {
    console.log("🔐 Starting Google OAuth...");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("❌ Google sign in failed:", error);
    throw error;
  }
};

// ✅ EMERGENCY FIX: Gunakan raw fetch untuk menghindari Supabase client bug
const createUserProfile = async (userId: string, email: string): Promise<UserProfile> => {
  try {
    console.log("🆕 EMERGENCY FIX: Creating profile for:", userId);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No session");
    
    if (session.user.id !== userId) {
      console.log("🔄 Using session ID:", session.user.id);
      userId = session.user.id;
    }
    
    const profileData = {
      id: userId,
      username: email.split('@')[0] || `user_${userId.slice(0, 8)}`,
      gender: "male",
      avatar_url: null,
      is_online: true,
      last_online: new Date().toISOString(),
      created_at: new Date().toISOString(),
      latitude: null,
      longitude: null,
      location_updated_at: new Date().toISOString(),
      age: null,
      bio: null,
      interests: null,
      location: null,
      public_key: null
    };

    console.log("📝 Profile data:", profileData);

    // ✅ FIX: Gunakan fetch langsung ke Supabase REST API
    const response = await fetch(`https://rjjdzjrxbemhfoyjnfjs.supabase.co/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': `${process.env.REACT_APP_SUPABASE_ANON_KEY}`, // Ganti dengan anon key Anda
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(profileData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Fetch INSERT error:", errorData);
      
      if (errorData.code === '23505') {
        console.log("🔄 Profile exists, fetching...");
        // Jika profile sudah ada, fetch data yang existing
        const fetchResponse = await fetch(`https://rjjdzjrxbemhfoyjnfjs.supabase.co/rest/v1/profiles?id=eq.${userId}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': `${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          }
        });
        
        if (fetchResponse.ok) {
          const existingData = await fetchResponse.json();
          if (existingData && existingData.length > 0) {
            console.log("✅ Using existing profile");
            return existingData[0];
          }
        }
      }
      
      throw new Error(`Insert failed: ${errorData.message}`);
    }

    const result = await response.json();
    console.log("✅ Profile created via fetch:", result[0]);
    return result[0];

  } catch (error) {
    console.error("❌ Create profile error:", error);
    
    // Fallback: coba dengan Supabase client tanpa select
    try {
      console.log("🔄 Fallback: Trying with minimal data...");
      const { data, error: fallbackError } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          username: email.split('@')[0],
          gender: "male",
          is_online: true
        });
      
      if (fallbackError) throw fallbackError;
      
      // Manual fetch untuk get data
      const { data: { session } } = await supabase.auth.getSession();
      const fetchResponse = await fetch(`https://rjjdzjrxbemhfoyjnfjs.supabase.co/rest/v1/profiles?id=eq.${userId}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': `${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
        }
      });
      
      if (fetchResponse.ok) {
        const result = await fetchResponse.json();
        return result[0];
      }
      
    } catch (fallbackError) {
      console.error("❌ Fallback also failed:", fallbackError);
    }
    
    return {
      gender: "male",
      avatar_url: null,
      is_online: true,
      latitude: null,
      longitude: null
    };
  }
};

// ✅ FIXED: ensureUserProfile dengan fetch approach
const ensureUserProfile = async (userId: string, email: string): Promise<UserProfile> => {
  try {
    console.log("🔍 Checking profile for:", userId);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No session");
    
    if (session.user.id !== userId) {
      userId = session.user.id;
    }

    // ✅ FIX: Gunakan fetch untuk check existing profile
    const response = await fetch(`https://rjjdzjrxbemhfoyjnfjs.supabase.co/rest/v1/profiles?id=eq.${userId}`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': `${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
      }
    });

    if (response.ok) {
      const existingData = await response.json();
      if (existingData && existingData.length > 0) {
        console.log("✅ Profile exists:", existingData[0]);
        return existingData[0];
      }
    }

    console.log("🆕 Profile not found, creating...");
    return await createUserProfile(userId, email);

  } catch (error) {
    console.error("❌ Ensure profile error:", error);
    
    // Fallback dengan Supabase client
    try {
      const { data: existingProfile, error: queryError } = await supabase
        .from("profiles")
        .select('*')
        .eq("id", userId)
        .maybeSingle();

      if (!queryError && existingProfile) {
        return existingProfile;
      }

      return await createUserProfile(userId, email);
    } catch (fallbackError) {
      console.error("❌ Fallback failed:", fallbackError);
      return {
        gender: "male",
        avatar_url: null,
        is_online: true,
        latitude: null,
        longitude: null
      };
    }
  }
};

// ✅ LOGOUT dengan delete data user
const handleLogout = async (userId: string) => {
  try {
    console.log("🚪 Logging out...");
    
    await supabase
      .from("profiles")
      .update({
        is_online: false,
        last_online: new Date().toISOString()
      })
      .eq("id", userId);

    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    localStorage.removeItem("user");
    localStorage.removeItem("userLocation");
    localStorage.removeItem("userLocationTime");

    console.log("✅ Logout successful");
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
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadStep, setLoadStep] = useState<string>("Mengecek sesi...");
  const [showSidebar, setShowSidebar] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState<any[]>([]);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [profileCreated, setProfileCreated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          let retryCount = 0;
          const maxRetries = 3;
          
          const createProfileWithRetry = async () => {
            try {
              const userProfile = await ensureUserProfile(session.user.id, session.user.email!);
              setCurrentUserGender(userProfile.gender || "male");
              setCurrentUserAvatar(getAvatarUrl(userProfile.avatar_url));
              setProfileCreated(true);
              
              console.log("✅ Profile setup completed");
              await updateOnlineStatus(session.user.id, true);
              setLoading(false);
              setIsRedirecting(false);
            } catch (error) {
              console.error(`❌ Profile setup failed (${retryCount + 1}/${maxRetries}):`, error);
              
              if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(createProfileWithRetry, 1000 * retryCount);
              } else {
                setAuthError("Gagal membuat profil. Silakan coba lagi.");
                setLoading(false);
                setIsRedirecting(false);
              }
            }
          };
          
          createProfileWithRetry();
        }
        else if (event === 'SIGNED_OUT') {
          console.log("🚪 User signed out");
          setUser(null);
          setUserEmail("");
          setAuthError(null);
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
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const userProfile = await ensureUserProfile(session.user.id, session.user.email!);
          setCurrentUserGender(userProfile.gender || "male");
          setCurrentUserAvatar(getAvatarUrl(userProfile.avatar_url));
          setProfileCreated(true);

          setLoadStep("Menyiapkan peta...");
          
          const cachedLocation = getCachedLocation();
          if (cachedLocation) {
            setLocation(cachedLocation);
            loadNearbyUsers(session.user.id, cachedLocation);
          }

          await updateOnlineStatus(session.user.id, true);
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

  // ✅ HYBRID: Smart location tracking
  const startLocationTracking = useCallback((userId: string) => {
    if (!profileCreated) {
      console.log("⏳ Waiting for profile creation...");
      return () => {};
    }

    console.log("🚀 Starting location tracking...");
    
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
      } catch (error) {
        console.error("Location update failed:", error);
      }
    };

    const shouldUpdateToServer = (newLocation: [number, number]): boolean => {
      if (!lastSavedLocation) return true;
      
      const distance = calculateDistance(
        lastSavedLocation[0], lastSavedLocation[1],  
        newLocation[0], newLocation[1]
      );
      if (distance > 0.5) return true;
      
      if (Date.now() - lastServerUpdate > 15 * 60 * 1000) return true;
      
      return false;
    };

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
        console.error("Location error:", error);
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
      if (watchId) navigator.geolocation.clearWatch(watchId);
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
          location_updated_at, public_key
        `)
        .neq("id", currentUserId)
        .eq("is_online", true)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .gte("location_updated_at", twoHoursAgo)
        .limit(25);

      if (error) throw error;

      if (data) {
        const usersWithDistance = data
          .map(user => ({
            ...user,
            avatar_url: getAvatarUrl(user.avatar_url),
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
    setAuthError(null);
    setLoadStep("Mengarahkan ke Google...");
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error("❌ Manual login failed:", error);
      
      if (error.message?.includes('popup')) {
        setAuthError("Popup login diblokir. Izinkan popup untuk website ini.");
      } else if (error.message?.includes('configuration')) {
        setAuthError("Error konfigurasi Google OAuth. Hubungi administrator.");
      } else {
        setAuthError("Login gagal. Coba lagi atau hubungi administrator.");
      }
      
      setIsRedirecting(false);
    }
  };

  // ✅ Logout handler
  const handleLogoutClick = () => {
    if (user?.id) {
      handleLogout(user.id);
    }
  };

  // ✅ Toggle sidebar handler
  const toggleSidebar = () => {
    setShowSidebar(prev => !prev);
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

          <p className="text-sm text-gray-500 mt-4">
            Jika ada masalah, pastikan popup diizinkan dan coba refresh halaman
          </p>
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
            aria-label={showSidebar ? "Tutup menu" : "Buka menu"}
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
              <img 
                src={currentUserAvatar} 
                alt="Avatar" 
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <User className="w-4 h-4" />
            )}
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
      <div className="w-full bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm z-20">
        <HorizontalUserScroll
          currentUserId={user.id}
          currentUserGender={currentUserGender}
        />
      </div>

      {/* MAIN CONTENT - FIXED: Sidebar tidak terhalang header */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* SIDEBAR - FIXED: Padding top untuk header dan overflow */}
        <div className={`
          fixed md:relative
          top-0 left-0 h-full
          transform transition-transform duration-300 
          ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0'}
          bg-white/95 backdrop-blur-md border-r border-gray-200
          shadow-xl md:shadow-none
          w-80 z-50
          pt-16 /* FIXED: Padding top untuk header */
          overflow-y-auto /* FIXED: Biar bisa scroll */
        `}>
          {showSidebar && (
            <SidebarUser
              userId={user.id}
              isOpen={showSidebar}
              onClose={() => setShowSidebar(false)}
            />
          )}
        </div>

        {/* MAP dengan nearby users yang sudah include avatar URLs */}
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
