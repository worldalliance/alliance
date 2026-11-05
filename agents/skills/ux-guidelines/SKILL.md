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

What a change adds or alters meets WCAG 2.2 AA and satisfies every item that applies; a failure it notices elsewhere on the surface follows the root `AGENTS.md` **Scope and improvement** rule. Judging a UI applies every item to the whole surface. A screenshot can show a visual defect; keyboard, screen-reader and timing items need the running app.

## Controls and labels

- Icons stand alone only for the actions the Alliance counts as universally recognised: close, search, send, delete, settings. Every other action carries a visible word, since a tooltip or accessible name doesn't tell a sighted newcomer what an unfamiliar icon does, and most Alliance users are non-technical. **R** [icon usability](https://www.nngroup.com/articles/icon-usability/): most icons are ambiguous without a label, and only a few, such as home, print and search, are broadly recognised; the Alliance's list is its own. This rule supersedes the "Icons over text labels" constraint in `docs/provenance/01a0b185-0403-7000-841f-9499984a8236-responses-table-view/REQUIREMENTS.md`, so that constraint takes no precedence over it. Icons come from `lucide-react` (`lucide-react-native` on mobile), a repo convention.
- Direct interaction over modes: an inline edit over an "Edit" toggle, an Alliance preference no source weighs. Where a mode remains, the active mode is clearly shown, and none is used where a slip in the wrong mode loses work or data. **R** [modes](https://www.nngroup.com/articles/modes/)
- On pointer platforms an icon-only control shows a tooltip. **V** [GNOME tooltips](https://developer.gnome.org/hig/patterns/feedback/tooltips.html). Content that hover or focus shows, a custom tooltip included, stays while the pointer moves onto it and until the pointer or focus leaves, the user dismisses it or it is no longer valid, and a key such as Escape dismisses it without moving either, unless it reports an input error or covers nothing. A browser `title` tooltip, which the user agent draws, is exempt. **F** [content on hover or focus](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html)
- A destructive or irreversible action says in words, on the control or in its confirmation or undo message, what it does and what it affects, and offers confirmation or undo. WCAG requires reversal, a check with a chance to correct, or confirmation only for legal, financial, stored-data and test-response submissions; elsewhere this is practice. **V** [GNOME dialogs](https://developer.gnome.org/hig/patterns/feedback/dialogs.html), **F** [error prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html)
- An action keeps the same name and behaviour on every screen, and the current location is visible. **F** [consistent identification](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html), **R** [heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)

## Accessibility and input

- Every action works from the keyboard, nothing traps focus, and focus is visible and never fully hidden behind sticky headers, composers or overlays. **F** [keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html), [focus visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html), [focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
- Meaningful images have a text alternative (`alt`, `accessibilityLabel` on native), decorative ones are hidden from screen readers, and prerecorded video with audio has captions. **F** [non-text content](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html), [captions](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html)
- Controls expose their name, role and state (selected, expanded, disabled, checked) to screen readers, icon-only ones included (`aria-label`, `accessibilityLabel` on native). A control's accessible name contains its visible label's text, so a voice user can say the word they see. **F** [name, role, value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html), [label in name](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html)
- Text contrast is at least 4.5:1, or 3:1 for large text (18 pt or about 24 CSS px, or 14 pt or about 18.5 CSS px bold); visual information needed to identify a control or its state reaches 3:1; colour is never the only signal. **F** [contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [use of colour](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)
- Web text stays usable at 200% zoom, and content reflows at 320 CSS px wide without horizontal scrolling, except content such as a data table that needs two dimensions. **F** [resize](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html), [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
- Web hit areas are at least 24×24 CSS px, measured on the hit area rather than the icon, unless WCAG's spacing, equivalent-control, inline, user-agent or essential exception applies; touch targets default to 44×44 pt on iOS and 48×48 dp on Android. **F** [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), **V** [Apple](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Android](https://support.google.com/accessibility/android/answer/7101858)
- Anything done by dragging also works without it: drop zones have a file picker. **F** [dragging](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)
- A modal takes focus, keeps Tab inside, closes on Escape and returns focus where it was. **C** [dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- With Reduce Motion on, nonessential animation stops and state changes stay clear. **V** [Apple accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)

## Status and feedback

- After an action starts, working, done and failed look different; a failure never looks like an empty success. **R** [heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
- Feedback to a click lands within about 100 ms; a wait over about 1 s shows that work is under way, and long work names what it is doing and lets the user turn elsewhere. Progress is a percentage only when it is measurable. **R** [response times](https://www.nngroup.com/articles/response-times-3-important-limits/), **V** [progress](https://developer.gnome.org/hig/patterns/feedback/progress-bars.html)
- Status messages (saved, uploaded, failed) reach screen readers without moving focus. **F** [status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- An empty state says why it is empty and offers the next action; "nothing yet", "failed to load" and "no results" read differently. **V** [placeholders](https://developer.gnome.org/hig/patterns/feedback/placeholders.html)
- A notification fires once per event, keeps confidential content out of its preview, opens the thing it is about, and its outcome is also findable in the app. **V** [Apple notifications](https://developer.apple.com/design/human-interface-guidelines/notifications)

## Forms and errors

- Every input has a label or instructions, and its format and constraints show before submission. **F** [labels](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html)
- A failed submission keeps every answer, marks each bad field with how to fix it, and a multi-field form leads with an error summary linking to the fields. **F** [error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html), [error suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html), **C** [error summary](https://design-system.service.gov.uk/components/error-summary/), [validation](https://design-system.service.gov.uk/patterns/validation/)
- An error names the problem and the way out in plain words; codes and raw output sit behind it as detail. **R** [heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
- Information already entered in the same flow is prefilled or offered for selection rather than typed again, except where re-entry is essential, required for security, or the earlier answer is no longer valid. **F** [redundant entry](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html)
- Sign-in allows paste and password managers. **F** [accessible authentication](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html)
- Every required field has a reason the task needs it; conditional fields appear only when relevant. **R** [form fields](https://baymard.com/research-articles/checkout-flow-average-form-fields)
- A multi-step flow shows where the user is and what is left, and going back keeps the answers. **C** [task list](https://design-system.service.gov.uk/components/task-list/), [question pages](https://design-system.service.gov.uk/patterns/question-pages/)
- Advanced options can hide behind a disclosure; what the current task needs stays visible. **R** [progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)

## Platform and performance

- Standard shortcuts keep their platform meaning (macOS on Mac, GNOME on Linux), and every shortcut is discoverable from a menu or visible action. **V** [Apple keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards), [GNOME keyboard](https://developer.gnome.org/hig/reference/keyboard.html)
- Loading content never shifts the control under the pointer. A web change that alters loading or layout, such as new above-the-fold media, data fetched on render or content that arrives late, doesn't make the pages it touches slower to load, respond or settle. Google's Core Web Vitals call a page good when the 75th percentile of real users sees LCP ≤ 2.5 s, INP ≤ 200 ms and CLS ≤ 0.1, which only field data shows. **V** [Web Vitals](https://web.dev/articles/vitals)
- On mobile, large text, the keyboard and safe areas never hide the focused field or the submit control. **V** [Apple accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Android accessibility](https://developer.android.com/guide/topics/ui/accessibility/apps)

## Where judgment takes over

No standard settles visual density, spacing, typography or motion style; how agent chat apps show tool calls, auto-scroll, or queue versus steer; or the right onboarding length. Compare with established products there and say it is judgment. Less friction is the wrong goal in front of a consequential commitment, where a deliberate review step belongs.
