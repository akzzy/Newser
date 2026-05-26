import { calculateTitleSimilarity, checkDuplicate } from './services/deduplicator.js';
import dotenv from 'dotenv';
dotenv.config();

const testCases = [
  // ─── TRUE DUPLICATES (should match) ───
  { t1: "Ferrari reveals its first EV, with design help from Jony Ive",
    t2: "The Electric Ferrari Luce Is Finally Here",
    expect: true, label: "Ferrari EV (Verge vs Wired)" },

  { t1: "Ferrari reveals its first EV, with design help from Jony Ive",
    t2: "Ferrari Luce unveiled: Here's the first car from Jony Ive's design house",
    expect: true, label: "Ferrari EV (Verge vs Engadget)" },

  { t1: "Sennheiser's new Momentum 5 headphones have upgraded ANC and a replaceable battery",
    t2: "Sennheiser's Momentum 5 headphones are all about the audio and ANC upgrades",
    expect: true, label: "Sennheiser Momentum 5 (Verge vs Engadget)" },

  { t1: "Samsung Galaxy is ditching OneDrive integration",
    t2: "Here's when Samsung Gallery is officially cutting ties with OneDrive",
    expect: true, label: "Samsung OneDrive (9to5 vs AA)" },

  { t1: "Pope Leo calls for AI to serve humanity and not concentrate power",
    t2: "Pope Leo XIV tells the Vatican to disarm AI, in the first encyclical of his pontificate",
    expect: true, label: "Pope AI (Engadget vs TechCrunch)" },

  { t1: "SpaceX launches Starship V3 for the first time, but loses booster on return",
    t2: "SpaceX's Starship V3—still a work in progress—mostly successful on first flight",
    expect: true, label: "SpaceX Starship (Verge vs Ars)" },

  { t1: "First-generation Chromecast users stressed by devices suddenly failing",
    t2: "First-gen Chromecast streamers are suddenly failing for some users, 13 years later",
    expect: true, label: "Chromecast failing (same story)" },

  // ─── FALSE POSITIVES (should NOT match) ───
  { t1: "AT&T Promo Codes: $50 Off This May 2026",
    t2: "T-Mobile Promo Codes: 25% Off | May",
    expect: false, label: "Different promo brands (AT&T vs T-Mobile)" },

  { t1: "AT&T Promo Codes: $50 Off This May 2026",
    t2: "Hoka Coupon Codes: 30% Off | May 2026",
    expect: false, label: "Different promo brands (AT&T vs Hoka)" },

  { t1: "Google is not ending security updates for Chromecasts",
    t2: "Google announces Wear OS 7 with Live Updates, widgets, more",
    expect: false, label: "Different Google stories (Chromecast vs Wear OS)" },

  { t1: "Apple launches M4 MacBook Pro",
    t2: "Apple launches M4 iPad Pro",
    expect: false, label: "Different Apple products (MacBook vs iPad)" },

  { t1: "Huawei unveils 'Tau Scaling Law' as China's workaround for US chip sanctions",
    t2: "China's shark finning could lead to US seafood sanctions",
    expect: false, label: "Different stories (Huawei vs seafood)" },

  { t1: "Memorial Day 2026 Grill and Griddle Deals: Weber, Traeger, Recteq",
    t2: "Best Memorial Day Mattress Deals: Helix, Saatva (2026)",
    expect: false, label: "Different Memorial Day deals (grills vs mattress)" },

  { t1: "Android 17 QPR1 Beta 3 now defaults screen recording to your last-used app",
    t2: "Your Android home screen widgets are about to get a ton of upgrades",
    expect: false, label: "Different Android stories" },
];

// Fake logger
const logger = {
  info: (msg) => console.log(`  💬 ${msg}`),
  warn: (msg) => console.log(`  ⚠️  ${msg}`),
  error: (msg) => console.log(`  ❌ ${msg}`)
};

async function runTests() {
  console.log("=== Hybrid Deduplication Test Suite ===\n");
  let pass = 0, fail = 0;

  for (const tc of testCases) {
    const tokenScore = calculateTitleSimilarity(tc.t1, tc.t2);
    const zone = tokenScore >= 0.50 ? 'DEFINITE' : tokenScore >= 0.20 ? 'GRAY_ZONE → AI' : 'SKIP';

    console.log(`─── ${tc.label} ───`);
    console.log(`  Token score: ${tokenScore.toFixed(4)} → ${zone}`);

    const result = await checkDuplicate(tc.t1, [tc.t2], logger);
    const correct = result.isDuplicate === tc.expect;
    if (correct) pass++; else fail++;

    console.log(`  ${correct ? '✅ PASS' : '❌ FAIL'} | Result: ${result.isDuplicate ? 'DUPLICATE' : 'UNIQUE'} (method: ${result.method}) | Expected: ${tc.expect ? 'DUPLICATE' : 'UNIQUE'}`);
    console.log('');
  }

  console.log(`\n=== Results: ${pass}/${pass + fail} passed, ${fail} failed ===`);
}

runTests();
