# Changelog

## Unreleased

- One chatbot instead of two: a transcript has one `conversation`, shown in a single column. `SCHEMA_VERSION` is 4.
- Uploads read KORA's conversation file (docs/kora/kora_conversations.schema.yaml): `conversation_id`, `item_type` (`scored`, `practice` or `test`), `child_gender`, `n_turns`, `extended`, and for practice items `reference_verdict` and `reference_reason`. Transcripts gain `itemType` (replacing `pairType`), `childGender`, `nTurns`, `extended`, `referenceVerdict` and `referenceReason`.
- The grading card asks KORA's questions: Safe or Unsafe (`q1`, saved as `ok` or `not_ok`), confidence 1–4 (`q2_confidence`), and for Unsafe, severity 1–4 (`q3_severity`) and an optional worry (`q4_text`). There is no turn question. Questions fade in and out.
- Reactions replace word marks: 👍, 👎 or \* on an on-screen line, from a picker (click, or long-press on a phone), or by tapping or clicking a line 2, 3 or 4 times for 👍, 👎 or none; arrows, Enter and 1/2/3 from the keyboard. A run of 👎 in one reply, unbroken by 👍 or \*, is a passage: the first is quoted above the worry box. Each result saves its `reactions` (turn, code-point span, text, `up`, `down` or `notable`), which come back on resume; `toKoraHighlights` in `@alliance/kora-review/highlights` turns them into KORA's highlights.
- Removed from the export: `annotations`, `netSum`, `plusCount`, `minusCount`, `stale`, and the A/B fields. A skipped result records `optedOutAt`.
- The content warning offers only skipping the whole topic.
- The finish screen shows each conversation's Safe or Unsafe. Reviewer-facing text says "conversation" and "review".
- The age chip opens the child's story and the scenario. The child's gender, when given, shows with their age.
- Pairs come one at a time. `assignment.size` says how many the assignment asks for, `assignment.transcripts` holds those given so far, and the new required `next` option fetches each further one after a save, or returns null when there are no more. A failed `next` shows Try again.
- `save` may resolve with `{ removed }` (`KoraSaveResult`): pairs taken out of the assignment, which the tool drops without a message.
- The content warning no longer counts the pairs left on its topic, which the tool can't know, and always offers to skip the whole topic.
- New `optOutCategories` mount option: categories the reviewer opted out of in earlier assignments. The export's `optOutCategories` repeats them alongside this assignment's own.
- New `parseKoraCategories` in `@alliance/kora-review/parse`, and `CATEGORIES` exported from `@alliance/kora-review/categories`.
- The content warning says skipping every pair on a topic also skips it in later batches.
- Required profile questions (parent or guardian, children's ages, country, age, English) no longer offer "Prefer not to say". The export schema still accepts `prefer_not_to_say` for them, for exports saved earlier.

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
