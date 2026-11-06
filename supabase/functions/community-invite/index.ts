import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

function jsonResponse(body: Record<string, unknown>, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  })
}

function defaultKeyFromMap(variable: string): string | null {
  const raw = Deno.env.get(variable)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const preferred = parsed.default
    if (typeof preferred === 'string' && preferred.length > 0) return preferred
    return Object.values(parsed).find((value): value is string => typeof value === 'string' && value.length > 0) ?? null
  } catch {
    return null
  }
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, cors)

  const authorization = req.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return jsonResponse({ error: 'sign_in_required' }, 401, cors)

  const url = Deno.env.get('SUPABASE_URL')
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') || defaultKeyFromMap('SUPABASE_PUBLISHABLE_KEYS')
  const secretKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || defaultKeyFromMap('SUPABASE_SECRET_KEYS')
  if (!url || !publishableKey || !secretKey) {
    return jsonResponse({ error: 'server_configuration_unavailable' }, 503, cors)
  }

  const caller = createClient(url, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user }, error: authError } = await caller.auth.getUser()
  if (authError || !user || !user.email_confirmed_at) {
    return jsonResponse({ error: 'confirmed_sign_in_required' }, 401, cors)
  }

  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: isOwner, error: ownerError } = await caller.rpc('is_platform_owner')
  if (ownerError) return jsonResponse({ error: 'role_check_unavailable' }, 503, cors)

  const [profileResult, rolesResult, invitationSetting] = await Promise.all([
    admin.from('profiles').select('account_status').eq('user_id', user.id).maybeSingle(),
    admin.from('user_roles').select('role').eq('user_id', user.id),
    admin.from('platform_settings').select('value_boolean').eq('setting_key', 'owner_invitations_enabled').maybeSingle(),
  ])
  if (profileResult.error || rolesResult.error || invitationSetting.error) {
    return jsonResponse({ error: 'authorization_data_unavailable' }, 503, cors)
  }
  if (invitationSetting.data?.value_boolean !== true) {
    return jsonResponse({ error: 'invitations_disabled' }, 403, cors)
  }

  const assignedRoles = new Set((rolesResult.data || []).map(row => row.role as string))
  const approved = profileResult.data?.account_status === 'approved'
  const hasInviteRole = isOwner === true || (approved && (
    assignedRoles.has('manager') || assignedRoles.has('moderator') || assignedRoles.has('coach')
  ))
  if (!hasInviteRole || (!approved && isOwner !== true)) {
    return jsonResponse({ error: 'approved_team_role_required' }, 403, cors)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400, cors)
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse({ error: 'invalid_request' }, 400, cors)
  }

  const rawEmail = (body as Record<string, unknown>).email
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'valid_email_required' }, 400, cors)
  }
  if (user.email && email === user.email.toLowerCase()) {
    return jsonResponse({ error: 'cannot_invite_self' }, 400, cors)
  }

  try {
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}?flow=confirm`,
    })
    if (error) return jsonResponse({ error: 'invitation_not_created', detail: 'The address may already have an account.' }, 409, cors)
    return jsonResponse({ invited: true, initial_role: 'member', account_status: 'pending_review' }, 202, cors)
  } catch {
    return jsonResponse({ error: 'invitation_failed' }, 500, cors)
  }
})
