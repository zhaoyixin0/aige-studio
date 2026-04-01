# UI Element Generation

Prompt knowledge for game UI elements: icons, buttons, frames, indicators.

## UI Icon Template

```
Generate a game UI icon sprite: {DESCRIPTION}.
This is a {PURPOSE} icon for a {GAME_TYPE} mobile game's heads-up display.
It must be immediately recognizable and readable at very small sizes (24x24 to 48x48 pixels).
{STYLE_DESCRIPTOR}.

CRITICAL BACKGROUND REQUIREMENT:
The ENTIRE background MUST be solid flat chroma-key green, EXACT hex color #00FF00.
NO gradients, NO noise, NO texture, NO shadows on the background.

CRITICAL EDGE REQUIREMENT:
Add a clean white outline border (2-3 pixels) around the icon silhouette.

DESIGN REQUIREMENTS:
- Ultra-simple, bold design with maximum contrast.
- Single clear symbol — avoid complex scenes or multiple elements.
- Thick lines and solid fills — thin details disappear at small sizes.
- Use the game's consistent art style but prioritize clarity over decoration.
- The icon should communicate its purpose instantly with no ambiguity.

Composition: single icon, perfectly centered, occupying 75-85% of canvas.
No text, no labels, no additional decorative elements.
```

## UI Design Principles

- UI elements require the SIMPLEST possible designs
- Readability at 24x24px is the ultimate test
- Bold shapes, maximum contrast, minimal detail
- Icons should be universally understood (heart = health, star = score, etc.)
- Use the game's art style but always prioritize functional clarity
- Consistent padding and visual weight across all UI icons
- Consider generating UI elements with the "flat" style regardless of game style,
  as flat UI reads best at small sizes on mobile screens
