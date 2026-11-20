# Evidence

Checked 2026-11-18 by research subagents; categories per root `AGENTS.md` **Established practice**.

## Error recovery UX

- Nielsen Norman Group, [error message guidelines](https://www.nngroup.com/articles/error-message-guidelines/) (research-backed): offer accelerators that resolve the situation; guess the correct action and let users pick it.
- Nielsen Norman Group, [how little do users read](https://www.nngroup.com/articles/how-little-do-users-read/) (research-backed): users read at most about 28% of a page's words. The study covers ordinary web pages, not recovery dialogs.
- Apple HIG, [alerts](https://developer.apple.com/design/human-interface-guidelines/alerts) (vendor recommendation): button titles are one or two words describing the result, preferably verbs.

## Applying updates

- Expo, [downloading updates](https://docs.expo.dev/eas-update/download-updates/) (vendor recommendation): `checkForUpdateAsync`, `fetchUpdateAsync`, `reloadAsync`; don't block launch on the newest update; reloading in the background is experimental and cold-boots without state restoration; no first-class mandatory-update support.
- Expo, [`reloadAsync`](https://docs.expo.dev/versions/latest/sdk/updates/#updatesreloadasyncoptions) (vendor recommendation): reloads into the update expo-updates selects locally; it rejects when updates are disabled or in development. A reload without a downloaded update doesn't run newer code.
- Vite, [load error handling](https://vite.dev/guide/build#load-error-handling) (vendor recommendation): its example reloads on failed dynamic imports. That is a different failure from unknown content kinds.

## Mobile component tests

Checked 2026-11-19 by a research subagent.

- Expo, [unit testing](https://docs.expo.dev/develop/unit-testing/) (vendor recommendation): component tests use Jest with the `jest-expo` preset and React Native Testing Library; Bun appears only as a package manager.
- React Native, [testing overview](https://reactnative.dev/docs/testing-overview) (vendor recommendation): Jest with React Native Testing Library; mock only what can't run, such as native modules.
- Bun, [DOM testing](https://bun.com/docs/test/dom) (vendor documentation): Bun's runner works with React Testing Library through happy-dom registered in a preload; React Native isn't mentioned.
- Bun can't parse the real `react-native` package's Flow sources ([oven-sh/bun#10083](https://github.com/oven-sh/bun/issues/10083), vendor issue tracker).
- react-native-fast-image, [PR #1123](https://github.com/DylanVann/react-native-fast-image/pull/1123) (common practice, a single example): moved its tests to Bun by replacing `react-native` with a small stand-in module registered through `mock.module`.
- Jest, [mock functions](https://jestjs.io/docs/mock-functions) (vendor documentation): a side effect is checked by recording calls at its boundary.

### Experiment

2026-11-19, Bun 1.4.4, at this branch's tip: rendering the mobile `UnrenderableNotice` with `@testing-library/react` 16.3.2 over happy-dom 20.11.1, with stand-ins for `react-native`, `expo-router` and `expo-updates`, records one `captureException` with `report` true and none with it false, and the other 48 mobile test files pass with those stand-ins preloaded.

## Repository behaviour

Read 2026-11-18 at commit 94cc44094c.

- `variablesError` (`shared/useFormRenderer.ts`) carries both authoring errors and unknown-kind failures. The unknown-kind failures in the member path (`resolveFieldInput`, `resolveListInput` in `common/src/forms/variable-evaluation.ts`) read fields of this form's schema, whose unknown top-level kinds `findUnknownFormElementKind` already flags, and, through `resolveSourceInput`, fields of another form's submitted responses, though `readSourceHistory` (`common/src/forms/variable-source-history.ts`) drops questions of a kind this build doesn't know before evaluation reads them.
- `readDisplayOnlySchema` returns null for any parse failure, losing whether a block kind was unknown.
- `apps/frontend/src/lib/useFullLoadOnNewBuild.ts` already turns the next navigation into a full load once a new web build is deployed.
- `shared/useTaskFlow.ts` holds the task flow's open state in memory, so a web reload closes it.
