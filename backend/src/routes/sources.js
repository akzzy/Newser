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
    // For performance, we can just return the hardcoded list of valid AI categories,
    // or query distinct categories. Hardcoded is extremely fast and reliable.
    const categories = [
      "Technology",
      "Science",
      "Business",
      "Culture",
      "Entertainment",
      "Politics",
      "Health",
      "Gaming",
      "Auto",
      "General"
    ];
    
    return { categories };
  });
}
