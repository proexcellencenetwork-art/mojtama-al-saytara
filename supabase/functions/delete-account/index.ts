import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAdminKey, getPublishableKey, getSupabaseUrl } from '../_shared/keys.ts'

const allowedOrigins = new Set([
  'https://proexcellencenetwork-art.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])
function headers(req: Request) {
  const origin = req.headers.get('Origin')
  return {
    ...(origin && allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

Deno.serve(async (req) => {
  const cors = headers(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors })
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return new Response('Sign-in required', { status: 401, headers: cors })

  const url = getSupabaseUrl()
  const publicKey = getPublishableKey()
  const adminKey = getAdminKey()
  if (!url || !publicKey || !adminKey) return new Response('Missing server configuration', { status: 500, headers: cors })
  const caller = createClient(url, publicKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } })
  const { data: { user }, error: authError } = await caller.auth.getUser()
  if (authError || !user) return new Response('Invalid session', { status: 401, headers: cors })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400, headers: cors })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) || (body as Record<string, unknown>).confirm !== true) {
    return new Response('Explicit confirmation required', { status: 400, headers: cors })
  }

  try {
    const admin = createClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const paths: string[] = []
    const pageSize = 100
    let offset = 0
    while (true) {
      const { data: files, error: listError } = await admin.storage.from('verification-private').list(user.id, { limit: pageSize, offset, sortBy: { column: 'name', order: 'asc' } })
      if (listError) throw listError
      const page = files ?? []
      paths.push(...page.filter(file => file.id && file.name !== '.emptyFolderPlaceholder').map(file => `${user.id}/${file.name}`))
      if (page.length < pageSize) break
      offset += page.length
    }
    for (let index = 0; index < paths.length; index += 100) {
      const { error: removeError } = await admin.storage.from('verification-private').remove(paths.slice(index, index + 100))
      if (removeError) throw removeError
    }
    const { error: queueError } = await admin.from('verification_cleanup_queue').delete()
      .eq('bucket_id', 'verification-private').like('object_path', `${user.id}/%`)
    if (queueError) throw queueError

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
    if (deleteError) throw deleteError
    return new Response(JSON.stringify({ deleted: true }), { status: 200, headers: { ...cors, 'content-type': 'application/json' } })
  } catch {
    console.error('delete-account operation failed')
    return new Response(JSON.stringify({ error: 'Account deletion failed. Contact the site administrator if this continues.' }), { status: 500, headers: { ...cors, 'content-type': 'application/json' } })
  }
})
