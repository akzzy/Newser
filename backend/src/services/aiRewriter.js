import axios from 'axios';
import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { REWRITE_SYSTEM_PROMPT, buildRewritePrompt } from '../config/prompts.js';

// ── Rate limit constants ──
// Cerebras gpt-oss-120b free tier: 5 RPM, 30k TPM, 1M TPD
const CEREBRAS_SLEEP_MS = 13000; // 13s = ~4.6 RPM, safely under 5 RPM

// NVIDIA fallback: 40 RPM
const NVIDIA_SLEEP_MS = 3000;

/**
 * Attempt to repair and parse malformed JSON from the AI.
 * Handles: truncated JSON, trailing commas, unclosed braces.
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
    if (inString) repaired += '"';
    repaired += ']'.repeat(Math.max(0, openBrackets));
    repaired += '}'.repeat(Math.max(0, openBraces));
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Primary: Cerebras gpt-oss-120b (ultra-fast inference, 5 RPM free tier)
 */
async function rewriteWithCerebras(title, content) {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) throw new Error('CEREBRAS_API_KEY not configured in .env');

  const client = new Cerebras({ apiKey });
  const userPrompt = buildRewritePrompt(title, content);

  const completion = await client.chat.completions.create({
    model: 'gpt-oss-120b',
    messages: [
      { role: 'system', content: REWRITE_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.7,
    max_tokens: 4096,   // Reasoning model: needs tokens for thinking + full JSON response
    response_format: { type: 'json_object' }
  });

  const responseText = completion.choices?.[0]?.message?.content;
  if (!responseText) throw new Error('Empty response from Cerebras');

  // 13s sleep to stay safely under 5 RPM limit
  await sleep(CEREBRAS_SLEEP_MS);

  return parseAIResponse(responseText);
}

/**
 * Fallback: NVIDIA Mistral Small (40 RPM, used only when Cerebras fails)
 */
async function rewriteWithNvidia(title, content) {
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
    max_tokens: 1200,
    response_format: { type: 'json_object' }
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    timeout: 60000
  });

  const responseText = response.data?.choices?.[0]?.message?.content;
  if (!responseText) throw new Error('Empty response from NVIDIA');

  await sleep(NVIDIA_SLEEP_MS);

  return parseAIResponse(responseText);
}

/**
 * Rewrite a single article.
 * Tries Cerebras first, falls back to NVIDIA Mistral on any error.
 */
export async function rewriteArticle(title, content, maxRetries = 3) {
  // ── Attempt Cerebras (primary) ──
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await rewriteWithCerebras(title, content);
      console.log(`[AIRewriter] Cerebras OK: "${title.substring(0, 50)}"`);
      return result;
    } catch (error) {
      const isRateLimit = error.status === 429 || error.message?.includes('429') || error.message?.includes('rate_limit');

      if (isRateLimit && attempt < maxRetries) {
        const wait = 20000 * attempt;
        console.log(`[AIRewriter] Cerebras rate limit, waiting ${wait / 1000}s (attempt ${attempt}/${maxRetries})`);
        await sleep(wait);
        continue;
      }

      console.warn(`[AIRewriter] Cerebras failed (attempt ${attempt}): ${error.message?.substring(0, 150)}`);
      if (attempt === maxRetries) break;
    }
  }

  // ── Fallback: NVIDIA Mistral ──
  console.log(`[AIRewriter] Falling back to NVIDIA Mistral for "${title.substring(0, 50)}"`);
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await rewriteWithNvidia(title, content);
      console.log(`[AIRewriter] NVIDIA fallback OK: "${title.substring(0, 50)}"`);
      return result;
    } catch (error) {
      const isRateLimit = error.response?.status === 429 || error.message?.includes('429');

      if (isRateLimit && attempt < maxRetries) {
        const wait = 15000 * Math.pow(2, attempt - 1);
        console.log(`[AIRewriter] NVIDIA rate limit, waiting ${wait / 1000}s`);
        await sleep(wait);
        continue;
      }

      console.error(`[AIRewriter] NVIDIA fallback failed (attempt ${attempt}): ${error.message?.substring(0, 150)}`);
      throw error;
    }
  }

  throw new Error('Max retries exceeded on both Cerebras and NVIDIA');
}
