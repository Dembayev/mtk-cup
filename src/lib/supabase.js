import { createClient } from '@supabase/supabase-js'

// Используем прокси через наш сервер для обхода блокировок
export const SUPABASE_URL = window.location.hostname === "localhost" 
  ? 'https://ecayfpszkleyxuhsekhu.supabase.co'
  : 'https://app.mtkcup.ru/api/supabase'

const supabaseAnonKey = 'sb_publishable_WqPpIyUu-kbLZ07b6O_lLg_dFutAdO8'

export const supabase = createClient(SUPABASE_URL, supabaseAnonKey)
