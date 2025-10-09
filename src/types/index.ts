export interface UserProfile {
  id: string
  username: string
  gender: "male" | "female"
  avatar_url?: string
  latitude?: number
  longitude?: number
  is_online?: boolean
}
