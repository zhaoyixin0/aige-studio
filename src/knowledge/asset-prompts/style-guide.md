# Art Style Guide for Game Assets

Detailed style definitions that maintain visual consistency across all generated assets.
Each style includes specific keywords, color guidance, and rendering characteristics.

## Style Definitions

### cartoon
Full descriptor: "2D cartoon style with bold black outlines (2-3px), vibrant saturated flat colors, cel-shaded shading with one shadow tone per color, clean vector-art look, smooth curves, exaggerated proportions for appeal"
Color guidance: bright primaries, high saturation, warm highlights
Outline: thick black (#000000) outlines, 2-3px
Shading: single shadow tone per base color, no gradients
Best for: casual games, family-friendly content

### pixel
Full descriptor: "pixel art style with crisp square pixels, retro 8-bit aesthetic, limited 16-color palette per sprite, no anti-aliasing on edges, visible pixel grid, dithering for gradients, NES/SNES era charm"
Color guidance: limited palette (16 colors max), indexed color feel
Outline: 1px dark pixel border
Shading: dithering patterns, no smooth gradients
Best for: retro games, nostalgic themes

### flat
Full descriptor: "flat design minimalist style with solid color fills, zero shadows, clean geometric shapes, material design inspired, thin hairline borders, modern UI aesthetic, limited to 4-5 colors per asset"
Color guidance: muted pastels or bold material design colors, no gradients
Outline: thin hairline or no outline
Shading: none — completely flat fills
Best for: modern minimalist games, puzzle games

### realistic
Full descriptor: "semi-realistic 3D rendered look with soft diffused studio lighting, detailed PBR textures, subtle specular reflections, ambient occlusion, physically accurate proportions, matte finish"
Color guidance: natural tones, realistic saturation
Outline: no visible outline, form defined by lighting
Shading: full PBR with ambient occlusion
Best for: simulation games, mature themes

### watercolor
Full descriptor: "watercolor painting style with soft blended wet edges, translucent color washes layered for depth, visible brush stroke texture, warm paper-tone background bleed, muted pastel palette with occasional vivid accent"
Color guidance: translucent washes, muted palette, warm undertones
Outline: soft pencil sketch lines or no outline
Shading: layered transparent washes
Best for: artistic games, narrative games

### chibi
Full descriptor: "chibi / super-deformed style with oversized round head (2:1 head-to-body ratio), tiny stubby limbs, huge sparkly eyes, kawaii aesthetic, pastel soft tones with pink accents, rounded everything, maximum cuteness"
Color guidance: pastel soft tones, pink and mint accents
Outline: thin rounded outlines, dark brown (#4A3728) not black
Shading: soft gradient blush on cheeks, minimal shadows
Best for: cute games, kids games, casual mobile

## Theme Aesthetics

### fruit
Aesthetic: "colorful farmer's market vibe, warm sunlight, juicy textures, fresh dewdrops, woven basket and wooden crate props, green leaf accents"
Palette: warm reds, sunny yellows, leaf greens, brown wood tones

### space
Aesthetic: "deep cosmic void with vibrant nebula colors, cool blue-purple starfield, neon cyan and magenta energy glows, metallic chrome surfaces, holographic HUD accents"
Palette: deep navy, electric cyan, hot magenta, chrome silver

### ocean
Aesthetic: "underwater coral reef paradise, dappled sunlight rays through clear water, blue-green color grading, bioluminescent accents, gentle current motion feel"
Palette: cerulean blue, seafoam green, coral orange, sandy gold

### halloween
Aesthetic: "spooky but playful halloween night, orange jack-o-lantern glow against purple-black sky, gothic silhouettes, cobwebs and bats, candy-bright accent colors"
Palette: pumpkin orange, witch purple, midnight black, candy green

### candy
Aesthetic: "sugary candy land fantasy, pastel rainbow palette, glossy sugar-coated surfaces, sprinkle textures, bubblegum pink dominant, cotton candy clouds"
Palette: bubblegum pink, mint green, lavender, candy yellow, white frosting

## Custom Theme Handling

For themes not in the preset list, construct the aesthetic as:
"{theme} themed environment, {theme}-inspired visual elements, playful and engaging, vibrant colors appropriate to {theme}"

## Cross-Asset Consistency Anchor

Every prompt should include this consistency paragraph (after style):
"This asset is part of a cohesive set of mobile game sprites. All assets in this set share the same art style, line weight, color saturation level, and rendering technique. Maintain visual harmony with other assets in the set."
