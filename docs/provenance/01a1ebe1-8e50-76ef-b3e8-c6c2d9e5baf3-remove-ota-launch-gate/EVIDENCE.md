# Evidence

## When an over-the-air update should apply (researched 2026-11-17)

No formal standard or published research covers this. Vendor guidance converges on background download, apply on next launch, and a restart prompt.

- Expo (vendor recommendation): by default checks on cold start, downloads without blocking and applies on the next restart (`checkAutomatically` `ON_LOAD`, `fallbackToCacheTimeout` 0). On blocking startup with a timeout: "We recommend against this strategy because the resulting user experience is extremely poor." A custom loading screen is allowed when always running the latest version is "very important". "There is no first-class support for critical/mandatory updates." https://docs.expo.dev/eas-update/download-updates/, https://docs.expo.dev/versions/latest/sdk/updates/
- CodePush (vendor recommendation, repo archived May 2025): `installMode` defaults to `ON_NEXT_RESTART`; only updates flagged mandatory default to `IMMEDIATE`. https://github.com/microsoft/react-native-code-push/blob/master/docs/api-js.md
- Shorebird (vendor recommendation): downloads on launch, runs the patch on the next start, recommends a "Restart to update" prompt, immediate restarts only for urgent fixes. https://docs.shorebird.dev/code-push/update-strategies/
- Capawesome, Capacitor live updates (vendor recommendation): recommended strategy is background download plus a reload prompt; blocking at the splash is for apps where a stale version is unsafe. https://capawesome.io/docs/cloud/live-updates/update-strategies/
- Apple HIG (vendor recommendation): "Launch instantly". https://developer.apple.com/design/human-interface-guidelines/launching
- Android vitals (vendor recommendation): a cold start of 5 s or more is excessive. https://developer.android.com/google/play/vitals/launch-time
- Nielsen Norman Group (research-backed): 1 s before attention drifts, 10 s before the task is lost. https://www.nngroup.com/articles/response-times-3-important-limits/

## Which update identity to attach to analytics (researched 2026-11-17)

- Sentry's Expo SDK (vendor recommendation) attaches `update_id`, `channel`, `runtime_version`, `is_embedded_launch`, `is_emergency_launch` and `emergency_launch_reason` to every event. https://docs.sentry.io/platforms/react-native/guides/expo/manual-setup/expo/expo-updates/
- Expo (vendor API) exposes those as `Updates` constants. https://docs.expo.dev/versions/latest/sdk/updates/
- PostHog (vendor docs) documents `customAppProperties`, applied to every event from initialization. https://posthog.com/docs/libraries/react-native

## The bug (measured 2026-11-17, expo-updates 57.0.22)

- iOS serializes the state machine context with `checkError` and `downloadError` present as `null` when there is no error (`node_modules/expo-updates/ios/EXUpdates/UpdatesStateMachine.swift`, `json`, a `[String: Any?]`). Android omits them. The TypeScript types declare `checkError?: Error`. The gate compared with `!== undefined`, so on iOS it opened with `check_error` on the first render.
- PostHog, 7 days to 2026-11-17: iOS 169 `check_error`, 4 `applied`, 0 `no_update`; Android 0 `check_error`, 13 `applied`, 5 `no_update`. iOS `check_error` resolved 0–8 ms after mount.
- A production iPhone's device log showed the startup check receiving `204 No Content` with `expo-protocol-version: 1`, which expo-updates' iOS `FileDownloader` handles as a successful no-update response.
