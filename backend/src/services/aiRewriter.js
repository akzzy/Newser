import axios from 'axios';
import { REWRITE_SYSTEM_PROMPT, buildRewritePrompt } from '../config/prompts.js';

/**
 * Attempt to repair and parse malformed JSON from the AI.
 * Handles: truncated JSON, unescaped apostrophes, trailing commas.
 */
function parseAIResponse(text) {
  let cleaned = text.trim();

  // Strip markdown code fences
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  // Attempt 1: Parse as-is (happy path)
  try {
    const parsed = JSON.parse(cleaned);
    return extractFields(parsed);
  } catch (_) {}

  // Attempt 2: Fix trailing commas before } or ]
  try {
    const fixed = cleaned.replace(/,\s*([}\]])/g, '$1');
    const parsed = JSON.parse(fixed);
    return extractFields(parsed);
  } catch (_) {}

  // Attempt 3: Truncated JSON — close unclosed braces/brackets
  try {
    let repaired = cleaned;
    // Count unclosed braces and brackets
    let openBraces = 0, openBrackets = 0;
    let inString = false, escape = false;
    for (const ch of repaired) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') openBraces++;
      if (ch === '}') openBraces--;
      if (ch === '[') openBrackets++;
      if (ch === ']') openBrackets--;
    }
    // Close any open strings, brackets, braces
    if (inString) repaired += '"';
    repaired += ']'.repeat(Math.max(0, openBrackets));
    repaired += '}'.repeat(Math.max(0, openBraces));
    // Remove trailing comma before the closing braces we just added
    repaired = repaired.replace(/,\s*([}\]])/g, '$1');
    const parsed = JSON.parse(repaired);
    return extractFields(parsed);
  } catch (_) {}

  throw new Error(`Failed to parse AI JSON response. Raw snippet: ${cleaned.substring(0, 200)}`);
}

function extractFields(parsed) {
  if (!parsed.titleHook || !parsed.deepDiveContent) {
    throw new Error('Missing required fields: titleHook or deepDiveContent');
  }
  return {
    title_hook: parsed.titleHook,
    deep_dive_content: parsed.deepDiveContent,
    ai_category: parsed.category || 'General',
    ai_tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    read_time: parsed.readTime || '1 min'
  };
}

/**
 * Sleep helper.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Rewrite a single article using meta/llama-3.3-70b-instruct on NVIDIA NIM.
 * Includes retry logic with exponential backoff for rate limits.
 */
export async function rewriteArticle(title, content, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const apiKey = process.env.NVIDIA_API_KEY;
      if (!apiKey) throw new Error('NVIDIA_API_KEY not configured in .env');

      const userPrompt = buildRewritePrompt(title, content);

      const response = await axios.post('https://integrate.api.nvidia.com/v1/chat/completions', {
        model: 'mistralai/mistral-small-4-119b-2603',
        messages: [
          { role: 'system', content: REWRITE_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1200,  // Enough for 350 words — lower = faster inference on free tier
        response_format: { type: 'json_object' }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 60000  // 60s — 119B model, give it time
      });

      const result = response.data;
      const responseText = result.choices?.[0]?.message?.content;
      if (!responseText) {
        throw new Error('Empty response from AI');
      }

      // Mandatory 3-second sleep to stay well under NVIDIA 40 RPM limit
      await sleep(3000);

      return parseAIResponse(responseText);
    } catch (error) {
      const isRateLimit = error.response?.status === 429 || error.message?.includes('429') || error.message?.includes('rate');

      if (isRateLimit && attempt < maxRetries) {
        const waitTime = 15000 * Math.pow(2, attempt - 1);
        console.log(`[AIRewriter] Rate limited on "${title.substring(0, 40)}...", retrying in ${waitTime / 1000}s (attempt ${attempt}/${maxRetries})`);
        await sleep(waitTime);
        continue;
      }

      console.error(`[AIRewriter] Error rewriting "${title.substring(0, 50)}..." (attempt ${attempt}):`, error.message?.substring(0, 200));
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * Process a batch of articles with rate limiting.
 */
export async function rewriteBatch(articles, delayMs = 2000) {
  const results = [];
  const batchSize = 10;

  const toProcess = articles.slice(0, batchSize);
  if (articles.length > batchSize) {
    console.log(`[AIRewriter] Batch capped at ${batchSize} articles (${articles.length - batchSize} deferred to next cycle)`);
  }

  for (let i = 0; i < toProcess.length; i++) {
    const article = toProcess[i];
    console.log(`[AIRewriter] Rewriting ${i + 1}/${toProcess.length}: "${article.title.substring(0, 60)}..."`);

    const aiResult = await rewriteArticle(article.title, article.original_content);

    results.push({
      ...article,
      ...(aiResult || {}),
      rewrite_status: aiResult ? 'completed' : 'failed',
      rewritten_at: aiResult ? new Date().toISOString() : null
    });

    if (i < toProcess.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  for (const article of articles.slice(batchSize)) {
    results.push({
      ...article,
      rewrite_status: 'pending',
      rewritten_at: null
    });
  }

  return results;
}
