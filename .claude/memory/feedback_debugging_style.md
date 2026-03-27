---
name: systematic-debugging-preference
description: User wants Claude to find root causes and generalize fixes across modules, not patch one-by-one
type: feedback
---

When debugging, find the common root cause across modules before fixing individually.
**Why:** User frustrated that Claude fixes the same type of bug in each module separately instead of identifying the shared pattern and applying a unified fix.
**How to apply:** Before fixing a bug, first search for similar patterns across the codebase. If multiple modules have the same issue, fix them all at once with a shared approach. Always ask: "Is this a systemic issue or an isolated one?"
