# Gemini Image Generation API (generateContent format)

**Extracted:** 2026-03-27
**Context:** Migrating from old Imagen predict API to Nano Banana Pro generateContent API

## Problem
Google's image generation API has two formats: the old `predict` endpoint (Imagen 4) and the new `generateContent` endpoint (Nano Banana Pro). The formats are completely different and mixing them causes silent failures.

## Solution

### Old Format (Imagen 4 — DEPRECATED)
```
POST .../models/imagen-4.0-generate-001:predict
{
  "instances": [{ "prompt": "..." }],
  "parameters": { "sampleCount": 1 }
}
Response: data.predictions[0].bytesBase64Encoded
```

### New Format (Nano Banana Pro — RECOMMENDED)
```
POST .../models/gemini-3-pro-image-preview:generateContent
{
  "contents": [{ "parts": [{ "text": "..." }] }],
  "generationConfig": {
    "responseModalities": ["TEXT", "IMAGE"],
    "imageConfig": {
      "aspectRatio": "1:1",   // 1:1, 9:16, 16:9, 3:4, 4:3, etc.
      "imageSize": "1K"       // "512", "1K", "2K", "4K"
    }
  }
}
Response: data.candidates[0].content.parts[] — find part with inlineData.data
```

### Available Models
- `gemini-3-pro-image-preview` (Nano Banana Pro) — best quality
- `gemini-3.1-flash-image-preview` (Nano Banana 2) — fastest
- `imagen-4.0-generate-001` (Imagen 4 Standard) — legacy
- `imagen-4.0-ultra-generate-001` (Imagen 4 Ultra) — legacy high quality
- `imagen-4.0-fast-generate-001` (Imagen 4 Fast) — legacy fast

### Response Parsing
The response may contain both text and image parts. Iterate parts to find the image:
```typescript
const parts = data.candidates?.[0]?.content?.parts;
for (const part of parts) {
  const inline = part.inlineData ?? part.inline_data;
  if (inline?.data) {
    return `data:${inline.mimeType ?? 'image/png'};base64,${inline.data}`;
  }
}
```

### Key Differences
- Nano Banana Pro supports up to 14 reference images (6 objects + 5 characters)
- Supports "thinking" for complex prompts
- Supports multi-turn conversation for iterative editing
- Longer prompts produce better results (trained on long captions)

## When to Use
When working with Google's Gemini/Imagen image generation APIs.
Trigger: any Gemini image generation task, API migration, or new image generation feature.
