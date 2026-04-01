# Asset Prompt Framework

Universal structure for all game asset generation prompts.
Imagen/Nano Banana Pro weights early tokens more heavily — order matters.

## Prompt Structure (in priority order)

1. **Subject** — "A [adjective] [object/character] [description]"
2. **Role/Purpose** — "This is a [collectible/enemy/player/background] for a [genre] mobile game"
3. **Art Style** — Exact style string, identical across all assets in a game
4. **Theme Aesthetic** — Visual mood and color palette
5. **Background Requirement** — Chroma-key green or full-canvas fill
6. **Composition** — Size, position, orientation, camera angle
7. **Exclusions** — What must NOT appear

## Key Principles

- Nano Banana Pro is trained on long captions — detailed prompts produce better results
- Use emphatic capitalization for non-negotiable requirements (CRITICAL, MUST, EXACT)
- Repeat critical constraints 2-3 times with different phrasing for emphasis
- Describe the scene narratively, not as keyword lists
- Always specify what the asset is FOR (mobile game sprite, game background, etc.)

## Chroma-Key Green Screen Rules (for sprites)

All non-background sprites MUST use chroma-key green for reliable background removal:

- Background: EXACT hex #00FF00 (RGB 0, 255, 0)
- No gradients, noise, texture, shadows, or reflections on background
- Add 2-3px white outline/border around the sprite as anti-aliasing buffer
- Sprite must NOT contain any pure #00FF00 green internally
- If subject is naturally green, use dark green (#006400) or lime (#32CD32) instead

## Composition Guidelines

- Sprites: single object, centered, 65-80% canvas occupation
- Characters: front-facing or 3/4 view, 60-70% canvas
- Backgrounds: fill entire canvas, no borders, no letterboxing
- UI elements: centered, specific shape description required

## Mobile Readability

- Always include "readable at [target]x[target] pixels" for final display size
- Prefer bold outlines and high contrast for small-screen visibility
- Simple, clean silhouettes that are identifiable at a glance
- Limited detail — avoid visual noise that disappears at mobile resolution

## Style Consistency

- Use IDENTICAL style strings across all prompts for one game
- Include "part of a matching set of game assets" in every prompt
- Specify exact color palette when possible (hex values)
- Reference the player character style for all other assets:
  "Matching the same art style as the game's main character"

## Resolution

- Generate all assets at 1024x1024 (imageSize: "1K", aspectRatio: "1:1")
- Backgrounds generate at native 9:16 (imageSize: "1K", aspectRatio: "9:16")
- Post-generation resize to game target sizes
