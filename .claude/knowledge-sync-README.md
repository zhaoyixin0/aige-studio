# Claude Knowledge Sync

This branch contains Claude Code's accumulated knowledge for the aige-studio project.
To restore on another machine, copy these files to the corresponding locations.

## File Mapping

### Memory (project-specific)
Source: `~/.claude/projects/C--aige-studio/memory/`
Files in: `.claude/memory/`
- `MEMORY.md` — Memory index
- `user_profile.md` — Developer profile (yixin, solo dev)
- `feedback_debugging_style.md` — Debugging preferences (systemic, not one-by-one)
- `feedback_solo_dev_workflow.md` — Workflow preferences (no PR, push to branch)
- `project_nano_banana_pro.md` — Nano Banana Pro image gen migration (2026-03-27)

### Learned Skills (global)
Source: `~/.claude/skills/learned/`
Files in: `.claude/skills/learned/`
- `ai-game-asset-prompts.md` — AI game asset prompt engineering patterns
- `gemini-generatecontent-api.md` — Gemini generateContent API format (vs old predict)

### Global CLAUDE.md
Source: `~/.claude/CLAUDE.md`
File: `.claude/CLAUDE.global.md`
- Core philosophy, modular rules, debugging rules, agent usage, personal preferences

### Rules (global)
Source: `~/.claude/rules/`
Files in: `.claude/rules/`
- `common/` — Coding style, development workflow, testing, git, security, agents, patterns, performance
- `typescript/` — TS-specific coding style, testing, security, patterns, hooks

### Evals (project-specific, already in repo)
Files in: `.claude/evals/`
- `fix-camera-stretch.md` — Camera stretch fix eval
- `fix-game-generation-quality.md` — Game generation quality eval

### Plans (project-specific, already in repo)
Files in: `.claude/plan/`
- `high-priority-expansion.md` — High priority module expansion plan

### Knowledge Base (already tracked in repo)
Files in: `src/knowledge/`
- `asset-prompts/` — 6 prompt engineering skill files (prompt-framework, style-guide, character, item, background, ui-element)
- `game-types/` — 16 game type skill files
- `modules/` — 19+ module skill files
- `relations/` — Module wiring, synergies, conflicts

## How to Restore

### On another machine with Claude Code:

```bash
# Clone and checkout this branch
git clone <repo-url>
git checkout chore/claude-knowledge-sync

# Copy memory files
mkdir -p ~/.claude/projects/C--aige-studio/memory/
cp .claude/memory/*.md ~/.claude/projects/C--aige-studio/memory/

# Copy learned skills
mkdir -p ~/.claude/skills/learned/
cp .claude/skills/learned/*.md ~/.claude/skills/learned/

# Copy global CLAUDE.md (review first — may want to merge with existing)
cp .claude/CLAUDE.global.md ~/.claude/CLAUDE.md

# Copy rules
mkdir -p ~/.claude/rules/common/ ~/.claude/rules/typescript/
cp .claude/rules/common/*.md ~/.claude/rules/common/
cp .claude/rules/typescript/*.md ~/.claude/rules/typescript/
```

The `src/knowledge/`, `.claude/evals/`, and `.claude/plan/` files are already in the project directory and will be available automatically.
