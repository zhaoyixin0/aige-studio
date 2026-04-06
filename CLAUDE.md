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
- **Testing:** Vitest (1120+ tests)
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
- `src/engine/modules/` — 60 game modules (6 input, 13 mechanic, 5 feedback, 11 extended, 16 platformer batch 1, 7 shooter batch 2, 6 RPG batch 3 — but only 2 dummy)
- `src/engine/renderer/` — PixiJS rendering (emoji themes, particles, float text, sound synth, HUD)
- `src/engine/tracking/` — MediaPipe wrappers (face, hand, body)

### Agent & Wizard
- `src/agent/conversation-agent.ts` — ConversationAgent: unified Claude tool_use agent (replaces wizard UI)
- `src/agent/singleton.ts` — Shared ConversationAgent singleton (survives HMR)
- `src/agent/wizard.ts` — GameWizard: step-by-step guided game creation (15 game types, internal utility), re-selectable choices, background question
- `src/agent/agent.ts` — Agent orchestrator: wizard routing, Mode B, guided creator, enhancement suggestions
- `src/agent/guided-creator.ts` — LLM-guided game creation through free conversation (Claude API tool_use)
- `src/agent/game-presets.ts` — Market-calibrated default params per game type (incl. platformer 1080x1920)
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
- `src/ui/layout/main-layout.tsx` — Two-phase layout: landing → studio (chat+preview+editor)
- `src/ui/landing/landing-page.tsx` — Centered input page with dynamic suggestion chips
- `src/ui/chat/studio-chat-panel.tsx` — In-studio chat panel with ConversationAgent
- `src/ui/chat/suggestion-chips.tsx` — Dynamic suggestion chips component
- `src/ui/chat/chat-panel.tsx` — Legacy chat panel (kept for compatibility)
- `src/ui/preview/preview-canvas.tsx` — PixiJS game preview
- `src/ui/editor/` — Module list, properties panel, schema renderer (collapsible)
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

## Interaction Mode
**Conversational Creation** — Google AI Studio inspired UI:
- Landing page: centered input + game type suggestion chips
- User describes game → ConversationAgent (Claude tool_use) infers params, ≤3 follow-up rounds
- Game created → two-panel studio (chat 40% + preview 60%), editor collapsible
- Dynamic suggestion chips change by phase: game types → modules → enhancements
- Works without API key (regex fallback for game type detection)

Old modes (Wizard, Mode B, GuidedCreator) kept as internal utilities.

## Environment Variables
```
VITE_ANTHROPIC_API_KEY=<Claude API key>  # For ConversationAgent (optional: regex fallback without key)
VITE_GEMINI_API_KEY=<Gemini API key>     # For AI asset generation (optional)
```
Wizard and Mode B work WITHOUT any API keys.

