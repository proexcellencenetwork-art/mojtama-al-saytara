import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const allowedOrigins = new Set([
  'https://proexcellencenetwork-art.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin')
  return {
    ...(origin && allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  }
}

function json(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) })
}

async function fingerprint(ip: string, pepper: string) {
  const bytes = new TextEncoder().encode(`${ip}:${pepper}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405)
  const origin = req.headers.get('Origin')
  if (origin && !allowedOrigins.has(origin)) return json(req, { error: 'origin_not_allowed' }, 403)

  let body: unknown
  try { body = await req.json() } catch { return json(req, { error: 'invalid_json' }, 400) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json(req, { error: 'invalid_body' }, 400)
  const input = body as Record<string, unknown>
  if (typeof input.website === 'string' && input.website.trim()) return json(req, { ok: true, status: 'subscribed' }, 202)
  if (input.consent !== true) return json(req, { error: 'consent_required' }, 400)
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const sourcePath = typeof input.sourcePath === 'string' && input.sourcePath.startsWith('/') ? input.sourcePath.split(/[?#]/)[0].slice(0, 300) : '/'
  if (email.length < 5 || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(req, { error: 'invalid_email' }, 400)

  const url = Deno.env.get('SUPABASE_URL')
  const adminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !adminKey) return json(req, { error: 'server_configuration_unavailable' }, 503)
  const admin = createClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const rawIp = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
  if (rawIp) {
    const key = await fingerprint(rawIp, adminKey)
    const { data: previous, error: readError } = await admin.from('newsletter_rate_limits').select('window_started_at,request_count').eq('fingerprint', key).maybeSingle()
    if (readError) return json(req, { error: 'rate_limit_check_failed' }, 503)
    const now = Date.now()
    const active = previous && now - new Date(previous.window_started_at).getTime() < 60 * 60 * 1000
    if (active && previous.request_count >= 5) return json(req, { error: 'rate_limited' }, 429)
    const nextCount = active ? previous.request_count + 1 : 1
    const { error: rateError } = await admin.from('newsletter_rate_limits').upsert({
      fingerprint: key,
      window_started_at: active ? previous.window_started_at : new Date(now).toISOString(),
      request_count: nextCount,
      updated_at: new Date(now).toISOString(),
    }, { onConflict: 'fingerprint' })
    if (rateError) return json(req, { error: 'rate_limit_update_failed' }, 503)
  }

  const { data, error } = await admin.rpc('request_newsletter_subscription', {
    p_email: email,
    p_source_path: sourcePath,
  })
  if (error || data !== 'subscribed') return json(req, { error: 'subscription_save_failed' }, 500)
  return json(req, { ok: true, status: 'subscribed', emailDeliveryConfigured: false }, 201)
})
