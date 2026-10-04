import { useEffect, useRef } from 'react'
import { turnstileSiteKey } from '../lib/turnstile-config'

type TurnstileRenderOptions = {
  sitekey: string
  theme?: 'auto' | 'light' | 'dark'
  callback: (token: string) => void
  'expired-callback'?: () => void
  'error-callback'?: () => void
}

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string
  reset: (widgetId?: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const scriptUrl = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let scriptPromise: Promise<void> | null = null

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(`script[src="${scriptUrl}"]`)
    const onLoad = () => window.turnstile ? resolve() : reject(new Error('Turnstile did not initialize'))
    const onError = () => {
      scriptPromise = null
      reject(new Error('Turnstile script failed to load'))
    }

    if (!script) {
      script = document.createElement('script')
      script.src = scriptUrl
      script.async = true
      script.defer = true
      script.addEventListener('load', onLoad, { once: true })
      script.addEventListener('error', onError, { once: true })
      document.head.append(script)
      return
    }

    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener('error', onError, { once: true })
  })

  return scriptPromise
}

type TurnstileChallengeProps = {
  onToken: (token: string) => void
  resetKey: number
}

export function TurnstileChallenge({ onToken, resetKey }: TurnstileChallengeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | undefined>(undefined)
  const onTokenRef = useRef(onToken)

  useEffect(() => {
    onTokenRef.current = onToken
  }, [onToken])

  useEffect(() => {
    if (!turnstileSiteKey || !containerRef.current) return
    let active = true

    void loadTurnstile().then(() => {
      if (!active || !containerRef.current || !window.turnstile) return
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: turnstileSiteKey,
        theme: 'auto',
        callback: token => onTokenRef.current(token),
        'expired-callback': () => onTokenRef.current(''),
        'error-callback': () => onTokenRef.current(''),
      })
    }).catch(() => onTokenRef.current(''))

    return () => {
      active = false
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = undefined
      }
    }
  }, [])

  useEffect(() => {
    if (resetKey > 0 && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current)
    }
  }, [resetKey])

  if (!turnstileSiteKey) return null

  return <div className="auth-turnstile" style={{ display: 'grid', justifyItems: 'center', gap: 6, maxWidth: '100%', margin: '8px 0' }}>
    <div ref={containerRef}/>
    <small>أكمل التحقق الأمني قبل المتابعة.</small>
  </div>
}
