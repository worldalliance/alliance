# Checks on 2026-09-21

The dropdown-search commit follows parent `ddf688262`. The sections below identify the implementation stage exercised by each check. Commands use Bun 1.3.6 on macOS arm64. Paths are relative to the repository root.

## Review fixes on 2026-09-21

These checks exercised the dropdown height and hidden-label fixes before the separate web question-label changes.

- From the repository root, `bun run test sharedweb apps/frontend apps/admin` exited 0 with 110, 122, and 190 passing tests respectively and no failures. From `sharedweb`, `bun run typecheck` exited 0. From the repository root, `bun run format sharedweb/forms/RenderField.tsx sharedweb/forms/FormRenderer.test.tsx` exited 0.

- From `sharedweb`, `bun test forms/FormRenderer.test.tsx` with the new hidden-addon assertion exited 1 before the fix: 9 tests passed and the hidden-label case failed because "Show publicly" remained rendered. After the guard, the same command exited 0 with 10 passing tests. Both visible and hidden labels retained the dropdown's accessible name.
- From the repository root, `bun .scratch/dropdown-fixes/web-check.ts` used installed Playwright Chromium at a 390 by 844 viewport against an isolated Vite fixture on this worktree's frontend port. The initial standalone searchable/native comparison failed at 37.5 versus 38 pixels after fonts loaded. With both actual `RenderField` variants using `h-10`, the check at that stage exited 0: both measured 37.5 pixels at a 15px root font and 50 pixels at a 20px root font. That comparison covered the two dropdown variants only, not the other controls on the form. Selecting short and long labels preserved each height; the closed searchable label retained ellipsis and the open list allowed selection of its full text. An intermediate check failed because its "Options" selector also matched "Search options" during popup dismissal; exact naming corrected the selector.

## Tests and typechecks

- With the scroll-on-clear fix applied and both follow-up commits absent, `bun run test common shared sharedweb apps/frontend apps/admin apps/mobile` from the repository root exited 0 with 829, 521, 110, 122, 190, and 54 passing tests respectively, and zero failures. `bun run typecheck` from each of those six packages exited 0. Frontend and admin ESLint printed the existing warning that the React version was unspecified.
- Before and after the changes, ran `bun run test common shared sharedweb apps/frontend apps/admin apps/mobile` from the repository root. Both runs exited 0. Package results were 829, 521, 109, 122, 190, and 54 passing tests respectively, with zero failures. These runs exclude server tests and native UI tests.
- Ran `bun run typecheck` separately from `common`, `shared`, `sharedweb`, `apps/frontend`, `apps/admin`, and `apps/mobile` after the code changes. All six exited 0.
- Ran `bun run format:check apps/mobile/components/BottomSheetOptionPicker.tsx sharedweb/forms/SearchableSelect.tsx` from the repository root. Exit 0; all matched files use Prettier formatting.

## Web label layout

Used the installed Playwright Chromium with a 390 by 844 viewport. An isolated Vite fixture at `http://localhost:5973` imported `SearchableSelect` and `apps/frontend/src/index.css`, without authentication or API calls. Its container was 240 pixels wide and used the form control classes `w-full px-3 py-2 rounded-md bg-white`.

The selected synthetic label was "A deliberately long option label that should remain readable in the menu without making the closed control taller". The second option was "Short label".

- Before the change, the selected label wrapped and the trigger measured 127.5 pixels tall. The adjacent native select measured 34 pixels tall. The layout assertion failed.
- After wrapping the selected value in the truncating span, the trigger measured 37.5 pixels tall for both labels. Its span had `text-overflow: ellipsis`, with scroll width greater than client width.
- Opening the dropdown displayed the full long label on multiple lines. Searching for "Short" and selecting "Short label" updated the trigger.
- The final command, `bun .scratch/dropdown-review/web-check.ts` from the repository root, exited 0. The script and fixture remain local working files.

