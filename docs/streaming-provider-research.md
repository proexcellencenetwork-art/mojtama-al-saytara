# Live Learning provider research — 2026-10-04

This is a source-backed discovery note, not a claim that any provider has been provisioned or tested live.

## Cloudflare Stream
- Live ingest uses RTMPS or SRT and supports automatic recording when `recording.mode` is `automatic`; a completed live stream becomes a replayable video. Official docs: https://developers.cloudflare.com/stream/stream-live/start-stream-live/
- Playback can require signed URLs/tokens so the video ID alone does not grant access. Official docs: https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/
- Pricing is based on stored video minutes and delivered minutes; the current pricing page states storage capacity in $5 increments per 1,000 stored minutes and $1 per 1,000 delivered minutes. It also states WebRTC broadcasts cannot currently be recorded. Official docs: https://developers.cloudflare.com/stream/pricing/
- Fit: strong for RTMP/SRT ingest, recording and protected HLS playback, but not sufficient by itself for an in-browser interactive room with camera/mic/screen-share controls and automatic WebRTC recording.

## LiveKit
- Production access tokens must be generated server-side because token signing requires API credentials; tokens specify participant identity and grants. Official docs: https://docs.livekit.io/home/get-started/authentication/
- Egress can record room composites/tracks to MP4 or HLS and requires configured output/storage; managed LiveKit Cloud supports Egress without self-hosting. Official docs: https://docs.livekit.io/transport/media/ingress-egress/egress/
- Fit: strong for interactive WebRTC, but persistent library storage/CDN/signed playback still needs configured object storage and an authorization layer.

## 100ms
- HLS streaming can be started from an in-browser room; HLS recording/VOD is configurable. Official docs: https://www.100ms.live/docs/javascript/v2/how-to-guides/record-and-live-stream/hls/hls
- Recordings can use 100ms-managed storage (documented limited 15-day default retention) or customer S3/GCS storage; managed download URLs are pre-signed and their validity is configurable. Official docs: https://www.100ms.live/docs/get-started/v2/get-started/features/recordings/set-up-recording
- Pricing page currently lists included monthly allowances (10,000 conferencing minutes, 10,000 streaming minutes, 300 recording minutes) and pay-as-you-grow rates ($0.004/participant-min conferencing, $0.0012/viewer-min streaming, $0.0135/recording min after allowance). Recheck before enabling because vendor pricing can change. Official docs: https://www.100ms.live/pricing
- Fit: promising single-vendor browser conferencing + live HLS + recording; production security still requires server-issued scoped tokens, role configuration, an authorized playback-link flow, and archival storage beyond the managed retention window.

## Mux
- Mux live streams support signed playback policies as well as public/DRM policies. Official API docs: https://www.mux.com/docs/api-reference/video/live-streams/create-live-stream
- Fit: strong for live ingest/recording/CDN playback and signed asset delivery, but would need a separate real-time WebRTC conferencing provider for the requested interactive host controls.

## Current implementation status
No new provider account, paid plan, API key, room, live input, recording, or video has been created. No media service has been integrated into production. Service selection and live E2E remain gated on the actual access and configuration needed to test end-to-end.


## Integration feasibility notes — verified from official docs on 2026-10-04
- `@100mslive/react-sdk` latest npm metadata (0.13.3) declares peer React `>=16.8 <19.0.0`, and `@100mslive/roomkit-react` latest (0.6.3) declares React `>=17.0.2 <19.0.0`; this repo is React 19. Do not force-install these wrappers or use a React Prebuilt integration without an explicit compatibility upgrade/test.
- The vendor's framework-independent package `@100mslive/hms-video-store` is the documented core SDK and can be used with plain JS or any UI framework: https://www.100ms.live/docs/javascript/v2/how-to-guides/install-the-sdk/integration and https://www.100ms.live/docs/javascript/v2/quickstart/javascript-quickstart . This is the compatible integration path to prototype; still require a browser/provider E2E.
- 100ms app-auth tokens are intended to be generated server-side with app_access_key + app_secret, room_id, role and user_id; the secret must not be in browser code: https://www.100ms.live/docs/get-started/v2/get-started/security-and-tokens .
- Server room creation uses `POST https://api.100ms.live/v2/rooms`, `template_id`, and can inherit template recording settings when `recording_info` is omitted: https://www.100ms.live/docs/server-side/v2/api-reference/Rooms/create-via-api . Room names are case-insensitive and reusing a name updates/reuses the room, so the app must use a stable per-workshop name and validate the returned mapping.
- HLS can be started through `hmsActions.startHLSStreaming()` once template destinations are configured. `recording: { singleFilePerLayer: true, hlsVod: false }` requests MP4 assets; room template must enable the appropriate HLS recording mode. HLS can be stopped with `stopHLSStreaming()`: https://www.100ms.live/docs/javascript/v2/how-to-guides/record-and-live-stream/hls/hls .
- `hls.recording.success` webhooks include a recording path/presigned URL, but durable archive requires configured customer storage (S3/GCS); 100ms managed storage defaults to limited 15-day retention. Never persist or publish webhook presigned links as permanent library URLs: https://www.100ms.live/docs/server-side/v2/how-to-guides/configure-webhooks/webhook and https://www.100ms.live/docs/get-started/v2/get-started/features/recordings/set-up-recording .
- Recording assets have API identifiers and their own short-lived presigned-link endpoint; asset API documentation: https://www.100ms.live/docs/server-side/v2/api-reference/recording-assets/get-asset and https://www.100ms.live/docs/server-side/v2/api-reference/recording-assets/get-presigned-url . For long-term customer S3 playback, the returned HLS manifest link may not itself be directly playable; design must respect the configured VOD format/storage rather than assume a durable URL.
- These are documentation facts, not a provisioned/tested 100ms workspace, account, template, recording, or production integration. No media resources have been created.
