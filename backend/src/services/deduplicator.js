/**
 * Deduplicator service — hybrid token + AI approach.
 *
 * Fast path: Token-based Jaccard/Containment similarity is used as a pre-filter.
 *   - Score >= 0.50 → definitely a duplicate (skip AI)
 *   - Score 0.20–0.50 → "gray zone" → ask AI model for confirmation
 *   - Score < 0.20 → definitely NOT a duplicate (skip AI)
 *
 * This avoids hand-tuning thresholds and uses AI only for borderline cases,
 * keeping costs minimal while achieving near-perfect accuracy.
 */


// ── Stop words ──
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'in', 'on', 'at', 'to', 'from', 'by', 'for', 'with', 'about', 'against', 'between',
  'into', 'through', 'during', 'before', 'after', 'above', 'below', 'under',
  'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where',
  'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'can', 'will', 'just', 'should', 'now', 'has', 'have', 'had', 'its', 'their', 'this',
  'that', 'these', 'those', 'do', 'does', 'did', 'doing', 'would', 'could', 'might',
  'shall', 'may', 'must', 'need', 'dare', 'ought', 'used', 'get', 'gets', 'got',
  'getting', 'make', 'makes', 'made', 'let', 'us', 'me', 'my', 'we', 'our', 'you',
  'your', 'he', 'she', 'it', 'they', 'him', 'her', 'them', 'his', 'hers', 'theirs',
  'what', 'which', 'who', 'whom', 'whose', 'if', 'unless', 'until', 'while',
  'of', 'up', 'out', 'off', 'over', 'down', 'on', 'no', 'yes',
  'new', 'says', 'said', 'report', 'reports', 'according', 'also', 'still',
  'best', 'last', 'next', 'big', 'top', 'major', 'latest',
  'reveals', 'reveal', 'announces', 'announced',
  'unveiled', 'unveils', 'confirms', 'confirmed', 'shows', 'show',
  'coming', 'goes', 'going', 'like', 'looks', 'look',
  'heres', 'thats', 'whats', 'dont', 'doesnt', 'wont', 'cant', 'isnt',
  'promo', 'codes', 'code', 'coupon', 'coupons', 'discount', 'deal', 'deals',
  'sale', 'sales', 'offer', 'offers', 'save', 'saving', 'savings',
  'memorial', 'day',
  '2024', '2025', '2026', '2027'
]);

const SYNONYMS = {
  'electric': 'ev', 'electrical': 'ev',
  'automotive': 'car', 'auto': 'car', 'vehicle': 'car',
  'motorcycle': 'bike', 'bicycle': 'bike'
};

// ── Thresholds ──
const DEFINITE_DUPLICATE_THRESHOLD = 0.50;  // High confidence — skip AI
const GRAY_ZONE_THRESHOLD = 0.20;            // Below this — definitely not a dup

// ── NVIDIA API Key Helper ──
function getApiKey() {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error('NVIDIA_API_KEY not configured');
  return apiKey;
}

// ── Tokenizer ──
export function tokenize(title) {
  if (!title) return [];
  return title
    .toLowerCase()
    .replace(/'s\b/g, '')
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .map(word => SYNONYMS[word] || word)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word));
}

// ── Token similarity (fast) ──
export function calculateTitleSimilarity(title1, title2) {
  const t1 = tokenize(title1);
  const t2 = tokenize(title2);
  if (t1.length === 0 || t2.length === 0) return 0;

  const set1 = new Set(t1);
  const set2 = new Set(t2);

  let intersection = 0;
  for (const token of set1) {
    if (set2.has(token)) intersection++;
  }

  const jaccard = intersection / new Set([...t1, ...t2]).size;
  const containment = intersection / Math.min(set1.size, set2.size);

  return 0.4 * jaccard + 0.6 * containment;
}

