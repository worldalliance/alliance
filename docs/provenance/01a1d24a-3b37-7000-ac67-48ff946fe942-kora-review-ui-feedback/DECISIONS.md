# Decisions

## Undo

- The review header's "Undo" button goes too, not only the toast's link. The clarifying question named only the toast, but the answer was "We don't need an undo button", and the header button is the more visible one. (agent decision)
- The single-key `U` undo shortcut goes with the header button, whose tooltip was its only mention; Ctrl/Cmd+Z keeps the platform's standard meaning. (agent decision)

## Saving a comparison

- The intro step reads "Compare and save", and the button reads "Explain why to continue" while only the reason is missing. The button no longer carries a lock icon. (agent decision, applying "Save and continue")
- The ranking section is rebuilt from the pair's result every time the marks change, instead of holding a draft while a sheet is open. Answers the reviewer picked are already saved on the result, so rebuilding keeps them, while unanswered questions keep following the marks as they change. (agent decision)
- With no modal sheet left, the scrim and modal handling are removed. (agent decision)
- The footer keeps its "Ready to rank A vs B" button, which now scrolls to the section and focuses its first answer. It is the quickest way down a long pair. The label's capital R is lowered per the root `AGENTS.md` capitalisation rule. (agent decision)

## Visual

- Corners: `--r` is 6px and `--r-lg` 8px. Every fixed radius of 5px or more is halved, and pills and circles stay round. (agent decision, applying the approved "about half")
- The opening user prompt is 19.5px, 15% above the 17px of other messages. (agent decision)
- Header gap: the site header shrinks from about 94px to about 64px once scrolled, but the frontend pinned the review header at a fixed 78px, so about 14px of content showed between them. `--kora-top-offset` now follows `--site-nav-height`, and the navbar publishes its exact height (`getBoundingClientRect`), not the rounded `offsetHeight`, which left a 0.25px seam. (agent decision; measured in the frontend dev server at 1024px wide)

## Dev server

- The frontend's Vite config aliases `@alliance/kora-review` to `kora-review/src`, like the other workspace packages. With `preserveSymlinks` on, Vite reached the package through `node_modules`, didn't watch it, and kept serving edited files from its transform cache. (agent decision; observed while verifying this task)
