import { triggerManualRefresh } from '../jobs/refreshFeeds.js';

export async function articleRoutes(fastify) {
  /**
   * GET /api/articles
   * Paginated feed of AI-rewritten articles.
   * Query params: page, limit, category, source
   */
  fastify.get('/articles', async (request, reply) => {
    const {
      page = 1,
      limit = 20,
      category = 'all',
      source = 'all',
      guest_id = null
    } = request.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    // 1. Fetch guest preferences if guest_id is provided
    let preferredCategories = [];
    if (guest_id && category === 'all') {
      const { data: prefs } = await fastify.supabase
        .from('guest_preferences')
        .select('category, score')
        .eq('guest_id', guest_id)
        .order('score', { ascending: false })
        .limit(3);
        
      if (prefs && prefs.length > 0) {
        preferredCategories = prefs.map(p => p.category);
      }
    }

    // 2. Build base query — only fetch completed rewrites
    let query = fastify.supabase
      .from('articles')
      .select(`
        id,
        title_hook,
        deep_dive_content,
        read_time,
        image_url,
        ai_category,
        ai_tags,
        published_at,
        url,
        source_id,
        sources!inner (
          name,
          slug,
          logo_url,
          color
        )
      `, { count: 'exact' })
      .eq('rewrite_status', 'completed')
      .not('title_hook', 'is', null);

    // Apply sorting logic
    if (preferredCategories.length > 0) {
      // If we have preferences, we order by matching categories first, THEN by published_at.
      // Supabase REST API doesn't easily support dynamic CASE WHEN sorting in a simple query, 
      // but we can pull a slightly larger dataset, sort in memory, and paginate.
      // For this MVP, we will fetch up to 100 recent articles and sort them.
      query = query
        .order('published_at', { ascending: false })
        .limit(100);
    } else {
      // Standard chronological sorting
      query = query
        .order('published_at', { ascending: false })
        .range(offset, offset + limitNum - 1);
    }

    // Filter by AI category
    if (category !== 'all') {
      query = query.ilike('ai_category', category);
    }

    // Filter by source slug
    if (source !== 'all') {
      query = query.eq('sources.slug', source);
    }

    const { data, error, count } = await query;

    if (error) {
      fastify.log.error(`[Articles] Query error: ${error.message}`);
      return reply.status(500).send({ error: 'Failed to fetch articles' });
    }

    // 3. Algorithmic sorting for personalized feed
    let finalData = data || [];
    let totalCount = count || (data ? data.length : 0);

    if (preferredCategories.length > 0 && category === 'all') {
      // Split into preferred and general
      const preferred = finalData.filter(a => preferredCategories.includes(a.ai_category));
      const general = finalData.filter(a => !preferredCategories.includes(a.ai_category));
      
      // Mix them (e.g. 2 preferred, then 1 general)
      const mixed = [];
      let pIdx = 0, gIdx = 0;
      while (pIdx < preferred.length || gIdx < general.length) {
        if (pIdx < preferred.length) mixed.push(preferred[pIdx++]);
        if (pIdx < preferred.length) mixed.push(preferred[pIdx++]); // 2x weight
        if (gIdx < general.length) mixed.push(general[gIdx++]);
      }
      
      // Apply pagination manually
      finalData = mixed.slice(offset, offset + limitNum);
    }

    // Reshape the response
    const articles = finalData.map(article => ({
      id: article.id,
      title_hook: article.title_hook,
      deep_dive_content: article.deep_dive_content,
      read_time: article.read_time,
      image_url: article.image_url,
      ai_category: article.ai_category,
      ai_tags: article.ai_tags,
      published_at: article.published_at,
      original_url: article.url,
      source: article.sources ? {
        name: article.sources.name,
        slug: article.sources.slug,
        logo_url: article.sources.logo_url,
        color: article.sources.color
      } : null
    }));

    return {
      articles,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        has_more: offset + limitNum < totalCount
      }
    };
  });

  /**
   * POST /api/interactions
   * Record a user interaction to build their preference profile.
   */
  fastify.post('/interactions', async (request, reply) => {
    const { guest_id, category, action } = request.body || {};
    
    if (!guest_id || !category) {
      return reply.status(400).send({ error: 'guest_id and category are required' });
    }

    try {
      // 1. Ensure guest profile exists
      await fastify.supabase
        .from('guest_profiles')
        .upsert({ id: guest_id, last_active: new Date().toISOString() }, { onConflict: 'id' });

      // 2. Fetch existing score
      const { data: existing } = await fastify.supabase
        .from('guest_preferences')
        .select('score')
        .eq('guest_id', guest_id)
        .eq('category', category)
        .single();

      const newScore = (existing?.score || 0) + (action === 'share' ? 3 : 1);

      // 3. Upsert new score
      await fastify.supabase
        .from('guest_preferences')
        .upsert({
          guest_id,
          category,
          score: newScore,
          updated_at: new Date().toISOString()
        }, { onConflict: 'guest_id,category' });

      return { success: true };
    } catch (err) {
      fastify.log.error(`[Interactions] Error tracking preference: ${err.message}`);
      return reply.status(500).send({ error: 'Failed to track interaction' });
    }
  });

  /**
   * GET /api/articles/:id
   * Single article with full deep dive content.
   */
  fastify.get('/articles/:id', async (request, reply) => {
    const { id } = request.params;

    const { data, error } = await fastify.supabase
      .from('articles')
      .select(`
        id,
        title_hook,
        deep_dive_content,
        read_time,
        image_url,
        ai_category,
        ai_tags,
        published_at,
        url,
        sources!inner (
          name,
          slug,
          logo_url,
          color
        )
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return reply.status(404).send({ error: 'Article not found' });
    }

    return {
      id: data.id,
      title_hook: data.title_hook,
      deep_dive_content: data.deep_dive_content,
      read_time: data.read_time,
      image_url: data.image_url,
      ai_category: data.ai_category,
      ai_tags: data.ai_tags,
      original_url: data.url,
      published_at: data.published_at,
      source: data.sources ? {
        name: data.sources.name,
        slug: data.sources.slug,
        logo_url: data.sources.logo_url,
        color: data.sources.color
      } : null
    };
  });

  /**
   * POST /api/refresh
   * Manually trigger a feed refresh cycle.
   */
  fastify.post('/refresh', async (request, reply) => {
    // Fire and forget — don't block the response
    triggerManualRefresh(fastify).catch(err => {
      fastify.log.error(`[Refresh] Manual refresh failed: ${err.message}`);
    });

    return { status: 'refresh_started', message: 'Feed refresh triggered. New articles will appear shortly.' };
  });
}
