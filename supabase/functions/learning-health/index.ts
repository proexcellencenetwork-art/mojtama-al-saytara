import { authenticate, corsHeaders, env, jsonResponse, managementToken } from '../_shared/learning.ts'

type JsonRecord = Record<string, unknown>

const required = [
  'HMS_ACCESS_KEY',
  'HMS_APP_SECRET',
  'HMS_TEMPLATE_ID',
  'HMS_WEBHOOK_SECRET',
  'HMS_HOST_ROLE_NAME',
  'HMS_MEMBER_ROLE_NAME',
] as const

const asRecord = (value: unknown): JsonRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {}

const ready = (key: string, label: string, detail: string) => ({
  key, label, status: 'READY' as const, missing: [] as string[], detail,
})

const missing = (key: string, label: string, items: string[], detail: string) => ({
  key, label, status: 'MISSING' as const, missing: [...new Set(items)], detail,
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405)

  const auth = await authenticate(req)
  if (auth.error) {
    const status = auth.error === 'Sign-in required' || auth.error === 'Invalid session'
      ? 401
      : auth.error === 'Approved account required' ? 403 : 503
    return jsonResponse(req, { error: auth.error }, status)
  }

  const owner = await auth.caller.rpc('is_platform_owner')
  if (owner.error) return jsonResponse(req, { error: 'Authorization service unavailable' }, 503)
  if (owner.data !== true) return jsonResponse(req, { error: 'Owner access required' }, 403)

  const missingSecrets = required.filter((name) => !env(name))
  const accessKey = env('HMS_ACCESS_KEY')
  const appSecret = env('HMS_APP_SECRET')
  const templateId = env('HMS_TEMPLATE_ID')
  const hostRoleName = env('HMS_HOST_ROLE_NAME') || 'host'
  const memberRoleName = env('HMS_MEMBER_ROLE_NAME') || 'attendee'

  let managementJwt: string | null = null
  let providerVerified = false
  let templateRolesReady = false
  let hlsDestinationReady = false
  let hlsRecordingReady = false
  let providerFailure = ''
  const providerIssues: string[] = []

  if (missingSecrets.length === 0 && accessKey && appSecret && templateId) {
    try {
      managementJwt = await managementToken(accessKey, appSecret)
      const response = await fetch(
        'https://api.100ms.live/v2/templates/' + encodeURIComponent(templateId),
        {
          method: 'GET',
          headers: { Authorization: 'Bearer ' + managementJwt },
          signal: AbortSignal.timeout(8000),
        },
      )

      if (!response.ok) {
        providerFailure = response.status === 401 || response.status === 403
          ? '100ms rejected the server credentials.'
          : response.status === 404
            ? 'The configured 100ms template was not found.'
            : '100ms template verification failed with HTTP ' + response.status + '.'
      } else {
        const template = asRecord(await response.json())
        providerVerified = template.id === templateId

        if (!providerVerified) providerIssues.push('The returned template ID did not match HMS_TEMPLATE_ID.')

        const roles = asRecord(template.roles)
        const hostRole = asRecord(roles[hostRoleName])
        const memberRole = asRecord(roles[memberRoleName])
        if (!roles[hostRoleName]) providerIssues.push('Host role "' + hostRoleName + '" was not found in the 100ms template.')
        if (!roles[memberRoleName]) providerIssues.push('Member role "' + memberRoleName + '" was not found in the 100ms template.')

        const hostPermissions = asRecord(hostRole.permissions)
        const memberPermissions = asRecord(memberRole.permissions)
        if (roles[hostRoleName] && hostPermissions.hlsStreaming !== true) {
          providerIssues.push('The host role must have HLS streaming permission enabled.')
        }
        if (roles[memberRoleName]) {
          const unsafeMemberPermissions = ['hlsStreaming', 'endRoom', 'removeOthers']
            .filter((permission) => memberPermissions[permission] === true)
          if (unsafeMemberPermissions.length) {
            providerIssues.push('The member role has administrative permissions enabled: ' + unsafeMemberPermissions.join(', ') + '.')
          }
        }
        templateRolesReady = providerVerified
          && Boolean(roles[hostRoleName])
          && Boolean(roles[memberRoleName])
          && hostPermissions.hlsStreaming === true
          && !['hlsStreaming', 'endRoom', 'removeOthers'].some((permission) => memberPermissions[permission] === true)

        const destinations = asRecord(template.destinations)
        const hlsDestinations = asRecord(destinations.hlsDestinations)
        const hlsDestinationValues = Object.values(hlsDestinations).map(asRecord)
        hlsDestinationReady = hlsDestinationValues.length > 0
        hlsRecordingReady = hlsDestinationValues.some((destination) => {
          const recording = asRecord(destination.recording)
          return recording.hlsVod === true || recording.singleFilePerLayer === true
        })
      }
    } catch {
      providerFailure = 'Could not reach or validate the 100ms template. Check the server secrets and provider availability.'
    }
  }

  const configMissing = [...missingSecrets, ...providerIssues]
  if (!providerVerified && !missingSecrets.length) configMissing.push('Verified 100ms template/API access')
  if (providerFailure) configMissing.push('Valid 100ms credentials and template')
  const configReady = missingSecrets.length === 0 && providerVerified && templateRolesReady
    && providerIssues.length === 0 && !providerFailure

  const recordingMissing: string[] = []
  if (missingSecrets.length) recordingMissing.push(...missingSecrets)
  if (!providerVerified) recordingMissing.push('Verified 100ms template/API access')
  if (!templateRolesReady) recordingMissing.push('Valid host and member roles')
  if (!hlsDestinationReady) recordingMissing.push('At least one configured HLS destination')
  if (!hlsRecordingReady) recordingMissing.push('HLS VOD or single-file-per-layer recording configured in the template')
  if (env('HMS_RECORDING_ENABLED') !== 'true') recordingMissing.push('HMS_RECORDING_ENABLED=true declaration')
  const recordingReady = recordingMissing.length === 0

  let webhookEvidenceError = false
  let processedRecordingWebhook = false
  const webhookEvidence = await auth.admin
    .from('learning_provider_events')
    .select('event_id,event_type,received_at,processed_at')
    .eq('event_type', 'hls.recording.success')
    .not('processed_at', 'is', null)
    .order('received_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (webhookEvidence.error) {
    webhookEvidenceError = true
  } else {
    processedRecordingWebhook = Boolean(webhookEvidence.data)
  }

  const webhookMissing: string[] = []
  if (!env('HMS_WEBHOOK_SECRET')) webhookMissing.push('HMS_WEBHOOK_SECRET')
  if (webhookEvidenceError) webhookMissing.push('Read access to processed webhook evidence')
  if (!processedRecordingWebhook) webhookMissing.push('A processed hls.recording.success event from a real test recording')
  const webhookReady = webhookMissing.length === 0

  let storageEvidenceError = false
  let playableRecordingVerified = false
  const completedRecording = await auth.admin
    .from('learning_recordings')
    .select('provider_asset_id,recorded_at')
    .eq('status', 'completed')
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (completedRecording.error) {
    storageEvidenceError = true
  } else if (completedRecording.data?.provider_asset_id && managementJwt) {
    try {
      const playbackResponse = await fetch(
        'https://api.100ms.live/v2/recording-assets/'
          + encodeURIComponent(completedRecording.data.provider_asset_id)
          + '/presigned-url?presign_duration=60',
        {
          method: 'GET',
          headers: { Authorization: 'Bearer ' + managementJwt },
          signal: AbortSignal.timeout(8000),
        },
      )
      if (playbackResponse.ok) {
        const playback = asRecord(await playbackResponse.json())
        playableRecordingVerified = typeof playback.url === 'string' && playback.url.startsWith('https://')
      }
    } catch {
      playableRecordingVerified = false
    }
  }

  const storageMissing: string[] = []
  if (env('HMS_STORAGE_CONFIGURED') !== 'true') storageMissing.push('HMS_STORAGE_CONFIGURED=true declaration')
  if (storageEvidenceError) storageMissing.push('Read access to completed recording metadata')
  if (!completedRecording.data?.provider_asset_id) storageMissing.push('A completed test recording in the protected database')
  else if (!playableRecordingVerified) storageMissing.push('A successful 100ms short-lived playback URL check')
  const storageReady = storageMissing.length === 0

  const checks = [
    configReady
      ? ready('config', '100ms configuration', 'The 100ms API accepted the server credentials, the configured template ID matched, the host role can start HLS, and the member role does not have room-administration permissions.')
      : missing('config', '100ms configuration', configMissing, providerFailure || (providerIssues.length
        ? 'The 100ms API is reachable, but the selected template or its role permissions need correction.'
        : 'Add the missing server secrets, then verify the real 100ms template and its role permissions.')),
    recordingReady
      ? ready('recording', 'Recording', 'The real template exposes an HLS destination with VOD or single-file-per-layer recording, and the explicit recording declaration is enabled. A live test recording is still required below.')
      : missing('recording', 'Recording', recordingMissing, 'Recording readiness requires the real 100ms template configuration; environment flags alone are not sufficient.'),
    webhookReady
      ? ready('webhook', 'Webhook', 'A real hls.recording.success event was authenticated and processed. Keep the provider secret header private.')
      : missing('webhook', 'Webhook', webhookMissing, webhookEvidenceError
        ? 'Could not verify webhook evidence in the protected database.'
        : 'The secret alone is not proof of a working webhook. Deliver and process a real HLS recording event from 100ms.'),
    storageReady
      ? ready('storage', 'Storage', 'A completed recording exists and 100ms returned a short-lived HTTPS playback URL. The URL itself was not returned to the browser.')
      : missing('storage', 'Storage', storageMissing, 'Storage remains unverified until a completed test recording and a successful protected playback-link check exist.'),
  ]

  return jsonResponse(req, { checks, checkedAt: new Date().toISOString() })
})
