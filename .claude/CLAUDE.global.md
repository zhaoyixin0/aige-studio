# User-Level CLAUDE.md — yixin

## Core Philosophy

1. **Systematic Debugging**: Find root causes across modules, don't patch one-by-one
2. **Plan Before Execute**: Use Plan Mode for complex operations
3. **Test-Driven**: Write tests before implementation
4. **Agent-First**: Delegate to specialized agents for complex work
5. **Parallel Execution**: Use Task tool with multiple agents when possible

---

## Modular Rules

Detailed guidelines in `~/.claude/rules/`:

| Rule File | Contents |
|-----------|----------|
| common/coding-style.md | Immutability, file organization, error handling |
| common/development-workflow.md | Research-first workflow, TDD, code review pipeline |
| common/testing.md | TDD workflow, 80% coverage requirement |
| common/git-workflow.md | Conventional commits, PR workflow |
| common/security.md | Security checks, secret management |
| common/agents.md | Agent orchestration, when to use which agent |
| common/patterns.md | Design patterns, skeleton projects |
| common/performance.md | Model selection, context management |
| typescript/coding-style.md | TS types, interfaces, immutability, error handling |
| typescript/testing.md | Playwright E2E |
| typescript/security.md | Secret management in TS |
| typescript/patterns.md | API response format, React hooks, repository pattern |

---

## Debugging Rules (CRITICAL)

When encountering a bug:
1. **Search for patterns first** — before fixing, grep the codebase for similar issues
2. **Identify if systemic** — ask: "Does this same problem exist in other modules?"
3. **Fix all instances at once** — don't fix one module then move to the next
4. **Document the root cause** — explain WHY it happened, not just WHAT you changed
5. **Verify across modules** — run tests for all affected areas, not just the one you found

---

## Available Agents

| Agent | Purpose |
|-------|---------|
| planner | Feature implementation planning |
| architect | System design and architecture |
| tdd-guide | Test-driven development |
| code-reviewer | Code review for quality/security |
| security-reviewer | Security vulnerability analysis |
| build-error-resolver | Build error resolution |

---

## Personal Preferences

### Code Style
- No emojis in code, comments, or documentation
- Prefer immutability — never mutate objects or arrays
- Many small files over few large files
- Explicit TypeScript types on public APIs
- No `console.log` in production code

### Git
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`
- Always test locally before committing
- Small, focused commits

### Testing
- TDD: Write tests first
- 80% minimum coverage
- Unit + integration tests required

### Language
- User communicates in Chinese, respond in Chinese when appropriate
- Code and comments in English

---

## Success Metrics

You are successful when:
- All tests pass (80%+ coverage)
- No security vulnerabilities
- Bugs are fixed systemically, not individually
- Code is readable and maintainable
- User requirements are met
