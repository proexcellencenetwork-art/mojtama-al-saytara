import { supabase } from './supabase'

export type SiteEventName = 'page_view' | 'tool_start' | 'tool_complete' | 'register_view' | 'workshop_view' | 'cta_click'

const CONSENT_KEY = 'saytara-analytics-consent'
const VISITOR_KEY = 'saytara-analytics-visitor'

export function hasAnalyticsConsent(): boolean {
  try { return localStorage.getItem(CONSENT_KEY) === 'accepted' } catch { return false }
}

export function setAnalyticsConsent(accepted: boolean): void {
  try { localStorage.setItem(CONSENT_KEY, accepted ? 'accepted' : 'declined') } catch { /* Consent still applies for this session. */ }
  window.dispatchEvent(new CustomEvent('saytara-analytics-consent', { detail: accepted ? 'accepted' : 'declined' }))
}

function getVisitorId(): string | null {
  try {
    let id = localStorage.getItem(VISITOR_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(VISITOR_KEY, id)
    }
    return id
  } catch { return null }
}

function getDeviceCategory(): 'mobile' | 'tablet' | 'desktop' | 'unknown' {
  if (typeof window === 'undefined') return 'unknown'
  const width = window.innerWidth
  return width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop'
}

export async function trackSiteEvent(eventName: SiteEventName, pagePath: string, eventLabel?: string): Promise<void> {
  if (!supabase || !hasAnalyticsConsent()) return
  const visitorId = getVisitorId()
  if (!visitorId) return
  let referrerHost: string | null = null
  try { if (document.referrer) referrerHost = new URL(document.referrer).hostname.slice(0, 160) } catch { /* Ignore invalid referrer. */ }
  const params = new URLSearchParams(window.location.search)
  const timezone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null } catch { return null } })()
  try {
    await supabase.rpc('record_site_analytics_event', {
      p_event_name: eventName,
      p_page_path: pagePath.slice(0, 300),
      p_visitor_id: visitorId,
      p_event_label: eventLabel?.slice(0, 160) || null,
      p_referrer_host: referrerHost,
      p_source: params.get('utm_source')?.slice(0, 120) || null,
      p_medium: params.get('utm_medium')?.slice(0, 120) || null,
      p_campaign: params.get('utm_campaign')?.slice(0, 160) || null,
      p_timezone: timezone,
      p_locale: navigator.language?.slice(0, 24) || null,
      p_device_category: getDeviceCategory(),
    })
  } catch { /* Analytics must never block product functionality. */ }
}

export function getAnalyticsConsent(): 'accepted' | 'declined' | 'unset' {
  try {
    const value = localStorage.getItem(CONSENT_KEY)
    return value === 'accepted' || value === 'declined' ? value : 'unset'
  } catch { return 'unset' }
}
