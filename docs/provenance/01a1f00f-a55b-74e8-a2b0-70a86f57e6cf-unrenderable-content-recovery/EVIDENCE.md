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

## Repository behaviour

Read 2026-11-18 at commit 94cc44094c.

- `variablesError` (`shared/useFormRenderer.ts`) carries both authoring errors and unknown-kind failures. The unknown-kind failures in the member path (`resolveFieldInput`, `resolveListInput` in `common/src/forms/variable-evaluation.ts`) read fields of this form's schema, whose unknown top-level kinds `findUnknownFormElementKind` already flags, and, through `resolveSourceInput`, fields of another form's submitted responses, though `readSourceHistory` (`common/src/forms/variable-source-history.ts`) drops questions of a kind this build doesn't know before evaluation reads them.
- `readDisplayOnlySchema` returns null for any parse failure, losing whether a block kind was unknown.
- `apps/frontend/src/lib/useFullLoadOnNewBuild.ts` already turns the next navigation into a full load once a new web build is deployed.
- `shared/useTaskFlow.ts` holds the task flow's open state in memory, so a web reload closes it.
