# Evidence

Research done 2026-11-10 by six research subagents (three for mobile, three for web); each claim was checked against the linked page on that date. Status per root `AGENTS.md` **Established practice**.

## Mobile: detecting and applying updates mid-session

- Expo: check "when the user launches or foregrounds the app. Avoid polling for updates in a frequent loop"; updates served by Expo may be rate limited. Vendor recommendation. https://docs.expo.dev/versions/latest/sdk/updates/
- Expo: "When an update is found, you may want to show a dialog to the user to prompt the user to update"; reloading while backgrounded is "experimental"; blocking startup on a download gives an "extremely poor" experience; there is "no first-class support for critical/mandatory updates". Vendor recommendation. https://docs.expo.dev/eas-update/download-updates/
- Expo `useUpdates()` exposes `isUpdateAvailable` and `isUpdatePending` ("available and has been downloaded"); `reloadAsync` reloads into the most recently downloaded update and accepts `reloadScreenOptions`. Vendor documentation. https://docs.expo.dev/versions/latest/sdk/updates/
- CodePush defaults to installing on next restart without forcing one; `ON_NEXT_RESUME` with `minimumBackgroundDuration` applies silently after time in background; mandatory updates install immediately; `disallowRestart()` defers restarts during critical flows. Vendor recommendation (archived project). https://github.com/microsoft/react-native-code-push/blob/master/docs/api-js.md
- Shorebird: patches apply on next launch; mid-session, "Don't restart in the middle of what the user is doing. Ask first (for example, a 'Restart to update' prompt)." Vendor recommendation. https://docs.shorebird.dev/code-push/update-strategies/

## Mobile UX

- Google Play flexible in-app updates: once downloaded, "inform the user that the update is ready to install and request confirmation before restarting"; sample is an indefinite snackbar "An update has just been downloaded." with "RESTART"; check whenever the app is foregrounded and don't prompt too often. Vendor recommendation. https://developer.android.com/guide/playcore/in-app-updates and https://developer.android.com/guide/playcore/in-app-updates/kotlin-java
- Apple HIG: "Avoid using an alert merely to provide information"; avoid alerts at app start. Vendor recommendation. https://developer.apple.com/design/human-interface-guidelines/alerts
- NN/g: passive notifications should be non-modal and less intrusive; don't use modals for nonessential information. Research-backed. https://www.nngroup.com/articles/indicators-validations-notifications/ and https://www.nngroup.com/articles/modal-nonmodal-dialog/
- Chrome ("Relaunch", "Not now") and Slack ("Restart Slack") name the restart in the action. Common practice. https://support.google.com/chrome/answer/95414 and https://slack.com/help/articles/360048367814

## Hard relaunch

- Apple QA1561: "There is no API provided for gracefully terminating an iOS application… Do not call the exit function. Applications calling exit will appear to the user to have crashed." Vendor recommendation (archived note). https://developer.apple.com/library/archive/qa/qa1561/_index.html
- Android: a process's "lifetime isn't directly controlled by the application itself"; restarting your own process needs third-party libraries. Vendor documentation. https://developer.android.com/guide/components/activities/process-lifecycle

## Web: a tab running an older build

- Next.js: on a deployment-ID mismatch the client "triggers a hard navigation (full page reload) instead of a client-side navigation." Vendor recommendation. https://nextjs.org/docs/app/api-reference/config/next-config-js/deploymentId
- SvelteKit: polls for a new version and checks on focus; the documented recipe forces a full load on the next navigation via `beforeNavigate`. Vendor recommendation. https://svelte.dev/docs/kit/configuration#version
- Vike: "the next time the user navigates to a new page, the page does a full reload"; rejects immediate reloads and popups. Vendor recommendation. https://vike.dev/deploy-sync
- Inertia: on asset change, makes "a full-page visit instead of an XHR visit on the next request." Vendor recommendation. https://inertiajs.com/asset-versioning
- Vercel, Netlify and Cloudflare keep the old deployment's assets reachable for open tabs. Vendor recommendation. https://vercel.com/docs/skew-protection, https://www.netlify.com/blog/introducing-netlify-skew-protection.md, https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/version-affinity/
- Vite: handle `vite:preloadError` by reloading; serve HTML uncached. Vendor recommendation. https://vite.dev/guide/build#load-error-handling
- Workbox: a "new version, reload" prompt "isn't a pattern every application … needs to follow." Vendor recommendation. https://developer.chrome.com/docs/workbox/handling-service-worker-updates
- Without a service worker, apps poll an uncached build-id endpoint, typically on focus or visibility plus a slow interval, and must keep the version response uncached. Common practice. https://github.com/GreatAuk/plugin-web-update-notification

## Measurements

- React Router 7.13.2 (installed): the client's manifest-version check, with its `X-Remix-Reload-Document` reload, runs only on `/__manifest` requests, which lazy route discovery makes; `routeDiscovery: { mode: "initial" }` never makes them. Method: read `node_modules/react-router/dist/development/chunk-UVKPFVEO.mjs` and `chunk-UALY5CBT.mjs`, 2026-11-10.
- React Router 7.13.2 `useBlocker` registers with the router only in effects, so it is safe in a server-rendered component, and blockers run for `navigate()` PUSH/REPLACE and history POP. Method: read `useBlocker` and `shouldBlockNavigation` in `chunk-UVKPFVEO.mjs`, 2026-11-10.
