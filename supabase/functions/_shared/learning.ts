import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAdminKey, getPublishableKey, getSupabaseUrl } from './keys.ts'

const allowedOrigins = new Set([
  'https://proexcellencenetwork-art.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

export function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin')
  return {
    ...(origin && allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

export function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

export function env(name: string) {
  return Deno.env.get(name)?.trim() || null
}

export function makeClients(authorization: string) {
  const url = getSupabaseUrl()
  const publishableKey = getPublishableKey()
  const adminKey = getAdminKey()
  if (!url || !publishableKey || !adminKey) return null
  const caller = createClient(url, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const admin = createClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } })
  return { caller, admin }
}

export async function authenticate(req: Request) {
  const authorization = req.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return { error: 'Sign-in required' as const }
  const clients = makeClients(authorization)
  if (!clients) return { error: 'Server configuration unavailable' as const }
  const { data: { user }, error } = await clients.caller.auth.getUser()
  if (error || !user) return { error: 'Invalid session' as const }
  const { data: approved, error: approvalError } = await clients.caller.rpc('is_account_approved')
  if (approvalError || approved !== true) return { error: 'Approved account required' as const }
  return { ...clients, user, error: null }
}

export async function isLearningManager(caller: SupabaseClient, userId: string) {
  const [owner, manager] = await Promise.all([
    caller.rpc('is_platform_owner'),
    caller.rpc('has_role', { p_user: userId, p_role: 'manager' }),
  ])
  if (owner.error || manager.error) return { allowed: false, unavailable: true }
  return { allowed: owner.data === true || manager.data === true, unavailable: false }
}

function base64Url(input: Uint8Array) {
  let binary = ''
  for (const byte of input) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

export async function signHmsJwt(payload: Record<string, unknown>, secret: string) {
  const encoder = new TextEncoder()
  const header = base64Url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = base64Url(encoder.encode(JSON.stringify(payload)))
  const content = `${header}.${body}`
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(content)))
  return `${content}.${base64Url(signature)}`
}

export async function managementToken(accessKey: string, secret: string) {
  const now = Math.floor(Date.now() / 1000)
  return await signHmsJwt({
    access_key: accessKey,
    type: 'management',
    version: 2,
    iat: now,
    nbf: now - 5,
    exp: now + 60 * 60,
    jti: crypto.randomUUID(),
  }, secret)
}

export async function appToken(params: { accessKey: string; secret: string; roomId: string; userId: string; role: string }) {
  const now = Math.floor(Date.now() / 1000)
  return await signHmsJwt({
    access_key: params.accessKey,
    room_id: params.roomId,
    user_id: params.userId,
    role: params.role,
    type: 'app',
    version: 2,
    iat: now,
    nbf: now - 5,
    exp: now + 10 * 60,
    jti: crypto.randomUUID(),
  }, params.secret)
}

export function constantTimeEquals(a: string, b: string) {
  const left = new TextEncoder().encode(a)
  const right = new TextEncoder().encode(b)
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index]
  return difference === 0
}
