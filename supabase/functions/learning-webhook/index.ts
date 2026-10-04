import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { constantTimeEquals, corsHeaders, env, jsonResponse, managementToken } from '../_shared/learning.ts'
import { getAdminKey, getSupabaseUrl } from '../_shared/keys.ts'

type ProviderEvent = { id?: unknown; type?: unknown; data?: unknown }
type ProviderAsset = { id?: unknown; room_id?: unknown; session_id?: unknown; type?: unknown; status?: unknown; duration?: unknown; created_at?: unknown }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405)
  const expected = env('HMS_WEBHOOK_SECRET')
  const supplied = req.headers.get('x-saytara-webhook-secret') || ''
  if (!expected || !constantTimeEquals(supplied, expected)) return jsonResponse(req, { error: 'Webhook authentication failed' }, 401)

  const url = getSupabaseUrl()
  const adminKey = getAdminKey()
  const accessKey = env('HMS_ACCESS_KEY')
  const secret = env('HMS_APP_SECRET')
  if (!url || !adminKey || !accessKey || !secret) return jsonResponse(req, { error: 'Webhook service unavailable' }, 503)
  const raw = await req.text()
  if (raw.length > 65536) return jsonResponse(req, { error: 'Webhook payload too large' }, 413)
  let event: ProviderEvent
  try { event = JSON.parse(raw) as ProviderEvent } catch { return jsonResponse(req, { error: 'Invalid event payload' }, 400) }
  if (typeof event.id !== 'string' || event.id.length > 100 || typeof event.type !== 'string' || event.type.length > 100 || !event.data || typeof event.data !== 'object' || Array.isArray(event.data)) {
    return jsonResponse(req, { error: 'Invalid event payload' }, 400)
  }
  const data = event.data as Record<string, unknown>
  const roomId = typeof data.room_id === 'string' ? data.room_id : null
  const sessionId = typeof data.session_id === 'string' ? data.session_id : null
  const admin = createClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { error: insertEventError } = await admin.from('learning_provider_events').insert({
    event_id: event.id,
    event_type: event.type,
    provider_room_id: roomId,
    session_id: sessionId,
  })
  if (insertEventError && insertEventError.code !== '23505') return jsonResponse(req, { error: 'Webhook event could not be recorded' }, 503)
  const { data: existingEvent, error: existingEventError } = await admin.from('learning_provider_events').select('processed_at').eq('event_id', event.id).maybeSingle()
  if (existingEventError) return jsonResponse(req, { error: 'Webhook event could not be verified' }, 503)
  if (existingEvent?.processed_at) return jsonResponse(req, { received: true, duplicate: true })

  try {
    const { data: room, error: roomError } = roomId
      ? await admin.from('learning_provider_rooms').select('workshop_id').eq('provider_room_id', roomId).maybeSingle()
      : { data: null, error: null }
    if (roomError) return jsonResponse(req, { error: 'Workshop mapping unavailable' }, 503)

    if (room && ['session.close.success', 'room.end.success'].includes(event.type)) {
      const { error } = await admin.from('learning_workshops').update({ status: 'ended' }).eq('id', room.workshop_id).eq('status', 'live')
      if (error) return jsonResponse(req, { error: 'Workshop status could not be updated' }, 503)
    }

    if (room && event.type === 'hls.recording.success' && roomId && sessionId) {
      const management = await managementToken(accessKey, secret)
      const params = new URLSearchParams({ room_id: roomId, session_id: sessionId, status: 'completed', limit: '50' })
      let assetId: string | null = null
      const durationValue = typeof data.duration === 'number' ? data.duration : null
      const singleFiles = Array.isArray(data.recording_single_files) ? data.recording_single_files as Record<string, unknown>[] : []
      const preferredFile = singleFiles
        .filter(file => typeof file.asset_id === 'string' && typeof file.layer === 'string')
        .sort((a, b) => Number(a.layer) - Number(b.layer))[0]
      if (preferredFile && typeof preferredFile.asset_id === 'string') assetId = preferredFile.asset_id

      if (!assetId) {
        // Some templates emit only a playlist asset. Look up the exact provider room/session rather than accepting caller-supplied IDs.
        for (const delay of [0, 700, 1800]) {
          if (delay) await new Promise(resolve => setTimeout(resolve, delay))
          const response = await fetch(`https://api.100ms.live/v2/recording-assets?${params.toString()}`, { headers: { Authorization: `Bearer ${management}` } })
          if (!response.ok) return jsonResponse(req, { error: 'Recording asset lookup failed' }, 502)
          const result = await response.json() as { data?: ProviderAsset[] }
          const assets = (result.data || []).filter(asset => asset.status === 'completed' && asset.room_id === roomId && asset.session_id === sessionId && typeof asset.id === 'string')
          const preferred = assets.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0]
          if (preferred && typeof preferred.id === 'string') { assetId = preferred.id; break }
        }
      }
      if (!assetId) {
        // Keep this event unprocessed so a provider retry can safely finish the mapping after its asset index updates.
        return jsonResponse(req, { error: 'Recording asset is not ready yet' }, 503)
      }
      const duration = durationValue !== null && Number.isFinite(durationValue) ? Math.max(0, Math.min(43200, Math.floor(durationValue))) : null
      const { error: recordingError } = await admin.from('learning_recordings').upsert({
        workshop_id: room.workshop_id,
        provider: '100ms',
        provider_asset_id: assetId,
        session_id: sessionId,
        duration_seconds: duration,
        status: 'completed',
      }, { onConflict: 'provider_asset_id' })
      if (recordingError) return jsonResponse(req, { error: 'Recording metadata could not be saved' }, 503)
      const { error: statusError } = await admin.from('learning_workshops').update({ status: 'recorded' }).eq('id', room.workshop_id).in('status', ['live', 'ended'])
      if (statusError) return jsonResponse(req, { error: 'Workshop archive status could not be updated' }, 503)
    }

    const { error: markError } = await admin.from('learning_provider_events').update({ processed_at: new Date().toISOString() }).eq('event_id', event.id)
    if (markError) return jsonResponse(req, { error: 'Webhook event could not be finalized' }, 503)
    return jsonResponse(req, { received: true })
  } catch {
    return jsonResponse(req, { error: 'Webhook processing failed' }, 500)
  }
})