Earlier versions of the check failed because they required the searchable control to equal the native control's height exactly, and because an unscoped option selector matched the native select's hidden option. The final check compares long and short searchable values and scopes menu options to the listbox. A `render` prop on `Combobox.Value` did not create a wrapper in the installed Base UI version; the implementation uses an enclosing span.

## Mobile subscription lifetime

Read `BottomSheetOptionPicker.tsx`, `FormModal.tsx`, and the installed React Native 0.86.3 `Libraries/Modal/Modal.js`. The window and keyboard hooks are inside `SearchableOptionList`, which is a descendant of the modal and only exists for searchable pickers. On iOS, `Modal` retains children until dismissal completes, then returns null. Keyboard-height state belongs to the list wrapper; the option rows are passed as children from its parent.

## Android device

### Query clearing

On the Moto G Play 2024 running Android 14, used the synthetic native fixture supplied by the separate test commit. It imports the production picker, supplies 40 options, and initially selects Option 30. From the repository root, ran `maestro --platform android test -e APP_ID=com.alliance.alliancemobile.dev --debug-output .scratch/dropdown-fix/red apps/mobile/e2e/dropdown/picker.yaml` with assertions for clearing a query and reopening.

- Before the fix, the flow exited 1 after entering `zzz` and clearing it. The assertion that Option 01 was visible failed; the screenshot showed selected Option 30 at the top.
- A once-per-opening guard alone also exited 1 at that assertion. Temporary layout and scroll logs showed the guarded callback skipping the second selection scroll while the list retained offset 1358.857 after its content height became zero. Resetting the empty list's offset produced a scroll event at zero.
- With the guard and empty-content reset, the same command using output directory `.scratch/dropdown-fix/reset-empty` exited 0. Clearing `zzz` showed Option 01 with Option 30 absent; clearing `3`, which retained Option 30, also showed Option 01. Reopening showed Option 30 again. Clearing `Option` after scrolling to Option 01 preserved that position. The flow also passed selection with the keyboard open, empty-result dismissal, scrolling to both ends with search visible, and plain-picker selection. Temporary logs were removed after this run.

### Initial dropdown checks

On 2026-09-21, tested the mobile dropdown implementation before the scroll-on-clear fix on a Moto G Play 2024 running Android 14, using the installed development client. An isolated Expo fixture in `.scratch/dropdown-review/native` imported the repository's `BottomSheetOptionPicker`, mobile stylesheet, `SafeAreaProvider`, and `KeyboardProvider`. It supplied 40 synthetic options, initially selecting Option 30. Metro served this worktree's port 8885 through an adb reverse mapping. The fixture made no API calls.

From the repository root, ran `~/.maestro/bin/maestro --platform android test --debug-output <output-directory> <flow>` for the following flows in `.scratch/dropdown-review`. Each final run exited 0:

- `android-search.yaml`: opened around selected Option 30, filtered to Option 39, selected its row with the keyboard open, and reopened with Options 39 and 40 visible. Output directory: `android-search-final`.
- `android-scroll.yaml`: with the keyboard open and query "Option", scrolled to Option 01 and then Option 40, asserting that the search input remained visible at both ends. Selected Option 40, reopened around it, dismissed through the backdrop, then selected Option 02 in the plain picker with no search input. Output directory: `android-scroll-output`.
- `android-dismiss.yaml`: searched for "NoSuchOption", observed "No matches", dismissed through the backdrop, and reopened with Option 02 visible and both the query and empty-state message absent. Output directory: `android-dismiss-output`.

The first search flow exited 1 at the selected-value assertion because its text selector tapped the query input containing "Option 39". A coordinate tap on the result row selected it; changing the flow to select the second matching element passed. A separate hierarchy command run during that first flow failed with Maestro's device-server-unavailable error. Subsequent Maestro commands ran sequentially. Live screenshots showed the filtered result and the scrolling list above the keyboard. These checks did not exercise application API integration, and no picker code changed during them.

## iOS simulator

