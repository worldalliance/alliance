# Decisions

All agent decisions unless labelled otherwise.

## Telling "too old" from "broken"

- `formUnrenderable` (`common/src/forms/unrenderable.ts`) blames the client when `unknownKind` is set and the content otherwise. `variablesError` alone can't tell them apart: its strings mix authoring errors with this build not knowing a kind (EVIDENCE.md, Repository behaviour), so every kind evaluation can fail on is caught as `unknownKind` first (below).
- Display-only content: `readDisplayOnlySchemaForMember` blames the client for every parse failure. The server parses each display-only snapshot with its own build when serving it and serves an empty schema when that fails (`server/src/tasks/display-only-snapshot.ts`), and member clients are never newer than the server, so a schema the client rejects was written by a newer build. Splitting by zod issue code misread a widened type or relaxed bound as broken content.

## Kinds this build doesn't know

- `unknownKind` also covers the kinds that used to surface only through `variablesError`: unknown formula input kinds in variables and options formulas (`findUnknownVariableInputKind`) and unknown list sub-field kinds (`findUnknownFormElementKind` now looks inside lists). Member clients cast stored schemas rather than parse them, so these kinds do reach the renderer. An options formula's unknown input kind no longer throws while ordering the options formulas (`dependencies` in `formula-options.ts`), which crashed the form before the block could show.
- `unknownKind` also covers a variable or options formula this build can't compile (`findUncompilableFormula`): the server compiles every formula on save, so a compile failure on a member's screen is usually syntax or a function a newer build added. A formula saved before a stricter compiler rule (the `-x ** 2` rejection came two weeks after compiling on save) fails on every build and is mislabelled too; stored formulas weren't checked for one, and telling it apart would mean comparing the error against rules later builds tightened. Runtime evaluation failures stay content problems.
- Known gap, not addressed here: `readSourceHistory` drops a question of a kind this build doesn't know from another form's history before evaluation reads it, so a formula reading it computes without it rather than blocking. It predates this task; filed as ALL-2363.

## Staff views

- Staff views (`showDetail` on admin form previews and response views, `staffView` on the admin's update list) show the detail under "This form can't be displayed" (or "update"). Content the admin build is too old for keeps "Reload page": the server serves only what it parses, so the tab is stale, and the admin, unlike the frontend, doesn't reload itself on a new build. Only the form builder's preview (`draft`) shows a formula error with no reload, since its schema is unsaved and no newer build fixes a mistyped formula; the response views show saved snapshots and keep it. A draft whose variable reads an input kind the tab doesn't know loses the reload too, though a newer tab would show it; the detail still names the kind, and telling the two apart would mean recording which check set `unknownKind`.
- The copy makes no claim that anyone was notified (REQUIREMENTS.md).

## Mobile recovery

- One search per moment, shared by every notice on screen (`shareInFlight`): download an OTA update first, then ask the server whether the store has a newer build (also when the OTA check failed, since a store build fixes the content either way), reusing the check `UpdateAvailableModal` already ran, now in `lib/storeUpdate.ts`. `OtaUpdateBanner` and the notice share `fetchAvailableUpdate`, which reports a failed check or download, and `restartIntoUpdate`. A failed store request counts as a failed search ("Couldn’t check…"), never as "isn’t out yet".
- `restartIntoUpdate` saves the current route, query parameters included (expo-router's `useUnstableGlobalHref`, so `/messages/new?to=…` keeps its recipient), before `reloadAsync`; `ResumeAfterRestart` opens it with `router.navigate` (a push would stack a second home screen on a restart from home) once auth has loaded, waiting through a session restore that failed and may succeed on retry, for signed-in members only, if it was saved under two minutes ago and is an in-app path. The banner's restart returns to the same screen too. In-memory state (an open task flow) isn't restored: the member lands on the screen, not inside a sheet opened on it. expo-router marks that hook private and may add a hostname to it; `takeResumeRoute` then rejects the route as not in-app, so the restart lands on the home screen rather than anywhere unexpected. A failed save, read or drop of the route, and a saved entry that is unreadable or not an in-app path, is reported as `resume_route_failed` (not sent to Slack: the member still lands on the home screen). A failed reload drops the saved route, so a later launch from a push or link isn't sent back to it.
- Copy per state: "Getting the latest version…" with a spinner; "Restart Alliance to finish updating." + "Restart to update"; "Get it from the App Store." + "Open App Store" (Play Store on Android); "The version of Alliance this form needs isn’t out yet. Please try again later."; "Couldn’t check for an update. Check your connection and try again." + "Try again"; restart failure reuses the banner's "Couldn’t restart. Close and reopen Alliance to update."
- `updateRecoveryView` picks the message and button from the search outcome, apart from the component, so tests cover each state.
- Status changes are announced with `AccessibilityInfo.announceForAccessibility`, once per message across notices that mount or change within 2 seconds of each other, so a feed of cards the build can't show doesn't repeat it, while a notice on a screen opened later still announces.

## Web

- The notice keeps the amber styling for both reasons; the outdated case adds a "Reload page" button (`window.location.reload()`).