## Commands
```bash
npm run dev          # Dev server
npm run dev -- --host  # Dev server + LAN access
npm run build        # Production build
npx vitest run       # Run all tests (1120+)
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
13. Guided wizard with 15 game types + market-calibrated presets
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

### 2026-03-24
28. BaseModule unified gameflowPaused mechanism — all modules coordinate with GameFlow state
29. Comprehensive module coordination fixes: event names, collision radii, scorer configurability, restart state
30. Platformer rendering: platforms, collectibles, hazards, checkpoints, camera follow
31. Runner/Rhythm/World-AR HUD rendering (15/15 game types fully rendered)
32. 16 platformer modules registered in module-setup.ts + CameraFollow
33. Platformer game type added to wizard (15th type) with 1080x1920 preset
34. All game types open all 5 input methods — remapEventsForInput auto-maps events
35. TouchInput hold/release for continuous platformer movement (left/right half screen)
36. Wizard step re-selection: click previous choices to rewind and re-answer
37. AI background generation question in wizard + PixiRenderer background image support
38. GuidedCreator: LLM-guided game creation through free conversation (Claude API tool_use)
39. PixiRenderer event listener cleanup prevents accumulation on restart
40. Asset extraction expanded for Collectible/Hazard/PlayerMovement modules
41. Architecture improvements: BaseModule auto-track listeners, module dependency declarations, EventBus debug mode, PixiRenderer destroy leak fix
42. Event constants registry (src/engine/core/events.ts) — centralized event names + payload interfaces
43. Module combination diagnostics system (EventRecorder + 9 rules + CombinationGenerator)
44. Integration test matrix: 90 lifecycle tests (15 types × 6) + 300 combination tests
45. Browser console diagnostics: window.__diagnostics.start/stop/report
46. Dodge game scoring fix (scorePerSecond for survival-based scoring)
47. Background rendering fix (buildConfig assets, config sync, sprite cache invalidation)
48. Art style wizard step — 6 styles (cartoon, pixel, flat, realistic, watercolor, chibi)
49. Green screen sprite prompts (#00FF00) + HSV chroma-key bg removal (~10ms vs ~30s)

### 2026-03-25
50. Conversational UI redesign — Google AI Studio inspired landing page + studio layout
51. ConversationAgent: unified Claude tool_use agent (create_game, modify_game, suggest_enhancements)
52. Dynamic suggestion chips: game types → module recommendations → enhancement suggestions
53. Two-phase layout: centered landing → chat+preview studio, collapsible editor
54. LandingPage + StudioChatPanel + SuggestionChips components
55. ConversationAgent fixes: shared singleton, history preservation, input method confirmation
56. Custom theme support — any theme string accepted, LLM generates matching asset descriptions
57. Generic asset IDs (good_1/good_2/bad_1 instead of star/apple/bomb) — LLM controls content via asset_descriptions
58. Style/theme change triggers asset regeneration (clears src to force re-generate)
59. Collision module added to platformer preset, resolving dependency warnings

### 2026-03-25 (continued)
60. Platform physics integration — Gravity surface system, AutoWirer 5 new rules, PlayerMovement lock/delta, Dash freeze
61. Batch 2: 7 shooter modules (Health, Shield, Projectile, BulletPattern, Aim, EnemyAI, WaveSpawner)
62. Batch 3: 6 action-RPG modules (LevelUp, StatusEffect, EquipmentSlot, EnemyDrop, SkillTree, DialogueSystem)
63. 157 new tests (963 → 1120), TDD methodology for all new modules

### 2026-03-26
64. Game generation quality fix — shooting preset rewritten as combat shooter (Projectile+EnemyAI+WaveSpawner), old Spawner-based pattern removed
65. AutoWirer: 3 new rules — Projectile+Collision (register/track/destroy), WaveSpawner+Collision (enemy lifecycle), Spawner position sync
66. Runner preset: dual collision rules (items=hit for coins, obstacles=damage for obstacles) + Spawner per-item layer support
67. ConversationAgent: 14 missing modules added to ALL_MODULES, per-game-type "module recipe" knowledge in system prompt, action-rpg game type support
68. Wizard shooting definition updated with combat modules (Projectile, Aim, EnemyAI, WaveSpawner, Health)
69. Knowledge base: shooting.md rewritten for combat shooter, new platformer.md and action-rpg.md skill files (16/16 game types documented)
70. 1175 tests passing (+55 from 1120)

### 2026-03-30
71. Systemic game quality fix — shooting/action-rpg now playable
72. AutoWirer: WaveSpawner+EnemyAI rule (wave:spawn → addEnemy, enemy:death → removeEnemy)
73. PlayerMovement: Y coordinate tracking, init X to canvas center, defaultY param, emit {x, y} in player:move
74. Projectile: autoFire param for continuous fire without manual taps
75. Renderer: 3-path routing (platformer/shooter/spawner) replacing 2-path, new syncShooterPlayer method
76. TouchInput: default center-bottom position on init + reset (catch/dodge player visible at start)
77. Runner: lane-based player rendering from Runner.getCurrentLane()
78. Presets: shooting uses chase behavior (detectionRange: 2000), autoFire: true; all presets playerSize: 64
79. 1349 tests passing (+174 from 1175)

### 2026-03-31
80. Contract-based auto-wiring system — modules self-declare capabilities via getContracts() (collisionProvider, damageReceiver, damageSource, playerPosition)
81. AutoWirer rewritten: 4-phase algorithm (Registration, Damage Routing, Queries, Bridges) replaces 10 hardcoded WIRING_RULES
82. Damage routing convention: collision:hit = A damages B, collision:damage = B damages A — automatic amount resolution from contracts
83. PlayerMovement follow mode (mode:'follow' + lerp) for shooter/RPG touch-following
84. Renderer collision decoupling — game-object-renderer and shooter-renderer no longer touch Collision module
85. health:zero → lives:zero bridge in AutoWirer for GameFlow integration
86. aim:queryTargets handler for Aim module enemy position queries
87. Shooting/action-rpg presets updated: follow mode, attackRange:40
88. 6 modules with contracts: Spawner, Projectile, EnemyAI, PlayerMovement, Collectible, Health
89. 1409 tests passing (+60 from 1349), 11 contract wiring integration tests

### 2026-03-31 (continued) — Game Quality Audit
90. TouchInput: emit `input:touch:position` on pointerDown/pointerMove for follow-mode player control
91. Shooting/action-rpg presets: add `continuousEvent: 'input:face:move'` to PlayerMovement — fixes face/touch control
92. Platformer: remove swipe-based movement, use hold-based continuous input instead
93. Jump + Gravity integration: Jump registers player in Gravity system, uses surface landing instead of fixed groundY
94. Variable jump height: `jump:release` event cuts velocity 50% for short hops vs full jumps
95. Dash invulnerability: emits `iframes:start/end` during dash for damage immunity
96. IFrames visual feedback: player sprite alpha flickers (0.3/1.0 per 100ms) during invulnerability
97. Platformer preset expanded: 12 platforms (static+moving+one-way), 8 collectibles, 3 hazards, 2 checkpoints
98. WaveSpawner: `maxEnemiesPerWave` param caps exponential scaling (default: 15)
99. Catch preset: mixed good+bad items with dual collision rules (hit+damage)
100. Dodge preset: mixed bad+good items with scoring on pickup
101. Rhythm preset: 150 pre-generated beats at 120 BPM covering 60s with syncopation
102. Action-RPG: SkillTree populated with 3 skills (power_strike, heal, speed_burst) + EquipmentSlot module
103. Quiz: varied correctIndex across questions (was all 0, now 1/2/0/3/1)
104. Runner: speed 400→900 with acceleration 15 (was 250 with acceleration 10)
105. 1448 tests passing (+39 from 1409), 3 new test files (preset-quality, game-feel, touch-input expanded)

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
- **Batch 2 (done):** 7 shooter modules — Projectile, Aim, EnemyAI, Health, WaveSpawner, BulletPattern, Shield
- **Batch 3 (done):** 6 action-RPG modules — LevelUp, StatusEffect, EquipmentSlot, EnemyDrop, SkillTree, DialogueSystem
- Design docs: `docs/plans/2026-03-23-module-expansion-design.md`

## Diagnostics System
- **Vitest:** `npx vitest run src/__tests__/integration/module-combinations.test.ts` — 300 combination tests
- **Browser console:** `__diagnostics.start()` → play → `__diagnostics.stop()` — event flow analysis
- **EventBus debug:** `__engine.eventBus.setDebug(true)` — real-time event logging

## New Module Integration Checklist (CRITICAL)
When adding new collision-based modules:
1. **getContracts()**: Implement collisionProvider/damageReceiver/damageSource/playerPosition contracts — AutoWirer reads these to auto-wire everything
2. **Renderer routing**: If new game pattern, add a routing path in `game-object-renderer.ts` (currently: platformer/shooter/spawner)
3. **Event contracts**: Verify all event payloads match consumer expectations (e.g., `player:move` must include `{x, y}`)
4. **Integration test with real preset**: Test end-to-end flow using actual preset config, not hand-crafted test configs
5. **getDependencies()**: New modules must declare requires/optional dependencies

No auto-wirer code changes needed for collision-based modules — just implement getContracts().
Platform→Gravity bridges remain as BRIDGE_RULES in auto-wirer.ts (5 rules).

Lesson: Batch 2/3 modules passed unit tests but failed in real games because the integration layer was not updated. Contract system prevents this by making wiring self-declaring.

## Known Issues / Next Steps
- Gemini API key exposed in frontend (fine for internal use, need proxy for public)
- Comprehensive mobile touch testing needed
- GuidedCreator conversation could benefit from streaming responses
- Code duplication in game-object-renderer (syncShooterPlayer vs syncPlayer) — extract shared createPlayerContainer method
