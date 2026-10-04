export type CompassInput = {
  stage: string
  specialty: string
  experience: string
  currentField: string
  targetField: string
  goal: string
  challenge: string
  skills: string
  targetSkills: string
  evidence: string
}

export type CompassReport = {
  position: string
  marketDirection: string
  skillGaps: string[]
  directions: string[]
  next90Days: string[]
  next12Months: string[]
  positioningStatement: string
}

const splitSkills = (value: string) => value.split(/[,،;؛\n]+/).map(item => item.trim()).filter(Boolean)
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ar').replace(/[\u064B-\u065F\u0670]/g, '').replace(/\s+/g, ' ').trim()

export function assessCompass(input: CompassInput): { missing: string[]; report: CompassReport | null } {
  const required: [keyof CompassInput, string][] = [
    ['stage', 'المرحلة المهنية'], ['specialty', 'التخصص'], ['experience', 'سنوات الخبرة'],
    ['currentField', 'المجال الحالي'], ['targetField', 'المجال المستهدف'], ['goal', 'الهدف'],
    ['challenge', 'التحدي الحالي'], ['skills', 'المهارات الحالية'], ['targetSkills', 'المهارات المستهدفة'], ['evidence', 'مثال على دليل إنجاز'],
  ]
  const missing = required.filter(([key]) => !input[key].trim()).map(([, label]) => label)
  const experience = Number(input.experience)
  if (input.experience.trim() && (!Number.isFinite(experience) || experience < 0 || experience > 80)) missing.push('سنوات خبرة صحيحة (0–80)')
  if (missing.length) return { missing, report: null }

  const currentSkills = new Set(splitSkills(input.skills).map(normalize))
  const skillGaps = splitSkills(input.targetSkills).filter(skill => !currentSkills.has(normalize(skill)))
  const target = input.targetField.trim()
  const specialty = input.specialty.trim()
  const experienceLabel = experience === 1 ? 'سنة خبرة' : 'سنوات خبرة'
  const gapSummary = skillGaps.length ? skillGaps.slice(0, 3).join('، ') : 'تجربة تطبيقية أعمق على المهارات المستهدفة'
  return {
    missing,
    report: {
      position: `${input.stage.trim()} · ${specialty} · ${input.currentField.trim()} · ${experience} ${experienceLabel}`,
      marketDirection: `المجال الذي اخترت اختباره هو «${target}». هذه الأداة لا تتنبأ بالطلب أو الرواتب؛ تحقّق من الإعلانات الرسمية والجهات المهنية ومصدر رادار السوق، ثم اسأل ممارساً يعمل في الدور.`,
      skillGaps: skillGaps.length ? skillGaps : ['لم يظهر فرق نصي بين القائمتين؛ اختر مستوى الكفاءة والدليل المطلوب لكل مهارة قبل اعتبارها مكتملة.'],
      directions: [
        `تعمّق في دورك الحالي عبر ${specialty} مع تجربة محدودة مرتبطة بهدفك: ${input.goal.trim()}.`,
        `اختبر جسراً قريباً من خبرتك الحالية إلى ${target} بمشروع أو مهمة قصيرة قبل اتخاذ انتقال كبير.`,
        `تحقّق من مسار مباشر إلى ${target} عبر مقابلات مهنية ومتطلبات الوظائف الفعلية، لا عبر المسمّى وحده.`,
      ],
      next90Days: [
        `الأيام 1–30: تحدث مع 3 ممارسين في «${target}»، وسجّل المتطلبات المتكررة ومصدر كل ملاحظة.`,
        `الأيام 31–60: اختر مهارة واحدة ذات فجوة («${gapSummary}») وأنجز تجربة عملية صغيرة بحدود واضحة.`,
        `الأيام 61–90: وثّق النتيجة والدليل، واطلب ملاحظات من شخص خبير، ثم قرر: استمر، عدّل الاتجاه، أو أوقف التجربة.`,
      ],
      next12Months: [
        'الأشهر 1–3: استكشاف موثق وتجربة منخفضة المخاطر.',
        'الأشهر 4–6: بناء كفاءة واحدة مطلوبة وإظهارها في مشروع قابل للشرح.',
        'الأشهر 7–9: توسيع المسؤولية أو الخبرة عبر فرصة حقيقية ومحددة.',
        'الأشهر 10–12: مراجعة الأدلة والظروف والموارد؛ لا تتخذ قرار انتقال قبل اختبار ملاءمته لك.',
      ],
      positioningStatement: `أساعد ${target} على التقدم في ${input.goal.trim()} عبر خبرتي في ${specialty} ومهاراتي في ${splitSkills(input.skills).slice(0, 3).join('، ')}؛ والدليل الذي أستند إليه هو: ${input.evidence.trim()}.`,
    },
  }
}

export type ScoreItem = { id: string; label: string; fix: string; value: number | null }
export type ScoreResult = { score: number; priorities: ScoreItem[]; actionPlan: string[] } | null

export function scoreLinkedInAudit(items: ScoreItem[]): ScoreResult {
  if (items.length === 0 || items.some(item => item.value === null || item.value < 1 || item.value > 5)) return null
  const total = items.reduce((sum, item) => sum + (item.value ?? 0), 0)
  const score = Math.round(((total - items.length) / (items.length * 4)) * 100)
  const priorities = [...items].sort((a, b) => (a.value ?? 0) - (b.value ?? 0)).slice(0, 3)
  return {
    score,
    priorities,
    actionPlan: priorities.map((item, index) => `الأسبوع ${index + 1}: ${item.fix}`),
  }
}

export type ReadinessItem = { id: string; label: string; prompt: string; value: number | null }
export type ReadinessResult = { score: number; evidenceGaps: ReadinessItem[]; interpretation: string; nextSteps: string[] } | null

export function scorePromotionReadiness(items: ReadinessItem[]): ReadinessResult {
  if (items.length === 0 || items.some(item => item.value === null || item.value < 0 || item.value > 3)) return null
  const total = items.reduce((sum, item) => sum + (item.value ?? 0), 0)
  const score = Math.round((total / (items.length * 3)) * 100)
  const evidenceGaps = [...items].sort((a, b) => (a.value ?? 0) - (b.value ?? 0)).slice(0, 3)
  const interpretation = score >= 80
    ? 'الأدلة التي أدخلتها تبدو مكتملة نسبياً؛ هذا ليس ضماناً للترقية. تحقّق من معايير الجهة واطلب موعداً مهنياً لمراجعة التوقعات.'
    : score >= 55
      ? 'توجد مؤشرات جيدة مع فجوات قابلة للمعالجة. ابنِ دليلاً على مسؤوليات المستوى التالي قبل طلب قرار.'
      : 'ابدأ بتوضيح معايير المستوى التالي، ثم اتفق مع مديرك على مسؤولية قابلة للقياس ومراجعة بموعد محدد.'
  return {
    score,
    evidenceGaps,
    interpretation,
    nextSteps: evidenceGaps.map((item, index) => `الخطوة ${index + 1}: ${item.prompt}`),
  }
}

export function buildPositioningStatement(values: { audience: string; problem: string; capability: string; proof: string; direction: string }): string {
  const { audience, problem, capability, proof, direction } = values
  if (![audience, problem, capability, proof, direction].every(value => value.trim())) return ''
  return `أدعم ${audience.trim()} في معالجة ${problem.trim()} عبر ${capability.trim()}، مستنداً إلى ${proof.trim()}، وأتجه إلى ${direction.trim()}.`
}