Used the installed development client on an iPhone 17 simulator running iOS 27.0. An isolated Expo fixture in `.scratch/dropdown-review/native` imported the repository's `BottomSheetOptionPicker`, mobile stylesheet, fonts, `SafeAreaProvider`, and `KeyboardProvider`. It supplied 40 synthetic options labelled "Option 01" through "Option 40", initially selecting value `30`. Metro served this worktree's port 8885; the fixture made no API calls.

Ran Maestro flows with `~/.maestro/bin/maestro --device <booted-simulator-id> test --debug-output .scratch/dropdown-review/maestro <flow>`, from the repository root. The `native-keyboard.yaml` and `native-reopen.yaml` flows in `.scratch/dropdown-review` exited 0. Inspected their screenshots and the initial open screenshot:

1. Opening showed selected Option 30 at the top of the list, with an empty, unfocused search input and no keyboard.
2. Typing "Option 39" displayed that row above the native keyboard. Tapping it dismissed the sheet and the fixture displayed "Selected 39".
3. Reopening cleared the query and showed selected Option 39 and neighboring rows, including Option 40.
4. Typing "Option" displayed a scrollable list above the keyboard. Swiping to Option 40 kept the search input visible; the last row remained above the keyboard.
5. Dismissing through the backdrop and reopening cleared the query while retaining selection 39.
6. Opening the plain picker showed its three supplied options without a search input.

The first native fixture run lacked styles because Metro was launched from the repository root; restarting from the fixture directory loaded its Uniwind CSS. Label-based Maestro assertions for individual rows exited 1. The hierarchy exposed the modal contents as one combined accessibility element, although the screenshot showed Option 30 selected and visible. Subsequent flows used coordinate taps and screenshot inspection inside the modal. These checks cover iOS only; Android and application API integration were not exercised.

## Checked-in native regression fixture

These checks exercised the checked-in native fixture with dropdown search and web question-label changes applied.

- From the repository root, `bun run test sharedweb apps/frontend apps/admin` exited 0 with 140, 122, and 190 passing tests. `bun run test apps/mobile` exited 0 with 54 passing tests. These unit suites do not execute the Maestro flow.
- From each of `sharedweb`, `apps/frontend`, `apps/admin`, and `apps/mobile`, `bun run typecheck` exited 0. The mobile check includes the fixture's TypeScript. Frontend and admin ESLint printed the existing warning that the React version was unspecified.
- From `apps/mobile/e2e/dropdown`, `bun run start` started Metro on the port returned by `bun scripts/ports.ts mobile` from the repository root, 8885 in this checkout. Metro bundled the fixture for Android and iOS without errors.
- Opened the fixture in the installed iOS development client on the booted iPhone 17 simulator running iOS 27.0. A Maestro tap on "Open searchable picker" completed. `xcrun simctl io booted screenshot .scratch/dropdown-fixes/ios-picker.png` exited 0. Inspection showed the styled sheet, empty search input, and selected Option 30 at the top of the list. Maestro's hierarchy exposed the modal as one combined accessibility label containing its title, input label, and all 40 options; an exact "Search options" assertion failed.
- The initial Android smoke flow failed its "Selected 30" assertion before interacting with the fixture. `adb shell dumpsys window` showed the notification shade focused; the device reported itself locked.
- After extending the flow to cover query clearing, `maestro --platform android test -e APP_ID=com.alliance.alliancemobile.dev --debug-output .scratch/dropdown-fix/reset-empty apps/mobile/e2e/dropdown/picker.yaml` from the repository root exited 0 on the unlocked Moto G Play 2024 running Android 14. It passed all assertions, including clearing searches that hide or retain the selection and scrolling back to the selection on reopening. The same flow before the scroll-on-clear fix exited 1 at the first assertion that Option 01 was visible after clearing `zzz`.
- After replaying both follow-up commits onto the tested base, `bun run typecheck` from `apps/mobile` exited 0, including the native fixture. From the repository root, `bun run format:check` on the five changed files exited 0. Comparing the rewritten branch with its previous tip showed no changes to any `REQUIREMENTS.md` file.

