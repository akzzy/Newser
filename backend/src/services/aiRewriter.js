import axios from 'axios';
import Cerebras from '@cerebras/cerebras_cloud_sdk';
import OpenAI from 'openai';
import { REWRITE_SYSTEM_PROMPT, buildRewritePrompt } from '../config/prompts.js';

// ── Rate limit constants ──
// Cerebras gpt-oss-120b free tier: 5 RPM, 30k TPM, 1M TPD
const CEREBRAS_SLEEP_MS = 15000; // 15s = 4 RPM, safely under 5 RPM
const NVIDIA_SLEEP_MS = 3000;    // 3s between NVIDIA requests (no token limit, only rate limit)

// ── Cerebras daily limit tracking ──
// When Cerebras hits its daily token limit, we block it and use NVIDIA for the rest of the day.
// Resets automatically at midnight UTC.
let cerebrasBlockedUntil = 0;

function isCerebrasBlocked() {
  if (Date.now() < cerebrasBlockedUntil) return true;
  // Auto-reset if the block has expired
  cerebrasBlockedUntil = 0;
  return false;
}

function blockCerebrasForDay() {
  // Block until next midnight UTC
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  cerebrasBlockedUntil = tomorrow.getTime();
  const hoursLeft = Math.round((cerebrasBlockedUntil - Date.now()) / 3600000);
  console.log(`[AIRewriter] ⚠️ Cerebras daily token limit hit. Blocked for ~${hoursLeft}h. Switching to NVIDIA.`);
}

// ── Content compression constants ──
const MAX_WORDS = 300;           // Hard cap: never send more than 300 words to LLM
const MAX_PARAGRAPHS = 5;        // Soft cap: take first 5 paragraphs (inverted pyramid)
const COMPRESS_THRESHOLD = 300;  // Only compress if article exceeds this word count

/**
 * Compress article content before sending to LLM.
 * 
 * Strategy: "Inverted Pyramid Truncation"
 * News articles front-load the most important facts (who/what/when/where/why)
 * in the first few paragraphs. We exploit this structure to safely cut ~70-80%
 * of token usage without losing key facts.
 *
 * Based on real DB analysis (100 articles):
 *   75% of articles are already <= 500 words → pass through untouched
 *   17% are 501-800 words → mild compression
 *   8% are 800+ words → heavy compression
 */
function compressContent(content) {
  if (!content) return '';

  // Skip compression entirely for small/medium articles
  const wordCount = content.split(/\s+/).length;
  if (wordCount <= COMPRESS_THRESHOLD) return content;

  // Split on double newlines (standard paragraph separator)
  const paragraphs = content
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  // Take first N paragraphs
  const selected = paragraphs.slice(0, MAX_PARAGRAPHS);
  let compressed = selected.join('\n\n');

  // Hard-cap by word count (handles giant paragraphs)
  const words = compressed.split(/\s+/);
  if (words.length > MAX_WORDS) {
    compressed = words.slice(0, MAX_WORDS).join(' ') + '...';
  }

  return compressed;
}

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
    reasoning_effort: 'low',
    max_tokens: 4096,
    response_format: { type: 'json_object' }
  });

  const responseText = completion.choices?.[0]?.message?.content;
  if (!responseText) throw new Error('Empty response from Cerebras');

  // 15s sleep to stay safely under 5 RPM limit
  await sleep(CEREBRAS_SLEEP_MS);

  return parseAIResponse(responseText);
}

/**
 * Backup: NVIDIA meta/llama-3.3-70b-instruct (no token limit, only rate limit, but unreliable under heavy traffic)
 */
