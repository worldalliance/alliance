---
name: ux-guidelines
description: Read before designing or changing UI in apps/, sharedweb/, shared/ or agents/desktop, or judging a UI's quality.
---

# UI and UX guidelines

No standard covers good UX as a whole; the **F** items below are the WCAG criteria most relevant to UI work here, not all of it. An explicit product requirement that conflicts with any item takes precedence, per the root `AGENTS.md` **Established practice** rule, and the change states the departure. Each item carries its status:

- **F**: formal standard, normative in its scope (WCAG 2.2, also ISO/IEC 40500:2025).
- **V**: platform vendor recommendation, authoritative on that platform and **C** on any other (Apple HIG, Material 3, GNOME HIG, Google's Web Vitals).
- **R**: research-backed practice (Nielsen Norman Group, Baymard).
- **C**: common practice in mature design systems (GOV.UK, USWDS, WAI-ARIA patterns).

Each item's links open local copies in `sources/`, each headed with its URL, licence and retrieval date; a page whose licence forbids copying holds only the passages the items rest on.

What a change adds or alters meets WCAG 2.2 AA and satisfies every item that applies; a failure it notices elsewhere on the surface follows the root `AGENTS.md` **Scope and improvement** rule. Judging a UI applies every item to the whole surface. A screenshot can show a visual defect; keyboard, screen-reader and timing items need the running app.

## Controls and labels

- Icons stand alone only for the actions the Alliance counts as universally recognised: close, search, send, delete, settings. Every other action carries a visible word, since a tooltip or accessible name doesn't tell a sighted newcomer what an unfamiliar icon does, and most Alliance users are non-technical. **R** [icon usability](sources/nngroup-icon-usability.md): most icons are ambiguous without a label, and only a few, such as home, print and search, are broadly recognised; the Alliance's list is its own. This rule supersedes the "Icons over text labels" constraint in `docs/provenance/01a0b185-0403-7000-841f-9499984a8236-responses-table-view/REQUIREMENTS.md`, so that constraint takes no precedence over it. Icons come from `lucide-react` (`lucide-react-native` on mobile), a repo convention.
- Direct interaction over modes: an inline edit over an "Edit" toggle, an Alliance preference no source weighs. Where a mode remains, the active mode is clearly shown, and none is used where a slip in the wrong mode loses work or data. **R** [modes](sources/nngroup-modes.md)
- On pointer platforms an icon-only control shows a tooltip. **V** [GNOME tooltips](sources/gnome-tooltips.md). Content that hover or focus shows, a custom tooltip included, stays while the pointer moves onto it and until the pointer or focus leaves, the user dismisses it or it is no longer valid, and a key such as Escape dismisses it without moving either, unless it reports an input error or covers nothing. A browser `title` tooltip, which the user agent draws, is exempt. **F** [content on hover or focus](sources/wcag-content-on-hover-or-focus.md)
- A destructive or irreversible action says in words, on the control or in its confirmation or undo message, what it does and what it affects, and offers confirmation or undo. WCAG requires reversal, a check with a chance to correct, or confirmation only for legal, financial, stored-data and test-response submissions; elsewhere this is practice. **V** [GNOME dialogs](sources/gnome-dialogs.md), **F** [error prevention](sources/wcag-error-prevention-legal-financial-data.md)
- An action keeps the same name and behaviour on every screen, and the current location is visible. **F** [consistent identification](sources/wcag-consistent-identification.md), **R** [heuristics](sources/nngroup-ten-usability-heuristics.md)

## Accessibility and input

- Every action works from the keyboard, nothing traps focus, and focus is visible and never fully hidden behind sticky headers, composers or overlays. **F** [keyboard](sources/wcag-keyboard.md), [focus visible](sources/wcag-focus-visible.md), [focus not obscured](sources/wcag-focus-not-obscured-minimum.md)
- Meaningful images have a text alternative (`alt`, `accessibilityLabel` on native), decorative ones are hidden from screen readers, and prerecorded video with audio has captions. **F** [non-text content](sources/wcag-non-text-content.md), [captions](sources/wcag-captions-prerecorded.md)
- Controls expose their name, role and state (selected, expanded, disabled, checked) to screen readers, icon-only ones included (`aria-label`, `accessibilityLabel` on native). A control's accessible name contains its visible label's text, so a voice user can say the word they see. **F** [name, role, value](sources/wcag-name-role-value.md), [label in name](sources/wcag-label-in-name.md)
- Text contrast is at least 4.5:1, or 3:1 for large text (18 pt or about 24 CSS px, or 14 pt or about 18.5 CSS px bold); visual information needed to identify a control or its state reaches 3:1; colour is never the only signal. **F** [contrast](sources/wcag-contrast-minimum.md), [non-text contrast](sources/wcag-non-text-contrast.md), [use of colour](sources/wcag-use-of-color.md)
- Web text stays usable at 200% zoom, and content reflows at 320 CSS px wide without horizontal scrolling, except content such as a data table that needs two dimensions. **F** [resize](sources/wcag-resize-text.md), [reflow](sources/wcag-reflow.md)
- Web hit areas are at least 24×24 CSS px, measured on the hit area rather than the icon, unless WCAG's spacing, equivalent-control, inline, user-agent or essential exception applies; touch targets default to 44×44 pt on iOS and 48×48 dp on Android. **F** [target size](sources/wcag-target-size-minimum.md), **V** [Apple](sources/apple-accessibility.md), [Android](sources/android-touch-target-size.md)
- Anything done by dragging also works without it: drop zones have a file picker. **F** [dragging](sources/wcag-dragging-movements.md)
- A modal takes focus, keeps Tab inside, closes on Escape and returns focus where it was. **C** [dialog pattern](sources/apg-dialog-modal.md)
- With Reduce Motion on, nonessential animation stops and state changes stay clear. **V** [Apple accessibility](sources/apple-accessibility.md)

## Status and feedback

- After an action starts, working, done and failed look different; a failure never looks like an empty success. **R** [heuristics](sources/nngroup-ten-usability-heuristics.md)
- Feedback to a click lands within about 100 ms; a wait over about 1 s shows that work is under way, and long work names what it is doing and lets the user turn elsewhere. Progress is a percentage only when it is measurable. **R** [response times](sources/nngroup-response-times-3-important-limits.md), **V** [progress](sources/gnome-progress-bars.md)
- Status messages (saved, uploaded, failed) reach screen readers without moving focus. **F** [status messages](sources/wcag-status-messages.md)
- An empty state says why it is empty and offers the next action; "nothing yet", "failed to load" and "no results" read differently. **V** [placeholders](sources/gnome-placeholders.md)
- A notification fires once per event, keeps confidential content out of its preview, opens the thing it is about, and its outcome is also findable in the app. **V** [Apple notifications](sources/apple-notifications.md)

## Forms and errors

- Every input has a label or instructions, and its format and constraints show before submission. **F** [labels](sources/wcag-labels-or-instructions.md)
- A failed submission keeps every answer, marks each bad field with how to fix it, and a multi-field form leads with an error summary linking to the fields. **F** [error identification](sources/wcag-error-identification.md), [error suggestion](sources/wcag-error-suggestion.md), **C** [error summary](sources/govuk-error-summary.md), [validation](sources/govuk-validation.md)
- An error names the problem and the way out in plain words; codes and raw output sit behind it as detail. **R** [heuristics](sources/nngroup-ten-usability-heuristics.md)
- Information already entered in the same flow is prefilled or offered for selection rather than typed again, except where re-entry is essential, required for security, or the earlier answer is no longer valid. **F** [redundant entry](sources/wcag-redundant-entry.md)
- Sign-in allows paste and password managers. **F** [accessible authentication](sources/wcag-accessible-authentication-minimum.md)
- Every required field has a reason the task needs it; conditional fields appear only when relevant. **R** [form fields](sources/baymard-checkout-form-fields.md)
- A multi-step flow shows where the user is and what is left, and going back keeps the answers. **C** [task list](sources/govuk-task-list.md), [question pages](sources/govuk-question-pages.md)
- Advanced options can hide behind a disclosure; what the current task needs stays visible. **R** [progressive disclosure](sources/nngroup-progressive-disclosure.md)

## Platform and performance

- Standard shortcuts keep their platform meaning (macOS on Mac, GNOME on Linux), and every shortcut is discoverable from a menu or visible action. **V** [Apple keyboards](sources/apple-keyboards.md), [GNOME keyboard](sources/gnome-keyboard.md)
- Loading content never shifts the control under the pointer. A web change that alters loading or layout, such as new above-the-fold media, data fetched on render or content that arrives late, doesn't make the pages it touches slower to load, respond or settle. Google's Core Web Vitals call a page good when the 75th percentile of real users sees LCP ≤ 2.5 s, INP ≤ 200 ms and CLS ≤ 0.1, which only field data shows. **V** [Web Vitals](sources/web-vitals.md)
- On mobile, large text, the keyboard and safe areas never hide the focused field or the submit control. **V** [Apple accessibility](sources/apple-accessibility.md), [Android accessibility](sources/android-accessibility-apps.md)

## Where judgment takes over

No standard settles visual density, spacing, typography or motion style; how agent chat apps show tool calls, auto-scroll, or queue versus steer; or the right onboarding length. Compare with established products there and say it is judgment. Less friction is the wrong goal in front of a consequential commitment, where a deliberate review step belongs.
