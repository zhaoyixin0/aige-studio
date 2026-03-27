# AI Game Asset Prompt Engineering (Nano Banana Pro / Imagen)

**Extracted:** 2026-03-27
**Context:** Generating high-quality game sprites, characters, backgrounds via AI image generation APIs

## Problem
AI-generated game assets suffer from: inconsistent art style across assets, messy edges making background removal difficult, poor readability at mobile game sizes, and backgrounds that don't match portrait mobile format.

## Solution

### Prompt Structure (priority order — early tokens weighted more)
1. Subject — "A [adjective] [object] [description]"
2. Role/Purpose — "This is a [collectible/enemy/player] for a [genre] mobile game"
3. Art Style — Detailed descriptor, IDENTICAL across all assets in a game
4. Theme Aesthetic — Visual mood, color palette, environmental cues
5. Background Requirement — Chroma-key or full-canvas
6. Composition — Size, position, orientation
7. Exclusions — What must NOT appear

### Chroma-Key Green Screen with White Outline Buffer
```
CRITICAL BACKGROUND REQUIREMENT:
Background MUST be solid flat #00FF00 (RGB 0,255,0).
NO gradients, NO noise, NO shadows.

CRITICAL EDGE REQUIREMENT:
Add 2-3px white outline border around the sprite silhouette.
This white border acts as anti-aliasing buffer between sprite and green background.

CRITICAL COLOR REQUIREMENT:
Do NOT use #00FF00 inside the sprite. Use #006400 or #32CD32 for green elements.
```
The white outline is the key insight — it prevents anti-aliasing artifacts from contaminating transparency edges during chroma-key removal.

### Style Consistency Anchor
Include in EVERY prompt for a game set:
"This asset is part of a cohesive set of mobile game sprites. All assets share the same art style, line weight, color saturation, and rendering technique."

### Mobile Readability
Always include: "readable and recognizable when scaled to [N]x[N] pixels on a mobile screen"
- Characters: 64x64
- Items/obstacles: 48x48
- Projectiles: 32x32

### API Parameters
- Sprites: aspectRatio "1:1", imageSize "1K" (1024x1024)
- Backgrounds: aspectRatio "9:16", imageSize "1K" (native portrait, no resize distortion)

## When to Use
When generating game assets via Imagen 4, Nano Banana Pro, or similar text-to-image APIs.
Trigger: any task involving AI image generation for games, sprites, or UI assets.
