const rawUrl = import.meta.env.VITE_SUPABASE_URL
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const url = typeof rawUrl === 'string' ? rawUrl.trim() : ''
const anonKey = typeof rawAnonKey === 'string' ? rawAnonKey.trim() : ''

function validProjectUrl(value: string): boolean {
  if (!value || /YOUR_PROJECT|PLACEHOLDER|example\.com/i.test(value)) return false
  try {
    const parsed = new URL(value)
    return (parsed.protocol === 'https:' || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
      && Boolean(parsed.hostname)
      && !parsed.username
      && !parsed.password
  } catch {
    return false
  }
}

function validPublicKey(value: string): boolean {
  return value.length >= 20 && !/YOUR_|PLACEHOLDER|REPLACE_ME/i.test(value)
}

export const isSupabaseConfigured = validProjectUrl(url) && validPublicKey(anonKey)
export const supabaseConfig = Object.freeze({ url, anonKey })
