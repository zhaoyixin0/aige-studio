# AIGE Studio — Project Guide for Claude

## Project Overview
AIGE Studio is a modular social platform game creation tool. Users create games by selecting and assembling pre-built game modules through an AI-guided wizard, with real-time preview and dual export (Web HTML + .apjs for Effect House).

**Owner:** yixin (TikTok, GitHub: zhaoyixin0)
**Team:** 1 person + AI, quality-first, no hard deadline
**Deployment:** Vercel (auto-deploy on push) — https://aige-studio-app.vercel.app
**GitHub:** https://github.com/zhaoyixin0/aige-studio

## Tech Stack
- **Frontend:** React 19 + TypeScript + Vite 8
- **Rendering:** PixiJS 8 (emoji + AI-generated sprite rendering)
- **State:** Zustand
- **Styling:** Tailwind CSS v4 + Radix UI
- **AI:** Claude API (free-form chat), Gemini Imagen 4 (asset generation)
- **Image Processing:** @imgly/background-removal (ONNX WASM, browser-side)
- **Storage:** IndexedDB (asset library via idb-keyval)
- **Testing:** Vitest (543+ tests)
- **Tracking:** MediaPipe (face/hand/body, optional)

## Architecture
```
User Input (Wizard / Chat / Mode B)
    ↓
Agent System (Wizard → GameConfig JSON)
    ↓
Engine (loads modules from config, runs game loop)
    ↓
PixiJS Renderer (emoji themes + AI sprites + particles + sound)
    ↓
Export (Web HTML / .apjs)
```

**Core Principle:** No code generation. Agent only outputs JSON configs. All game logic is in pre-built TypeScript module classes that are instantiated dynamically.

## Key Files & Directories

### Engine Core
- `src/engine/core/` — Engine, EventBus, ConfigLoader, AutoWirer, types
- `src/engine/modules/` — 46 game modules (6 input, 13 mechanic, 5 feedback, 11 extended, 16 platformer batch 1)
- `src/engine/renderer/` — PixiJS rendering (emoji themes, particles, float text, sound synth, HUD)
- `src/engine/tracking/` — MediaPipe wrappers (face, hand, body)

### Agent & Wizard
- `src/agent/wizard.ts` — GameWizard: step-by-step guided game creation (15 game types)
- `src/agent/agent.ts` — Agent orchestrator: wizard routing, Mode B auto-build, enhancement suggestions
- `src/agent/game-presets.ts` — Market-calibrated default params per game type
- `src/agent/skill-loader.ts` — Knowledge base loader
- `src/agent/intent-parser.ts` — Claude API intent classification
- `src/agent/recipe-generator.ts` — Claude API config generation
- `src/agent/local-patterns.ts` — Chinese regex for simple commands (no API needed)

### Asset System
- `src/services/asset-agent.ts` — Auto search/generate/remove-bg/save pipeline
- `src/services/asset-library.ts` — IndexedDB persistent asset storage
- `src/services/bg-remover.ts` — @imgly/background-removal wrapper
- `src/services/prompt-builder.ts` — Context-aware Gemini prompt generation (theme-specific item descriptions)
- `src/services/gemini-image.ts` — Imagen 4 API client

### UI
- `src/ui/layout/main-layout.tsx` — 3-panel layout (chat, preview, editor)
- `src/ui/chat/chat-panel.tsx` — Chat with wizard, Mode B, enhancements
- `src/ui/preview/preview-canvas.tsx` — PixiJS game preview
- `src/ui/editor/` — Module list, properties panel, schema renderer
- `src/ui/assets/` — Asset browser, upload, AI generate dialog
- `src/ui/export/export-dialog.tsx` — Web + .apjs export

### Knowledge Base
- `src/knowledge/game-types/` — 15 game type skill files (Chinese)
- `src/knowledge/modules/` — 19 module skill files
- `src/knowledge/relations/` — Module wiring, synergies, conflicts

### Stores
- `src/store/game-store.ts` — GameConfig state (modules, assets, params)
- `src/store/editor-store.ts` — UI state (selected module, preview mode, chat)

### Exporters
- `src/exporters/web-exporter.ts` — Standalone HTML game export
- `src/exporters/apjs-exporter.ts` — Effect House .apjs export

## 15 Game Types
catch, dodge, tap, shooting, quiz, random-wheel, expression, runner, gesture, rhythm, puzzle, dress-up, world-ar, narrative, platformer

## 5 Emoji Themes
fruit (🧺🍎💣), space (🚀⭐☄️), ocean (🐠🐚🦈), halloween (🎃🍬👻), candy (🤖🍩🌶️)

## 3 Interaction Modes
1. **Wizard (Mode A):** Step-by-step guided creation with progressive preview
2. **Mode B:** Type description → auto-detect game type → one-shot build → enhancement suggestions
3. **Free Chat (Mode C):** Claude API natural language modification

