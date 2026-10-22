---
user: chonboncode
task: Tweaks to the onboarding flow, the platform walkthrough and the login screen
---

## 1. Priority cards

The description size is a blend of the two sizes it has had, set by
`--ob-priority-body` in `onboarding.css`. 0 is `calc(var(--ob-caption) * 1.1)`,
the size the flow used before this task; 1 is the site's own `1.1rem`; it sits
at 0.5. The old size tracks viewport height and the site's does not, so the
midpoint is an expression rather than a constant. Line height follows the same
split, 1.4 between 1.35 and 1.45.

Measured: 15.0px at 1440x900 (between 13.5 and 16.5), 14.2px at 1280x800
(between 12.0 and 16.5), 16.6px at 1728x1117, where the old size was already
16.7px and the blend changes almost nothing.

An earlier pass resized the cards to open the description inside them, and that
is what came back too large. All of it is reverted: `StorySteps.tsx` and
`Priorities.tsx` are byte-identical to where they started, and the row floor,
the reduced insets and the narrow-window font override are gone.

The description never runs past the card's foot, which keeps 19px of clearance
everywhere. The head is what gives, and `usePriorityRowFit` is what stops it.

The row's height is a share of the viewport's and the description's height
follows the card's width, so the two disagree once the window is small enough.
The hook measures what the worst card is short, which is readable at rest
because the description is clipped rather than absent while closed, and grows
the row by that much. Nothing in CSS can express it: the requirement is where
the text happens to wrap, and Safari wraps it a line further than Chrome at
1024x768, where the same card comes out 286px rather than 267px.

The growth comes out of the room the step is not using, and is capped at it, so
the step never scrolls. `offsetTop` rather than a rect for that room: the entry
animation translates these boxes, and a rect read mid-rise reported 16px that
was not there, which the step then overflowed by exactly 16px.

What moves, measured at eleven sizes by reading every band's position with the
growth applied and again with it removed: the eyebrow, the footer and the
progress track do not move at all, because they sit outside the scrolling band.
The gap between the cards and the note does not change either. The headline and
the note re-centre, by half the growth each, which is 30px at 1024x768 and 42px
at 1024x640. 1440x900 and wider are untouched, since nothing there is short.

Widening the cards is not available. An attempt that reclaimed 1.5rem of the
step's gutter on each side did take the longest description off a line, but a
negative margin on the row puts it outside the padding that keeps the panel off
the screen edge, and the cards ran off the sides. The height is the only lever.

`--ob-priority-body` remains the knob for the text size itself.

## 2. Fifteen-minutes screen

`ob-rise` starts its subject at `translateY(16px)`, and a translated box counts
toward `scrollHeight`, so the step's scroller had 16px to scroll for as long as
the animation ran. Measured: `scrollHeight - clientHeight` peaks at 16 through
the entry on every viewport tried.

`StepLayout`'s `fill` already means the body is capped at the height it was
given, so it now takes `overflow-hidden` rather than `overflow-y-auto`. Nothing
to scroll, no scrollbar to flash. This also covers the commitment screen, the
other `fill` caller.

## 3. Fifteen-minutes graphic

The two anchor labels are hidden below `lg` (1024px) through an `anchorClasses`
record beside the file's other per-size records, so only the compact size the
onboarding uses drops them. Hiding them leaves `--hours-chrome` reserving height
for a label that is no longer there, which shrinks the grid by a few pixels.
That is the direction the existing comment calls safe, and `.ob-hours-fit`
centres the block in what it is given, so the freed height splits above and
below rather than opening a gap under the headline.

The first and last cells lose their outline and take the same fill as the other
166, at both sizes and every breakpoint. The outlines were what "Action arrives"
and "Deadline" pointed at, so above `lg` the labels now name the row ends
without a marker on them.

Which arrangement shows is now a `@media (min-aspect-ratio: 4 / 5)` on the
screen with the `@container (min-width: 28rem)` still on the box. The two ask
different questions: whether the device is being read vertically, and whether 24
columns have the room to stay legible at all.

