import fs from 'fs';
import path from 'path';

export default async function adminRoutes(fastify, options) {
  const supabase = fastify.supabase;
  const logFile = path.join(process.cwd(), 'app.log');

  // Logs endpoint
  fastify.get('/logs', async (request, reply) => {
    try {
      if (!fs.existsSync(logFile)) {
        return { logs: ['Log file not found or still empty.'] };
      }
      // Quick way to get last ~150 lines without crashing on memory
      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.split('\n').filter(Boolean);
      return { logs: lines.slice(-150) };
    } catch (err) {
      return { logs: [`Error reading logs: ${err.message}`] };
    }
  });

  // GET /api/admin/dashboard
  // Returns recent AI rewritten articles and duplicate logs
  fastify.get('/dashboard', async (request, reply) => {
    try {
      const page = parseInt(request.query.page) || 1;
      const limit = parseInt(request.query.limit) || 20;
      const offset = (page - 1) * limit;

      const status = request.query.status;

      // 1. Fetch paginated articles (filtered by status if provided)
      let query = supabase
        .from('articles')
        .select(`
          id, title, title_hook, ai_category, published_at, rewrite_status, is_scraped,
          source:sources(name)
        `, { count: 'exact' });

      if (status && status !== 'all') {
        if (status === 'scraped') {
          query = query.eq('is_scraped', true);
        } else if (status === 'rss') {
          query = query.eq('is_scraped', false);
        } else {
          query = query.eq('rewrite_status', status);
        }
      }

      const { data: recentArticles, count: totalArticles, error: artError } = await query
        .order('published_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (artError) throw artError;

      // 2. Fetch last 50 duplicate logs
      const { data: duplicateLogs, error: logError } = await supabase
        .from('duplicate_logs')
        .select('*')
        .neq('method', 'admin')
        .order('created_at', { ascending: false })
        .limit(50);

      if (logError) throw logError;

      // 3. Queue Stats (pending, completed, failed)
      // Supabase REST doesn't easily do GROUP BY counts in a single query efficiently,
      // so we'll do three quick count queries.
      const { count: pendingCount } = await supabase.from('articles').select('*', { count: 'exact', head: true }).eq('rewrite_status', 'pending');
      const { count: completedCount } = await supabase.from('articles').select('*', { count: 'exact', head: true }).eq('rewrite_status', 'completed');
      const { count: failedCount } = await supabase.from('articles').select('*', { count: 'exact', head: true }).eq('rewrite_status', 'failed');

      // 4. Scrape Stats (RSS vs Scraped)
      const { count: scrapedCount } = await supabase.from('articles').select('*', { count: 'exact', head: true }).eq('is_scraped', true);
      const { count: rssCount } = await supabase.from('articles').select('*', { count: 'exact', head: true }).eq('is_scraped', false);

      const stats = {
        queue: {
          pending: pendingCount || 0,
          completed: completedCount || 0,
          failed: failedCount || 0
        },
        scraper: {
          rssOnly: rssCount || 0,
          scraped: scrapedCount || 0
        },
        duplicates: duplicateLogs.length
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
