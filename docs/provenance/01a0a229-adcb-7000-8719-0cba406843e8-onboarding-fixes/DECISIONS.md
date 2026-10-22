# Decisions

## Mobile

- Disabled the narrative screens by commenting them out of `STEP_ORDER` in
  `apps/mobile/lib/onboarding/flow.ts`, matching how the web flow already parks
  its own app-download screen. Everything else stays in the tree.
- `isOnboardingStep` now checks the enum rather than `STEP_ORDER`, so the
  development-only `?step=` preview still opens a disabled screen.
- The walkthrough is off by commenting out `<Walkthrough />` in
  `apps/mobile/app/(app)/_layout.tsx`. `WalkthroughAnchorProvider` stays mounted
  so the `Anchor` calls scattered through the app keep working.
- `/platform-walkthrough` redirects to `/` rather than starting the tour.
- `walkthroughStart()` has no caller now. Left in place: it belongs to the
  disabled tour, which is being kept.
- The login photo sits in its own absolutely positioned box at a frozen viewport
  height, outside the keyboard-avoiding subtree. The height is the tallest
  window height seen at the current width, because Android resizes the window
  when the keyboard opens and iOS does not.
- The root `KeyboardAvoidingView` is disabled on the gate, which now runs its
  own, so only the form moves.

## Web

- Equal spacing came from giving each story step's inner wrapper `var(--ob-gap)`,
  the same gap the step layout puts between the headline and that wrapper.
- `useScrollFeather` masks a scroller's clipped edge, and only the edge with
  content past it. It watches the whole subtree plus `animationend`, because the
  entry animation translates content and a translated box counts toward
  `scrollHeight` while it is still offset.
- Added an optional `count` to `GET /user/signupSocialProof`, capped at 24, so
  the commitment mockups can draw twelve distinct members. Existing callers get
  the same five as before.
- Each mockup takes its own slice of that roll and wraps where the database
  holds fewer photos, falling back to the bundled avatars when it holds none or
  when an image fails to load.
- The compact hours grid caps its width off the height it was handed, through a
  size container query. The gaps come out of the height before the aspect ratio
  is applied and go back on after, which is what keeps the cells square.
- A size container query resolves to zero unless the container's height is
  definite, so `StepLayout` gained a `fill` option that caps the body at the
  height it was given. The minutes and commitment steps use it. That also fixed
  the commitment deck, which was painting at scale zero on every phone width
  before this change, for the same reason.
- Impact screen: the first attempt stacked the milestones one per row, which the
  user rejected. Reverted to the two-by-two grid. The halved progress bar and
  the dropped "Completed" qualifier stayed.
- The agreement's terms band is the only part of that screen that gives up
  height, so the headline, note, field, faces, and buttons stay put. Its minimum
  height sits on the band rather than on the scroller inside it, or the scroller
  refuses to shrink and runs out under the field.
- `useLockedViewport` publishes `--ob-keyboard-inset` from `visualViewport`, and
  the panel answers it with padding rather than a shorter box: the panel's morph
  transitions `bottom` over 900ms, and the keyboard has to be answered in the
  frame it opens.

## Not verified

- Firefox will not launch on this machine (a graphics failure in the installed
  build, present before these changes). Checked in Chromium and WebKit across
  four viewports and five screens.
- Profile photos 404 locally because `server/uploads/` is empty, so the faces
  were verified by URL rather than by eye.
- The mobile changes were reasoned about rather than driven: Metro was not
  running by the time the app came up for checking.