Measured before changing it, the box is landscape-shaped on every device larger
than a phone, from 0.97 on an iPad Pro held upright to 2.39 on a laptop, because
the headline, the note and the footer take their height first. The old
`min-aspect-ratio: 3 / 4` on the container therefore passed almost everywhere,
and the width test alone decided the arrangement. `28rem` against a 15px root is
420px, which is phone territory, so the vertical grid was reaching phones and
nothing else.

Verified across twelve shapes. Every landscape screen keeps the day per row.
Square and exactly 4:5 keep it. One pixel under 4:5 flips. The Galaxy Tab at
700x1138 goes from 19px cells filling 30% of the box to 29px filling 87%, and
an iPad Pro upright from 24px to 41px.

## 4. Agreement screen

`xl` (1280px) is the breakpoint. `lg` is 1024px, which every iPad in landscape
meets.

Centring the aside on the agreement alone needs the agreement and the signatures
to be separate boxes, so the two-element flex row became a three-element grid:
aside in row one column one, agreement in row one column two, signatures in row
two column two. `align-items: center` then centres the aside against row one,
which the signatures are not in. The wrapper that used to hold the agreement and
the signatures together is gone, and both now carry `ob-rise` at the same delay,
so they still rise in unison.

Rows are content-sized with `content-center` rather than `minmax(0,1fr)`. With
`1fr` the first row ate the leftover height and the signatures were pinned to
the bottom of the panel, a long way under the card they belong to.

Fixed tracks (28rem and 34rem) around `xl:gap-x-14`, on a `w-fit mx-auto` grid.
Percentage columns would have held the gap proportional and pulled the halves
apart on a wide monitor, which the request rules out. 28rem is the widening: the
aside was 24rem.

Verified at 1728x1117, 1440x900, 1536x720 and 1280x800 that the aside's vertical
centre is within a pixel of the agreement card's, and at 1100x800 that the
stacked layout below `xl` is unchanged.

## 5. Walkthrough dialogue

`ProgressTrack` split into `ProgressSegments`, which the tour reuses at seven
segments and `--ob-bar: 2px`. The onboarding track keeps its own absolute
positioning and its 3px bars.

Back is hidden rather than disabled on the first step, where the primary button
spans both columns. A disabled control that is never usable is worse than none.

The visible "1 of 7" is gone, so the count moved into an `sr-only` line: the
progress bar is `aria-hidden`, and the dialogue is `aria-live="polite"`.

Skip went from `--ob-caption` to `--ob-ui`, the size the dialogue's own body copy
runs at, which is as far as it can go without competing with the step title
above it at `--ob-body`. Padding went with it, for a hit target near 45x28
rather than 38x25.

## 6. Walkthrough step 2

The two sentences added to the body are deleted. The step carries an optional
`deferred` flag, and the spotlight renders a grey veil over the cutout. Greying
the element is the whole of it: the fields read as inactive before anyone reads
a word.

A white pill on the frame's top edge reading "After the tour" went with the veil
at first and has since been removed. What is left needs no new field, but
`deferred` stays, because the veil is still a per-step choice.

## 7. A phone held sideways

`@media (orientation: landscape) and (max-height: 560px)`. Height rather than
width is what runs out, and 560px clears every iPhone landscape height (430 at
the tallest) while staying under the 600px-tall small tablets, which have the
room and should keep their margins.

The panel goes full bleed by resetting `--ob-margin` and `--ob-radius` to zero
after the 640px and 1024px rules that raise them. The sign-up screen stays white,
because it is white held vertically too: it is the site page, not the panel.

`ob-drop-landscape` is one class on the four things that give up their place:
the milestones note, the fifteen-minutes note, the agreement note and the
signatures. "Tap to explore" joins them, since the deck it refers to is not on
screen here.

The mockups swap the deck for the desktop row, and the row's width cap moves
into `--mocks-row-max` so the media query can lift it. Uncapped, each stage is
about 277px wide instead of 164px, which is what lets a card be drawn at 73% and
cropped rather than shrunk to 43% and whole.

