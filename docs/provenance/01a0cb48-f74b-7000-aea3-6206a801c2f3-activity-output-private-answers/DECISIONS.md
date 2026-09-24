---
agent: Claude Opus 5.5
---

## What the server sends

`buildOutputFormResponse` runs `redactToOutput` on the stored response and sends what it returns in place of the answers and the form snapshot's schema:

- the answers of the fields the output view's visible blocks draw. A list answer keeps only the rows and cells the renderers draw: cells a row's condition hides and sub-fields in `outputViewHiddenFieldIds` go, and so does a row left with none;
- a schema holding only those fields (on one page), without the list sub-fields the view hides, and one output view holding only the visible blocks;
- `#{name}` references already filled in, and no variables left;
- no visibility conditions anywhere, on blocks, fields or list sub-fields.

A renderer resolves that to the same items the whole response gives it. `shared/outputrenderer.test.ts` checks this by comparing the two.

The payload keeps its shape, so no client changes. An app build already released renders it the same way: with no conditions or variables left, it has nothing to evaluate against answers it no longer gets. That rules out the proposal's cost of old builds going wrong on conditions and variables that read private answers.

Visibility validator verdicts are sent as `{}`. Once the conditions are gone nothing reads them, and a verdict can say something about the respondent.

`publicAnswers` holds a `true` flag for each answer sent and nothing else, so which answers the respondent kept private stays on the server. The web and mobile cards, released app builds included, draw the output only when `publicAnswers` has an entry, so it also carries the output view's id. Without it, a view where only display blocks show ("You scored #{score}") sends no answers and the cards would hide what they drew before. The renderers ignore the extra key, since no block reads it.

The feed only draws the default view (no caller passes a `viewId`), so the server resolves that one and drops the others. When no block shows, including a form with no output view, the server sends no output at all, which is what both renderers drew for it.

## Server cost

The server now runs admin-written variable formulas for every activity it sends. `resolveOutputBlocks` evaluates only the variables named in the visible blocks' and drawn fields' text, so a variable the view doesn't show costs nothing.

The home feed keeps an activity only when `buildOutputFormResponse` returns an output, and hands that output on to the DTO, so it builds each output once and reports a malformed list answer once. `hasPublicOutputAnswer` alone lets through activities whose view shows nothing, since it ignores the view. It counts an answer by the renderer's own rule, `isOutputAnswerShown` in `common/src/forms/output-resolution.ts` (a `true` flag and a value), so an activity whose answers are all unflagged or empty can't show an output of display blocks alone. The feed doesn't also require the built output to draw an answer: a view of display blocks alone ("You scored #{score}") shows once the respondent shares an output answer, even one the view doesn't draw. Building the output costs more for candidates the feed turns down, but `hasPublicOutputAnswer` still turns away most of them before any formula runs.

## Where the resolution lives

The server can only import `common`, so the part of `resolveOutputItems` that decides which blocks show, fills in variables and spots malformed list answers moved to `common/src/forms/output-resolution.ts` as `resolveOutputBlocks`. `shared`'s `resolveOutputItems` builds its items from that, so the server and the renderers can't drift apart.

## Malformed list answers

A public list answer that isn't a list of rows used to be reported by whichever client drew the feed. The server now drops that block before a client sees it, so `buildOutputFormResponse` logs the field and reports the same `malformed_list_answer` exception to PostHog through `PosthogService.captureException`. A renderer still reports the ones it resolves itself.
