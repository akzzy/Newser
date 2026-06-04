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
      sort = 'foryou',
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
        importance_score,
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

    if (sort === 'foryou' && preferredCategories.length > 0 && category === 'all' && source === 'all') {
      // ── 60/40 BLENDED CHRONOLOGICAL FEED ──
      // User wants exactly 60% explicit interests and 40% related interests, sorted by time.
      const normalizeCat = (c) => {
        let n = c.toLowerCase().trim();
        if (n === 'startup') return 'startups';
        if (n === 'auto') return 'automotive';
        if (n === 'tech') return 'technology';
        return n;
      };
      
      const SIMILARITY_MAP = {
        'ai': ['software', 'hardware', 'startups'],
        'mobile': ['hardware', 'software', 'technology'],
        'startups': ['business', 'technology', 'finance'],
        'gaming': ['entertainment', 'software', 'hardware'],
        'science': ['technology', 'health', 'space'],
        'security': ['software', 'internet', 'technology'],
        'software': ['technology', 'ai', 'internet'],
        'hardware': ['technology', 'mobile', 'gaming'],
        'business': ['finance', 'startups', 'world'],
        'internet': ['software', 'security', 'technology'],
        'automotive': ['technology', 'hardware', 'business'],
        'politics': ['world', 'business', 'finance'],
        'world': ['politics', 'business', 'science'],
        'sports': ['entertainment', 'world', 'culture'],
        'entertainment': ['culture', 'gaming', 'world'],
        'finance': ['business', 'startups', 'politics'],
        'health': ['science', 'world', 'technology'],
        'technology': ['software', 'hardware', 'ai']
      };

      const explicitTargets = [...new Set(preferredCategories.map(normalizeCat))];
      let relatedTargets = [];
      explicitTargets.forEach(cat => {
        const related = SIMILARITY_MAP[cat] || [];
        relatedTargets.push(...related);
      });
      // Filter out any related targets that the user already explicitly requested
      relatedTargets = [...new Set(relatedTargets)].filter(cat => !explicitTargets.includes(cat));

      // Calculate pagination ratios
      const pageNum = Math.floor(offset / limitNum) + 1;
      const explicitLimit = Math.ceil(limitNum * 0.6); // 12
      const relatedLimit = limitNum - explicitLimit;   // 8
      
      const explicitOffset = (pageNum - 1) * explicitLimit;
      const relatedOffset = (pageNum - 1) * relatedLimit;

      const getBaseQuery = () => {
        let q = fastify.supabase
          .from('articles')
          .select(`
            id, title_hook, deep_dive_content, read_time, image_url, ai_category, ai_tags, published_at, url, importance_score, source_id,
            sources!inner ( name, slug, logo_url, color )
          `)
          .eq('rewrite_status', 'completed')
          .not('title_hook', 'is', null);

        const { blocked_sources, blocked_categories } = request.query;
        if (blocked_sources) {
          const bSources = blocked_sources.split(',').map(s => s.trim()).filter(Boolean);
          if (bSources.length > 0) {
            const excludeStr = `(${bSources.map(s => `"${s}"`).join(',')})`;
            q = q.not('sources.slug', 'in', excludeStr);
          }
        }
        if (blocked_categories) {
          const bCats = blocked_categories.split(',').map(s => s.trim()).filter(Boolean);
          if (bCats.length > 0) {
            const excludeStr = `(${bCats.map(s => `"${s}"`).join(',')})`;
            q = q.not('ai_category', 'in', excludeStr);
          }
        }
        return q;
      };

      let queryExplicit = getBaseQuery();
      let queryRelated = getBaseQuery();

      const explicitOr = explicitTargets.map(cat => `ai_category.ilike.%${cat}%`).join(',');
      const relatedOr = relatedTargets.map(cat => `ai_category.ilike.%${cat}%`).join(',');

      // Execute both queries in parallel
      const [explicitResult, relatedResult] = await Promise.all([
        queryExplicit.or(explicitOr).order('published_at', { ascending: false }).range(explicitOffset, explicitOffset + explicitLimit - 1),
        relatedTargets.length > 0 
          ? queryRelated.or(relatedOr).order('published_at', { ascending: false }).range(relatedOffset, relatedOffset + relatedLimit - 1)
          : { data: [], error: null }
      ]);

      if (explicitResult.error) fastify.log.error(`[Articles] Explicit query error: ${explicitResult.error.message}`);
      if (relatedResult.error) fastify.log.error(`[Articles] Related query error: ${relatedResult.error.message}`);

      let combinedData = [...(explicitResult.data || []), ...(relatedResult.data || [])];
      
      // Sort combined strictly chronologically
      combinedData.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

      // Because we use split logic, we just send a mock total count that guarantees pagination continues 
      // as long as we got a full page of data back
      const totalCount = offset + limitNum + (combinedData.length === limitNum ? 1 : 0);
      
      return reply.send({
        articles: combinedData.map(article => ({
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
        })),
        user_interests: preferredCategories,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          has_more: combinedData.length > 0
        }
      });
    }

    // ── STANDARD SORTING FLOW ──
    // 3. Apply sorting and filtering logic for non-foryou feeds
    if (sort === 'trending' || sort === 'top_today') {
      // Pull up to 500 recent articles for deep algorithmic sorting
      query = query
        .order('published_at', { ascending: false })
        .limit(500);
    } else {
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

    // Explicitly exclude blocked sources and categories at DB level
    // ONLY for "For You" feed (handled above). Other feeds ignore these blocks.

    const { data, error, count } = await query;

    if (error) {
      fastify.log.error(`[Articles] Query error: ${error.message}`);
      return reply.status(500).send({ error: 'Failed to fetch articles' });
    }

    // 3. Algorithmic sorting for personalized/trending feeds
    let finalData = data || [];
    let totalCount = count || (data ? data.length : 0);

    if (sort === 'trending') {
      finalData.sort((a, b) => {
        const timeA = (Date.now() - new Date(a.published_at).getTime()) / 3600000;
        const timeB = (Date.now() - new Date(b.published_at).getTime()) / 3600000;
        const scoreA = ((a.importance_score || 1) + Math.random() * 0.5) / Math.pow(timeA + 2, 1.5);
        const scoreB = ((b.importance_score || 1) + Math.random() * 0.5) / Math.pow(timeB + 2, 1.5);
        return scoreB - scoreA;
      });
      finalData = finalData.slice(offset, offset + limitNum);
    } else if (sort === 'top_today') {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      finalData = finalData.filter(a => new Date(a.published_at) >= oneDayAgo);
      
      finalData.sort((a, b) => {
        const impA = a.importance_score || 1;
        const impB = b.importance_score || 1;
        if (impA !== impB) return impB - impA;
        
        const getReadTimeScore = (rt) => rt === 'Long' ? 3 : (rt === 'Medium' ? 2 : 1);
        const rtA = getReadTimeScore(a.read_time);
        const rtB = getReadTimeScore(b.read_time);
        if (rtA !== rtB) return rtB - rtA;

        return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
      });
      finalData = finalData.slice(offset, offset + limitNum);
    }
    // (For You is already handled fully by the DB query now)

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
      user_interests: preferredCategories,
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
    const { guest_id, category, categories, action, score } = request.body || {};
    
    // Support either single category or array of categories (for onboarding bulk insert)
    const categoryList = categories || (category ? [category] : []);

    if (!guest_id || categoryList.length === 0) {
      return reply.status(400).send({ error: 'guest_id and category/categories are required' });
    }

    try {
      // 1. Ensure guest profile exists
      await fastify.supabase
        .from('guest_profiles')
        .upsert({ id: guest_id, last_active: new Date().toISOString() }, { onConflict: 'id' });

      // 2. Prepare data for upsert
      let upsertData = [];
      const timestamp = new Date().toISOString();

      if (categoryList.length > 1 || score !== undefined) {
        // Bulk insert (Onboarding) - just set the score directly
        upsertData = categoryList.map(cat => ({
          guest_id,
          category: cat,
          score: score || 10, // Default to a high score for explicit onboarding choice
          updated_at: timestamp
        }));
      } else {
        // Single interaction (Read/Like/Share) - fetch existing and increment
        const singleCat = categoryList[0];
        const { data: existing } = await fastify.supabase
          .from('guest_preferences')
          .select('score')
          .eq('guest_id', guest_id)
          .eq('category', singleCat)
          .single();

        const newScore = (existing?.score || 0) + (action === 'share' ? 3 : action === 'like' ? 2 : 1);
        upsertData = [{
          guest_id,
          category: singleCat,
          score: newScore,
          updated_at: timestamp
        }];
      }

      // 3. Upsert into database (handles both single and array payloads in one query)
      const { error: upsertErr } = await fastify.supabase
        .from('guest_preferences')
        .upsert(upsertData, { onConflict: 'guest_id,category' });

      if (upsertErr) throw upsertErr;

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
