---
name: debug
description: Read before investigating a bug or failing check whose cause you don't know yet.
---

# Debug

Find out what is actually happening and why before fixing anything. Throwaway code is fine while investigating.

- Before each change, say what you'd see if your hypothesis holds, then make the smallest change that could prove it wrong. One change at a time, so each result has one cause.
- Instrument freely: logs of inputs, branches taken and intermediate state, assertions on "impossible" states, a forced constant or config to take a path. Mark each temporary change with a `DEBUG` comment, and find and revert every one before you commit.
- A flaky or blocked reproduction: improve logging first, so the next failure explains itself.
- A check failing on a commit under review: run it on the parent commit before blaming the commit.
- Logs never hold secrets, tokens or personal information. No destructive operations, such as data loss or irreversible migrations, unless the user asked.

Report in whatever form your task asks for: what you know, what you don't, the evidence for the cause, and the next experiment if it isn't settled.
