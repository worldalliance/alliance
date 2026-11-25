# Decisions

- The category chip uses the tool's body font (`--f-body`). On the Alliance site the host sets that to TT Neoris (`KoraReviewTool.tsx`), the site's body font; standalone, it falls back to the tool's bundled Atkinson Hyperlegible. (agent decision)
- Without a known age, the label above the first message stays "Child", and the header shows no age chip, as before. (agent decision)
- The reminder ignores scroll movements under 8px, so small jitters and momentum scrolling don't flicker it. At the very top it always shows. (agent decision)
- After the reminder hides or shows, scroll events are ignored for 300ms. Collapsing it shrinks the sticky header, and Chrome's scroll anchoring then moves the page by that height, which otherwise reads as a scroll up and brings the reminder straight back. Seen in Chrome at 390px wide before the fix: height 71px instead of 0 after scrolling down. (agent decision)
- Hiding collapses its height, padding and margin and fades it over 0.2s, with no transition under `prefers-reduced-motion`. It stays in the DOM, so screen readers still reach it. (agent decision)
