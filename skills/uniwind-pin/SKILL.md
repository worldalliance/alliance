---
name: uniwind-pin
description: Read before bumping uniwind in apps/mobile or tailwindcss in any package, or when the mobile CSS build breaks after a Tailwind release.
---

# The uniwind pin

## Bumping uniwind

Write the new version into `apps/mobile/package.json` with no range, then `bun install`. Re-read every comment that names uniwind's behavior (`git grep -n uniwind apps/mobile`) against the new source.

Then run `Mobile Visual Regression iOS` twice, at the pre-bump commit and then at the bump's, pushing the bump between the two dispatches rather than before the first:

```bash
gh workflow run mobile-visual-regression-ios.yaml --ref <branch> -f ref=<commit> -f environment=staging
```

`-f ref` is the full 40-character SHA checked out; a shorter one resolves as a branch name and the checkout fails. `--ref` is the branch the run executes from and takes no raw SHA. Screenshots land under that branch's head rather than under `-f ref`, which is what the unpushed bump buys. Dispatch from a head that is still the pre-bump commit and the two runs own separate keys, so each `Approve baseline` link Slack posts keeps pointing at the run that posted it. Push first and both runs write one key, where the second overwrites the first and either link promotes the bump.

A passing run overwrites that environment's baseline, which is what the first dispatch is for and why neither one names `production`. A run that logs `No baseline screenshots` compared nothing and passes anyway. A failing first run means the staging baseline holds some other ref, so approve the pre-bump head through `Approve Visual Baseline` (`suite: mobile-ios`, `environment: staging`). `No screenshots found for SHA` back from the approve means that run died before capture, which is a different failure.

The second dispatch is the bump's, from the pushed head. Green means the bump left rendering alone. Red means it moved, so read the diffs and either fix the code and dispatch again, or take the change on purpose through that run's own `Approve baseline` link.

## Bumping tailwindcss

`apps/frontend`, `apps/admin`, and `apps/mobile` each declare a `tailwindcss` range, and `apps/mobile/global.css` imports whichever copy resolves for it, so a bump in any of the three moves the theme mobile compiles against. `bun pm why tailwindcss` lists every package asking for it, grouped by installed version. `@alliance/mobile` appears under more than one; the copy `global.css` imports is the one it asks for directly.

Diff the `--text-*--line-height` names in that copy's `theme.css` against the ones `global.css` sets to `initial`. Add a line for each name Tailwind gained, drop each one Tailwind does not define.

`global.css` spells one name per size, and that `initial` is the whole reason a bare `text-*` sets no line height. A size token it misses puts the height back.

## The Tailwind the pin reaches

uniwind bundles the `@tailwindcss/node` that compiles `global.css`, so that compiler moves only when uniwind does, while the `tailwindcss` supplying the theme values stays on the ranges those three declare. They stay open on purpose. The mobile code rounds whatever line height comes back, so a Tailwind release moves a design value in the open.

`Mobile CSS Check` runs `global.css` through uniwind's metro pipeline on every PR, bundled compiler and processor both, so a red run after a Tailwind release means those two drifted: bump uniwind, or pin `tailwindcss` to the version uniwind bundles.
