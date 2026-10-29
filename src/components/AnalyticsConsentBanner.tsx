import { useEffect, useState } from 'react'
import { ShieldCheck, X } from 'lucide-react'
import { getAnalyticsConsent, resetAnalyticsConsent, setAnalyticsConsent } from '../lib/analytics'
import { supabase } from '../lib/supabase'
import './AnalyticsConsentBanner.css'

export function AnalyticsConsentBanner() {
  const [consent, setConsent] = useState<'accepted'|'declined'|'unset'>(() => getAnalyticsConsent())
  useEffect(() => {
    const sync = () => setConsent(getAnalyticsConsent())
    window.addEventListener('saytara-analytics-consent', sync)
    return () => window.removeEventListener('saytara-analytics-consent', sync)
  }, [])
  if (!supabase || consent !== 'unset') return null
  return <aside className="analytics-consent-banner" dir="rtl" aria-label="إعدادات التحليلات"><div className="analytics-consent-icon"><ShieldCheck size={20}/></div><div className="analytics-consent-copy"><b>ساعدنا نحسّن مجتمع السيطرة</b><p>يمكنك السماح بقياس مشاهدات الصفحات واستخدام الأدوات ومصدر الزيارة بشكل محدود. لا نجمع إجابات الأدوات أو نصوص النماذج. المدينة والدولة لا تُستنتجان من المنطقة الزمنية.</p><a href="/mojtama-al-saytara/privacy/">اقرأ سياسة الخصوصية</a></div><div className="analytics-consent-actions"><button type="button" className="btn btn-primary btn-small" onClick={() => setAnalyticsConsent(true)}>موافقة</button><button type="button" className="btn btn-outline btn-small" onClick={() => setAnalyticsConsent(false)}><X size={14}/> رفض</button></div></aside>
}

export function AnalyticsConsentSettingsButton() {
  return <button className="btn btn-outline btn-small analytics-consent-reset" type="button" onClick={resetAnalyticsConsent}>تغيير تفضيل التحليلات</button>
}
