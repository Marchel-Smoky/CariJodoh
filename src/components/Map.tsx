import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconPath from "../asset/noprofile.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const defaultIcon = iconPath;

type UserMarker = {
  id: string;
  username: string;
  avatar_url?: string | null;
  age?: number | null;
  bio?: string | null;
  interests?: string[] | null;
  location?: string | null;
  is_online?: boolean | null;
  last_online?: string | null;
  latitude: number;
  longitude: number;
  gender: "male" | "female";
};

interface MapProps {
  userLocation: [number, number] | null;
  currentUserAvatar?: string | null; // ✅ Pastikan prop ini ada
  nearbyUsers?: UserMarker[];
  currentUserId: string;
  currentUserGender: string;
}

export const Map: React.FC<MapProps> = ({
  userLocation,
  currentUserAvatar, // ✅ Terima prop ini
  nearbyUsers = [],
  currentUserGender,
}) => {
  const [map, setMap] = useState<L.Map | null>(null);

  // Custom icon untuk current user - GUNAKAN currentUserAvatar
  const createCurrentUserIcon = () =>
    L.divIcon({
      html: `
        <div class="relative animate-pulse">
          <img 
            src="${currentUserAvatar || defaultIcon}" 
            class="w-12 h-12 rounded-full border-4 ${
              currentUserGender === "male" ? "border-blue-500" : "border-pink-500"
            } shadow-lg object-cover"
            onerror="this.src='${defaultIcon}'"
          />
          <div class="absolute -bottom-1 -right-1 w-4 h-4 ${
            currentUserGender === "male" ? "bg-blue-500" : "bg-pink-500"
          } border-2 border-white rounded-full animate-ping"></div>
          <div class="absolute -bottom-1 -right-1 w-4 h-4 ${
            currentUserGender === "male" ? "bg-blue-600" : "bg-pink-600"
          } border-2 border-white rounded-full"></div>
        </div>
      `,
      className: "custom-current-marker",
      iconSize: [48, 48],
      iconAnchor: [24, 48],
    });

  // Custom icon untuk user lain - GUNAKAN avatar_url dari nearbyUsers
  const createUserIcon = (avatar_url: string | null, gender: "male" | "female", isOnline: boolean = false) =>
    L.divIcon({
      html: `
        <div class="relative transform hover:scale-110 transition-transform duration-200">
          <img 
            src="${avatar_url || defaultIcon}" 
            class="w-10 h-10 rounded-full border-2 ${
              gender === "male" ? "border-blue-400" : "border-pink-400"
            } shadow-lg object-cover"
            onerror="this.src='${defaultIcon}'"
          />
          ${
            isOnline
              ? `<div class="absolute -bottom-1 -right-1 w-3 h-3 ${
                  gender === "male" ? "bg-green-500" : "bg-green-400"
                } border-2 border-white rounded-full animate-pulse"></div>`
              : '<div class="absolute -bottom-1 -right-1 w-3 h-3 bg-gray-400 border-2 border-white rounded-full"></div>'
          }
        </div>
      `,
      className: "custom-user-marker",
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    });

  // Format last online time
  const formatLastOnline = (lastOnline: string | null) => {
    if (!lastOnline) return "Tidak diketahui";
    
    const lastOnlineDate = new Date(lastOnline);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - lastOnlineDate.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Baru saja";
    if (diffInMinutes < 60) return `${diffInMinutes} menit lalu`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} jam lalu`;
    return `${Math.floor(diffInMinutes / 1440)} hari lalu`;
  };

  // Update posisi map saat lokasi user berubah
  useEffect(() => {
    if (map && userLocation) {
      map.setView(userLocation, 13, { animate: true, duration: 1 });
    }
  }, [map, userLocation]);

  if (!userLocation) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-2xl">🗺️</span>
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">Memuat Peta</h3>
          <p className="text-gray-500">Menyiapkan lokasi Anda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={userLocation}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        ref={setMap}
        scrollWheelZoom={true}
        zoomControl={true}
        className="rounded-lg"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {/* Marker user sendiri - GUNAKAN currentUserAvatar */}
        <Marker position={userLocation} icon={createCurrentUserIcon()} zIndexOffset={1000}>
          <Popup>
            <div className="text-center min-w-[200px]">
              <img
                src={currentUserAvatar || defaultIcon}
                onError={(e) => {
                  e.currentTarget.src = defaultIcon;
                  e.currentTarget.onerror = null;
                }}
                className="w-16 h-16 rounded-full mx-auto mb-2 border-2 border-gray-200 object-cover"
                alt="Anda"
              />
              <div className="font-bold text-blue-600 text-lg">📍 Lokasi Anda</div>
              <div className="text-sm text-gray-600 mt-2">
                {userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}
              </div>
              <div className="mt-2 text-xs text-gray-500 bg-blue-50 px-2 py-1 rounded">
                Anda sedang online
              </div>
            </div>
          </Popup>
        </Marker>

        {/* Marker user lain - GUNAKAN avatar_url dari nearbyUsers */}
        {nearbyUsers.map((user) => (
          <Marker
            key={user.id}
            position={[user.latitude, user.longitude]}
            icon={createUserIcon(user.avatar_url || null, user.gender, user.is_online || false)}
          >
            <Popup>
              <div className="min-w-[280px] text-center">
                <img
                  src={user.avatar_url || defaultIcon}
                  onError={(e) => {
                    e.currentTarget.src = defaultIcon;
                    e.currentTarget.onerror = null;
                  }}
                  className="w-20 h-20 rounded-full mx-auto mb-3 border-2 border-gray-200 object-cover"
                  alt={user.username}
                />
                
                <div className="flex items-center justify-center gap-2 mb-2">
                  <h3 className="font-bold text-gray-800 text-lg">{user.username}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    user.gender === "male" 
                      ? "bg-blue-100 text-blue-800" 
                      : "bg-pink-100 text-pink-800"
                  }`}>
                    {user.gender === "male" ? "♂ Laki-laki" : "♀ Perempuan"}
                  </span>
                </div>

                {user.age && (
                  <div className="text-sm text-gray-600 mb-2">
                    <span className="font-medium">Usia:</span> {user.age} tahun
                  </div>
                )}

                {user.bio && (
                  <p className="text-sm text-gray-600 mt-2 mb-3 line-clamp-3 bg-gray-50 p-2 rounded">
                    {user.bio}
                  </p>
                )}

                {user.interests && user.interests.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-xs font-semibold text-gray-500 mb-1">MINAT:</h4>
                    <div className="flex flex-wrap gap-1 justify-center">
                      {user.interests.slice(0, 3).map((interest, index) => (
                        <span 
                          key={index}
                          className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full"
                        >
                          {interest}
                        </span>
                      ))}
                      {user.interests.length > 3 && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                          +{user.interests.length - 3} lagi
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center text-xs text-gray-500 border-t pt-2">
                  <div className={`flex items-center gap-1 ${
                    user.is_online ? "text-green-600" : "text-gray-400"
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      user.is_online ? "bg-green-500 animate-pulse" : "bg-gray-400"
                    }`}></div>
                    {user.is_online ? "Online" : "Offline"}
                  </div>
                  
                  {!user.is_online && user.last_online && (
                    <div className="text-gray-400">
                      {formatLastOnline(user.last_online)}
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <style>{`
        .custom-current-marker, .custom-user-marker {
          background: none !important;
          border: none !important;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }
        .leaflet-popup-content {
          margin: 16px;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
};