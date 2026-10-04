import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAdminKey, getPublishableKey, getSupabaseUrl } from '../_shared/keys.ts'

const allowedOrigins = new Set([
  'https://proexcellencenetwork-art.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])
const siteUrl = 'https://proexcellencenetwork-art.github.io/mojtama-al-saytara/'

function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin')
  return {
    ...(origin && allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors })

  const authorization = req.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return new Response('Sign-in required', { status: 401, headers: cors })

  const url = getSupabaseUrl()
  const publishableKey = getPublishableKey()
  const adminKey = getAdminKey()
  if (!url || !publishableKey || !adminKey) {
    return new Response('Server configuration unavailable', { status: 503, headers: cors })
  }

  const caller = createClient(url, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user }, error: authError } = await caller.auth.getUser()
  if (authError || !user) return new Response('Invalid session', { status: 401, headers: cors })

  const { data: isOwner, error: ownerCheckError } = await caller.rpc('is_platform_owner')
  if (ownerCheckError) return new Response('Owner authorization unavailable', { status: 503, headers: cors })
  if (isOwner !== true) return new Response('Owner access required', { status: 403, headers: cors })
  const { data: invitationsEnabled, error: settingError } = await caller.rpc('is_owner_invitations_enabled')
  if (settingError) return new Response('Invitation setting unavailable', { status: 503, headers: cors })
  if (invitationsEnabled !== true) return new Response('Owner invitations are currently disabled', { status: 403, headers: cors })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400, headers: cors })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return new Response('Invalid request body', { status: 400, headers: cors })
  }

  const rawEmail = (body as Record<string, unknown>).email
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response('Enter a valid email address', { status: 400, headers: cors })
  }

  try {
    const admin = createClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}?flow=confirm`,
    })
    if (error) return new Response('Invitation could not be created; the address may already have an account.', { status: 409, headers: cors })
    return new Response(JSON.stringify({ invited: true }), {
      status: 202,
      headers: { ...cors, 'content-type': 'application/json' },
    })
  } catch {
    return new Response('Invitation could not be created', { status: 500, headers: cors })
  }
})