## Required-dropdown review fixes

On 2026-09-21, checked the fixes while stopped at base commit `30c5a0add98d4ddcb9f00237d9da6f61b670ef78`, before replaying the web question-label commit.

- Before edits, `bun run test sharedweb apps/mobile` from the repository root exited 0 with 110 and 54 passing tests.
- Extended the submit test in `sharedweb/forms/FormRenderer.test.tsx` to cover native and searchable dropdowns with the submit button focused and unfocused. Before the implementation change, `bun test forms/FormRenderer.test.tsx` from `sharedweb` exited 1 with 8 passing and 2 failing tests. The focused native case lacked `aria-required`; the unfocused native case never displayed the inline required error.
- After changing the native select to `aria-required`, extracting the component-local option type, using the mobile color token, and moving the existing fixture into the base commit, `bun run test` from the repository root exited 0. Passing counts were server 525, common 829, shared 521, sharedweb 112, frontend 122, admin 190, and mobile 54, with zero failures.
- `bun run typecheck` from each of `sharedweb`, `apps/frontend`, `apps/admin`, and `apps/mobile` exited 0. Frontend and admin ESLint printed the existing warning that the React version was unspecified.

The unit suites do not execute the Maestro flow. The moved fixture and flow retain their previously recorded device results; no device run was repeated for these review fixes.

## Invalid-field navigation

On 2026-09-21, added focus assertions against branch tip `15242b4fa`, then applied the implementation and tests to dropdown-search base `f2b7110d2` before replaying the question-label commit.

- From `sharedweb`, `bun test forms/FormRenderer.test.tsx` before the implementation exited 1 with 5 passing and 7 failing tests. Failures covered both dropdown variants, Next, and returning to an earlier invalid page. An initial version comparing DOM objects directly crashed Bun while printing a failed assertion; boolean identity assertions produced the reported failures.
- With the implementation and additional submit-event cases, the same command exited 0 with 14 passing tests. Assertions cover repeated invalid submissions, focus with a help button beside the question, both dropdown variants, Next, form submission on an intermediate page, and returning to an earlier invalid page.
- While stopped at the base commit with the fix applied, `bun run test` from the repository root exited 0. Passing counts were server 525, common 829, shared 521, sharedweb 116, frontend 122, admin 190, and mobile 54, with zero failures. `bun run typecheck` from each of `sharedweb`, `apps/frontend`, and `apps/admin` exited 0. Frontend and admin ESLint printed the existing warning that the React version was unspecified.
- From the repository root, `bun .scratch/form-focus/check.ts` exited 0 using installed Playwright Chromium at 390 by 844 against an isolated Vite fixture on port 5973. The fixture imports production `FormRenderer` and the frontend stylesheet and supplies synthetic options. All 12 assertions passed: native and searchable dropdowns, document and 600px container scrolling, two button submissions and submission by Enter. Before submission, each dropdown was above the viewport; afterward its top was at 115.75px and it held focus. The first fixture attempt failed with `React is not defined`; importing React in the fixture corrected that setup error.

## Control heights without an explicit height class

Measured on 2026-09-22 with the dropdown-search commit's `RenderField` class strings and no height class on either variant.

- `bunx @tailwindcss/cli -i src/index.css -o /tmp/f.css` from `apps/frontend` and the same from `apps/admin` both exited 0.
- A Bun static server served each compiled stylesheet plus `apps/<app>/public`, so the repository's Source Sans 3 woff2 files loaded. Installed Playwright Chromium opened the page, awaited `document.fonts.ready`, and read `boundingBox().height` for a text input, a native select, and the searchable trigger, each carrying the class strings `RenderField` emits.
- Frontend, root font size 15px: text input 39.5, native select 40, searchable trigger 39.5.
- Admin, root font size 16px: text input 42, native select 42, searchable trigger 42.
- The same script run with `h-10` added to both dropdown variants reported 37.5 for select and trigger against a 39.5 text input on the frontend, and 40 against a 42 text input on the admin.
