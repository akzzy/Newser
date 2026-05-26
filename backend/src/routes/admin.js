export default async function adminRoutes(fastify, options) {
  const supabase = fastify.supabase;

  // GET /api/admin/dashboard
  // Returns recent AI rewritten articles and duplicate logs
  fastify.get('/dashboard', async (request, reply) => {
    try {
      const page = parseInt(request.query.page) || 1;
      const limit = parseInt(request.query.limit) || 20;
      const offset = (page - 1) * limit;

      // 1. Fetch paginated successfully rewritten articles
      const { data: recentArticles, count: totalArticles, error: artError } = await supabase
        .from('articles')
        .select(`
          id, title, title_hook, ai_category, published_at,
          source:sources(name)
        `, { count: 'exact' })
        .eq('rewrite_status', 'completed')
        .order('published_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (artError) throw artError;

      // 2. Fetch last 50 duplicate logs (exclude admin manual deletes from the UI)
      const { data: duplicateLogs, error: logError } = await supabase
        .from('duplicate_logs')
        .select('*')
        .neq('method', 'admin')
        .order('created_at', { ascending: false })
        .limit(50);

      if (logError) throw logError;

      // 3. Stats summary
      const stats = {
        total_articles: totalArticles || 0,
        total_recent_duplicates: duplicateLogs.length,
      };

      return {
        stats,
        recentArticles: recentArticles || [],
        duplicateLogs: duplicateLogs || []
      };
    } catch (err) {
      fastify.log.error(`[AdminAPI] Error fetching dashboard data: ${err.message}`);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE /api/admin/articles/:id
  fastify.delete('/articles/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      
      // First, fetch the article's title so we can add it to the exclusion list
      const { data: article } = await supabase.from('articles').select('title').eq('id', id).single();
      
      if (article) {
        // Log it as a manual delete so the background worker doesn't re-ingest it!
        await supabase.from('duplicate_logs').insert({
          dropped_title: article.title,
          matched_title: '[Manual Delete via Admin]',
          method: 'admin',
          score: 1.0
        });
      }

      // Now actually delete it from the articles table
      const { error } = await supabase.from('articles').delete().eq('id', id);
      
      if (error) throw error;
      return { success: true };
    } catch (err) {
      fastify.log.error(`[AdminAPI] Error deleting article: ${err.message}`);
      return reply.code(500).send({ error: 'Failed to delete article' });
    }
  });

  // PUT /api/admin/articles/:id
  fastify.put('/articles/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const { title_hook, deep_dive_content, ai_category } = request.body;
      
      const { error } = await supabase
        .from('articles')
        .update({ title_hook, deep_dive_content, ai_category })
        .eq('id', id);
        
      if (error) throw error;
      return { success: true };
    } catch (err) {
      fastify.log.error(`[AdminAPI] Error updating article: ${err.message}`);
      return reply.code(500).send({ error: 'Failed to update article' });
    }
  });
}