async function rewriteWithNvidia(title, content) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error('NVIDIA_API_KEY not configured in .env');

  const client = new OpenAI({
    apiKey,
    baseURL: 'https://integrate.api.nvidia.com/v1',
  });

  const userPrompt = buildRewritePrompt(title, content);

  const completion = await client.chat.completions.create({
    model: 'mistralai/mistral-nemotron',
    messages: [
      { role: 'system', content: REWRITE_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.6,
    top_p: 0.7,
    max_tokens: 4096,
    stream: false,
    response_format: { type: 'json_object' }
  });

  const responseText = completion.choices?.[0]?.message?.content;
  if (!responseText) throw new Error('Empty response from NVIDIA');

  // 10s sleep between NVIDIA requests to stay under 40 RPM limit
  await sleep(10000);

  return parseAIResponse(responseText);
}

/**
 * Rewrite a single article.
 * 
 * Strategy:
 *   1. Try NVIDIA (primary — 40 RPM, no token limit)
 *   2. If NVIDIA fails (traffic/rate limit) → Fallback to Cerebras
 *   3. If Cerebras hits daily token limit → permanently block Cerebras for the day
 * 
 * Content is automatically compressed before hitting any LLM to save tokens.
 */
export async function rewriteArticle(title, content, logger = console, maxRetries = 3) {
  // ── Compress content before sending to LLM ──
  const originalWordCount = content?.split(/\s+/).length || 0;
  const compressed = compressContent(content);
  const compressedWordCount = compressed.split(/\s+/).length;
  
  if (originalWordCount !== compressedWordCount) {
    logger.info?.(`[AIRewriter] Compressed: ${originalWordCount} → ${compressedWordCount} words (${Math.round((1 - compressedWordCount / originalWordCount) * 100)}% reduction)`);
  }

  // ── Primary: NVIDIA (no token limit) ──
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await rewriteWithNvidia(title, compressed);
      if (result && Array.isArray(result.ai_tags)) {
        if (result.ai_tags.length >= 3) result.ai_tags.pop();
        result.ai_tags.unshift('🟢 NVIDIA');
      }
      logger.info?.(`[AIRewriter] ✅ NVIDIA OK: "${title.substring(0, 50)}"`);
      return result;
    } catch (error) {
      const errMsg = error.message || '';
      logger.warn?.(`[AIRewriter] NVIDIA failed (attempt ${attempt}): ${errMsg.substring(0, 150)}`);
      
      if (attempt < 2) {
        await sleep(5000); // Brief wait before NVIDIA retry
        continue;
      }
    }
  }

  // ── Fallback: Cerebras ──
  if (!isCerebrasBlocked()) {
    logger.info?.(`[AIRewriter] Trying Cerebras backup for: "${title.substring(0, 50)}"`);
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await rewriteWithCerebras(title, compressed);
        if (result && Array.isArray(result.ai_tags)) {
          if (result.ai_tags.length >= 3) result.ai_tags.pop();
          result.ai_tags.unshift('⚡ Cerebras');
        }
        logger.info?.(`[AIRewriter] ✅ Cerebras OK: "${title.substring(0, 50)}"`);
        return result;
      } catch (error) {
        const errMsg = error.message || '';
        const isDailyLimit = errMsg.includes('Tokens per day') || errMsg.includes('tokens per day') || errMsg.includes('daily');
        const isRateLimit = error.status === 429 || errMsg.includes('429') || errMsg.includes('rate_limit');

        if (isDailyLimit) {
          logger.warn?.(`[AIRewriter] Cerebras Daily Limit Reached. Blocking for today.`);
          blockCerebrasForDay();
          break;
        }

        if (isRateLimit && attempt < maxRetries) {
          logger.info?.(`[AIRewriter] Cerebras per-minute rate limit. Waiting 60s (attempt ${attempt}/${maxRetries}).`);
          await sleep(60000);
          continue;
        }

        logger.warn?.(`[AIRewriter] Cerebras failed (attempt ${attempt}): ${errMsg.substring(0, 150)}`);
        if (attempt === maxRetries) break;
      }
    }
  }

  // Both providers failed
  throw new Error(`All providers failed for "${title.substring(0, 60)}"`);
}