## Environment Variables
```
VITE_ANTHROPIC_API_KEY=<Claude API key>  # Optional: only for Mode C free chat
VITE_GEMINI_API_KEY=<Gemini API key>     # Optional: for AI asset generation
```
Wizard and Mode B work WITHOUT any API keys.

## Commands
```bash
npm run dev          # Dev server
npm run dev -- --host  # Dev server + LAN access
npm run build        # Production build
npx vitest run       # Run all tests (543+)
npx tsc --noEmit     # Type check
```

## Design Documents
- `docs/plans/2026-03-22-aige-studio-design.md` — Complete architecture design
- `docs/plans/2026-03-22-aige-studio-implementation.md` — 22-task implementation plan
- `docs/plans/2026-03-22-game-params-calibration.md` — Market calibration plan
- `docs/plans/2026-03-22-v1-v2-merge.md` — V1 visual merge plan
- `docs/plans/2026-03-22-asset-agent.md` — Asset Agent plan
- `docs/plans/2026-03-23-module-expansion-design.md` — Platformer module expansion design
- `docs/plans/2026-03-23-module-expansion-implementation.md` — 19-task implementation plan

## V1 Reference
Previous prototype at `C:\Users\yixin\Downloads\secret demo\index.html` — single-file Canvas 2D engine with 22 modules, 5 emoji themes, particle effects, Web Audio sound synthesis. V1's visual expressiveness was merged into V2.

## Development History
1. Project scaffolding (Vite + React + TS + Tailwind)
2. Engine core (EventBus, Engine, ModuleRegistry, AutoWirer, ConfigLoader)
3. 19 base modules (input, mechanic, feedback)
4. 11 extended modules (P1/P2/P3: expression detector, combo, jump, powerup, beatmap, gesture match, match engine, runner, plane detection, branch state machine, dress-up)
5. PixiJS renderer + MediaPipe tracking
6. 3-panel UI shell + schema-driven property editor
7. Engine ↔ UI integration (useEngine, useCamera, useGameLoop hooks)
8. Agent system (SkillLoader, IntentParser, RecipeGenerator, Recommender)
9. Knowledge base (37 markdown skill files)
10. Web + .apjs exporters
11. Asset system (browser, upload, AI generate dialog)
12. Preview modes (edit/play/fullscreen) + share/export
13. Guided wizard with 14 game types + market-calibrated presets
14. V1×V2 merge (emoji themes, particles, float text, sound synthesis)
15. V1 interaction modes (progressive preview, Mode B, character selection, enhancements)
16. Asset Agent (auto search → Imagen 4 generate → bg removal → resize → save to IndexedDB)
17. Live sprite/player size adjustment sliders
18. Vercel deployment + GitHub CI

### 2026-03-23
19. 16 platformer modules (Gravity, Knockback, IFrames, PlayerMovement, Dash, CoyoteTime, StaticPlatform, MovingPlatform, OneWayPlatform, CrumblingPlatform, Hazard, Collectible, Inventory, Checkpoint, WallDetect, CameraFollow)
20. Platformer game type preset + integration tests
21. Auto-wirer expansion (Collectible+Collision wiring)
22. Game flow UI: start screen (click to play), countdown overlay (3,2,1,GO!), result screen (score + stars + restart)
23. Canvas click handler for game start/restart (replaces PixiJS events for reliability)
24. Asset library strict theme matching — no cross-theme fallback, forces regeneration
25. Theme-specific asset generation prompts (space→crystal, fruit→strawberry, etc.)
26. Collision re-registration fix on game restart
27. HTML nesting fix (button-in-button → div with role=button)

## Game Flow
```
Start Screen ("click to start")
    ↓ click
Countdown (3, 2, 1, GO!)
    ↓
Playing (timer, score, lives HUD)
    ↓ timer:end / lives:zero
Result Screen (score + stars + time + "click to restart")
    ↓ click
Restart → Countdown...
```

## Module Expansion Plan (3 batches)
- **Batch 1 (done):** 16 platformer modules — physics, movement, platforms, collectibles, camera
- **Batch 2 (planned):** ~7 shooter/bullet modules — Projectile, AimControl, EnemyAI, Health, WaveManager, BulletPattern, Shield
- **Batch 3 (planned):** ~6 action-RPG modules — MeleeAttack, Patrol, ResourcePool, LootDrop, StatusEffect, DialogTrigger
- Design docs: `docs/plans/2026-03-23-module-expansion-design.md`

## Known Issues / Next Steps
- Background removal is slow (~10-30s/image, single-threaded WASM)
- Some game types need custom renderers for full visual experience
- Gemini API key exposed in frontend (fine for internal use, need proxy for public)
- V1's Python backend Agent (WebSocket + tool_use) could be ported for better AI interaction
- Comprehensive mobile touch testing needed
- Platformer modules need renderer integration (platforms/hazards not yet rendered visually)
- Batch 2 & 3 module expansion pending
