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
- The 600 cap lives in the frontend, not in KORA's CSS: `koraFonts.css` declares a "Kora TT Neoris" family whose DemiBold face covers weights 600-1000, and the KORA mount sets `--site-font-body` (and through it KORA's body and display font properties) to that family. Every weight KORA or the browser asks for above 600, including default bold on headings, `<b>` and `<strong>`, then renders with DemiBold, and standalone KORA keeps its own fonts and weights. The mount overrides `--site-font-body` because the site's `.site-root *` rule sets every element's font from it directly, bypassing KORA's font properties. The family uses only TT Neoris's latin files, so glyphs outside them fall back to the site's uncapped TT Neoris. KORA's bold body rules also drop from 700 to 600; with Atkinson Hyperlegible, which has only 400 and 700, standalone KORA still renders them with its 700 face.
- The slow opening applies only to a pair opened for the first time, and only when the pair has a shared opener. A pair reopened, or resumed from a saved export, shows everything at once, since the reviewer has already read it.
- Typing starts once the pair is in view, after the question intro fades: a 500 ms pause, then one word every 90 ms, sped up so a long message takes no more than 3 s. Reduced motion shows the whole message at once.
- The button appears once the message has finished typing, taking focus. Until it is clicked, the chats, the tap-a-word hint, "Your marks" and the ranking stay hidden.
- The tap-a-word hint sits between the opener and the chats, so revealing the replies doesn't shift the child's message. A keyboard press of the button moves focus to the first reply on screen; a mouse click leaves focus alone, so no focus ring appears on a reply.
- Whether a pair has been revealed is not saved: reopening it shows the replies directly.
- The full-height background comes from the frontend: the review and example pages' `<main>` is a flex column and the tool's mount fills it, rather than the package assuming a page height. The other views in that `<main>` use `SITE_COL`, which sets `w-full`, so they keep their width.
- On phones the "Child" label sits beside the icon on its own line, so it stays centred against the icon there instead of top-aligned with the message.
- When the reviewer picks "No real problem, it is just not as good" as the turn, the question asks "In your words, why was this response less safe for the child?", since calling it unsafe would contradict their answer.
- The export schema's description of `q3_text` (and the generated type) is reworded to match the new question; the field itself is unchanged.
- The line was the sticky header's bottom border, which the pre- and post-survey screens share; it is removed there too so the screens match.
- Each pre-survey dropdown keeps its question as a label, starts on an empty "Choose an answer" option and lists the same answers as before, "Prefer not to say" included. Leaving an optional one on "Choose an answer" skips it; leaving a required one there blocks Continue, as an unanswered radio question did.
- Without the welcome screen, the tool opens on the pre-survey when one is needed, otherwise on the first unreviewed pair (and its question intro). Its example demo, step list and "Start reviewing" button go with it.
- Boot changes don't save, so when the tool opens the very first pair while mounting, it saves once mounting finishes, keeping that pair's start time as clicking "Start reviewing" used to.
- The intro paragraph shows wherever the hero's button reads "Start ranking": an open batch with nothing ranked yet, and a ready batch with no finished one before it. <N> is that batch's pair count. It isn't shown with "Continue ranking" or "Rank another N", nor on the example page's closing "Start ranking" button, which has no batch to count.
- The intro keeps the "N of M reviewed" progress line above the category, since only the "What to look for" label was asked to go.
- With the guides gone, their [ … :+1: ] markup renderer, its styles and the transcript's `challenge` and `tagline` fields are deleted. The header rules' class is renamed from `challenge` to `rules`.
- The 50px is the visible gap: the thread's 18px gap plus a 32px top margin on "Your marks". The underline copies the chatbot headings: 8px below the text, 2px solid ink.
- The `#` is a button named "Pair ID" for screen readers, with `aria-expanded`; clicking it again hides the ID. It is at 40% opacity until hovered or open. Like the ID before it, it stays hidden below 900px wide.
- The "..." is three bouncing dots, one text line tall so the bubble keeps its height when the first word replaces them, and hidden from screen readers. With reduced motion the whole message shows at once, so the dots never appear.
- The age line is 16px (was 14px) in the ink colour (was muted), a step below the bold 17px "Child".
