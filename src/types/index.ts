export interface Mountain {
  id: string
  name: string
  elevation_ft: number | null
  elevation_m: number | null
  latitude: number
  longitude: number
  prominence_ft: number | null
  prominence_m: number | null
  description: string
  highlights: string
  canonical_url: string
  difficulty_level: number | null
  banner_path: string | null
  other_name: string | null
}

export interface User {
  id: string
  created_at: string
  username: string
  image_path: string | null
  given_name: string | null
  family_name: string | null
  location: string | null
  website: string | null
  banner_path: string | null
}

export interface Log {
  id: string
  created_at: string
  user_id: string
  mountain_id: string
  climb_date: string | null
  climb_report: string | null
}

export interface MountainImage {
  id: string
  created_at: string
  image_path: string
  mountain_id: string
  user_id: string
  title: string
  description: string
  is_uploaded: string
}

export interface ClimbLog extends Log {
  mountain: Mountain
  user: User
  log_images: MountainImage[]
}
