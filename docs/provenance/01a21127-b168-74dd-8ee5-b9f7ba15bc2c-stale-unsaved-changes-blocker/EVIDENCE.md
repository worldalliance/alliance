# Evidence

## Reproducing ALL-2390 and finding its cause

Method, 2026-11-24, on `main` at 32c7f4ba2b (React 19.2.3, React Router 7.13.2, Bun 1.4.4, macOS, idle machine), where `useUnsavedChangesPrompt` gave each page its own `useBlocker`:

- `bun test src/pages/FormulaPage.test.tsx -t "stays where the admin went" --rerun-each N` in `apps/admin` failed 8 of 50, 37 of 100, 5 of 30 and 2 of 30 runs. No load was needed.
- With `window.confirm` wrapped to count its calls: 0 calls in 100 runs, failures included.
- With `router.subscribe` logging each state change and `router.navigate` logging its callers, a failing run showed no navigation back to the new formula. The admin's `navigate("/formulas")` left the router at `/formulas/<id>`, idle, with one blocker in state `blocked`; the page that owned it unmounted before its effect could ask. A passing run had no blocker registered at that point.

On `main` at 5c44acdf5c, after #1028 replaced that hook with `useLeaveGuard`, the same test failed 10 of 100 runs. There the shared `LeaveGuard` blocker stays mounted, so the left page's guard makes it ask: in the new hook test run against that hook, `window.confirm` was called once in each of 5 runs, and declining kept the router on the page being left.

After the fix in `useLeaveGuard`, the same test passed 200 of 200 runs. The new hook test `lets staff leave a page an unprompted navigation left before its guard is removed` failed 10 of 10 runs before the fix and passed 20 of 20 after.

## A page kept mounted through a navigation

React Router 7.13.2's `RouterProvider` applies router state inside `React.startTransition`, so a page that stays mounted renders at the new location, and re-registers its guard, some time after the router commits it. The hook test `still asks for a dirty page a change of search params kept mounted, before it renders again` navigates a dirty `allowSamePath` page to `/a?tab=events` and then to `/b` in one `act`: with a guard that blocks only while the router is at its rendered location, `window.confirm` was not called and the router ended at `/b`; with the guard standing down only after its own unprompted navigation, it asked and stayed at `/a`. FormulaPage's `stays where the admin went` passed 200 of 200 runs with the latter. Run 2026-11-24, same versions as above.

## Which location key an unprompted navigation commits

In React Router 7.13.2 (`node_modules/react-router/dist/development/chunk-UVKPFVEO.mjs`, `navigate` and `shouldBlockNavigation`), `router.navigate` hands the blocker the `nextLocation` it then commits, so a guard sees the destination's key before it exists in history. A blocked navigation never commits that key, and the blocker's `proceed` calls `navigate` again, which creates a location with a new key and skips the blocker. The hook test `still asks for a dirty page a change of search params kept mounted after another guard blocked its unprompted navigation` failed with a guard that remembered the key it left from (`window.confirm` called once, not twice) and passes with one that remembers the destination's key. Run 2026-11-24, same versions as above.
