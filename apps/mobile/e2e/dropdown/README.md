# Dropdown picker device test

This isolated Expo fixture imports the real picker and uses 40 synthetic options, followed by three multiselect dropdown fields rendered through the real `RenderField`. It makes no API calls. Run it with an installed Alliance development client, an unlocked Android device, and Maestro.

From this directory, start Metro:

```sh
bun run start
```

From the repository root, forward this checkout's Metro port and run the flow:

```sh
metro_port=$(bun scripts/ports.ts mobile)
adb reverse "tcp:$metro_port" "tcp:$metro_port"
adb shell am force-stop com.alliance.alliancemobile.dev
adb shell am start -a android.intent.action.VIEW \
  -d "alliance://expo-development-client/?url=http%3A%2F%2Flocalhost%3A$metro_port" \
  com.alliance.alliancemobile.dev
maestro --platform android test \
  -e APP_ID=com.alliance.alliancemobile.dev \
  --debug-output .scratch/dropdown-picker \
  apps/mobile/e2e/dropdown/picker.yaml
```

The launch commands restart the fixture so selection starts at Option 30. The flow checks filtering, clearing searches that hide or retain the selected row, selection with the keyboard open, query reset after selection and backdrop dismissal, empty results, scrolling to the selected option on reopening, scrolling to both ends with search visible, and the plain picker's default behavior. The backdrop tap uses a point above the sheet; all controls and results use text selectors.

`multiselect.yaml` runs the same way, after the same restart. It checks selecting several options without closing the sheet, case- and accent-insensitive search, query retention while selecting and reset on reopening, closing through the header close button, empty results, the selection limit, removal through chips, search and removal names that use a Markdown label's rendered text, the plain sheet, and a wrapped read-only chip without a removal control. Assertions on the trigger and chips run after closing the sheet, since Maestro does not see content behind the modal. Labels render through Markdown, which curls apostrophes, so selectors for them match any character there.

The fixture also runs in an iOS development client. Open the same development-client URL with `xcrun simctl openurl booted`. The Maestro flow targets Android because the current iOS modal groups its contents into one accessibility element, preventing individual input and row selectors.
