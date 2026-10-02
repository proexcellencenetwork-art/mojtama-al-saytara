import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors })
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return new Response('Sign-in required', { status: 401, headers: cors })
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceKey) return new Response('Missing server configuration', { status: 500, headers: cors })
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } })
  const { data: { user }, error: authError } = await caller.auth.getUser()
  if (authError || !user) return new Response('Invalid session', { status: 401, headers: cors })
  try {
    const body = await req.json()
    if (body?.confirm !== true) return new Response('Explicit confirmation required', { status: 400, headers: cors })
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: files, error: listError } = await admin.storage.from('verification-private').list(user.id, { limit: 1000 })
    if (listError) throw listError
    const paths = (files ?? []).filter(file => file.name !== '.emptyFolderPlaceholder').map(file => `${user.id}/${file.name}`)
    if (paths.length) { const { error: removeError } = await admin.storage.from('verification-private').remove(paths); if (removeError) throw removeError }
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) throw error
    return new Response(JSON.stringify({ deleted: true }), { status: 200, headers: { ...cors, 'content-type': 'application/json' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Deletion failed'
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...cors, 'content-type': 'application/json' } })
  }
})
