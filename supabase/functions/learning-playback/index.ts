import { authenticate, corsHeaders, env, isLearningManager, jsonResponse, managementToken } from '../_shared/learning.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405)
  const auth = await authenticate(req)
  if (auth.error) return jsonResponse(req, { error: auth.error }, auth.error === 'Sign-in required' ? 401 : auth.error === 'Invalid session' ? 401 : auth.error === 'Approved account required' ? 403 : 503)

  let input: unknown
  try { input = await req.json() } catch { return jsonResponse(req, { error: 'Invalid request' }, 400) }
  const recordingId = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>).recordingId : null
  if (typeof recordingId !== 'string' || !/^[0-9a-f-]{36}$/i.test(recordingId)) return jsonResponse(req, { error: 'Invalid recording' }, 400)

  const { data: recording, error: recordingError } = await auth.admin.from('learning_recordings')
    .select('id,workshop_id,provider_asset_id,status')
    .eq('id', recordingId)
    .maybeSingle()
  if (recordingError) return jsonResponse(req, { error: 'Recording service unavailable' }, 503)
  if (!recording || recording.status !== 'completed') return jsonResponse(req, { error: 'Recording not found' }, 404)

  const [audience, manager, workshop] = await Promise.all([
    auth.caller.rpc('can_access_learning_workshop', { p_workshop_id: recording.workshop_id }),
    isLearningManager(auth.caller, auth.user.id),
    auth.caller.from('learning_workshops').select('status').eq('id', recording.workshop_id).maybeSingle(),
  ])
  if (audience.error || manager.unavailable || workshop.error) return jsonResponse(req, { error: 'Recording access could not be verified' }, 503)
  if (audience.data !== true || !workshop.data || workshop.data.status !== 'recorded') return jsonResponse(req, { error: 'Recording access denied' }, 403)

  const accessKey = env('HMS_ACCESS_KEY')
  const secret = env('HMS_APP_SECRET')
  if (!accessKey || !secret) return jsonResponse(req, { error: 'Live learning has not been configured yet' }, 503)
  try {
    const token = await managementToken(accessKey, secret)
    const response = await fetch(`https://api.100ms.live/v2/recording-assets/${encodeURIComponent(recording.provider_asset_id)}/presigned-url?presign_duration=300`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return jsonResponse(req, { error: 'A protected playback link could not be created' }, 502)
    const result = await response.json() as { url?: unknown; expiry?: unknown }
    if (typeof result.url !== 'string' || !result.url.startsWith('https://')) return jsonResponse(req, { error: 'The provider returned an invalid playback link' }, 502)
    return jsonResponse(req, { url: result.url, expiresIn: 300 })
  } catch {
    return jsonResponse(req, { error: 'Playback service is temporarily unavailable' }, 502)
  }
})
