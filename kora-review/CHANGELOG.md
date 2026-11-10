# Changelog

## 0.1.0-alpha.0 (2026-11-10)

First packaged release of KORA's transcript review tool, for hosts to mount on their own page.

- `mountKoraReview(element, options)` mounts the tool and returns `flush()` and `unmount()`. All storage, identity and networking go through the host's `save` adapter.
- `transcriptSchema` and `exportSchema` (JSON Schema draft 2020-12, `additionalProperties: false` throughout), with TypeScript types generated from them. `SCHEMA_VERSION` is 2.
- Export changes from the standalone tool's version 1:
  - `reviewer` is `{ id }` at the top level only. No name or email anywhere.
  - Pending results can hold partial answers (`q0_a`, `q0_b`, `q1`, `q2_turn`, `q3_text`).
  - New: `currentTranscriptId`, and `optedOut` on every result.
  - Annotations index into their own side's conversation (`side` plus `messageIndex`).
  - `profile` and `exitSurvey` are null until answered, and every profile question has `prefer_not_to_say`.
  - Removed: `shareReachedAt` and the per-result `reviewer`.
- Debounced saving (about 2 s), one save in flight, failures reported through `onSaveStateChange` and retried on the next change or `flush()`.
- Resume from a saved export, including a half-answered ranking.
- Content warning before every pair in a sensitive category, with skip-this-pair and skip-the-category.
- Profile before the first pair and exit survey at the end, each optional per mount. `onComplete` fires once per mount.
- Progress shown as "N of M reviewed".
- Removed from the standalone tool: name and email sign-in, `localStorage`, batch loading, export and reset screens, shared-store comparisons, the visible timer, Google Fonts.
- Styles scoped to `.kora-review` with `--kora-*` theming properties. Fonts bundled.
- Accessibility: text labels on header and footer buttons, a keyboard path into each reply, focus moved to each new screen's heading, 44 px targets on touch.
- Example Vite + React 19 host with an in-memory adapter and a fail-on-demand save.
