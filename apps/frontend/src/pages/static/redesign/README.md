# Homepage redesign mockups

Four homepage directions, live at `/redesign`. The page is `noindex` and nothing
links to it, so it only exists for whoever has this URL.

| | |
| --- | --- |
| [`/redesign?v=1`](/redesign?v=1) | Blue, Caslon headline, photo hero |
| [`/redesign?v=2`](/redesign?v=2) | Green, Neoris headline, video hero |
| [`/redesign?v=3`](/redesign?v=3) | Green, Galdeano, centred, network animation |
| [`/redesign?v=4`](/redesign?v=4) | Blue, notification animation hero, headline below |

Switch between them with the pill at the bottom of the screen, or edit the `v`
param. Anything else falls back to version 1.

Each version also varies its testimonial, closing CTA, footer, and the graphic
in the "how the model works" section — see `theme.ts`, which is the single
source of the differences. The sections themselves branch on those enums rather
than duplicating layouts.

## Layout

- `theme.ts` — the four themes and the enums they select between
- `content.ts` — copy, shared across versions
- `RedesignHome.tsx` — section order
- `sections/` — one file per band of the page
- `graphics/` — the animated and illustrative pieces
- `redesign.css` — `@font-face` and the CSS variables the themes set

## Fonts

`public/assets/fonts/redesign/` holds TT Neoris, Libre Caslon Condensed, and
Galdeano. The TT Neoris files are trial versions; they need a real license
before any of this ships publicly.
