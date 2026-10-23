export const turnstileSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? ''
export const isTurnstileConfigured = Boolean(turnstileSiteKey)

// This public build flag is an operator acknowledgement only. The authoritative
// CAPTCHA enforcement still must be enabled in Supabase Auth itself.
export const isSupabaseAuthCaptchaEnforced = import.meta.env.VITE_SUPABASE_CAPTCHA_ENFORCED === 'true'
export const isSignupSecurityConfigured = isTurnstileConfigured && isSupabaseAuthCaptchaEnforced
