# Newser - TODO

## Pending Tasks

- [ ] **Re-enable AI Deduplicator Gray Zone**: The deduplicator's AI confirmation step is currently disabled (`GRAY_ZONE_THRESHOLD` is set to `0.50`, same as `DEFINITE_DUPLICATE_THRESHOLD`). Lower `GRAY_ZONE_THRESHOLD` back to `0.20` to re-enable the gray zone where borderline duplicates get confirmed by an AI model. When re-enabling, make sure the deduplicator's API calls stay within Cerebras (5 RPM) or NVIDIA (40 RPM) rate limits — the rewriter is already using those same APIs, so total combined requests must not exceed the limits.
