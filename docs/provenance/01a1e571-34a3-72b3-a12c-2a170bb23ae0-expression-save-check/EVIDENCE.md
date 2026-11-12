# Evidence

## Measurements

### TypeScript's document registry across language services (typescript 5.9.3; 2026-11-12)

Method: two save checks in one process, each a new language service sharing one `ts.createDocumentRegistry()`, writing different text to the same file name at version 1.

- The second check type-checked the first check's text: the registry returns its cached syntax tree for a matching file name and version, whichever service asks. A registry shared that way also keeps every check's files until the process exits, since no service is disposed: a counter around the registry's acquire and release, over one-expression checks, held 4 documents after 1 check, 44 after 11 and 4444 after 1111 (round 18 review, 2026-11-13), and per-check timings with a fresh registry were within noise of the shared one. Each check therefore has its own registry (`check-world.ts`).
