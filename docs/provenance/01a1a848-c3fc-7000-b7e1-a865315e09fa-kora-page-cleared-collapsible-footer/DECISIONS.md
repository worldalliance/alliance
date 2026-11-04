# Decisions

- The collapsed footer strip is a `<button>` with an `aria-label` and `aria-expanded`, so it is reachable by keyboard and announced by screen readers (agent decision; root `AGENTS.md` requires icon-only controls to carry an `aria-label`). It uses `h-[12px]` because the site's root font size makes `h-3` 11.25px.
- Code only the old page used is deleted: its components, `useWebOtpCode`, and `koraOAuthErrorMessage` in `common/src/kora.ts`. The server `kora` module, its tables, and the `KORA_PROJECT_PATH` and `KoraError` it imports stay: they own stored participant data, and removing them is separate work (agent decision).
- The images in `apps/frontend/public/assets/chatbot-safety/` stay although no code references them; that folder is being edited outside this task (agent decision).
- "Fear and distress" has no hue in the user's list; it uses 270 (agent decision).
- The config's `sensitive`, `content_warning`, `starter` fields and `opt_out_prompt` are left out: they govern the review flow, which doesn't exist yet (agent decision, YAGNI). KORA's final names and descriptions arrive 7 Nov and replace `riskCategories.ts`.
- The blurb frames the config's phrases as "A responsible chatbot will …" and "A failing chatbot will …", capitalized and ending in a period (agent decision).
- While rotating, the blurb's live region is `aria-live="off"` and becomes `polite` once a category is chosen, following the WAI-ARIA carousel pattern, so screen readers aren't interrupted every 5 seconds (agent decision).
- "Remind me" is a `role="switch"` button, the WAI-ARIA switch pattern, since the repo has no headless UI library; it reads `localStorage` in an effect because the page is server-rendered (agent decision).
- The chip track renders the category list three times and, after sliding past the middle copy, jumps without animation to the identical chip in the middle, so it can always slide left. Only the middle copy is exposed to assistive tech and the keyboard; the current chip carries `aria-current` and a "Pause"/"Play" tooltip, since clicking it is the only pause control (agent decision; WCAG 2.2.2 requires a way to pause auto-moving content).
- The chip row uses `overflow: clip`, not `hidden`, so focus or scripted scrolling cannot scroll it and break the centering (agent decision).
- The shared column is `max-w-3xl`, which at desktop widths puts the post-it row's edges within about 12px of the column's (agent decision).
- The h1 uses the old page's hero heading size, `text-5xl sm:text-6xl lg:text-7xl` (agent decision).
