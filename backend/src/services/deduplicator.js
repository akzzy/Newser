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

import axios from 'axios';


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
const DEFINITE_DUPLICATE_THRESHOLD = 0.50;  // High confidence — skip AI, drop it
const GRAY_ZONE_THRESHOLD = 0.30;           // Optimized: 0.20 was too broad and triggered too many AI checks. 0.30 catches real edge cases without spamming the API.

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
      const response = await axios.post('https://integrate.api.nvidia.com/v1/chat/completions', {
        model: 'meta/llama-3.3-70b-instruct',
        messages: [
          {
            role: 'system',
            content: `You are a news headline deduplication engine.\n\nGiven two headlines, decide if they cover the SAME underlying news event or story.\n\nRules:\n- "Same story" means the core news event is identical, even if the headlines emphasize different angles.\n- Two articles about "Sennheiser Momentum 5 launch" from different sites = SAME.\n- Two articles about "SpaceX Starship V3 first flight" from different sites = SAME.\n- "MacBook Pro launch" vs "iPad Pro launch" = DIFFERENT (different products).\n- "Google Chromecast updates" vs "Google Wear OS updates" = DIFFERENT (different products).\n\nRespond with ONLY: {"same": true} or {"same": false}`
          },
          {
            role: 'user',
            content: `Headline A: "${title1}"\nHeadline B: "${title2}"`
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 20
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 15000  // 15s timeout
      });

      const result = response.data;
      const text = result.choices?.[0]?.message?.content?.trim();
      if (!text) return false;

      const parsed = JSON.parse(text);
      
      // Strict delay between AI checks to prevent dumping requests together
      await sleep(5000);
      
      return parsed.same === true;
    } catch (err) {
      const isRateLimit = err.response?.status === 429 || err.message?.includes('429') || err.message?.includes('rate');
      
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
 */
export async function checkDuplicate(candidateTitle, knownTitles, logger = console) {
  // 1. Calculate scores for all known titles
  const scoredMatches = knownTitles.map(knownTitle => {
    return {
      knownTitle,
      score: calculateTitleSimilarity(candidateTitle, knownTitle)
    };
  });

  // 2. Filter out anything below the Gray Zone and sort highest score to lowest
  const potentialMatches = scoredMatches
    .filter(m => m.score >= GRAY_ZONE_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  // 3. Process matches in order of likelihood
  for (const match of potentialMatches) {
    // Fast confirm: almost identical tokens, skip AI
    if (match.score >= DEFINITE_DUPLICATE_THRESHOLD) {
      logger.info?.(`[Dedup] Fast confirm (score ${match.score.toFixed(2)} > ${DEFINITE_DUPLICATE_THRESHOLD}): "${candidateTitle}"`);
      return { isDuplicate: true, matchedTitle: match.knownTitle, method: 'token', score: match.score };
    }

    // Gray Zone: Ask AI for the final verdict
    logger.info?.(`[Dedup] Checking (token score: ${match.score.toFixed(2)}): "${candidateTitle}" ↔ "${match.knownTitle}"`);
    const aiSaysSame = await askAIIfDuplicate(candidateTitle, match.knownTitle);

    if (aiSaysSame) {
      logger.info?.(`[Dedup] ✓ AI confirmed duplicate: "${candidateTitle}"`);
      return { isDuplicate: true, matchedTitle: match.knownTitle, method: 'ai', score: match.score };
    } else {
      logger.info?.(`[Dedup] ✗ AI says different story`);
    }
    
    // Note: askAIIfDuplicate already sleeps for 5s internally, so no need for double sleep here!
  }

  return { isDuplicate: false, matchedTitle: null, method: 'none', score: 0 };
}
