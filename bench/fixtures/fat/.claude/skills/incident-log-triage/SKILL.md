---
name: incident-log-triage
description: >-
  Triage local log dumps under logs/ during incident drills. Use when the user
  points at a log file and asks what failed.
---

# Incident log triage

1. Prefer searching for ERROR/WARN over reading the file top-to-bottom.
2. Quote only evidential lines.
3. Honor NEEDLE_LOGS from CLAUDE.md: ≤10 summary lines in the final reply.
4. Recommend one next diagnostic step — do not patch production from a log guess.
