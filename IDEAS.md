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

## 5. "For You" Feed Discovery Quota
**Location:** Backend Recommendation Engine
**Concept:** To prevent the user from being trapped in an algorithmic "echo chamber," the For You feed should reserve a strict quota (e.g., 20%) for pure serendipity and discovery.
- **Mechanism:** Instead of splitting the feed solely into explicit interests (60%) and related interests (40%), mathematically enforce a 50/30/20 split. The final 20% bucket should actively exclude all known user preferences and fetch high-quality news from completely unread categories, allowing the user to naturally discover new topics.

## 6. On-The-Fly Image Optimization Proxy
**Location:** Backend or CDN Level
**Concept:** Automatically compress and resize massive, multi-megabyte high-res images from source publishers to ensure lightning-fast mobile load times without sacrificing visual quality.
- **Mechanism:** Implement a lightweight image proxy (or utilize Next.js Image Optimization / Cloudinary). When the frontend requests an article image, the proxy intercepts the request, converts the original heavy image (e.g., PNG/JPG) to a highly compressed modern format like WebP or AVIF, resizes it to fit the device's exact dimensions, and heavily caches the result for instant delivery.

## 7. Vector Clustering for Article Compression (Embeddings + K-Means)
**Location:** Backend — Pre-processing pipeline before AI rewrite
**Concept:** Use a local embedding model to convert each sentence of a scraped article into a vector, cluster them with K-Means, and pick the most representative sentence from each cluster. This produces a semantically-aware extractive summary that captures all key themes of the article while drastically reducing token usage.
- **Why it's better than simple truncation:** It understands the *meaning* of sentences rather than just their position. A critical detail buried in paragraph 8 won't be lost — the algorithm will surface it if it represents a unique topic cluster.
- **Hosting:** Deploy the embedding model (e.g., `sentence-transformers/all-MiniLM-L6-v2`) as a free microservice on **Hugging Face Spaces**. The backend sends the raw article text to the HF Space, receives back the compressed summary, and then forwards that to Cerebras for the creative rewrite.
- **Trade-offs:** More complex to set up, adds a network hop to HF Spaces, and is overkill for short news articles. Best suited if we scale to long-form investigative pieces or research papers.
