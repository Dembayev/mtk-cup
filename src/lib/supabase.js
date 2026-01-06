import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://ecayfpszkleyxuhsekhu.supabase.co'
const supabaseAnonKey = 'sb_publishable_WqPpIyUu-kbLZ07b6O_lLg_dFutAdO8'

export const supabase = createClient(SUPABASE_URL, supabaseAnonKey)
