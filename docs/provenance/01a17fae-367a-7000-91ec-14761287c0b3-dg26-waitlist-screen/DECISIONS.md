The screen reuses `WaitlistSignupForm`, `DisplayHeading`, `SITE_COL`, and `NAV_HEIGHT`. Its title and subtitle are written in the screen. The hero below keeps its own headline and pitch. The words match today. The new screen is the page `h1`; the hero below is an `h2` at the same visual size.

`WAITLIST_HERO_IMAGES` in `placeholders.ts` holds four slots. A null `src` renders a zinc block. A set `src` renders an `img` with `object-cover` filling that strip. The four strips are equal rows inside an `aspect-square` column with a small gap, so the outer box stays 1:1. Its width is capped by the column, by about 42vw, and by the viewport height minus the nav, so the square fits in the screen.

Below `lg`, the title, subtitle, and form sit above the square. The section is `min-h-svh` and grows when that stack is taller than the viewport. `my-auto` centers it when it fits.

The band under the new screen no longer pads for the nav. The nav floats over the new screen only. The hero below still has its own form.

This route is not in the mobile app.
