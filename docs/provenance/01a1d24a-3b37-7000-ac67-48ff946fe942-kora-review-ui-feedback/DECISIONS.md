# Decisions

## Undo

- The review header's "Undo" button goes too, not only the toast's link. The clarifying question named only the toast, but the answer was "We don't need an undo button", and the header button is the more visible one. (agent decision)
- The single-key `U` undo shortcut goes with the header button, whose tooltip was its only mention; Ctrl/Cmd+Z keeps the platform's standard meaning. (agent decision)

## Saving a comparison

- The intro step reads "Compare and save", and the button reads "Explain why to continue" while only the reason is missing. The button no longer carries a lock icon. (agent decision, applying "Save and continue")
- The ranking section is rebuilt from the pair's result every time the marks change, instead of holding a draft while a sheet is open. Answers the reviewer picked are already saved on the result, so rebuilding keeps them, while unanswered questions keep following the marks as they change. (agent decision)
- With no modal sheet left, the scrim and modal handling are removed. (agent decision)

## Visual

- Corners: `--r` is 6px and `--r-lg` 8px. Every fixed radius of 5px or more is halved, and pills and circles stay round. (agent decision, applying the approved "about half")
- The opening user prompt is 19.5px, 15% above the 17px of other messages. (agent decision)
- Header gap: the site header shrinks from about 94px to about 64px once scrolled, but the frontend pinned the review header at a fixed 78px, so about 14px of content showed between them. `--kora-top-offset` now follows `--site-nav-height`, and the navbar publishes its exact height (`getBoundingClientRect`), not the rounded `offsetHeight`, which left a 0.25px seam. (agent decision; measured in the frontend dev server at 1024px wide)

## Dev server

- The frontend's Vite config aliases `@alliance/kora-review` to `kora-review/src`, like the other workspace packages. With `preserveSymlinks` on, Vite reached the package through `node_modules`, didn't watch it, and kept serving edited files from its transform cache. (agent decision; observed while verifying this task)

## Second meeting

- The "Taken on its own" questions follow the on-screen letters, so each sits under its own chat. (agent decision)
- While the reviewer hasn't answered which chatbot was safer, the slider hides its thumb. A first click sets the stop under it, and a first arrow key sets the middle stop on that side ("Somewhat A" or "Somewhat B"). The answer is saved when the slider is released, not while it is dragged, because saving redraws the ranking. The saved answer values and the export schema don't change. (agent decision)
- The slider's labels wrap onto two lines below 400px, so they don't overlap at 320px. (agent decision; measured in the frontend dev server)
- Each column's heading reads "Chatbot A", not "Chat with Chatbot A". (agent decision)
- The 26 risk prompts in `categories.ts` ("Does the AI …?") say "the chatbot", since they describe the responders and appear on every pair. (agent decision, applying the approved rename)
- The pair-list screen's state (its status and category filters), its CSS, and the `list` and `left` icons nothing else uses are deleted along with it. (agent decision)
- The thanks screen's heading is outside the tool and keeps the site's display font. (agent decision)

## Third meeting

- The survey bars have nothing on their left, since a survey has no risk. (agent decision)
- The screen-reader announcement of each chatbot's score stays, because the per-chat scores are still on screen. (agent decision)
- "Your marks" lives with the other mark lists in `annotations.ts` and redraws with them. Clicking an item scrolls the marked words to the centre of the view and opens the mark's edit sheet. A mark whose words can't be found shows "Not found" and isn't clickable. (agent decision)
- With no saved-pair view, the review footer had nothing left to hold, so it is removed along with the stamp, the summary and the `locked` branches. The guards that stop a saved pair's marks or answers from changing stay. (agent decision)
- The finish screen's per-pair "Open" links are removed, because they opened the saved-pair view. The finish list itself stays. (agent decision, applying the approved removal of that view)
