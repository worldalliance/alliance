# Decisions

## Data

- **Names.** The user deferred the field names while KORA's schema was pending. Once it arrived, the tool's record took KORA's answer names (`q1`, `q2_confidence`, `q3_severity`, `q4_text`) and kept `pairPosition`; transcripts use `conversation` and `itemType`. `SCHEMA_VERSION` is 4. (agent decision)
- **Saved reactions.** Each result stores `reactions`: per line, the turn, the line's span in Unicode code points, its text and `up` / `down` / `notable`. Passages and KORA's highlights are derived from them by `toKoraHighlights` (`kora-review/src/highlights.ts`), so the 👎 passage rule lives in one place and needs no layout. Code points because KORA's export counts them; the tool converts from UTF-16. (agent decision)
- **Skip time.** A topic skip records `optedOutAt`, because KORA's skips table needs a timestamp. Every skip is exported with scope `risk`, since only topic skips exist; KORA should be told that `once` never occurs. (agent decision)
- **Transcript fields.** The converter also carries `n_turns`, `extended`, `child_gender` and the practice reference verdict and reason, unused for now, so the later practice and length-warning work has them. (agent decision)
- **Child's gender** shows with the age in the chip when given. Carried over from an earlier attempt in this task that the user later rewound; the user approved it there and hasn't revisited it. (agent decision, from the rewound attempt)
- **No comprehension check.** The rewound attempt added one (tool, server column, migration). KORA's revised schemas have none, so it was removed, the never-run migration included. (agent decision)

## KORA export

- **Sessions.** Each assignment is a session; `session_number` counts a reviewer's assignments in creation order. (agent decision)
- **Ids.** `rating_id` is `<assignmentId>.<conversationId>`, `highlight_id` adds `.<n>`. Both match KORA's id pattern and are stable across exports. (agent decision)
- **Left out.** `test` conversations are never exported, as KORA's schema requires; a stored export that no longer validates against `exportSchema` fails the download loudly. (agent decision)
- **Not validated at download.** The server checks the output against KORA's schema only in tests (unit and e2e): the schema file lives in `docs/`, which isn't deployed with the server. (agent decision)
- **Endpoint.** `GET /kora/admin/results/kora-export?kind=rolling|final`, with an admin button "Download KORA export (.json)". `kind` is read as a string and checked by hand: under Bun an enum-typed parameter's design type makes the global ValidationPipe reject it, as `server/src/auth/oauth/provider-param.ts` records. (agent decision)

## Interaction

- **Lines.** A line is a run of a block's tokens on the same on-screen row, sized to the block's line height and centred on the words (a word's box is shorter than its line). Positions are measured inside the reply's border. Without layout, each block is one line. (agent decision; see EVIDENCE.md)
- **Taps and clicks.** Taps on one line less than 320 ms apart form one gesture, acted on once they stop, since a double tap could still become a triple. A tap on another line settles the pending gesture first. Mouse clicks follow the same counts, and multi-clicks don't select text. A long press is 450 ms. (agent decision)
- **Focused line** is a tint with an accent bar, painted under the text. (agent decision)
- **First reaction** marks the tip as seen but leaves it on screen until "Got it", so the replies don't jump under the pointer. (agent decision)
- **Quote redraw.** The grading card's quote redraws with "Your reactions" on every reflow, so its line breaks follow the reply's. (agent decision)
- **Confidence resets** when the reviewer switches between Safe and Unsafe, since it was about the other answer. (agent decision)
- **Verdict word colour.** The safe / unsafe word in the confidence question is coloured green or red; bold alone wasn't visible against the label's weight. (agent decision)
- **Topic in sentences** is the category label lower-cased ("Skip all conversations of violence and physical harm"), per the repository's capitalisation rule; no label starts with a proper noun. (agent decision)
- **Stories popup** is a native `<dialog>` showing both stories and focusing the one chosen; the chip is a WAI-ARIA menu button. Blank lines split paragraphs. (agent decision)
- **Module split.** The list of reactions is in `reaction-list.ts`, apart from `reactions.ts`, to keep both under the repository's 500-line limit. (agent decision)
