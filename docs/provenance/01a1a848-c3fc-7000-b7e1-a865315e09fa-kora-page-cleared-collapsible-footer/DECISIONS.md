# Decisions

- The collapsed footer strip is a `<button>` with an `aria-label` and `aria-expanded`, so it is reachable by keyboard and announced by screen readers (agent decision; root `AGENTS.md` requires icon-only controls to carry an `aria-label`). It uses `h-[12px]` because the site's root font size makes `h-3` 11.25px.
- The route component picks the page from `useKoraParticipant`'s `/kora/me` query: `KoraWelcome` inside the trimmed navbar and collapsible footer for a participant, otherwise `KoraSignUpPage`, which is `main`'s page unchanged. A failed query shows the sign-up page, whose card reports the failure with a retry (agent decision).
- A signed-in Alliance member who isn't a KORA participant sees the sign-up page, whose card tells them members take part through weekly tasks, as on `main` (reconstructed from existing code).
- The welcome page reuses the sign-up card's signed-in view, exported as `KoraSignedIn`, for its sign-out, handed to `KoraWelcome` as an `account` node so the welcome content stays free of the participant query (agent decision).
- The images in `apps/frontend/public/assets/chatbot-safety/` stay although no code references them; that folder is being edited outside this task (agent decision).
- "Fear and distress" has no hue in the user's list; it uses 270 (agent decision).
- The config's `sensitive`, `content_warning`, `starter` fields and `opt_out_prompt` are left out: they govern the review flow, which doesn't exist yet (agent decision, YAGNI). KORA's final names and descriptions arrive 7 Nov and replace `riskCategories.ts`.
- The blurb frames the config's phrases as "A responsible chatbot will …" and "A failing chatbot will …", capitalized and ending in a period (agent decision).
- While rotating, the blurb's live region is `aria-live="off"` and becomes `polite` once a category is chosen, following the WAI-ARIA carousel pattern, so screen readers aren't interrupted every 5 seconds (agent decision).
- "Remind me" is a `role="switch"` button, the WAI-ARIA switch pattern, since the repo has no headless UI library; it reads `localStorage` in an effect because the route is server-rendered (agent decision).
- The chip track renders the category list three times and, after sliding past the middle copy, jumps without animation to the identical chip in the middle, so it can always slide left. Only the middle copy is exposed to assistive tech and the keyboard; the current chip carries `aria-current` and a "Pause"/"Play" tooltip, since clicking it is the only pause control (agent decision; WCAG 2.2.2 requires a way to pause auto-moving content).
- Only `:focus-visible` focus moves the track, so a mouse click, which also focuses the chip in some browsers, still toggles rotation as a click (agent decision).
- An off-middle position snaps back to the middle copy whenever the track isn't animating, not only on `transitionend`, which never fires without a transition (reduced motion) (agent decision).
- The chip row uses `overflow: clip`, not `hidden`, so focus or scripted scrolling cannot scroll it and break the centering (agent decision).
- The shared column is `max-w-3xl`, which at desktop widths puts the post-it row's edges within about 12px of the column's (agent decision).
- The h1 uses the old page's hero heading size, `text-5xl sm:text-6xl lg:text-7xl` (agent decision).
