# @alliance/kora-review

KORA's chatbot-transcript review tool, which the Alliance site mounts on its review page. It was copied from `korabench-review` v0.1.0-alpha.0 (github.com/worldalliance/korabench-review) and is maintained here.

A reviewer reads a **conversation**: one simulated child talking to an AI chatbot. They react to lines of the AI's replies with 👍, 👎 or \* (reactions help with the questions and are never saved), then say whether it was safe and how confident they are, and for an unsafe one how serious it would be, at which turn it went wrong, and optionally what worries them.

The host owns everything outside the tool. It gives the tool a reviewer's assigned transcripts and the last export it stored, and it receives the tool's export every time it changes. The tool makes no network requests, stores nothing in the browser (no `localStorage`, `sessionStorage`, cookies or IndexedDB), loads no remote fonts or images, and never navigates the page.

- A workspace package imported as TypeScript source, like `@alliance/common`. `src/engine.ts` is not type-checked yet (`@ts-nocheck`).
- No runtime dependencies, and no React: the tool is plain DOM.
- Styles are scoped to the tool's own root element and themeable with CSS custom properties.
- MIT licence. Bundled fonts are under the SIL Open Font License 1.1.

## Use it

The frontend mounts the tool, and the server imports the schemas and the converter:

- `@alliance/kora-review`: `mountKoraReview` and the types
- `@alliance/kora-review/style.css`
- `@alliance/kora-review/schemas`: `transcriptSchema`, `exportSchema`, `SCHEMA_VERSION`
- `@alliance/kora-review/convert`: `readKoraConversations` and `fromKoraConversation`

## Mount it

```ts
import { mountKoraReview, KoraSaveState } from "@alliance/kora-review";
import "@alliance/kora-review/style.css";

const handle = mountKoraReview(document.getElementById("review")!, {
  reviewerId: "rv_8f3a2c71", // opaque; never a name, email or phone number
  assignment: {
    batchId: "asg_2026_11_10_001", // echoed as the export's batchId
    size: 10, // how many conversations the assignment asks for
    transcripts: [
      { transcript, contentHash: "sha256:…" }, // the conversations given so far, in the order to show them
    ],
  },
  savedExport: storedExportOrNull, // resume exactly where the reviewer left off
  collectProfile: true, // false once this reviewer has answered the profile questions
  collectExitSurvey: true,
  save: (exported) => api.saveExport(exported), // reject to refuse; may resolve with { removed: [ids] }
  next: () => api.nextPair(), // the next { transcript, contentHash }, or null when there are no more
  onComplete: () => showThankYou(), // once per mount
  onSaveStateChange: (s) => setSaveError(s === KoraSaveState.Failed),
});

// Before navigating away:
await handle.flush();
handle.unmount();
```

In React, own only the container and mount in an effect. See [example/src/KoraReview.tsx](example/src/KoraReview.tsx).

### API

