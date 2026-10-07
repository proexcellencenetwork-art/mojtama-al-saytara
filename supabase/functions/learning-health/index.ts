import { authenticate, corsHeaders, env, isLearningManager, jsonResponse } from '../_shared/learning.ts'

const required = ['HMS_ACCESS_KEY', 'HMS_APP_SECRET', 'HMS_TEMPLATE_ID', 'HMS_WEBHOOK_SECRET', 'HMS_HOST_ROLE_NAME', 'HMS_MEMBER_ROLE_NAME'] as const
const present = (name: string) => Boolean(env(name))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405)
  const auth = await authenticate(req)
  if (auth.error) return jsonResponse(req, { error: auth.error }, auth.error === 'Sign-in required' || auth.error === 'Invalid session' ? 401 : auth.error === 'Approved account required' ? 403 : 503)
  const owner = await auth.caller.rpc('is_platform_owner')
  if (owner.error) return jsonResponse(req, { error: 'Authorization service unavailable' }, 503)
  if (owner.data !== true) return jsonResponse(req, { error: 'Owner access required' }, 403)
  const missingConfig = required.filter(name => !present(name))
  const recordingReady = env('HMS_RECORDING_ENABLED') === 'true'
  const storageReady = env('HMS_STORAGE_CONFIGURED') === 'true'
  return jsonResponse(req, {
    checks: [
      { key: 'config', label: '100ms configuration', status: missingConfig.length === 0 ? 'READY' : 'MISSING', missing: missingConfig, detail: missingConfig.length === 0 ? 'Required 100ms server settings are present.' : 'Add the listed names to Supabase Edge Secrets.' },
      { key: 'recording', label: 'Recording', status: recordingReady && missingConfig.length === 0 ? 'READY' : 'MISSING', missing: recordingReady ? missingConfig : [...missingConfig, 'HMS_RECORDING_ENABLED=true'], detail: recordingReady ? 'Recording is declared enabled in the 100ms template.' : 'Enable HLS MP4 recording in 100ms, then set the declaration.' },
      { key: 'webhook', label: 'Webhook', status: present('HMS_WEBHOOK_SECRET') ? 'READY' : 'MISSING', missing: present('HMS_WEBHOOK_SECRET') ? [] : ['HMS_WEBHOOK_SECRET', '100ms webhook secret header'], detail: present('HMS_WEBHOOK_SECRET') ? 'Secret is present; webhook URL/header still need a real provider delivery test.' : 'Add the shared secret and configure the provider header.' },
      { key: 'storage', label: 'Storage', status: storageReady && missingConfig.length === 0 ? 'READY' : 'MISSING', missing: storageReady ? missingConfig : [...missingConfig, 'HMS_STORAGE_CONFIGURED=true'], detail: storageReady ? 'Storage is declared configured in 100ms.' : 'Choose provider storage/retention in 100ms, then set the declaration.' },
    ],
  })
})
