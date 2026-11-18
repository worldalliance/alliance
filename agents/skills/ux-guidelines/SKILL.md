---
name: ux-guidelines
description: Read before designing or changing UI in apps/, sharedweb/, shared/ or agents/desktop, including forms, native screens, keyboard shortcuts, loading and URL state, and colour, type, spacing or motion values, or judging a UI's quality.
---

# UI and UX guidelines

No standard covers good UX as a whole; the **F** items below are the WCAG criteria most relevant to UI work here, not all of it. An explicit product requirement that conflicts with any item takes precedence, per the root `AGENTS.md` **Established practice** rule, and the change states the departure. Each item carries its status:

- **F**: formal standard, normative in its scope (WCAG 2.2, also ISO/IEC 40500:2025). That scope is web content: on native, WCAG2ICT applies WCAG only informatively, so an **F** item counts as **C** there unless a law adopts it. WCAG2ICT lists an Electron app's HTML as software, so `agents/desktop` counts as native for status and the AA bar. Items scoped to the web also apply there, apart from new tabs, copied links and URL state, which its window doesn't have (**J**).
- **V**: platform vendor recommendation, authoritative on that platform and **C** on any other (Apple HIG and app review, Google Play policy, Material 3, GNOME HIG, Google's Web Vitals, library docs for that library).
- **R**: research-backed practice (Nielsen Norman Group, Baymard); an article naming no study counts as **C**.
- **C**: common practice in mature design systems (GOV.UK, USWDS, WAI-ARIA patterns).
- **J**: Alliance judgement that no source settles.

Each item names its sources; [SOURCES.md](SOURCES.md) links each item, by its opening words, to the local copies in `sources/`. Update it with each new item, each change to an item's opening words, and each source an item gains, loses or renames. Open one when a finding or decision needs to cite it.

What a change adds or alters meets WCAG 2.2 AA, on native as an Alliance bar (**J**), and satisfies every item that applies; a failure it notices elsewhere on the surface follows the root `AGENTS.md` **Scope and improvement** rule. Judging a UI applies every item to the whole surface. A screenshot can show a visual defect; keyboard, screen-reader and timing items need the running app. No automated rule judges colour-only meaning, so a surface that shows state, status or category by colour gets a look under Chrome's `achromatopsia` (grayscale), `protanopia` and `deuteranopia` emulation, which Playwright reaches through CDP `Emulation.setEmulatedVisionDeficiency`; a surface with no colour-coded meaning gains nothing from it. **V** Chrome for the emulation; when to run it is **J**

## Controls and labels

- Icons stand alone only for the actions the Alliance counts as universally recognised: close, search, send, delete, settings. Every other action carries a visible word, since a tooltip or accessible name doesn't tell a sighted newcomer what an unfamiliar icon does, and most Alliance users are non-technical. **R** icon usability: most icons are ambiguous without a label, and only a few, such as home, print and search, are broadly recognised; the Alliance's list is its own. This rule supersedes the "Icons over text labels" constraint earlier tasks recorded, so that constraint takes no precedence over it. Icons come from `lucide-react` (`lucide-react-native` on mobile), a repo convention.
- Direct interaction over modes: an inline edit over an "Edit" toggle, an Alliance preference no source weighs. Where a mode remains, the active mode is clearly shown, and none is used where a slip in the wrong mode loses work or data. **C** modes
- On pointer platforms an icon-only control shows a tooltip. **J**, extending GNOME's header-bar rule. A tooltip holds short text only; links or controls go in a popover opened by click. **C** Carbon toggletip, APG tooltip. Content that hover or focus shows, a custom tooltip included, stays while the pointer moves onto it and until the pointer or focus leaves, the user dismisses it or it is no longer valid, and a key such as Escape dismisses it without moving either, unless it reports an input error or covers nothing. A browser `title` tooltip, which the user agent draws, is exempt. **F** content on hover or focus
- A destructive or irreversible action says in words, on the control or in its confirmation or undo message, what it does and what it affects, and offers confirmation or undo. WCAG requires reversal, a check with a chance to correct, or confirmation only for legal, financial, stored-data and test-response submissions; elsewhere this is practice. **V** GNOME dialogs, **F** error prevention. It is never the default action, the one Enter or initial focus triggers. **V** Apple buttons for the default button; initial focus is **J**, extending APG dialog. A web confirmation whose purpose is the destructive step may style it as a primary danger button. **C** Carbon button
- A component with the same function keeps the same name on every screen that repeats it. **F** consistent identification. It also behaves the same, and the current location is visible. **J**
- On the web, anything that goes somewhere is a real link, so open-in-new-tab and copy-link work, and its text or context names the destination. Anything that does something is a button. **C** Carbon button, Carbon link, Atlassian link button, **F** link purpose
- Interface text uses common words, literal phrasing and one point per sentence. A button starts with a verb naming its result. **C** COGA, Fluent content, Carbon dialogs, Atlassian button, **R** lower-literacy users.

## Status and feedback

- After an action starts, working, done and failed look different; a failure never looks like an empty success. **J**, applying heuristics
- A failure or anything needing action stays available until resolved or dismissed, inline or in a banner; a timed toast carries only what the user can afford to miss. **C** Carbon notifications, Atlassian flag, Shopify alerts
- An absent value never shows as 0: zero, unavailable and not applicable read differently. **C** Analysis Function
- An absolute time names its timezone where the reader could take it for another zone, such as a deadline, event or incident. **C** GitLab, Cloudscape
- Feedback to a click lands within about 100 ms; a wait over about 1 s shows that work is under way, and long work names what it is doing and lets the user turn elsewhere. Progress is a percentage only when it is measurable. **R** response times, **V** progress
- Status messages (saved, uploaded, failed) reach screen readers without moving focus. **F** status messages
- An empty state names what is empty and guides the next step, with a control for it where one helps. **V** placeholders. "Nothing yet", "failed to load" and "no results" read differently. **J**
- An incoming chat message scrolls the view only if the reader is at or near the end; otherwise it keeps their place and offers a jump to latest. The reader's own sent message always scrolls into view. **C** MUI, Kendo
- A notification fires once per event, keeps confidential content out of its preview, opens the thing it is about, and its outcome is also findable in the app. **J**, extending Apple notifications

## Trust and safety

- Members can report another member's content or account and block them from inside the app. **V** Apple review, Google Play. Every surface showing another member's content offers Report, every one-to-one surface offers Block, and both are labelled in words. **J**
- A screen showing private content, such as direct messages or private answers, is excluded from session replay, and free-text input stays masked unless a change states why. **J**. PostHog masks with `ph-no-capture` on web and `PostHogMaskView` on native. **V** PostHog
- Account deletion is available inside the mobile app. **V** Apple review. Leaving, withdrawing or switching off a channel takes no more steps than joining and is available in the same app; its wording carries no guilt or invented urgency, and counts and deadlines shown are real. **J**

## Accessibility and input

- Every action works from the keyboard unless it depends on the path of movement, nothing traps focus, and focus is visible and never fully hidden behind sticky headers, composers or overlays. **F** keyboard, no keyboard trap, focus visible, focus not obscured
- After a view changes or the focused element goes away, focus lands on a logical place rather than `body`. **J**, applying focus order. The usual cause in a browser is `disabled` on the button that has focus, such as Send or a load-more button while pending; keep it focusable with `aria-disabled`, ignore presses while pending (in the submit handler for a submit button, since `aria-disabled` doesn't block form submission), and style it as disabled. "Show older texts" in `apps/admin/src/components/user-detail/MemberTextsSection.tsx` stays focusable and ignores presses; the shared `Button` dims only on `disabled`, so add the styling with Tailwind `aria-disabled:` variants, as `SettingsIconAction` in `apps/admin/src/components/form-canvas/SettingsActions.tsx` does.
- Headings, lists, tables and field groups use native elements or the platform's roles, and each view sets a descriptive title (the route's `<title>`, the screen's title on native). **F** info and relationships, page titled
- Meaningful images have a text alternative (`alt`, `accessibilityLabel` on native), decorative ones are hidden from screen readers, and prerecorded video with audio has captions. **F** non-text content, captions
- Controls expose their name, role and state (selected, expanded, disabled, checked) to screen readers, icon-only ones included (`aria-label`, `accessibilityLabel` on native). A control's accessible name contains its visible label's text, so a voice user can say the word they see. **F** name, role, value, label in name
- Text contrast is at least 4.5:1, or 3:1 for large text (18 pt or about 24 CSS px, or 14 pt or about 18.5 CSS px bold); placeholder text meets the same ratio. Visual information needed to identify a control, its state or its focus, or to understand a graphic, reaches 3:1. Text and visual information in inactive controls are exempt. **F** contrast, non-text contrast
- Colour is never the only way to convey information, indicate an action or tell elements apart: status, selection, role, category and unread state also differ by a word, icon shape, weight or a lightness difference of at least 3:1. Two identical icons in different colours, or a selected option that changes only its border or fill colour, fail with under 3:1 lightness difference. **F** use of colour
- Danger, warning and success colours mean only that; categories, unread state and emphasis use other colours. **V** Apple colour for one colour keeping one meaning; reserving these colours is **J**, extending the status roles in Atlassian colour and Carbon status
- On the web, a link inside a sentence stands out at rest by a non-colour cue or a 3:1 lightness difference from the text around it. **F** use of colour, failure F73. The Alliance uses an underline. **J**
- Chart series differ by label, dash or pattern, or reach 3:1 between neighbours; rainbow and red-green ramps stay out. **F** use of colour, non-text contrast, technique G111, **R** Crameri 2020. Values are also available as text. **J**
- A focusable web element styled with Tailwind that has its own visible focus indicator hides the default outline with `outline-hidden`, which preserves it in forced colours mode, where `outline-none` removes it. **V** Tailwind
- Web text stays usable at 200% zoom, and content reflows at 320 CSS px wide without horizontal scrolling, except content such as a data table that needs two dimensions. **F** resize, reflow
- Web hit areas are at least 24×24 CSS px, measured on the hit area rather than the icon, unless WCAG's spacing, equivalent-control, inline, user-agent or essential exception applies; touch targets default to 44×44 pt on iOS and 48×48 dp on Android. **F** target size, **V** Apple, Android
- Anything done by dragging, a path-based gesture such as swiping, or a multi-finger gesture also works with a single pointer, without dragging or a path, such as a tap or click, unless the gesture is essential, as in drawing a signature, or the user agent supplies it; a keyboard route alone doesn't satisfy this. **F** dragging, pointer gestures. A drop zone's route is a file picker. **J**
- A modal takes focus, keeps Tab inside, closes on Escape and returns focus where it was. **C** dialog pattern. A native `Modal` sets `onRequestClose`, so Android Back closes it. **V** React Native
- With Reduce Motion on, nonessential animation stops and state changes stay clear. **V** Apple accessibility

## Forms and errors

- Every input has a label or instructions. **F** labels. A placeholder never stands in for a label or holds needed information. **C** GOV.UK text input. Format and constraints show before submission. **J**
- Fields for the user's own name, email, phone and address set autofill purpose (`autoComplete`); name, email and code fields turn off spellcheck. **F** input purpose, **C** GOV.UK text input. URL fields turn it off too, and on native, email, code and URL fields also turn off autocorrect and auto-capitalisation. **J**
- A digit identifier such as a code is a text field with a numeric keyboard, not `type="number"`. **C** HTML note, GOV.UK text input. A phone number uses `type="tel"`, or `keyboardType="phone-pad"` on native. **J**
- A field isn't marked invalid before the user has finished it, and an error clears once corrected; checking on leaving or on submit both work. **R** Wroblewski, Baymard, **C** NN/g, GOV.UK validation
- A switch takes effect at once; a choice committed by Save or Submit is a checkbox. **V** Material, **C** NN/g, Carbon, Atlassian
- A submit button stays enabled and reports what is wrong when pressed. **C** GOV.UK button, Atlassian button. A control that must be disabled says why in visible text. **J**
- Editing that could be lost either autosaves with a visible saved state or warns on leaving with Save and Discard. **V** Apple for autosave, **C** Shopify for saving. The warning and its Save and Discard pair are **J**; USWDS modal shows a warning with different actions
- A failed submission keeps every answer, marks each bad field with how to fix it, and a multi-field form leads with an error summary linking to the fields. **F** error identification, error suggestion, **C** error summary, validation
- An error names the problem and the way out in plain words; codes and raw output sit behind it as detail. **R** heuristics
- Information already entered in the same flow is prefilled or offered for selection rather than typed again, except where re-entry is essential, required for security, or the earlier answer is no longer valid. **F** redundant entry
- No sign-in step needs memory or transcription without an alternative: passwords and one-time codes accept paste and autofill, and a puzzle has a non-puzzle alternative or is object recognition. **F** accessible authentication
- Every required field has a reason the task needs it; conditional fields appear only when relevant. **J**, extending form fields beyond checkout
- A multi-step flow shows where the user is and what is left, and going back keeps the answers. **C** task list, question pages
- Advanced options can hide behind a disclosure; what the current task needs stays visible. **R** progressive disclosure

## Platform and performance

- Standard shortcuts keep their platform meaning (macOS on Mac, GNOME on Linux). **V** Apple keyboards, GNOME keyboard. Every shortcut is discoverable from a menu or visible action. **J**
- Loading content never shifts the control under the pointer. A web change that alters loading or layout, such as new above-the-fold media, data fetched on render or content that arrives late, doesn't make the pages it touches slower to load, respond or settle. Google's Core Web Vitals call a page good when the 75th percentile of real users sees LCP ≤ 2.5 s, INP ≤ 200 ms and CLS ≤ 0.1, which only field data shows. **V** Web Vitals
- Native content keeps default font scaling, its containers grow with it, and it isn't truncated at the largest iOS accessibility size or Android 200%; navigation chrome such as tab titles may cap with `maxFontSizeMultiplier`. **V** Apple typography, Android 14, React Native Text. The keyboard and safe areas never hide the focused field or the submit control. **J**
- A custom native overlay hides what's behind it from screen readers, with `accessibilityViewIsModal` on iOS and `importantForAccessibility="no-hide-descendants"` on the content behind it on Android, and screen titles use the header role. **V** React Native accessibility; the Android half is **J**
- Filters, sort, tab and selected record live in the web URL, so Back, Reload and a copied link return to them. **R** Baymard for Back, in e-commerce; the rest is **J**

## Visual system

- Colour, type size and spacing come from theme tokens where one fits the purpose; a one-off value is fine where none does, and a value needed in a second place becomes a token. **C** Fluent tokens, Atlassian tokens, USWDS tokens for theme tokens; the one-off and second-use rule is **J**
- Long text stays under about 75 characters a line, at 16 px or more with line height at least 1.5, start-aligned (left in left-to-right languages) and never justified. **C** USWDS typography, GOV.UK layout
- Where the product has no convention, use the values mature systems converge on: a 4 px or 8 px spacing scale, 14 px dense text, 1.4 to 1.5 line height, 50 to 150 ms for hover or press and 150 to 400 ms for transitions, with entrances decelerating. These are defaults where nothing else decides, not minimums: a value outside them isn't a defect by itself, though accessibility items still apply. **C** Fluent layout, Carbon spacing, Atlassian spacing, Fluent type, Atlassian type, Atlassian motion, Carbon motion

## Where judgment takes over

No standard settles visual density or motion style; how agent chat apps show tool calls or queue versus steer; or the right onboarding length. Compare with established products there and say it is judgment. Less friction is the wrong goal in front of a consequential commitment, where a deliberate review step belongs.
