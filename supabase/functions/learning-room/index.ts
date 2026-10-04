import { authenticate, corsHeaders, env, isLearningManager, jsonResponse, managementToken } from '../_shared/learning.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405)

  const auth = await authenticate(req)
  if (auth.error) return jsonResponse(req, { error: auth.error }, auth.error === 'Sign-in required' ? 401 : auth.error === 'Invalid session' ? 401 : auth.error === 'Approved account required' ? 403 : 503)
  const access = await isLearningManager(auth.caller, auth.user.id)
  if (access.unavailable) return jsonResponse(req, { error: 'Authorization service unavailable' }, 503)
  if (!access.allowed) return jsonResponse(req, { error: 'Owner or manager access required' }, 403)

  let input: unknown
  try { input = await req.json() } catch { return jsonResponse(req, { error: 'Invalid request' }, 400) }
  const workshopId = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>).workshopId : null
  if (typeof workshopId !== 'string' || !/^[0-9a-f-]{36}$/i.test(workshopId)) return jsonResponse(req, { error: 'Invalid workshop' }, 400)

  const [workshopResult, existingResult] = await Promise.all([
    auth.caller.from('learning_workshops').select('id,title,status').eq('id', workshopId).maybeSingle(),
    auth.admin.from('learning_provider_rooms').select('provider_room_id').eq('workshop_id', workshopId).maybeSingle(),
  ])
  if (workshopResult.error || existingResult.error) return jsonResponse(req, { error: 'Workshop service unavailable' }, 503)
  if (!workshopResult.data) return jsonResponse(req, { error: 'Workshop not found' }, 404)
  if (!['scheduled', 'live'].includes(workshopResult.data.status)) return jsonResponse(req, { error: 'This workshop can no longer be started' }, 409)
  if (existingResult.data) return jsonResponse(req, { ready: true })

  const accessKey = env('HMS_ACCESS_KEY')
  const secret = env('HMS_APP_SECRET')
  const templateId = env('HMS_TEMPLATE_ID')
  if (!accessKey || !secret || !templateId) return jsonResponse(req, { error: 'Live learning has not been configured yet' }, 503)

  try {
    const roomName = `saytara-${workshopId.replaceAll('-', '')}`
    const token = await managementToken(accessKey, secret)
    const payload: Record<string, unknown> = {
      name: roomName,
      description: String(workshopResult.data.title).slice(0, 200),
      template_id: templateId,
    }
    const region = env('HMS_REGION')
    if (region && ['eu', 'in', 'us', 'auto'].includes(region)) payload.region = region
    // Omit recording_info deliberately so the room inherits the recording policy configured in the 100ms template.
    const response = await fetch('https://api.100ms.live/v2/rooms', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) return jsonResponse(req, { error: 'The video provider could not prepare this workshop room' }, 502)
    const room = await response.json() as { id?: unknown; name?: unknown }
    if (typeof room.id !== 'string' || !/^[0-9a-f]{20,40}$/i.test(room.id)) return jsonResponse(req, { error: 'The video provider returned an invalid room response' }, 502)

    const { error: saveError } = await auth.admin.from('learning_provider_rooms').upsert({
      workshop_id: workshopId,
      provider: '100ms',
      provider_room_id: room.id,
      provider_room_name: roomName,
    }, { onConflict: 'workshop_id' })
    if (saveError) return jsonResponse(req, { error: 'The workshop room could not be registered' }, 503)
    return jsonResponse(req, { ready: true })
  } catch {
    return jsonResponse(req, { error: 'The video provider is temporarily unavailable' }, 502)
  }
})
