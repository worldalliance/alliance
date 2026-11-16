# Decisions

All agent decisions.

- The two rules move into the header and out of the scenario card.
- The challenge question (the category guide) still shows on the full-screen intro when the question changes; only the review screen's header drops it.
- Without the per-turn list, a mark is edited or removed by clicking it in the reply or in the "Your marks" summary, which opens the edit sheet with its note field and Remove button. The separate note-only sheet and its pencil button had no other entry point, so they are removed.
- The screen-reader announcement of each chatbot's net score on change stays, since it does not render the removed pill.
- The opener row leaves out the age line when `child_age` is missing.
- Below 600px wide the opener wraps: icon and label on one line, the bubble full width under them, so the message doesn't squeeze into a narrow column.
- The scenario title stays as a visually hidden `h1`, the screen's only heading of that level and where focus lands when a pair opens, so screen-reader and keyboard users keep that anchor. It falls back to the pair id when the title is empty.
- The engine's transcript context drops `background` and `scenario`, since nothing renders them any more. The upload schema and converter still accept `childBackground` and `scenario`, so KORA's files load unchanged.
- The empty-marks prompt reads "No marks yet. This step is optional: scroll back up to the chatbots' replies and tap the words where a chatbot was unsafe." with a "Back to the replies" link button that scrolls to and focuses the first reply on screen, so keyboard users land where marking starts. Once either chatbot has a mark, the per-chatbot lists return, with "No marks on Chatbot X." for an empty side.
- A finished pair can't be marked, so it keeps the plain "No marks on Chatbot X." lines instead of the prompt.
- The frontend already sets `--kora-font-family` (and the display font) to the site's TT Neoris, so the 600 weight comes from KORA's own bold body rules dropping from 700 to 600, not from a new font. KORA's bundled default stays Atkinson Hyperlegible, which has only 400 and 700, so standalone KORA still renders those rules with its 700 face. Headings and badges in the display and mono fonts keep their weights.
