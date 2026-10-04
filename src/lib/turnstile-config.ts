export const turnstileSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? ''
export const isTurnstileConfigured = Boolean(turnstileSiteKey)
