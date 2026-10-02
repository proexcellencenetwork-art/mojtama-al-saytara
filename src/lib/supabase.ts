import { createClient } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabaseConfig } from './supabase-config'

export { isSupabaseConfigured }

// The browser receives only the public anon/publishable key; database access is still protected by RLS.
// PKCE keeps OAuth codes compatible with the app's BrowserRouter routes.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null