`FitStage` gained `crop`, which scales off the width alone and anchors the box
at the top. `CommitmentMocks` passes it only where a `useMediaQuery` on the same
phone-landscape query matches, alongside the feather.

The scale is the same either way below the cap, since the width term is the
smaller of the two and `min()` would pick it. The anchoring is not. Measured on
a window narrow enough that the cap does not bind, a stage 414px tall holds
350px of art at 1100x900 and 460px holds 323px at 1024x1000, so anchoring at the
top drops all 64px and 137px of slack below the row instead of splitting it.
Passing `crop` unconditionally lifted the row by half that on every desktop
window between `lg` and wherever the cap starts binding.

The fifteen-minutes grid fills its box because `--hours-chrome` stopped
reserving a line for the two anchor labels below `lg`, where they are hidden.
That is scoped to the same breakpoint that hides them, so the portrait phone
gains the same height.

Buttons shrink through `[data-ob-nav] > button`: 9rem minimum width instead of
13, 2.25rem minimum height instead of 2.75, and `--ob-ui` type.

Checked for overflow at 932x430, 915x412, 844x390, 800x360 and 740x360, on all
five screens. Nothing overflows the panel or its body, and the footer buttons
stay on screen throughout. Portrait, iPad landscape and desktop are unchanged.

## 8. Zoom on a focused field

`@media (pointer: coarse) { .ob-root input { font-size: max(16px, var(--ob-ui)) } }`.
16px is the threshold iOS Safari checks; at or above it the focus zoom never
fires, and nothing needs to zoom back out. `max()` rather than a flat 16px
because `--ob-ui` already exceeds it on a tablet.

This app's root is 15px, so `text-sm` is 13.1px and even `text-base` would be
15px. The floor has to be stated in pixels; reaching for a larger Tailwind text
class does not clear it.

`.ob-root` is on one element, so the rule reaches the three fields in the flow:
email and password on the account screen, and the signed name on the agreement.
Measured after the change, all three are 16px on a touch context at 390x844 and
844x390, in fields 37px and 32px tall.

Not `user-scalable=no` on the viewport meta. It breaks pinch-to-zoom, which is
a WCAG 1.4.4 failure, and iOS Safari has ignored it since iOS 10.

Measured three public mobile login pages under an iPhone user agent for the
question of what is standard: Wikipedia, GitHub and Mastodon all set their
inputs to exactly 16px against a 16px root. Reddit, Stack Overflow and Bluesky
did not expose fields to a headless browser.

The rest of the app is untouched. 37 files render an input or textarea and only
two of them sit under `.ob-root`, so the same fix elsewhere is its own task.

## 9. Full agreement in a popup

`FullAgreementModal` renders the governance page's own three pieces, the
markdown before, the contract card, and the markdown after, inside the shared
`Modal`. The page's subtitle is left out: its only content is a link to a
write-up elsewhere on the site, and following it would leave the flow, which is
the thing the popup exists to prevent. Nothing else in the governance markdown
is a link.

`DocProseSize` splits the type scale in two rather than scaling a wrapper,
because the sizes are per-element classes that a parent `font-size` cannot
reach. Compact runs the body at 0.9rem against the page's 1.05rem, and the
headings at 1.15rem against 1.75rem. Measured in the dialog at 1440 wide:
13.5px body, 17.3px headings. The headings are where the scrolling is won.
`ContractCard` takes the same size and drops its padding from `p-6 sm:p-8` to
`p-4`.

Each `leading-*` sits in the size record next to the font size it belongs to,
not in the shared class string the record merges over. `tailwind-merge` reads
`text-[1.5rem]` as a font size, which conflicts with `leading-*`, so a line
height in the earlier argument is dropped. Measured on `/governance`: h2 is
26.25px on a 32.8px line, and would run on a 39.4px line with the two
separated.

