function defaultKeyFromMap(variable: string): string | null {
  const raw = Deno.env.get(variable)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const preferred = parsed.default
    if (typeof preferred === 'string' && preferred.length > 0) return preferred
    const first = Object.values(parsed).find((value): value is string => typeof value === 'string' && value.length > 0)
    return first ?? null
  } catch {
    return null
  }
}

export function getSupabaseUrl(): string | null {
  return Deno.env.get('SUPABASE_URL') || null
}

export function getPublishableKey(): string | null {
  return Deno.env.get('SUPABASE_ANON_KEY') || defaultKeyFromMap('SUPABASE_PUBLISHABLE_KEYS')
}

export function getAdminKey(): string | null {
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || defaultKeyFromMap('SUPABASE_SECRET_KEYS')
}
