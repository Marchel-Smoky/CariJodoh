import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "./lib/supabase";
import { Map } from "./components/Map";
import { SidebarUser } from "./components/SidebarUser";
import { HorizontalUserScroll } from "./components/UserList";
import { Loader2, MapPin, Wifi, Menu } from "lucide-react";
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

  // ✅ HYBRID: Smart location tracking dengan optimized updates
  const startLocationTracking = useCallback((userId: string) => {
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
  
  // 1. First time update
      if (!lastSavedLocation) return true;
      
      // 2. Significant movement (> 500 meters)
      const distance = calculateDistance(
        lastSavedLocation[0],  // lat1
        lastSavedLocation[1],  // lon1  
        newLocation[0],        // lat2
        newLocation[1]         // lon2
      );
      if (distance > 0.5) return true;
      
      // 3. Periodic update (every 15 minutes)
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

        // ✅ Always update UI immediately (client-side)
        setLocation(newLocation);
        cacheLocation(newLocation);

        // ✅ Smart server update (hybrid approach)
        if (shouldUpdateToServer(newLocation)) {
          updateLocationToServer(newLocation, "movement/periodic");
        }
      },
      (error) => {
        console.error("Location tracking error:", error);
        // Fallback to IP-based location
        getCityLevelLocation().then(fallbackLocation => {
          if (fallbackLocation) {
            setLocation(fallbackLocation);
            cacheLocation(fallbackLocation);
            updateLocationToServer(fallbackLocation, "fallback");
          }
        });
      },
      {
        enableHighAccuracy: false, // Balance accuracy vs battery
        timeout: 10000,
        maximumAge: 30000 // 30 second cache
      }
    );

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  // ✅ HYBRID: Optimized nearby users loading dengan real-time updates
  // ✅ Load nearby users - FIXED URL encoding
