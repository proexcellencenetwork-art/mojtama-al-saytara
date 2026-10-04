type EditorialArticle = {
  id: string
  title: string
  slug: string
  excerpt: string
  content_body: string
  last_checked: string
}

type EditorialPipeline = { articles?: unknown }
type PublicEditorialRow = Record<string, unknown>

function isEditorialArticle(value: unknown): value is EditorialArticle {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return ['id', 'title', 'slug', 'excerpt', 'content_body', 'last_checked'].every(key => typeof row[key] === 'string' && row[key].trim())
}

async function editorialArticles(): Promise<EditorialArticle[]> {
  const module = await import('../content/editorial-pipeline.json')
  const pipeline = module.default as EditorialPipeline
  return Array.isArray(pipeline.articles) ? pipeline.articles.filter(isEditorialArticle) : []
}

function publicRow(article: EditorialArticle): PublicEditorialRow {
  const publishedAt = /^\d{4}-\d{2}-\d{2}$/.test(article.last_checked) ? `${article.last_checked}T00:00:00.000Z` : null
  return {
    id: `editorial-${article.id}`,
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    body: article.content_body,
    published_at: publishedAt,
    source: 'editorial-pipeline',
  }
}

export async function listEditorialArticleRows(): Promise<PublicEditorialRow[]> {
  return (await editorialArticles()).map(publicRow)
}

export async function findEditorialArticleRow(slug: string): Promise<PublicEditorialRow | null> {
  const article = (await editorialArticles()).find(item => item.slug === slug)
  return article ? publicRow(article) : null
}
