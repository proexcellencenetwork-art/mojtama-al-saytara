import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAdminKey, getSupabaseUrl } from '../_shared/keys.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, x-cleanup-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors })
  const expected = Deno.env.get('CLEANUP_WEBHOOK_SECRET')
  const supplied = req.headers.get('x-cleanup-secret')
  if (!expected || !supplied || supplied !== expected) return new Response('Unauthorized', { status: 401, headers: cors })

  const url = getSupabaseUrl()
  const adminKey = getAdminKey()
  if (!url || !adminKey) return new Response('Missing server configuration', { status: 500, headers: cors })
  const admin = createClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } })
  let payload: Record<string, unknown>
  try {
    const parsed: unknown = await req.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return new Response('Invalid JSON object', { status: 400, headers: cors })
    }
    payload = parsed as Record<string, unknown>
  } catch {
    return new Response('Invalid JSON body', { status: 400, headers: cors })
  }
  const oldValue = payload.old_record ?? payload.old ?? {}
  const newValue = payload.record ?? payload.new_record ?? payload.new ?? {}
  if (!oldValue || typeof oldValue !== 'object' || Array.isArray(oldValue) || !newValue || typeof newValue !== 'object' || Array.isArray(newValue)) {
    return new Response('Invalid webhook row data', { status: 400, headers: cors })
  }
  const oldRow = oldValue as Record<string, unknown>
  const newRow = newValue as Record<string, unknown>
  const oldPath = typeof oldRow.document_path === 'string' ? oldRow.document_path : null
  const newPath = typeof newRow.document_path === 'string' ? newRow.document_path : null
  const oldOwner = typeof oldRow.user_id === 'string' ? oldRow.user_id : null
  const newOwner = typeof newRow.user_id === 'string' ? newRow.user_id : null
  if ((oldOwner && newOwner && oldOwner !== newOwner) || (!oldOwner && !newOwner) || (!oldPath && !newPath)) {
    return new Response('Missing or inconsistent document owner/path', { status: 400, headers: cors })
  }
  const ownerId = oldOwner ?? newOwner!
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ownerId)) {
    return new Response('Invalid document owner', { status: 400, headers: cors })
  }
  const oldStatus = typeof oldRow.status === 'string' ? oldRow.status : ''
  const newStatus = typeof newRow.status === 'string' ? newRow.status : ''
  const replacedPath = Boolean(oldPath && oldPath !== newPath)
  const finalized = ['pending', 'more_information'].includes(oldStatus) && ['approved', 'rejected'].includes(newStatus)
  if (!replacedPath && !finalized) return new Response(JSON.stringify({ skipped: true }), { status: 200, headers: { ...cors, 'content-type': 'application/json' } })
  const path = replacedPath ? oldPath! : (oldPath ?? newPath!)
  const segments = path.split('/')
  if (segments.length !== 2 || segments[0] !== ownerId || !segments[1] || segments[1] === '.' || segments[1] === '..' || segments[1].includes('\\')) {
    return new Response('Invalid owner-scoped storage path', { status: 403, headers: cors })
  }
  try {
    const { data: queued, error: lookupError } = await admin.from('verification_cleanup_queue').select('id')
      .eq('bucket_id', 'verification-private').eq('object_path', path).is('processed_at', null).limit(1).maybeSingle()
    if (lookupError) throw lookupError
    if (!queued) return new Response('Path is not queued for cleanup', { status: 403, headers: cors })
    const { error: removeError } = await admin.storage.from('verification-private').remove([path])
    if (removeError) throw removeError
    const { error: queueError } = await admin.from('verification_cleanup_queue')
      .update({ processed_at: new Date().toISOString(), last_error: null })
      .eq('bucket_id', 'verification-private').eq('object_path', path).is('processed_at', null)
    if (queueError) throw queueError
    return new Response(JSON.stringify({ removed: true }), { status: 200, headers: { ...cors, 'content-type': 'application/json' } })
  } catch {
    console.error('cleanup-verification-files operation failed')
    return new Response(JSON.stringify({ error: 'Document cleanup failed.' }), { status: 500, headers: { ...cors, 'content-type': 'application/json' } })
  }
})
