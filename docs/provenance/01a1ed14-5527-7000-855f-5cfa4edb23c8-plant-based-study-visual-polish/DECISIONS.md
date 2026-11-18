# Decisions

Process source: the unslop skill by Damir Sokolovsky (https://github.com/heydamir/unslop, CC BY 4.0), read from GitHub rather than installed as a plugin.

- Polish mode, not a redesign (agent decision). The audit found a page that is mostly designed, so the brand fonts (Libre Caslon Condensed, TT Neoris), palette, chart types and layout stay; only the listed signs change. This also keeps the structure the requirements fix.
- Direction (agent decision): a research notebook and printed report. The charts carry the colour; the surrounding chrome is white with hairlines. The signature is a finding number in tabular mono (`01`–`06` on the summary links, the `Finding n of 6` kicker on each section), in the reduction group's text green.
- Summary links become a numbered list with hairline dividers instead of grey cards with a coloured left border, a common template look (agent decision).
- Uppercase, wide-tracked labels (kicker, figure eyebrow, control labels, PDF caption) are sentence case, as the root `AGENTS.md` capitalisation rule also requires. The HTML chart legends are sentence case for the same reason; category labels drawn inside the SVG charts are unchanged (agent decision, scope).
- Contrast (WCAG 1.4.3, `agents/skills/ux-guidelines`): muted text goes from ink at 45% (about 3:1 on white) to 64% (about 5.3:1); green used as text in the line chart uses `--reduction-ink` `#007a58` (about 5.2:1) instead of `#009e73` (about 3.4:1); the stacked bar's light-green segment label is ink instead of white (white on `#74c3a6` was about 2:1).
- Methodology text is body size in the secondary text colour instead of 13px muted, since it is long-form text (`agents/skills/ux-forms-platform`, visual system).
- Figures sit on the page surface with a hairline border instead of a hardcoded grey (`#f4f4f5`), so chart dots, whose outline is the surface colour, read cleanly.
- Weights 650 and 700 in prose, tooltips and chart labels become 600; spacing moves onto the 4px scale; transitions share one decelerating curve.
- Italic stays for stress inside prose paragraphs (agent decision): the skill's no-italic rule targets interface text, and stress italics are standard in editorial prose. The italic annotation "the biggest jump" inside the difficulty chart is upright.
- The dead `.back-home` rule, which no markup used, is removed.
