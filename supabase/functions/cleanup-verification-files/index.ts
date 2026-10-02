import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, x-cleanup-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors })
  const expected = Deno.env.get('CLEANUP_WEBHOOK_SECRET')
  const supplied = req.headers.get('x-cleanup-secret')
  if (!expected || !supplied || supplied !== expected) return new Response('Unauthorized', { status: 401, headers: cors })

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  if (!url || !serviceKey) return new Response('Missing server configuration', { status: 500, headers: cors })
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    const payload = await req.json()
    const oldRow = payload.old_record ?? payload.old ?? {}
    const newRow = payload.record ?? payload.new_record ?? payload.new ?? {}
    const replacedPath = oldRow.document_path && oldRow.document_path !== newRow.document_path
    const finalized = ['pending', 'more_information'].includes(oldRow.status) && ['approved', 'rejected'].includes(newRow.status)
    if (!replacedPath && !finalized) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200, headers: { ...cors, 'content-type': 'application/json' } })
    }
    const path = replacedPath ? oldRow.document_path : (oldRow.document_path ?? newRow.document_path)
    if (!path) return new Response('Missing document path', { status: 400, headers: cors })
    const { error: removeError } = await admin.storage.from('verification-private').remove([path])
    if (removeError) throw removeError
    const { error: queueError } = await admin.from('verification_cleanup_queue')
      .update({ processed_at: new Date().toISOString(), last_error: null })
      .eq('bucket_id', 'verification-private').eq('object_path', path).is('processed_at', null)
    if (queueError) throw queueError
    return new Response(JSON.stringify({ removed: true }), { status: 200, headers: { ...cors, 'content-type': 'application/json' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cleanup failed'
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...cors, 'content-type': 'application/json' } })
  }
})
