# Background Generation

Prompt knowledge for game environment backgrounds.

## Background Template

```
Generate a game background illustration for a {GAME_TYPE} mobile game.
The image MUST be in portrait orientation (9:16 aspect ratio, like a mobile phone screen held vertically).
Scene: {DESCRIPTION}.
Theme aesthetic: {AESTHETIC}.
{STYLE_DESCRIPTOR}.

This background is part of a cohesive mobile game visual set.
The style, color palette, and rendering technique must match the game's character and item sprites.

COMPOSITION REQUIREMENTS:
- Fill the ENTIRE canvas edge to edge — no borders, no letterboxing, no margins.
- Create depth with distinct foreground, midground, and background layers for potential parallax scrolling.
- The scene should feel like an immersive game world that a player character moves through.
- Leave the central area relatively uncluttered for gameplay visibility.
- Subtle environmental details and atmospheric effects add richness without distracting from gameplay.

COLOR AND MOOD:
- Vibrant colors appropriate to the theme, but not so bright that game sprites become invisible.
- Ensure sufficient contrast between the background and typical sprite colors.
- The overall value (brightness) should be moderate — not too dark, not too bright.
- Consider a slight vignette or atmospheric perspective to draw attention to center.

EXCLUSIONS:
- No text, no characters, no NPCs, no UI elements, no HUD overlays, no buttons.
- No logos, no watermarks, no borders, no frames.
- No ground-level platforms unless the game type requires them (platformer).
- The background should be a pure environment — the game engine adds everything else.
```

## Background Design Principles

- Always generate at native 9:16 aspect ratio (API parameter, not prompt-only)
- Use imageSize "1K" for 1024px on the long edge
- Backgrounds do NOT use chroma-key green (they fill the full canvas)
- Create layered depth for potential parallax scrolling effects
- Keep center-screen relatively open for gameplay
- Moderate brightness to ensure sprite visibility
- Each theme should have a distinctive color palette
- Avoid placing prominent objects where HUD/UI will overlay (top corners, bottom center)
- For platformer games, include a ground plane and sky
- For shooters, prefer darker backgrounds so bright projectiles pop
- For casual games, bright cheerful environments
