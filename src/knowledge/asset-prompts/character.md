# Character Sprite Generation

Prompt knowledge for player characters, enemies, and NPCs.

## Player Character Template

```
Generate a game player character sprite: {DESCRIPTION}.
This is the main playable character for a {GAME_TYPE} mobile game.
The character should look friendly, expressive, and heroic with an inviting personality.
{STYLE_DESCRIPTOR}.
Theme aesthetic: {AESTHETIC}.

This asset is part of a cohesive set of mobile game sprites.
All assets in this set share the same art style, line weight, color saturation, and rendering technique.

CRITICAL BACKGROUND REQUIREMENT:
The ENTIRE background MUST be solid flat chroma-key green, EXACT hex color #00FF00 (RGB 0,255,0).
NO gradients, NO noise, NO texture, NO shadows, NO reflections on the background.
Every single background pixel must be PURE UNIFORM #00FF00 green.

CRITICAL EDGE REQUIREMENT:
Add a clean white outline border (2-3 pixels wide) around the entire character silhouette.
This white border acts as an anti-aliasing buffer zone between the character and the green background.
The character must have clean, sharp edges against this white border.

CRITICAL COLOR REQUIREMENT:
Do NOT use any pure #00FF00 green anywhere inside the character sprite itself.
If the character has green elements, use dark green (#006400) or lime (#32CD32) instead.

Composition: single character, centered on canvas, front-facing or slight 3/4 angle,
occupying roughly 60-70% of the canvas height, fully visible within frame with no cropping.
Character should be in a neutral idle pose, standing, arms slightly away from body.
The design must remain readable and recognizable when scaled down to 64x64 pixels on a mobile screen.
No text, no UI elements, no floating accessories, no duplicate characters.
```

## Enemy Character Template

```
Generate a game enemy character sprite: {DESCRIPTION}.
This is a hostile enemy for a {GAME_TYPE} mobile game.
The character should look menacing, dangerous, and clearly threatening — visually distinct from friendly characters.
{STYLE_DESCRIPTOR}.
Theme aesthetic: {AESTHETIC}.

This asset is part of a cohesive set of mobile game sprites.

CRITICAL BACKGROUND REQUIREMENT:
[Same as player template]

CRITICAL EDGE REQUIREMENT:
[Same as player template]

Composition: single enemy character, centered, front-facing,
occupying roughly 55-65% of canvas height, fully visible, no cropping.
The enemy should have angular, sharp shape language (contrasting with rounded player characters).
Design must be readable at 48x48 pixels on a mobile screen.
No text, no UI, no additional characters.
```

## NPC Portrait Template

```
Generate a portrait bust shot of a game NPC character: {DESCRIPTION}.
This is a non-player character portrait for a {GAME_TYPE} mobile game dialogue system.
The character should have a clear, expressive face with distinctive personality traits.
{STYLE_DESCRIPTOR}.
Theme aesthetic: {AESTHETIC}.

This asset is part of a cohesive set of mobile game sprites.
All assets in this set share the same art style, line weight, color saturation, and rendering technique.

CRITICAL BACKGROUND REQUIREMENT:
The ENTIRE background MUST be solid flat chroma-key green, EXACT hex color #00FF00 (RGB 0,255,0).
NO gradients, NO noise, NO texture, NO shadows, NO reflections on the background.
Every single background pixel must be PURE UNIFORM #00FF00 green.

CRITICAL EDGE REQUIREMENT:
Add a clean white outline border (2-3 pixels wide) around the entire character silhouette.
This white border acts as an anti-aliasing buffer zone between the character and the green background.
The character must have clean, sharp edges against this white border.

CRITICAL COLOR REQUIREMENT:
Do NOT use any pure #00FF00 green anywhere inside the character sprite itself.
If the character has green elements, use dark green (#006400) or lime (#32CD32) instead.

Composition: bust shot (head and upper torso), centered on canvas, front-facing,
occupying roughly 70-80% of the canvas area, with clear facial features.
The face must be expressive and convey personality — friendly merchant, wise elder, mysterious stranger, etc.
Design must remain readable and recognizable when scaled to 64x64 pixels on a mobile screen.
No text, no speech bubbles, no UI elements, no additional characters.
```

### NPC Design Principles

- NPCs should be visually distinct from both players and enemies
- Warm, neutral color palettes — approachable but not heroic
- Exaggerated facial features for readability in dialogue boxes
- Each NPC should have a distinctive visual hook (hat, scar, hairstyle) for memorability
- Bust shot composition: head + shoulders, no full body needed
- Expression should match NPC role: merchants smile, guards look stern, elders look wise

## Character Design Principles

- Player characters: rounded shapes, warm colors, large eyes, approachable
- Enemies: angular shapes, cool/dark colors, sharp features, intimidating
- NPCs: distinctive features, neutral palettes, expressive faces, memorable silhouettes
- Size hierarchy: players 60-70% canvas, enemies 55-65%, bosses 75-85%, NPCs 70-80% (bust)
- All characters should have a clear readable silhouette
- Idle pose preferred for base sprites (neutral, arms visible)
- Front-facing or slight 3/4 view for maximum personality
- Exaggerate distinctive features for mobile readability