| Export                                         | What it is                                                                                                                                                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mountKoraReview(element, options)`            | Adds the tool inside `element` and returns a `KoraReviewHandle`. Throws a `TypeError` for malformed options, a `savedExport` from another `reviewerId` or `batchId`, or a `schemaVersion` it can't read. |
| `KoraReviewOptions`                            | `reviewerId`, `assignment`, `savedExport`, `collectProfile`, `collectExitSurvey`, `optOutCategories` (optional), `save`, `next`, `onComplete`, `onSaveStateChange`.                                      |
| `KoraAssignment`, `KoraAssignedTranscript`     | `{ batchId, size, transcripts: [{ transcript, contentHash }] }`. `contentHash` is `"sha256:<64 hex>"` and is echoed unchanged.                                                                           |
| `KoraReviewHandle`                             | `flush()` saves anything pending now and rejects if that save fails. `unmount()` removes the tool and its listeners; unsaved changes are dropped, so flush first.                                        |
| `KoraSaveResult`                               | What `save` may resolve with: `{ removed }`, transcript ids no longer in the assignment.                                                                                                                 |
| `KoraSaveState`                                | `Saved` and `Failed`.                                                                                                                                                                                    |
| `transcriptSchema`, `exportSchema`             | JSON Schema draft 2020-12 objects.                                                                                                                                                                       |
| `SCHEMA_VERSION`                               | `2`.                                                                                                                                                                                                     |
| `KoraCategory`                                 | Enum of KORA's 26 risk ids.                                                                                                                                                                              |
| `KoraTranscript`, `KoraExport` and their parts | Types generated from the schemas.                                                                                                                                                                        |

### Behaviour

- **Resume exactly.** With a `savedExport`, the tool reopens the same conversation with any half-answered grading questions. Reactions are never saved, so they don't come back.
- **Saving.** About two seconds after the last change (a mark, an answer, an opt-out, moving between conversations), `save` gets the complete export. Never more than one save is in flight; changes made during a save are saved when it settles. When the page is hidden (tab switch, app backgrounded) a pending save goes out straight away.
- **Failed saves.** A rejected save loses nothing. The tool calls `onSaveStateChange(Failed)`, retries on the next change or `flush()`, and calls `onSaveStateChange(Saved)` after the next success. It shows no error of its own: that's the host's.
- **One conversation at a time.** The host gives the conversations so far; once they're all reviewed or skipped and fewer than `size` have been given, the tool saves, then calls `next` and shows "Loading the next conversation…". A rejected `next` shows "Couldn't load the next conversation" with Try again. `null` means there are no more, and the assignment finishes with what was given.
- **Removed conversations.** When `save` resolves with `removed` ids, those conversations leave the tool and its exports without a message; a reviewer on one moves to the next.
- **Progress** is shown as "N of M reviewed" against `size`, where a conversation counts once it's reviewed or skipped. There's no time estimate.
- **Content warnings.** Before each conversation in a sensitive category, the reviewer can continue, skip that conversation (`optedOut: true`), or skip every conversation in the category (added to `optOutCategories`). The host passes earlier opt-outs back as the `optOutCategories` option so later exports keep them.
- **Completion.** When every conversation is reviewed or skipped and `size` conversations were given or `next` gave null, the tool asks the exit survey (if `collectExitSurvey`), sets `isDone`, saves, and then calls `onComplete`, once per mount. Mounting with an export that's already `isDone` shows the summary and calls `onComplete` once. The host shows the thank-you and any "review more" choice; to start another assignment, unmount and mount again with the new assignment and `savedExport: null`.
- **Profile.** With `collectProfile`, the profile questions come before the first conversation. The optional questions have a "Prefer not to say" answer; the required ones don't.

## Theming

Set any of these on the mount element or an ancestor. Unset ones keep KORA's look.

| Property                                                                        | Default (light)                                                        | Used for                                                                                              |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `--kora-color-background`                                                       | `#F1F3F8`                                                              | Page background                                                                                       |
| `--kora-color-surface`                                                          | `#FFFFFF`                                                              | Cards, AI replies, sheets                                                                             |
| `--kora-color-text` / `--kora-color-text-muted`                                 | `#151A2D` / `#566079`                                                  | Text                                                                                                  |
| `--kora-color-border`                                                           | `#D6DBE6`                                                              | Borders                                                                                               |
| `--kora-color-accent` / `--kora-color-accent-text` / `--kora-color-accent-soft` | `#2B45D2` / `#FFFFFF` / `#E1E6FF`                                      | Primary buttons, focus, links                                                                         |
| `--kora-color-positive` / `--kora-color-positive-soft`                          | `#0A7A54` / `#CBEEDD`                                                  | +1 marks                                                                                              |
| `--kora-color-negative` / `--kora-color-negative-soft`                          | `#BE2235` / `#FAD6DA`                                                  | −1 marks                                                                                              |
| `--kora-color-neutral`, `--kora-color-on-semantic`, `--kora-color-highlight`    | `#876000`, `#FFFFFF`, `#FFE14D`                                        | Hints, text on +1/−1 buttons, the selection                                                           |
| `--kora-color-child-bubble`, `--kora-color-code`                                | `#E2E6F0`, `#ECEFF6`                                                   | Child messages, code                                                                                  |
| `--kora-radius` / `--kora-radius-large`                                         | `12px` / `18px`                                                        | Controls / cards and sheets                                                                           |
| `--kora-font-family` / `--kora-font-family-display` / `--kora-font-family-mono` | Atkinson Hyperlegible / Bricolage Grotesque / JetBrains Mono (bundled) | Text                                                                                                  |
| `--kora-top-offset`                                                             | `0px`                                                                  | Height of a sticky host header, so the tool's sticky header sits below it                             |
| `--kora-z-index`                                                                | `0`                                                                    | Base added to the tool's layers (sticky header 20, footer 20, sheet 40, toasts 50, question intro 60) |

The colour scheme follows `prefers-color-scheme`. To force one, put `data-kora-theme="light"` or `"dark"` on an ancestor. Colour overrides apply in both schemes, so a host that sets colours should also set `data-kora-theme`.

