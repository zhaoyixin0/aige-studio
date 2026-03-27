---
name: Nano Banana Pro Migration
description: Image generation upgraded from Imagen 4 predict API to Nano Banana Pro generateContent API with enhanced prompt system
type: project
---

On 2026-03-27, image generation was upgraded from `imagen-4.0-generate-001:predict` to `gemini-3-pro-image-preview:generateContent` (Nano Banana Pro).

**Why:** Old Imagen 4 produced low-quality assets with inconsistent styles. Nano Banana Pro offers better quality, native aspect ratio control, and up to 14 reference images.

**How to apply:**
- `gemini-image.ts` uses new generateContent format with `contents` + `generationConfig`
- `prompt-builder.ts` has research-based templates with white outline buffer, anti-green-in-sprite, mobile readability hints
- Asset generation uses 1024x1024 (1K) for sprites, native 9:16 for backgrounds
- 6 knowledge skill files in `src/knowledge/asset-prompts/` define prompt best practices
- `PromptBuilder.getImageConfig(role)` returns correct API params per asset type
