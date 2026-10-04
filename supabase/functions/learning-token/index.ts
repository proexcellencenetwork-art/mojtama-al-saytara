import { appToken, authenticate, corsHeaders, env, isLearningManager, jsonResponse } from '../_shared/learning.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405)
  const auth = await authenticate(req)
  if (auth.error) return jsonResponse(req, { error: auth.error }, auth.error === 'Sign-in required' ? 401 : auth.error === 'Invalid session' ? 401 : auth.error === 'Approved account required' ? 403 : 503)

  let input: unknown
  try { input = await req.json() } catch { return jsonResponse(req, { error: 'Invalid request' }, 400) }
  const workshopId = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>).workshopId : null
  if (typeof workshopId !== 'string' || !/^[0-9a-f-]{36}$/i.test(workshopId)) return jsonResponse(req, { error: 'Invalid workshop' }, 400)

  const [workshopResult, audienceResult, managerResult, roomResult] = await Promise.all([
    auth.caller.from('learning_workshops').select('id,status').eq('id', workshopId).maybeSingle(),
    auth.caller.rpc('can_access_learning_workshop', { p_workshop_id: workshopId }),
    isLearningManager(auth.caller, auth.user.id),
    auth.admin.from('learning_provider_rooms').select('provider_room_id').eq('workshop_id', workshopId).maybeSingle(),
  ])
  if (workshopResult.error || audienceResult.error || managerResult.unavailable || roomResult.error) return jsonResponse(req, { error: 'Workshop access could not be verified' }, 503)
  if (!workshopResult.data || audienceResult.data !== true) return jsonResponse(req, { error: 'Workshop access denied' }, 403)
  if (workshopResult.data.status !== 'live') return jsonResponse(req, { error: 'This workshop is not live' }, 409)
  if (!roomResult.data?.provider_room_id) return jsonResponse(req, { error: 'Workshop room is not ready' }, 503)

  const accessKey = env('HMS_ACCESS_KEY')
  const secret = env('HMS_APP_SECRET')
  if (!accessKey || !secret) return jsonResponse(req, { error: 'Live learning has not been configured yet' }, 503)
  const role = managerResult.allowed ? (env('HMS_HOST_ROLE_NAME') || 'host') : (env('HMS_MEMBER_ROLE_NAME') || 'attendee')
  try {
    const token = await appToken({ accessKey, secret, roomId: roomResult.data.provider_room_id, userId: auth.user.id, role })
    return jsonResponse(req, { token, role: managerResult.allowed ? 'host' : 'attendee' })
  } catch {
    return jsonResponse(req, { error: 'A room token could not be issued' }, 500)
  }
})
