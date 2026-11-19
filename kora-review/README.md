# @alliance/kora-review

KORA's conversation review tool, which the Alliance site mounts on its review page. It was copied from `korabench-review` v0.1.0-alpha.0 (github.com/worldalliance/korabench-review) and is maintained here.

A reviewer works through a **session**: one conversation at a time, a simulated child and one AI chatbot. Each conversation takes two screens — **Read**, where they highlight passages of the AI's answers they like or dislike and say what the child talked about, then **Judge**, where they say whether the answer would be OK for a child of this age, how confident they are, and, when it is not OK, how serious it is and what worries them. The session ends with seven feedback questions.

The host owns everything outside the tool. It gives the tool the session's conversations and the last export it stored, and it receives the tool's export every time it changes. The tool makes no network requests, stores nothing in the browser (no `localStorage`, `sessionStorage`, cookies or IndexedDB), loads no remote fonts or images, and never navigates the page.

- A workspace package imported as TypeScript source, like `@alliance/common`.
- No runtime dependencies, and no React: the tool is plain DOM.
- Styles are scoped to the tool's own root element and themeable with CSS custom properties.
- MIT licence. Bundled fonts are under the SIL Open Font License 1.1.

## Use it

The frontend mounts the tool, and the server imports the schemas and the converter:

- `@alliance/kora-review`: `mountKoraReview` and the types
- `@alliance/kora-review/style.css`
- `@alliance/kora-review/schemas`: `conversationSchema` (what the host stores), `itemSchema` (what it serves), `exportSchema` (what the tool saves), `SCHEMA_VERSION`
- `@alliance/kora-review/convert`: `readKoraRecords`, `fromKoraConversation` and `fromKoraPair`

## Mount it

```ts
import { mountKoraReview, KoraSaveState } from "@alliance/kora-review";
import "@alliance/kora-review/style.css";

const handle = mountKoraReview(document.getElementById("review")!, {
  reviewerId: "rv_8f3a2c71", // opaque; never a name, email or phone number
  session: {
    id: "ses_2026_12_01_001", // echoed as the export's sessionId
    number: 1, // 1-based for this reviewer; the first session carries the practice conversations
    budgetUnits: 5, // what the session may spend, against each item's weightUnits
    items: [item], // the conversations given so far, in the order to show them
  },
  savedExport: storedExportOrNull, // resume exactly where the reviewer left off
  save: (exported) => api.saveExport(exported), // reject to refuse; may resolve with { removed: [ids] }
  next: () => api.nextConversation(), // { item } or { done: "budget_spent" | "queue_empty" }
  onOptOutRisk: (riskId) => api.optOut(riskId), // from a content warning
  onOpenAccount: () => router.push("/account"), // the tool never navigates
  onComplete: ({ again }) => (again ? startSession() : showThankYou()), // once per mount
  onSaveStateChange: (s) => setSaveError(s === KoraSaveState.Failed),
});

// Before navigating away:
await handle.flush();
handle.unmount();
```

In React, own only the container and mount in an effect. See [example/src/KoraReview.tsx](example/src/KoraReview.tsx).

### API

