# 🚀 1Minute — Project Overview

*This document provides a comprehensive breakdown of the 1Minute web application for marketing, strategy, and growth advisors.*

---

## 📖 What It Is
**1Minute** (live at [1minute.space](https://1minute.space)) is an AI-powered news aggregator and reader. It automatically pulls articles from 27+ premium tech and gaming sources (The Verge, TechCrunch, Wired, IGN, etc.), and uses AI to rewrite them from scratch into clean, concise, 1-2 minute reads. 

It features a premium, swipeable mobile feed (similar to TikTok or YouTube Shorts) and a robust 3-pane layout for desktop users.

## 🎯 The Purpose & Why I Built It
The modern internet has two major problems:
1. **The News is Bloated:** Traditional news articles are padded with SEO filler, buried under ads, and hidden behind paywalls. The actual information is usually just 3 paragraphs hidden inside 15.
2. **The Doomscrolling Generation:** Younger audiences spend hours doomscrolling Instagram Reels and TikTok. They don't know what RSS feeds are, and they aren't going to proactively open traditional news websites.

**The Solution:** I built 1Minute to turn doomscrolling into something productive. By stripping away the fluff and serving real journalism in a frictionless, swipeable interface, users can get informed about the world just as easily as they consume social media.

## 🛠️ How It Was Built (Tech Stack)
I am a solo developer building this in my free time. 

**Frontend:**
*   **Framework:** Next.js (React) deployed on Vercel.
*   **Styling:** Pure CSS Modules (Vanilla CSS) for maximum control and premium glassmorphism aesthetics.
*   **State Management:** Zustand.
*   **UX/UI:** Progressive Web App (PWA) so it acts like a native app. Custom `PointerEvents` implementation for buttery-smooth mobile swipe gestures (bypassing browser gesture hijacking).

**Backend & Data Pipeline:**
*   **Framework:** Fastify (Node.js).
*   **Database:** Supabase (PostgreSQL) handling articles, guest profiles, and preferences.
*   **Ingestion:** Continuous background jobs that fetch RSS feeds and scrape full-text HTML.
*   **AI Pipeline:** Articles run through a deduplicator (to avoid covering the same story twice), then are rewritten from scratch. 
    *   *Primary AI:* Cerebras (for ultra-fast Llama inference).
    *   *Fallback AI:* NVIDIA API.

## ⭐ The Positives (Our Unfair Advantages)
*   **Zero-Friction Onboarding (No Login):** Users do not need to create an account. The app generates a Guest ID and stores their preferences locally and in the DB. They just click the link and start reading.
*   **Premium UX:** It looks and feels like a highly-funded native iOS app. Dark mode, smooth animations, and gesture-driven navigation.
*   **Real AI Utility:** It's not just an "AI wrapper" that summarizes. It fully restructures articles for readability.
*   **Personalization:** A "For You" feed that learns what categories and tags the user boosts or blocks.
*   **SEO Engine:** Every rewritten article lives on its own URL (`/a/[id]`), creating a massive catalog of unique content for Google to index.

## 🚧 Our Limitations & Challenges
*   **Distribution (No App Store):** Because it is a PWA (web app), we cannot rely on App Store Search Optimization (ASO) for organic discovery. 
*   **Operating Costs:** Scraping and rewriting hundreds of articles a day requires AI API credits and continuous backend processing. It needs a monetization strategy eventually (currently $0 to the user).
*   **Solo Developer Bandwidth:** Balancing technical maintenance, AI rate limits, and marketing is difficult for one person.
*   **The "AI Stigma":** Skeptical audiences (especially on platforms like Reddit) immediately assume "AI news" means hallucinated or fake news, requiring careful messaging to explain that it rewrites *real* sources.

## 🏆 What We Are Trying to Achieve (Goals)
1.  **Build a Daily Habit:** Achieve high retention by making 1Minute the easiest way to consume news during a morning commute or bathroom break.
2.  **Acquire Users Organically:** Find marketing channels that convert well without spending money on paid ads (since the budget is $0 right now).
3.  **Prove the Value:** Validate that people prefer AI-condensed news over traditional, ad-heavy publisher sites.
