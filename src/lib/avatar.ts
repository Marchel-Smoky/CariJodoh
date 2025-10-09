// src/lib/avatar.ts
const avatarCache = new Map<string, string>();

export async function fetchSignedAvatar(path?: string) {
  if (!path) return "../asset/noprofile.png";
  if (path.startsWith("http")) return path;
  if (avatarCache.has(path)) return avatarCache.get(path);

  try {
    const res = await fetch(`/api/avatar?path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error("avatar endpoint failed");
    const json = await res.json();
    const url = json.url || "../asset/noprofile.png";
    avatarCache.set(path, url);
    return url;
  } catch (err) {
    console.warn("fetchSignedAvatar failed:", err);
    return "../asset/noprofile.png";
  }
}
