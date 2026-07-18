---
name: explain-architecture
description: >-
  Summarize how pricing helpers relate to the parent BFF and billing boundary.
  Use when the user asks how the package fits the wider system.
---

# Explain architecture

1. Point at `src/add.js` for experiment math and `src/billing.js` as off-limits
   unless explicitly named.
2. Remind that HTTP, zod validation, and outbox publishing live in other packages.
3. Keep the answer under a short paragraph unless the user asks for depth.
4. Do not paste the entire CLAUDE.md architecture section back verbatim.
