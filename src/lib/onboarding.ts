import { supabase } from './supabase'

export type OnboardingSubmission = {
  fullName: string
  email: string
  specialty: string
  goal: string
  selectedPath: string
  processingConsent: boolean
  marketingOptIn: boolean
  sourcePath: string
  website: string
}

export async function submitOnboardingLead(input: OnboardingSubmission): Promise<void> {
  if (!supabase) throw new Error('الخدمة غير متاحة حالياً. حاول مرة أخرى لاحقاً.')
  const { data, error } = await supabase.functions.invoke('onboarding-submit', {
    body: {
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      specialty: input.specialty,
      goal: input.goal,
      selectedPath: input.selectedPath,
      processingConsent: input.processingConsent,
      marketingOptIn: input.marketingOptIn,
      sourcePath: input.sourcePath,
      website: input.website,
    },
  })
  if (error || !data?.ok) {
    const code = typeof data?.error === 'string' ? data.error : ''
    if (code === 'rate_limited') throw new Error('وصلت إلى الحد المؤقت للطلبات. حاول بعد قليل.')
    if (code === 'origin_not_allowed') throw new Error('تعذر التحقق من مصدر الطلب.')
    if (code === 'consent_required') throw new Error('يرجى الموافقة على إشعار الخصوصية للمتابعة.')
    throw new Error('لم نتمكن من حفظ بياناتك الآن. حاول مرة أخرى.')
  }
}
