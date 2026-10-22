# Dropdown picker device test

This isolated Expo fixture imports the real picker and uses 40 synthetic options, followed by three multiselect dropdown fields rendered through the real `RenderField` and a searchable multi-select sheet of the 40 options. It makes no API calls. Run it with an installed Alliance development client, an unlocked Android device, and Maestro.

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

The launch commands restart the fixture so selection starts at Option 30. The flow checks filtering, clearing searches that hide or retain the selected row, selection with the keyboard open, query reset after selection and backdrop dismissal, empty results, scrolling to the selected option on reopening, results starting at the top after typing, scrolling to the end with search visible, and the plain picker's default behavior. The backdrop tap uses a point above the sheet; all controls and results use text selectors.

`multiselect.yaml` runs the same way, after the same restart. It checks selecting several options without closing the sheet, case- and accent-insensitive search, query retention while selecting and reset on reopening, closing through the header close button, empty results, the selection limit, removal through chips, search and removal names that use a Markdown label's rendered text, the plain sheet, a wrapped read-only chip without a removal control, and results starting at the top after typing in a sheet scrolled down. Assertions on the trigger and chips run after closing the sheet, since Maestro does not see content behind the modal. Labels render through Markdown, which curls apostrophes, so selectors for them match any character there.

`categories.yaml` runs the same way, after the same restart, on a screen of categorized fields opened from the fixture. It checks category headings in a checkbox list, omission of an empty category, scrolling to a selection below a heading on opening, a category-name search keeping that category's options under its heading, and selection from the filtered results, in both the single- and multi-select sheets. Headings render uppercase, so their selectors ignore case.

`clearing.yaml` runs the same way, after the same restart, on a screen of optional and required scale, radio, and select fields opened from the fixture. It checks that scale and radio options report whether they are checked, that tapping a selected option clears it, and that a select's clear button empties it and then hides, whether or not the field is required.

The fixture also runs in an iOS development client. Open the same development-client URL with `xcrun simctl openurl booted`. The Maestro flow targets Android because the current iOS modal groups its contents into one accessibility element, preventing individual input and row selectors.
