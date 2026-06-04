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

      // 2.5 Fetch unresolved system alerts
      const { data: systemAlerts, error: alertError } = await supabase
        .from('system_alerts')
        .select('*, source:sources(name)')
        .eq('is_resolved', false)
        .order('created_at', { ascending: false });
        
      if (alertError) throw alertError;

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
        duplicateLogs: duplicateLogs || [],
        systemAlerts: systemAlerts || []
      };
    } catch (err) {
      fastify.log.error(`[AdminAPI] Error fetching dashboard data: ${err.message}`);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/admin/cron-runs
  fastify.get('/cron-runs', async (request, reply) => {
    try {
      const { data, error } = await supabase
        .from('cron_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);
        
      if (error) throw error;
      return { runs: data || [] };
    } catch (err) {
      fastify.log.error(`[AdminAPI] Error fetching cron runs: ${err.message}`);
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

  // POST /api/admin/alerts/:id/resolve
  fastify.post('/alerts/:id/resolve', async (request, reply) => {
    try {
      const { id } = request.params;
      const { error } = await supabase.from('system_alerts').update({ is_resolved: true }).eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      fastify.log.error(`[AdminAPI] Error resolving alert: ${err.message}`);
      return reply.code(500).send({ error: 'Failed to resolve alert' });
    }
  });

  // GET /api/admin/sources/:id/articles
  fastify.get('/sources/:id/articles', async (request, reply) => {
    try {
      const { id } = request.params;
      const { data, error } = await supabase
        .from('articles')
        .select('id, title, title_hook, is_scraped, fetched_at, rewritten_at, rewrite_status')
        .eq('source_id', id)
        .order('rewritten_at', { ascending: false, nullsFirst: false })
        .limit(50);

      if (error) throw error;
      return { articles: data || [] };
    } catch (err) {
      fastify.log.error(`[AdminAPI] Error fetching source articles: ${err.message}`);
      return reply.code(500).send({ error: 'Failed to fetch source articles' });
    }
  });
  // GET /api/admin/sources
  // Returns telemetry and health metrics for each news source
  fastify.get('/sources', async (request, reply) => {
    try {
      const { data: sources, error: sourcesError } = await supabase.from('sources').select('*');
      if (sourcesError) throw sourcesError;

      const sourceMetrics = await Promise.all(sources.map(async (source) => {
        // Total articles
        const { count: totalArticles } = await supabase
          .from('articles')
          .select('*', { count: 'exact', head: true })
          .eq('source_id', source.id);

        // Articles today
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: articlesToday } = await supabase
          .from('articles')
          .select('*', { count: 'exact', head: true })
          .eq('source_id', source.id)
          .gte('fetched_at', yesterday);

        // Last fetch time
        const { data: latestArticle } = await supabase
          .from('articles')
          .select('fetched_at')
          .eq('source_id', source.id)
          .order('fetched_at', { ascending: false })
          .limit(1);

        const last_fetch_time = latestArticle && latestArticle.length > 0 ? latestArticle[0].fetched_at : null;

        // Determine status
        let status = 'inactive';
        if (source.is_active) {
          if (articlesToday > 0) status = 'healthy';
          else if (last_fetch_time && new Date(last_fetch_time) > new Date(Date.now() - 48 * 60 * 60 * 1000)) status = 'stale';
          else status = 'failing';
        }

        return {
          ...source,
          total_articles: totalArticles || 0,
          articles_today: articlesToday || 0,
          last_fetch_time,
          status
        };
      }));

      // Sort by status and then name
      sourceMetrics.sort((a, b) => {
        if (a.status === 'failing' && b.status !== 'failing') return -1;
        if (a.status !== 'failing' && b.status === 'failing') return 1;
        return a.name.localeCompare(b.name);
      });

      return { sources: sourceMetrics };
    } catch (err) {
      fastify.log.error(`[AdminAPI] Error fetching sources: ${err.message}`);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