const loadNearbyUsers = useCallback(async (currentUserId: string, userLocation: [number, number] | null) => {
  if (!userLocation) return;

  try {
    // ✅ FIX: Calculate timestamp properly tanpa URL encoding issues
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    
    // ✅ FIX: Gunakan query builder Supabase dengan benar
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
      .gte("location_updated_at", twoHoursAgo) // ✅ Fixed timestamp format
      .limit(25);

    if (error) {
      console.error("Supabase query error:", error);
      throw error;
    }

    if (data) {
      // ✅ Client-side filtering untuk akurasi
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
    
    // Fallback: load without location_updated_at filter
    try {
      console.log("🔄 Trying fallback query without location timestamp...");
      const { data } = await supabase
        .from("profiles")
        .select(`
          id, username, avatar_url, age, bio, interests, 
          location, is_online, last_online, latitude, longitude, gender
        `)
        .neq("id", currentUserId)
        .eq("is_online", true)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .limit(20);

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
          .sort((a, b) => a.distance - b.distance);

        setNearbyUsers(usersWithDistance);
        console.log(`📍 Fallback loaded ${usersWithDistance.length} users`);
      }
    } catch (fallbackError) {
      console.error("Fallback query also failed:", fallbackError);
    }
  }
}, []);

  // ✅ HYBRID: Real-time status updates only (ringan)
  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;

    const subscription = supabase
      .channel(`online-status-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: 'is_online=eq.true' // Hanya track online users
        },
        (payload) => {
          if (mounted) {
            console.log('🔄 Real-time status update, refreshing nearby users...');
            setRefreshTrigger(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [user?.id]);

  // ✅ Cek sesi & muat data awal
  useEffect(() => {
    const init = async () => {
      try {
        setLoadStep("Memuat aplikasi...");
        
        // Cek cached user untuk instant load
        const cachedUser = localStorage.getItem("user");
        if (cachedUser) {
          const userData = JSON.parse(cachedUser);
          setUser(userData);
        }

        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const userData = { 
            id: session.user.id, 
            email: session.user.email! 
          };
          setUser(userData);
          localStorage.setItem("user", JSON.stringify(userData));

          setLoadStep("Menyiapkan peta...");
          await loadUserProfile(session.user.id);
          
          // ✅ HYBRID: Start optimized location tracking
          const cleanupLocationTracking = startLocationTracking(session.user.id);
          
          // Load initial nearby users
          const cachedLocation = getCachedLocation();
          if (cachedLocation) {
            setLocation(cachedLocation);
            loadNearbyUsers(session.user.id, cachedLocation);
            setLoading(false); // Instant UI
          }

          await updateOnlineStatus(session.user.id, true);
          
          return cleanupLocationTracking;
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Initialization error:", error);
        setLoading(false);
      }
    };

    const cleanupPromise = init();

    return () => {
      cleanupPromise.then(cleanup => {
        if (cleanup) cleanup();
      });
    };
  }, [startLocationTracking, loadNearbyUsers]);

  // ✅ Refresh nearby users ketika ada real-time update
  useEffect(() => {
    if (refreshTrigger > 0 && user?.id && location) {
      console.log('🔄 Refreshing nearby users due to real-time update');
      loadNearbyUsers(user.id, location);
    }
  }, [refreshTrigger, user?.id, location, loadNearbyUsers]);

  // ✅ Auto update online status (optimized - setiap 2 menit)
  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;

    const interval = setInterval(() => {
      if (mounted) {
        updateOnlineStatus(user.id, true);
      }
    }, 2 * 60 * 1000); // Setiap 2 menit

    // Initial update
    updateOnlineStatus(user.id, true);

    return () => {
      mounted = false;
      clearInterval(interval);
      if (user.id) {
        updateOnlineStatus(user.id, false);
      }
    };
  }, [user?.id]);

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
        const isFresh = (Date.now() - parseInt(cacheTime)) < 60 * 60 * 1000; // 1 hour
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
      [-6.2088, 106.8456], // Jakarta
      [-6.9175, 107.6191], // Bandung
      [-7.2504, 112.7688], // Surabaya
      [-6.5942, 106.7890], // Bogor
      [-6.9667, 110.4167], // Semarang
      [-0.7893, 113.9213], // Pontianak
      [-2.5489, 118.0149], // Balikpapan
      [-5.1477, 119.4327], // Makassar
      [1.4748, 124.8426], // Manado 
    ];
    return cities[Math.floor(Math.random() * cities.length)];
  };

  const updateUserLocation = async (userId: string, coords: [number, number], reason: string) => {
    try {
      await supabase
        .from("profiles")
        .update({ 
          latitude: coords[0], 
          longitude: coords[1],
          location_updated_at: new Date().toISOString(),
          last_online: new Date().toISOString()
        })
        .eq("id", userId);
      console.log(`📍 Location updated (${reason})`);
    } catch (error) {
      console.error("Error updating location:", error);
    }
  };

  // ✅ Load user profile
  const loadUserProfile = async (userId: string): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("gender, avatar_url, latitude, longitude, is_online")
        .eq("id", userId)
        .single();

      if (error) throw error;

      if (data) {
        setCurrentUserGender(data?.gender || "male");
        setCurrentUserAvatar(data?.avatar_url || null);
      }
    } catch (error) {
      console.error("Profile load error:", error);
    }
  };

  // ✅ Update status online
  const updateOnlineStatus = async (userId: string, isOnline: boolean) => {
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

  // ✅ Loading screen
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center max-w-sm mx-auto px-6">
          <div className="relative mb-6">
            <div className="w-16 h-16 mx-auto bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <MapPin className="w-8 h-8 text-white" />
            </div>
            <div className="absolute -inset-3 bg-blue-500/20 rounded-2xl blur-xl animate-pulse"></div>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Memuat Peta</h2>
          <p className="text-gray-600 mb-4 text-sm">{loadStep}</p>
          <div className="flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        </div>
      </div>
    );
  }

  // ✅ Jika belum login
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-20 h-20 mx-auto bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-lg mb-4">
            <Wifi className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Akses Dibatasi</h2>
          <p className="text-gray-600 mb-2">Silakan login terlebih dahulu</p>
        </div>
      </div>
    );
  }

  // ✅ Tampilan utama
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

        <div className="hidden md:flex items-center gap-3 text-gray-500">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium">Online</span>
        </div>
      </header>

      {/* HORIZONTAL USER SCROLL */}
      <div className="w-full bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm z-30">
        <HorizontalUserScroll
          currentUserId={user.id}
          currentUserGender={currentUserGender}
        />
      </div>

      {/* KONTEN UTAMA */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* SIDEBAR */}
        {showSidebar && (
          <SidebarUser
            userId={user.id}
            isOpen={showSidebar}
            onClose={() => setShowSidebar(false)}
          />
        )}

        {/* PETA */}
        <div className={`transition-all duration-300 ${
          showSidebar ? "md:ml-0" : "ml-0"
        } flex-1 relative`}>
          <Map
            currentUserId={user.id}
            currentUserGender={currentUserGender}
            currentUserAvatar={currentUserAvatar}
            userLocation={location}
            nearbyUsers={nearbyUsers}
          />
        </div>
      </div>

      {/* OVERLAY MOBILE */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-20 md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}
    </div>
  );
};

export default App;