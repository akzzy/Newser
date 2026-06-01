# Newser - Future Feature Ideas

This document tracks upcoming feature ideas and architectural upgrades for the Newser application.

## 1. "Explain Like I'm 5" (Simplify) Toggle
**Location:** Reader Drawer (Article View)
**Concept:** A magic wand button or toggle that uses the Mistral AI backend to instantly rewrite the currently open article.
- **Modes:** Can simplify complex topics (ELI5) or expand them for advanced reading levels.
- **Mechanism:** The frontend sends a request to the backend with the article ID and target reading level. The backend uses the `aiRewriter` service to generate a new variation and streams it back to the UI.

## 2. "Good News Only" Vibe Filter
**Location:** Main Feed / Settings
**Concept:** A toggle to instantly filter out negative news, crime, and politics in favor of positive breakthroughs, uplifting stories, and technological advancements.
- **Mechanism:** When the backend ingests articles, the AI assigns a sentiment score (Positive/Neutral/Negative) or tags it with a "Vibe". The frontend can then filter the feed dynamically based on the user's current preference.

## 3. Gamified "Knowledge Profile"
**Location:** New Profile Tab
**Concept:** A personalized dashboard that tracks what the user is learning about.
- **Visuals:** Features a dynamic Radar Chart displaying the user's reading interests (e.g., heavily skewed towards Space, lightly reading AI).
- **Mechanism:** Leverages the existing `interactions` tracking table in Supabase. By aggregating the `category` or `ai_category` of articles the user has clicked or read, the app builds a real-time visualization of their knowledge consumption.

## 4. Lightning Fast Semantic Search
**Location:** Discover Page
**Concept:** A frictionless, animated search bar that lets users instantly find articles about specific topics, companies, or events without needing to navigate through categories.
- **Mechanism:** Leverages Supabase's full-text search (or pgvector for semantic search) across the `title_hook` and `deep_dive_content` fields. The results are streamed instantly as the user types, maintaining the app's hyper-fast, premium feel.
