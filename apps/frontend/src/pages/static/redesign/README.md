# Homepage redesign mockups

Seven homepage directions, live at `/redesign`. The page is `noindex` and nothing
links to it, so it only exists for whoever has this URL.

|                                  |                                                                    |
| -------------------------------- | ------------------------------------------------------------------ |
| [`/redesign?v=1`](/redesign?v=1) | Blue, Caslon headline, photo hero                                  |
| [`/redesign?v=2`](/redesign?v=2) | Green, Neoris headline, video hero                                 |
| [`/redesign?v=3`](/redesign?v=3) | Green, Galdeano, centred, network animation                        |
| [`/redesign?v=4`](/redesign?v=4) | Blue, notification animation hero, headline below                  |
| [`/redesign?v=5`](/redesign?v=5) | Version 4, hero is a row of activity off both edges                |
| [`/redesign?v=6`](/redesign?v=6) | Version 4, hero is the feed and an opened post beside the headline |
| [`/redesign?v=7`](/redesign?v=7) | Version 4, hero is a panel over the video, cards either side       |

Switch between them with the pill at the bottom of the screen, or edit the `v`
param. Anything else falls back to version 1.

The pill's `system` link opens `/redesign/system`, an inventory of every colour,
face, heading, component, and font size in use, each specimen sitting beside
where it came from. It is drawn from mockup 6 alone, so the pill drops its
version buttons there.

Versions 1 to 4 also vary their testimonial, closing CTA, footer, and the
graphic in the "how the model works" section. See `theme.ts`, which is the
single source of the differences. The sections themselves branch on those enums
rather than duplicating layouts.

Versions 5 to 7 spread version 4's theme and change the hero, so they compare
three ways of putting member activity above the fold. Their heroes hold still;
nothing in them moves.

The cards in those heroes come from `heroActivity` in `content.ts`, which has
three shapes: the outcome published when an action closes, one member's
submission against an action, and a member writing in their own voice.
`graphics/PostCard.tsx` renders all three.

Version 4 says "Join us" where every other version says "Request to join". That
lives on `joinLabel` in `theme.ts`.

`accent` is the second colour a version can carry: progress bars, checks, the
inline action links, and the hover strokes read from it. Every version but 7
sets it to its own primary, so nothing shows; version 7 lifts it to `#1E68D9`.
Tertiary buttons take that blue in every version, so it is written literally
there rather than read from the theme.

## The rest of the site

Each mockup is a whole site rather than one screen, so the design system can be
read on a long doc page and a form as well as the home page. Every nav link,
footer link, and in-page cross-reference carries the version with it, which is
what `rdHref` in `links.ts` is for. Drop the `v` and you land on version 1.

|                                                |                                                        |
| ---------------------------------------------- | ------------------------------------------------------ |
| `/redesign/people`                             | Expert group, office, member grid                      |
| `/redesign/guide`                              | The guide, with a contents list that tracks the scroll |
| `/redesign/progress`                           | Headline figures, then every action that has closed    |
| `/redesign/partner`                            | The outreach pitch and its signup form                 |
| `/redesign/join`                               | The request-to-join form                               |
| `/redesign/faq`                                | Accordion, one question per row                        |
| `/redesign/governance`, `/redesign/foundation` | The two founding documents                             |
| `/redesign/privacy`, `/redesign/terms`         | The legal pages                                        |

Copy comes from the pages the live site already serves. `pageContent.ts`
holds it where it has structure, such as the expert list and the partner offers.
`docContent.ts` holds the long-form pages as markdown, and
`sections/DocProse.tsx` renders that markdown in the theme. A link written as
`redesign:people` in markdown comes out pointing at the right version.

`Log In` is the one link that leaves the mockups, since the real page behind it
already works.

## Requesting to join

Every join control routes through `useJoinTarget` in
`sections/JoinRequest.tsx`, so the version decides what a click does. Version 4
opens the form over whatever page you are on. The rest go to
`/redesign/join`. That split is `joinFlow` in `theme.ts`.

The form asks for a name, an email, and why you want to join. Nothing is sent
anywhere; submitting swaps the fields for a confirmation.

## Layout

- `theme.ts` — the themes and the enums they select between
- `links.ts` — the page enum, and the URL builder that keeps `?v=` attached
- `content.ts` — home page copy, shared across versions
- `pageContent.ts`, `docContent.ts` — copy for the pages behind the nav
- `RedesignPage.tsx` — the route, which reads `?v=` and `:page` and picks a page
- `RedesignHome.tsx` — section order on the home page
- `pages/` — one file per page behind the nav, plus `SystemPage.tsx`, the
  style inventory
- `sections/` — one file per band of a page, plus the shared frame in
  `PageShell.tsx`
- `graphics/` — the animated and illustrative pieces
- `redesign.css` — `@font-face` and the CSS variables the themes set

## Fonts

`public/assets/fonts/redesign/` holds TT Neoris, Libre Caslon Condensed,
Galdeano, and Alex Brush. The TT Neoris files are trial versions; they need a
real license before any of this ships publicly.
