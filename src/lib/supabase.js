import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ecayfpszkleyxuhsekhu.supabase.co'
const supabaseAnonKey = 'sb_publishable_WqPpIyUu-kbLZ07b6O_lLg_dFutAdO8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
