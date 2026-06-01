export async function sourceRoutes(fastify) {
  /**
   * GET /api/sources
   * List all active news sources.
   */
  fastify.get('/sources', async (request, reply) => {
    const { data, error } = await fastify.supabase
      .from('sources')
      .select('id, name, slug, feed_url, website_url, logo_url, color, category, is_active')
      .eq('is_active', true)
      .order('name');

    if (error) {
      fastify.log.error(`[Sources] Query error: ${error.message}`);
      return reply.status(500).send({ error: 'Failed to fetch sources' });
    }

    return { sources: data || [] };
  });

  /**
   * GET /api/sources/categories
   * List all unique AI categories from articles.
   */
  fastify.get('/sources/categories', async (request, reply) => {
    // Dynamically fetch unique categories that actually exist in recent articles
    const { data, error } = await fastify.supabase
      .from('articles')
      .select('ai_category')
      .not('ai_category', 'is', null)
      .order('published_at', { ascending: false })
      .limit(500);

    if (error) {
      fastify.log.error(`[Sources] Category fetch error: ${error.message}`);
      return reply.status(500).send({ error: 'Failed to fetch categories' });
    }

    // Extract distinct categories
    const categories = [...new Set(data.map(a => a.ai_category))].filter(Boolean);
    
    return { categories };
  });
}