The panel is `flex max-h-[85vh] flex-col` with the content in a `min-h-0
flex-1 overflow-y-auto` child, so the header and its close button stay put
while the body scrolls. `Modal`'s own scrolling is on its viewport, which
would have carried the header off the top.

`showClose={false}` and a close button of the dialog's own: a filled 36px
circle with a 2.5-weight X, rather than the shared bare icon. Changing the
shared one would restyle every modal in the app.

The onboarding panel was `z-50`, a raw value above `zIndex.modal` at 40, so the
dialog opened behind it. The panel now takes `zIndex.drawer`, which is the tier
for a full-screen surface above the page chrome and below dialogs. The leaving
spinner moved to the same tier: it was `z-40`, under the panel, and equal tiers
with the panel later in the DOM keeps it there, so the panel still fades out
over the spinner instead of being cut off by it.

A 2px stroke in `--color-green` on the panel, measured as
`rgb(98, 161, 36)` once rendered.

Verified at 1440x900, 430x932 and 932x430: the dialog opens, the body scrolls,
the close button dismisses it, and the flow is still on the agreement step
afterwards. The governance page itself is unchanged at 26.25px headings and
16.8px body.

`GovernanceBody` holds the three pieces in order, and `/governance` and the
dialog both render it. Sharing the constants was not enough on its own: a
section added to the page, or reordered, would have stopped at the page. The
size prop is the only thing the two callers differ by.

The contract in the middle already came from the database through
`useContract` -> `contract/current`, which the admin edits at `/contracts/:id`.
The prose either side is a constant in `site/docContent.ts` and stays one, which
is what the manager already edits.

The body scroller takes `useScrollFeather`, the same fade the agreement's own
terms list uses.

That hook held its scroller in a `useRef` and read it in an effect, which is a
commit too early for anything inside a portal: `ref.current` was null, the
effect returned, and nothing re-ran it. Measured, the scroller sat at 1206px of
content in a 696px box with no fade at all. It now keeps the node in state
behind a callback ref, so setup waits for the node to attach. Both callers
verified afterwards: the dialog fades at the foot until scrolled to the end,
and the terms list still fades at 800x360 where it overflows by 65px and stays
flat at 932x430 where it fits.

## 10. Login and create-account screen

`useCopyFit` hides the standfirst, then the headline, whenever the card's
`scrollHeight` is over its `clientHeight`. A `ResizeObserver` on the card drives
it, matching how `FitStage` and `useScrollFeather` already measure in this repo.

`document.fonts.ready` runs one more pass. The observer watches the card's own
box, and a webfont swapping in reflows the copy inside it without resizing it,
so the first pass would otherwise stand on the fallback's metrics. Observing the
subtree the way `useScrollFeather` does is not open here: a pass sets `display:
none` on the elements it drops, which the observer would report as a resize and
feed back into itself.

Every pass starts by showing both lines again, so the decision is recomputed from
the full copy rather than accumulated. A pass leaves the card's own box where it
found it, which is what keeps the observer from feeding itself.

Measured at 1440 wide: both lines down to 620px of viewport height, the headline
alone from 580 to 540, neither below 500. Under 500 the task mock alone overruns
the card by 9px and more, which is older than this change and left alone.

Swept 900 down to 480 and back up, the copy comes back on the way up at the same
heights it went on the way down. Held at 560 and sampled eight times, the state
does not flip.

Thresholds in a height media query would have been fewer lines, but the card is
also used in normal flow on the phone layout at `min-h-80`, where `container-type:
size` would cap it at 20rem and clip its own contents. Measuring works for both
callers.

## Not addressed

Dead code found and left alone: `MobileAppStep`, `OnboardingStep.MobileApp` and
`MOBILE_WEB_QUERY` are commented out of the flow but still in the tree.

`HoursGridSize.Default` in `site/graphics/HoursGrid.tsx` has no callers. The
onboarding passes `Compact`, and the redesign page draws its own `HoursGrid`
from `pages/static/redesign/graphics/`. Both changes to the grid were applied to
the Default branch anyway, so the two sizes stay in step.
