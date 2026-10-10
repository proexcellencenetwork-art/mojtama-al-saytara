import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const pipeline = JSON.parse(await readFile(resolve(projectRoot, 'src/content/editorial-pipeline.json'), 'utf8'))
const issues = []
const requiredStrings = [
  'id', 'title', 'slug', 'excerpt', 'content_body', 'tiktok_hook', 'tiktok_30s', 'tiktok_60s',
  'caption', 'linkedin_post', 'x_post', 'video_concept', 'cta', 'last_checked',
]

if (!Array.isArray(pipeline.articles) || pipeline.articles.length < 10) {
  issues.push('The editorial pipeline must contain at least 10 published-ready articles.')
}

const slugs = new Set()
for (const [index, article] of (pipeline.articles ?? []).entries()) {
  const location = `Article ${index + 1}`
  if (!article || typeof article !== 'object' || Array.isArray(article)) {
    issues.push(`${location} is not an object.`)
    continue
  }

  for (const key of requiredStrings) {
    if (typeof article[key] !== 'string' || !article[key].trim()) issues.push(`${location} is missing ${key}.`)
  }
  if (typeof article.slug === 'string') {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)) issues.push(`${location} has an invalid slug: ${article.slug}.`)
    if (slugs.has(article.slug)) issues.push(`${location} duplicates slug: ${article.slug}.`)
    slugs.add(article.slug)
  }
  if (typeof article.last_checked === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(article.last_checked)) issues.push(`${location} has an invalid last_checked date.`)
  if (!Array.isArray(article.hashtags) || article.hashtags.length < 2 || article.hashtags.some(item => typeof item !== 'string' || !item.startsWith('#'))) issues.push(`${location} needs at least two hashtags.`)
  if (!Array.isArray(article.x_thread) || article.x_thread.length < 2 || article.x_thread.some(item => typeof item !== 'string' || !item.trim())) issues.push(`${location} needs a usable X thread.`)
  if (!Array.isArray(article.sources) || article.sources.length < 1) {
    issues.push(`${location} needs at least one source.`)
  } else {
    article.sources.forEach((source, sourceIndex) => {
      if (!source || typeof source !== 'object' || Array.isArray(source)) {
        issues.push(`${location} source ${sourceIndex + 1} is invalid.`)
        return
      }
      for (const key of ['title', 'organization', 'url', 'date_or_year', 'use']) {
        if (typeof source[key] !== 'string' || !source[key].trim()) issues.push(`${location} source ${sourceIndex + 1} is missing ${key}.`)
      }
      if (typeof source.url === 'string') {
        try {
          if (new URL(source.url).protocol !== 'https:') issues.push(`${location} source ${sourceIndex + 1} must use HTTPS.`)
        } catch {
          issues.push(`${location} source ${sourceIndex + 1} has an invalid URL.`)
        }
      }
    })
  }
}

const requiredHealthcareArticles = [
  'healthcare-classification-registration',
  'healthcare-cpd-plan',
  'saudi-board-readiness',
  'health-informatics-transition',
]
for (const slug of requiredHealthcareArticles) {
  const article = (pipeline.articles ?? []).find(item => item?.slug === slug)
  if (!article) {
    issues.push(`Missing required Saudi healthcare article: ${slug}.`)
    continue
  }
  if (!Array.isArray(article.sources) || !article.sources.some(source => {
    try { return new URL(source.url).hostname === 'scfhs.org.sa' } catch { return false }
  })) issues.push(`Healthcare article ${slug} must cite an official SCFHS source.`)
}

if (issues.length) {
  console.error(`Editorial pipeline validation failed with ${issues.length} issue(s):\n- ${issues.join('\n- ')}`)
  process.exitCode = 1
} else {
  console.log(`Editorial pipeline validation passed: ${pipeline.articles.length} source-backed articles with social derivatives.`)
}
