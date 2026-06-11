import axios from 'axios';
import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { REWRITE_SYSTEM_PROMPT, buildRewritePrompt } from '../config/prompts.js';

// ── Rate limit constants ──
// Cerebras gpt-oss-120b free tier: 5 RPM, 30k TPM, 1M TPD
const CEREBRAS_SLEEP_MS = 15000; // 15s = 4 RPM, safely under 5 RPM

// ── Content compression constants ──
const MAX_WORDS = 500;           // Hard cap: never send more than 500 words to LLM
const MAX_PARAGRAPHS = 5;        // Soft cap: take first 5 paragraphs (inverted pyramid)
const COMPRESS_THRESHOLD = 500;  // Only compress if article exceeds this word count

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
    max_tokens: 4096,   // Reasoning model: needs tokens for thinking + full JSON response
    response_format: { type: 'json_object' }
  });

  const responseText = completion.choices?.[0]?.message?.content;
  if (!responseText) throw new Error('Empty response from Cerebras');

  // 15s sleep to stay safely under 5 RPM limit
  await sleep(CEREBRAS_SLEEP_MS);

  return parseAIResponse(responseText);
}

/**
 * Rewrite a single article using Cerebras.
 * Content is automatically compressed before hitting the LLM to save tokens.
 */
export async function rewriteArticle(title, content, maxRetries = 3) {
  // ── Compress content before sending to LLM ──
  const originalWordCount = content?.split(/\s+/).length || 0;
  const compressed = compressContent(content);
  const compressedWordCount = compressed.split(/\s+/).length;
  
  if (originalWordCount !== compressedWordCount) {
    console.log(`[AIRewriter] Compressed: ${originalWordCount} → ${compressedWordCount} words (${Math.round((1 - compressedWordCount / originalWordCount) * 100)}% reduction)`);
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await rewriteWithCerebras(title, compressed);
      console.log(`[AIRewriter] Cerebras OK: "${title.substring(0, 50)}"`);
      return result;
    } catch (error) {
      const isRateLimit = error.status === 429 || error.message?.includes('429') || error.message?.includes('rate_limit');

      if (isRateLimit && attempt < maxRetries) {
        console.log(`[AIRewriter] Cerebras rate limit hit. Waiting 60s before retry (attempt ${attempt}/${maxRetries}).`);
        await sleep(60000);
        continue;
      }

      console.warn(`[AIRewriter] Cerebras failed (attempt ${attempt}): ${error.message?.substring(0, 150)}`);
      if (attempt === maxRetries) throw error;
    }
  }
}