| Export                                             | What it is                                                                                                                                                                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mountKoraReview(element, options)`                | Adds the tool inside `element` and returns a `KoraReviewHandle`. Throws a `TypeError` for malformed options, a `savedExport` from another `reviewerId` or `sessionId`, or a `schemaVersion` it can't read. |
| `KoraReviewOptions`                                | `reviewerId`, `session`, `savedExport`, `save`, `next`, `onOptOutRisk`, `onOpenAccount`, `onComplete`, `onSaveStateChange`.                                                                                |
| `KoraSession`, `KoraItem`                          | `{ id, number, budgetUnits, items }`. An item carries its risk guide, its weight in load units, and a `contentHash` of `"sha256:<64 hex>"`, echoed unchanged.                                              |
| `KoraReviewHandle`                                 | `flush()` saves anything pending now and rejects if that save fails. `unmount()` removes the tool and its listeners; unsaved changes are dropped, so flush first.                                          |
| `KoraSaveResult`                                   | What `save` may resolve with: `{ removed }`, conversation ids no longer in the session.                                                                                                                    |
| `KoraSaveState`                                    | `Saved` and `Failed`.                                                                                                                                                                                      |
| `conversationSchema`, `itemSchema`, `exportSchema` | JSON Schema draft 2020-12 objects. `transcriptSchema`, the pair upload of spec 5.2, is still exported from `./schemas` and goes with the pair upload.                                                      |
| `SCHEMA_VERSION`                                   | `3`.                                                                                                                                                                                                       |
| `KoraCategory`                                     | Enum of KORA's 26 risk ids.                                                                                                                                                                                |
| `KoraItem`, `KoraExport` and their parts           | Types generated from the schemas.                                                                                                                                                                          |

### Behaviour

- **Two screens, no way back.** Read, then Judge. An answer cannot be changed once its screen is submitted, and highlights are made on the Read screen only; the Judge screen shows them marked.
- **Resume exactly.** With a `savedExport`, the tool reopens the same conversation on the same screen, with the same highlights and any half-answered judge questions, and the time already spent on that screen still counted.
- **Saving.** About two seconds after the last change (a highlight, an answer, a skip, moving between screens), `save` gets the complete export. Never more than one save is in flight; changes made during a save are saved when it settles. When the page is hidden (tab switch, app backgrounded) a pending save goes out straight away.
- **Failed saves.** A rejected save loses nothing. The tool calls `onSaveStateChange(Failed)`, retries on the next change or `flush()`, and calls `onSaveStateChange(Saved)` after the next success. It shows no error of its own: that's the host's.
- **One conversation at a time.** The host gives the conversations so far; once the current one is finished the tool saves, then calls `next` and shows "Loading the next conversation…". A rejected `next` shows "Couldn't load the next conversation" with Try again. `{ done: "budget_spent" }` ends the session, `{ done: "queue_empty" }` offers the account page first.
- **Removed conversations.** When `save` resolves with `removed` ids, those conversations leave the tool and its exports without a message; a reviewer on one moves to the next.
- **Progress** is the share of the session's `budgetUnits` spent, never a count of conversations, so a long one doesn't read as a fraction. There's no time estimate.
- **Soft blocks.** On a practice conversation, on the reviewer's very first rated one, and on the Read screen of a risk they meet for the first time, Next is disabled for 45 seconds of visible time. Time already banked counts, so a reload doesn't restart it.
- **Content warnings.** Before a conversation on a hard risk, the reviewer can continue, skip it, or skip it and ask not to be shown that risk again (`onOptOutRisk`). A skip is recorded in the export; the host releases the conversation.
- **Practice.** A `kind: "practice"` conversation is followed by its reference answer and reason, counts nothing towards the budget, and carries no comprehension question.
- **Completion.** When the host says the budget is spent, the tool asks the seven feedback questions (all optional, skippable), sets `isDone`, saves, and shows the session-complete screen. `onComplete({ again })` says whether the reviewer asked for another session; to start one, unmount and mount again with the new session and `savedExport: null`.

## Theming

Set any of these on the mount element or an ancestor. Unset ones keep KORA's look.

| Property                                                                        | Default (light)                                                        | Used for                                                                                              |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `--kora-color-background`                                                       | `#F1F3F8`                                                              | Page background                                                                                       |
| `--kora-color-surface`                                                          | `#FFFFFF`                                                              | Cards, AI replies, sheets                                                                             |
| `--kora-color-text` / `--kora-color-text-muted`                                 | `#151A2D` / `#566079`                                                  | Text                                                                                                  |
| `--kora-color-border`                                                           | `#D6DBE6`                                                              | Borders                                                                                               |
| `--kora-color-accent` / `--kora-color-accent-text` / `--kora-color-accent-soft` | `#2B45D2` / `#FFFFFF` / `#E1E6FF`                                      | Primary buttons, focus, links                                                                         |
| `--kora-color-positive` / `--kora-color-positive-soft`                          | `#0A7A54` / `#CBEEDD`                                                  | Liked highlights                                                                                      |
| `--kora-color-negative` / `--kora-color-negative-soft`                          | `#BE2235` / `#FAD6DA`                                                  | Disliked highlights                                                                                   |
| `--kora-color-neutral`, `--kora-color-on-semantic`, `--kora-color-highlight`    | `#876000`, `#FFFFFF`, `#FFE14D`                                        | Hints, text on +1/−1 buttons, the selection                                                           |
| `--kora-color-child-bubble`, `--kora-color-code`                                | `#E2E6F0`, `#ECEFF6`                                                   | Child messages, code                                                                                  |
| `--kora-radius` / `--kora-radius-large`                                         | `12px` / `18px`                                                        | Controls / cards and sheets                                                                           |
| `--kora-font-family` / `--kora-font-family-display` / `--kora-font-family-mono` | Atkinson Hyperlegible / Bricolage Grotesque / JetBrains Mono (bundled) | Text                                                                                                  |
| `--kora-top-offset`                                                             | `0px`                                                                  | Height of a sticky host header, so the tool's sticky header sits below it                             |
| `--kora-z-index`                                                                | `0`                                                                    | Base added to the tool's layers (sticky header 20, footer 20, sheet 40, toasts 50, question intro 60) |

