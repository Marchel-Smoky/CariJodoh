import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Camera, Loader2, MapPin, Save } from "lucide-react";
import iconPath from "../asset/noprofile.png";

const defaultIcon = new URL(iconPath, import.meta.url).href;

export const Profile: React.FC<{ userId: string }> = ({ userId }) => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    username: "",
    avatar_url: "",
    age: "",
    bio: "",
    interests: "",
    location: "",
    gender: "male",
    latitude: "",
    longitude: "",
  });

  // ======================
  // 🔹 LOAD PROFILE
  // ======================
  useEffect(() => {
    if (!userId) return;

    const loadProfile = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();
        if (error) throw error;

        if (data) {
          setForm({
            username: data.username ?? "",
            avatar_url: data.avatar_url ?? "",
            age: data.age ? String(data.age) : "",
            bio: data.bio ?? "",
            interests:
              data.interests && Array.isArray(data.interests)
                ? data.interests.join(", ")
                : "",
            location: data.location ?? "",
            gender: data.gender ?? "male",
            latitude: data.latitude ? String(data.latitude) : "",
            longitude: data.longitude ? String(data.longitude) : "",
          });
        }
      } catch (err) {
        console.error(err);
        setMessage("⚠️ Gagal memuat profil.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [userId]);

  // ======================
  // 🔹 CLEANUP PREVIEW URL
  // ======================
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // ======================
  // 🔹 UPLOAD AVATAR
  // ======================
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return setMessage("❌ File atau user tidak valid");
    if (!file.type.startsWith("image/"))
      return setMessage("❌ File harus berupa gambar");

    setPreview(URL.createObjectURL(file));
    setUploading(true);
    setMessage(null);

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${userId}/${Date.now()}.${fileExt}`;

      // Upload ke Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      // 🔥 Ambil public URL (tanpa token expired)
      const { data: publicData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const avatarUrl = publicData.publicUrl;

      // Update ke tabel profiles
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", userId);
      if (updateError) throw updateError;

      // Update state
      setForm((f) => ({ ...f, avatar_url: avatarUrl }));
      setPreview(null);
      setMessage("✅ Foto profil berhasil diperbarui!");
    } catch (err) {
      console.error(err);
      setMessage("❌ Gagal upload foto.");
    } finally {
      setUploading(false);
    }
  };

  // ======================
  // 🔹 GET CURRENT LOCATION
  // ======================
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage("❌ Browser tidak mendukung geolokasi. Masukkan manual.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setForm((prev) => ({
          ...prev,
          latitude: latitude.toString(),
          longitude: longitude.toString(),
        }));
      },
      (err) => {
        console.error(err);
        setMessage("❌ Gagal mendapatkan lokasi.");
      }
    );
  };

  // ======================
  // 🔹 SAVE PROFILE
  // ======================
  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!form.username) {
      setMessage("⚠️ Nama tidak boleh kosong.");
      setLoading(false);
      return;
    }

    try {
      const updates = {
        username: form.username || null,
        avatar_url: form.avatar_url || null,
        bio: form.bio || null,
        age: form.age ? Number(form.age) : null,
        gender: form.gender || null,
        interests: form.interests
          ? form.interests.split(",").map((s) => s.trim())
          : [],
        location: form.location || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        last_online: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);
      if (error) throw error;

      setMessage("✅ Profil berhasil diperbarui!");
    } catch (err) {
      console.error(err);
      setMessage("❌ Gagal memperbarui profil.");
    } finally {
      setLoading(false);
    }
  };

  // ======================
  // 🔹 RENDER UI
  // ======================
  return (
    <div className="max-w-md mx-auto p-6 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-gray-100">
      <h2 className="text-2xl font-bold mb-4 text-center text-gray-700">
        ✏️ Edit Profil
      </h2>

      {/* Avatar */}
      <div className="flex flex-col items-center mb-6">
        <div className="relative group">
          <img
            src={preview || form.avatar_url || defaultIcon}
            onError={(e) => (e.currentTarget.src = defaultIcon)}
            alt="Avatar"
            className="w-28 h-28 rounded-full object-cover shadow-lg border-2 border-gray-300"
          />
          <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 transition">
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
            <input
              type="file"
              className="hidden"
              onChange={handleUpload}
              accept="image/*"
            />
          </label>
        </div>
        {preview && (
          <p className="text-xs text-gray-500 mt-1">
            📸 Pratinjau sebelum disimpan
          </p>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="space-y-4">
        <Input
          label="Nama"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
        <Input
          label="Umur"
          type="number"
          value={form.age}
          onChange={(e) => setForm({ ...form, age: e.target.value })}
        />
        <Textarea
          label="Bio"
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
        />
        <Input
          label="Minat (pisah koma)"
          value={form.interests}
          onChange={(e) => setForm({ ...form, interests: e.target.value })}
        />
        <Input
          label="Lokasi"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
        />

        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Jenis Kelamin
          </label>
          <select
            className="w-full px-3 py-2 border rounded-lg focus:ring focus:ring-blue-200"
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
          >
            <option value="male">Laki-laki</option>
            <option value="female">Perempuan</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Latitude"
            value={form.latitude}
            onChange={(e) => setForm({ ...form, latitude: e.target.value })}
          />
          <Input
            label="Longitude"
            value={form.longitude}
            onChange={(e) => setForm({ ...form, longitude: e.target.value })}
          />
        </div>

        <button
          type="button"
          onClick={getCurrentLocation}
          className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg w-full text-gray-700 transition"
        >
          <MapPin className="w-4 h-4" />
          Gunakan Lokasi Saat Ini
        </button>

        <button
          type="submit"
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium px-4 py-2 rounded-lg shadow hover:opacity-90 transition w-full"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Simpan Perubahan
        </button>

        {message && (
          <div
            className={`text-center text-sm mt-2 ${
              message.startsWith("✅") ? "text-green-600" : "text-red-600"
            }`}
          >
            {message}
          </div>
        )}
      </form>
    </div>
  );
};

// ======================
// 🔹 INPUT & TEXTAREA COMPONENT
// ======================
const Input = ({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <div>
    <label className="block text-sm text-gray-600 mb-1">{label}</label>
    <input
      {...props}
      className="w-full px-3 py-2 border rounded-lg focus:ring focus:ring-blue-200 focus:border-blue-400"
    />
  </div>
);

const Textarea = ({
  label,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) => (
  <div>
    <label className="block text-sm text-gray-600 mb-1">{label}</label>
    <textarea
      {...props}
      className="w-full px-3 py-2 border rounded-lg focus:ring focus:ring-blue-200 focus:border-blue-400"
      rows={3}
    />
  </div>
);
