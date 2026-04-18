export interface Profile {
  id: number
  name: string
}

export interface Session {
  id: number
  profile_id: number
  player_name: string
  date: string
  source_filename: string
  shot_count: number
}

export interface Shot {
  id: number
  club_type: string
  club_brand: string
  club_model: string
  carry_distance: number
  total_distance: number
  ball_speed: number
  club_speed: number
  smash_factor: number
  launch_angle: number
  launch_direction: number
  apex: number
  side_carry: number
  descent_angle: number
  attack_angle: number
  club_path: number
  spin_rate: number
  spin_axis: number
  club_data_est: number
}

export interface ImportResult {
  filename: string
  status: 'imported' | 'skipped' | 'error'
  message: string
}

export interface ImportSummary {
  results: ImportResult[]
  imported: number
  skipped: number
  errors: number
}
