# Driving the mobile app

The Expo app runs on react-native-web, so playwright drives it the way it drives the admin.

## Start it

Nothing else brings Metro up, and expo dies on a port that is already serving rather than prompting for another one:

```bash
curl -sfo /dev/null http://localhost:8085 || bun run --cwd apps/mobile web
```

Metro holds the foreground, so background it. ~20s to the first bundle. `BROWSER=none` in the script stops expo opening a tab in the user's own Chrome, so keep it on any variant you run.

## Selectors

- `testID` → `data-testid`, `accessibilityLabel` → `aria-label`.
- A screen whose data has landed sets `vr-<screen>-ready`, the signal to wait on. Roughly half of them do, so `grep -rn '"vr-' apps/mobile/app` for the set that exists today and wait on rendered text for the rest. `vr-app-shell-ready` means the authenticated shell mounted.
- The closed drawer stays in the DOM at negative x and still reports visible, so a text selector matches its copy of a nav label and `click()` retries until it times out on `element is outside of the viewport`. Reach screens by URL rather than by clicking nav, and scope selectors under the screen's own container.
- `ScrollView` scrolls with `mouse.wheel`.

## Authenticating

`SecureStorage` is localStorage on web. Mint an access token (see the skill's admin section) and seed it on the context to land as any user without a password:

```ts
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
await context.addInitScript(
  (t) => localStorage.setItem("alliance.secure.accessToken", t),
  token,
);
```

Use `addInitScript`, not `page.evaluate` after a `goto`. `AuthContext` reads the token on mount and clears it when it finds nothing, so a racing write lands you on `/auth/login` with empty localStorage.

Mint it with an expiry that outlives the run. Nothing seeds `alliance.secure.refreshToken`, and the fetch wrapper in `apps/mobile/app/_layout.tsx` refreshes only when it finds one, so the session ends at the first 401 after the token expires.

`citesting/src/test-user.ts` holds the seeded user CI logs in as.

## What differs on web

Push notifications and device registration return early on `Platform.OS === "web"`.

`alliance://` deep links don't resolve. Navigate to `/<route>` instead.

Uploads work. `launchImageLibraryAsync` leaves a hidden `<input type="file" data-testid="file-input">` on the body until a file arrives, so trigger the picker and then:

```ts
await page.getByTestId("file-input").setInputFiles("path/to/image.png");
```

Push and deep links are the only reason left to boot the iOS simulator, where `~/.maestro/bin/maestro` drives it and `citesting/src/take-mobile-screenshots.ts` already builds, boots, and screenshots end to end. Its `xcodebuild` step costs minutes per iteration against seconds on web.