The review screen uses `position: sticky` for its header and `position: fixed` for its footer, bottom sheet and the full-screen question intro, and it scrolls the window while a reviewer drags a selection. A transformed ancestor would break the fixed layers.

## Schemas

The host validates every uploaded transcript line against `transcriptSchema` and every saved export against `exportSchema`. Both use `additionalProperties: false` everywhere, so an unnamed field fails validation. Use ajv's 2020-12 build with formats:

```ts
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { exportSchema, transcriptSchema } from "@alliance/kora-review/schemas";

const ajv = new Ajv2020({ strict: true });
addFormats(ajv);
const validateTranscript = ajv.compile(transcriptSchema);
const validateExport = ajv.compile(exportSchema);
```

**Transcript** (one upload line): `transcriptId` (unique within an upload; the schema can't check that across lines), `category` (one of the 26 risk ids), `itemType` (`scored`, `practice` or `test`), `scenarioTitle`, `childAge`, `nTurns`, and `conversation`, a list of `{ role: "child" | "ai", text }` with at least one `ai` turn. Optional: `ageBand`, `childGender`, `childBackground`, `scenario`, `extended`, `referenceVerdict` and `referenceReason`. AI text may use a small Markdown subset and LaTeX maths.

**Export**: `schemaVersion`, `batchId`, `reviewer: { id }`, `exportedAt`, `currentTranscriptId`, `results` (one per assigned conversation, in assignment order), `profile` and `exitSurvey` (null until answered), `optOutCategories`, `isDone`. A pending result may hold some of `q1`, `q2_confidence`, `q3_severity` and `q4_text` and not others; a done result holds `q1` (`ok` or `not_ok`, shown as Safe or Unsafe) and `q2_confidence`, plus `q3_severity` when `q1` is `not_ok`, and `q4_text` only if the reviewer wrote one. A skipped result has `optedOutAt`. Each result's `reactions` list the reviewer's line reactions: `turnIndex`, `charStart`/`charEnd` (Unicode code points into the turn's text), the verbatim `text` and `kind` (`up`, `down` or `notable`).

**KORA's export** (docs/kora/kora_export.schema.yaml) is built by the host from every stored export: `toKoraHighlights` from `@alliance/kora-review/highlights` turns a result's reactions into KORA's highlights (each 👍 line a like; a run of 👎 lines one dislike; \* left out).

The TypeScript types are generated from the schemas (`bun run gen:types`), and a test fails if they drift. `SCHEMA_VERSION` is bumped whenever either schema changes shape.

Synthetic samples are in `samples/`: [`samples/transcript.json`](samples/transcript.json), [`src/sample-export.ts`](src/sample-export.ts) (with a partly answered pending result, in `src` so the server can import it), [`src/example-pair.ts`](src/example-pair.ts) (the practice conversation the site shows before real ones, in a category with no content warning) and [`samples/transcripts.json`](samples/transcripts.json) (five transcripts). None of them is real reviewer data or a real child's conversation.

### Converting KORA's transcript files

The server converts KORA's native files on upload with `readKoraConversations` and `fromKoraConversation` from `@alliance/kora-review/convert`, then validates each result against `transcriptSchema`. They map KORA's conversation file (`conversation_id`, `item_type`, `risk_id`, `conversation`, …; [docs/kora/kora_conversations.schema.yaml](../docs/kora/kora_conversations.schema.yaml)) to transcript fields and drop everything else. To check a file by hand:

```bash
bun scripts/kora-to-transcripts.mjs conversations.jsonl > transcripts.jsonl
```

## Accessibility

- Works with a keyboard alone. Tab to an AI reply and use ← and → to select words (Shift extends), then press + or −, or Enter to move to the sheet's labelled buttons. On touch, tap a word, then tap another to stretch the mark; no drag is needed.
- Every control has a visible text label except close (✕).
- Progress changes and opt-outs are announced through a polite live region without moving focus.
- +1 and −1 differ by underline style, icon and text as well as colour.
- No horizontal page scrolling at 320 CSS px (tables and code blocks scroll inside themselves). Touch targets are at least 44 × 44 px on coarse pointers.
- Focus is never entirely hidden behind the sticky header or fixed footer.
- Animations are off under `prefers-reduced-motion`.

## Development

```bash
bun test               # from kora-review/: schemas, converter, saving, resume, failure recovery, completion
bun run typecheck
bun run gen:types      # after changing src/schemas.ts
```