// ── AI duplicate check ──
export async function askAIIfDuplicate(title1, title2) {
  const apiKey = getApiKey();
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'google/gemma-4-31b-it',
          messages: [
            {
              role: 'system',
              content: `You are a news headline deduplication engine.

Given two headlines, decide if they cover the SAME underlying news event or story.

Rules:
- "Same story" means the core news event is identical, even if the headlines emphasize different angles.
- Two articles about "Sennheiser Momentum 5 launch" from different sites = SAME.
- Two articles about "SpaceX Starship V3 first flight" from different sites = SAME.
- "MacBook Pro launch" vs "iPad Pro launch" = DIFFERENT (different products).
- "Google Chromecast updates" vs "Google Wear OS updates" = DIFFERENT (different products).

Respond with ONLY: {"same": true} or {"same": false}`
            },
            {
              role: 'user',
              content: `Headline A: "${title1}"\nHeadline B: "${title2}"`
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0,
          max_tokens: 20,
          chat_template_kwargs: { enable_thinking: true }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        const err = new Error(`API error occurred: Status ${response.status}. Body: ${errorText}`);
        err.statusCode = response.status;
        throw err;
      }

      const result = await response.json();
      const text = result.choices?.[0]?.message?.content?.trim();
      if (!text) return false;

      // Strict delay to respect 40 RPS limit
      await sleep(3000);

    const parsed = JSON.parse(text);
    return parsed.same === true;
  } catch (err) {
    const isRateLimit = err.statusCode === 429 || err.message?.includes('429') || err.message?.includes('rate');
    
    if (isRateLimit && attempt < maxRetries) {
      const waitTime = 10000 * attempt;
      console.log(`[Deduplicator] Rate limited on "${title1.substring(0, 30)}...", retrying in ${waitTime/1000}s`);
      await sleep(waitTime);
      continue;
    }
    console.error(`[Deduplicator] AI check failed: ${err.message}`);
    return false;
  }
}
return false;
}

// ── Sleep helper ──
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if a candidate title is a duplicate of any title in the knownTitles list.
 *
 * Strategy:
 *   - Token score < 0.20 → skip (definitely different)
 *   - Token score >= 0.20 → ask AI for the final call
 *
 * This keeps AI calls minimal (only for pairs with some token overlap)
 * while letting the AI handle all the nuanced decisions.
 *
 * @param {string} candidateTitle - The new article title to check
 * @param {string[]} knownTitles - List of titles already accepted
 * @param {object} logger - Logger instance (optional)
 * @returns {{ isDuplicate: boolean, matchedTitle: string|null, method: string, score: number }}
 */
export async function checkDuplicate(candidateTitle, knownTitles, logger = console) {
  for (const knownTitle of knownTitles) {
    const score = calculateTitleSimilarity(candidateTitle, knownTitle);

    // Fast skip: no meaningful token overlap
    if (score < GRAY_ZONE_THRESHOLD) continue;

    // Fast confirm: almost identical tokens, skip AI and assume duplicate
    if (score >= DEFINITE_DUPLICATE_THRESHOLD) {
      logger.info?.(`[Dedup] Fast confirm (score ${score.toFixed(2)} > ${DEFINITE_DUPLICATE_THRESHOLD}): "${candidateTitle}"`);
      return { isDuplicate: true, matchedTitle: knownTitle, method: 'token', score };
    }

    // Ask AI for the final verdict
    logger.info?.(`[Dedup] Checking (token score: ${score.toFixed(2)}): "${candidateTitle}" ↔ "${knownTitle}"`);
    const aiSaysSame = await askAIIfDuplicate(candidateTitle, knownTitle);

    if (aiSaysSame) {
      logger.info?.(`[Dedup] ✓ AI confirmed duplicate: "${candidateTitle}"`);
      return { isDuplicate: true, matchedTitle: knownTitle, method: 'ai', score };
    } else {
      logger.info?.(`[Dedup] ✗ AI says different story`);
    }

    // Strict delay between AI calls to avoid 429s (if it didn't wait inside the function)
    await sleep(3000);
  }

  return { isDuplicate: false, matchedTitle: null, method: 'none', score: 0 };
}
