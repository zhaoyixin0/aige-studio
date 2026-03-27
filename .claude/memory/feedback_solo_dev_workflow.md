---
name: Solo dev workflow preference
description: User is solo developer, no PR needed, just push to branches. Merge to master when ready.
type: feedback
---

User is solo developer. No PR review process needed.
- Push to feature branches first, merge to master when stable
- Don't create PRs unless explicitly asked
- Don't use `gh pr create` workflow

**Why:** Solo project, PR adds unnecessary ceremony.
**How to apply:** When user says "push", create branch + push. Don't auto-merge to master or create PRs.
