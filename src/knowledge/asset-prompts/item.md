# Item Sprite Generation

Prompt knowledge for collectibles, obstacles, projectiles, and power-ups.

## Collectible Item Template

```
Generate a single game sprite icon of {DESCRIPTION}.
This is a POSITIVE collectible reward item that players eagerly want to catch in a {GAME_TYPE} mobile game.
It should look appealing, shiny, and valuable — something worth chasing.
{STYLE_DESCRIPTOR}.
Theme aesthetic: {AESTHETIC}.

This asset is part of a cohesive set of mobile game sprites.
All assets in this set share the same art style, line weight, color saturation, and rendering technique.

CRITICAL BACKGROUND REQUIREMENT:
The ENTIRE background MUST be solid flat chroma-key green, EXACT hex color #00FF00 (RGB 0,255,0).
NO gradients, NO noise, NO texture, NO shadows, NO reflections on the background.
Every single background pixel must be PURE UNIFORM #00FF00.

CRITICAL EDGE REQUIREMENT:
Add a clean white outline border (2-3 pixels wide) around the entire item silhouette.
This white border acts as an anti-aliasing buffer between the sprite and the green background.

CRITICAL COLOR REQUIREMENT:
Do NOT use any pure #00FF00 green inside the item sprite.
If the item is naturally green, use #006400 or #32CD32 instead.

Composition: single object, centered on canvas, facing the camera, slight 3/4 angle for depth,
occupying roughly 70-80% of the canvas area, fully visible with no cropping.
Add a subtle sparkle or glow effect to make the item look desirable.
The item must be clearly recognizable when scaled to 48x48 pixels on a mobile screen.
No text, no labels, no watermarks, no additional objects, no shadows on background.
```

## Obstacle/Hazard Template

```
Generate a single game sprite icon of {DESCRIPTION}.
This is a DANGEROUS obstacle that players must avoid in a {GAME_TYPE} mobile game.
It should look menacing, harmful, and clearly threatening — an obvious danger signal.
{STYLE_DESCRIPTOR}.
Theme aesthetic: {AESTHETIC}.

[Same cohesive set paragraph]
[Same background, edge, and color requirements]

Composition: single object, centered, facing camera,
occupying roughly 65-75% of canvas, fully visible, no cropping.
Use angular, spiky, or jagged shape language to signal danger.
Slightly darker or more saturated color temperature than collectibles.
Must be instantly recognizable as "avoid this" when scaled to 48x48 pixels.
No text, no labels, no additional objects.
```

## Projectile Template

```
Generate a single game projectile sprite: {DESCRIPTION}.
This is a fast-moving projectile/bullet for a {GAME_TYPE} mobile game.
It should look energetic, dynamic, and powerful with implied forward momentum.
{STYLE_DESCRIPTOR}.
Theme aesthetic: {AESTHETIC}.

[Same cohesive set paragraph]
[Same background, edge, and color requirements]

Composition: single projectile, centered, horizontally oriented (flying right),
occupying roughly 60-70% of canvas width, slightly elongated to suggest speed.
Add a subtle motion trail or energy glow behind the projectile.
Must read clearly at 32x32 pixels on a mobile screen.
No text, no additional objects.
```

## Item Design Principles

- Collectibles: warm colors, sparkle effects, rounded shapes, desirable look
- Obstacles: cool/dark colors, spiky shapes, warning feel, angular silhouettes
- Projectiles: elongated horizontally, motion trails, energy glow, dynamic feel
- Power-ups: bright, glowing, pulsing feel, larger than normal collectibles
- All items: simple single-object silhouettes, high contrast against any background
- Size hierarchy: collectibles 70-80%, obstacles 65-75%, projectiles 60-70%