The colour scheme follows `prefers-color-scheme`. To force one, put `data-kora-theme="light"` or `"dark"` on an ancestor. Colour overrides apply in both schemes, so a host that sets colours should also set `data-kora-theme`.

The review screens use `position: sticky` for the header and `position: fixed` for the bottom sheet and toasts, and the window scrolls while a reviewer drags a selection. A transformed ancestor would break the fixed layers.

## Schemas

The host validates every stored conversation against `conversationSchema`, every conversation it serves against `itemSchema`, and every saved export against `exportSchema`. All of them use `additionalProperties: false` everywhere, so an unnamed field fails validation. Use ajv's 2020-12 build with formats:

```ts
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import {
  conversationSchema,
  exportSchema,
  itemSchema,
} from "@alliance/kora-review/schemas";

const ajv = new Ajv2020({ strict: true });
addFormats(ajv);
const validateConversation = ajv.compile(conversationSchema);
const validateItem = ajv.compile(itemSchema);
const validateExport = ajv.compile(exportSchema);
```

**Conversation** (one stored conversation): `conversationId` (unique within an upload), `itemType` (`scored`, `practice`, `attention` or `test`), `riskId` (one of the 26 risk ids), `scenarioTitle`, `childAge`, `childBackground`, `scenario`, `nTurns` (AI turns) and `conversation`, a list of `{ role: "child" | "ai", text }` starting on a child turn. `comprehensionOptions` and `comprehensionCorrect` are required on scored and attention conversations, `referenceVerdict` on practice and attention, `referenceReason` on practice. Optional: `ageBand`, `childGender`, `optIn`. AI text may use a small Markdown subset and LaTeX maths.

**Item** (one conversation as it is served): the conversation itself plus `riskName`, `guide`, `hard`, `firstTimeOnRisk`, `kind` (`practice` or `rated`), `comprehension` (four options, or null), `reference` (a practice answer, or null), `position`, `weightUnits` and `contentHash`. What the host keeps to itself: the model, the judge's grade, whether this is the attention conversation, and the correct comprehension answer.

**Export**: `schemaVersion`, `sessionId`, `reviewer: { id }`, `exportedAt`, `place` (the conversation and screen to reopen), `ratings`, `skips`, `feedback` (null until answered or skipped) and `isDone`. A rating carries `status` (`reading`, `judging`, `done`), `position`, `firstTimeOnRisk`, `comprehensionAnswer` (the import's index, not the displayed one), `q1`, `q2Confidence`, `q3Severity` and `q4Text` (both only on a Not OK verdict), `highlights`, the two screen timers, and its timestamps. A highlight gives `turnIndex`, `charStart`/`charEnd` as Unicode code points into that turn's text, the span `text` verbatim, `valence` (`like` or `dislike`) and an optional `reason` from the list that valence allows.

The TypeScript types are generated from the schemas (`bun run gen:types`), and a test fails if they drift. `SCHEMA_VERSION` is bumped whenever either schema changes shape.

Synthetic samples are in [`src/sample-export.ts`](src/sample-export.ts): `SAMPLE_ITEMS`, a practice conversation and a rated one, and `SAMPLE_EXPORT`, a session with one finished and one part-way through. They are in `src` so the server can import them. [`test/fixtures/kora_conversations_12.yaml`](test/fixtures/kora_conversations_12.yaml) holds twelve conversations in KORA's import format. None of them is real reviewer data or a real child's conversation.

### Converting KORA's files

The server converts KORA's native files on upload with `readKoraRecords` from `@alliance/kora-review/convert`, then one of the two converters, then validates each result against its schema. `fromKoraConversation` maps a spec v6 conversation (`conversation_id`, `risk_id`, `n_turns`, `conversation`, …) onto `conversationSchema`; `fromKoraPair` maps a spec v5.2 pair (`pair_id`, `conversation_a`, …) onto `transcriptSchema`, and goes when the pair task does. Both drop everything the schema doesn't name. To check a pair file by hand:

```bash
bun scripts/kora-to-transcripts.mjs pairs.jsonl > transcripts.jsonl
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
