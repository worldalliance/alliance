# Understanding [SC 2.4.7](https://w3.org/TR/WCAG22#focus-visible) Focus Visible (Level AA)

Source: <https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html>

Retrieved: 2026-11-06

Copyright © 2026 World Wide Web Consortium. W3C® liability, trademark and permissive license rules apply (https://www.w3.org/copyright/software-license/); WAI's permission page puts WAI material under the W3C Document License (https://www.w3.org/Consortium/Legal/copyright-documents). Copied verbatim: the page's main content, converted from HTML to Markdown, with the site's navigation, header and footer left out. Page date: Updated 04 October 2026.

---

## In Brief

Goal

Users know which element has keyboard focus.

What to do

Ensure each item receiving focus has a visible indicator.

Why it's important

Without a focus indicator, sighted keyboard users cannot operate the page.

## Success Criterion (SC)

Any keyboard operable user interface has a mode of operation where the keyboard [focus indicator](#dfn-focus-indicator) is visible.

## Intent

The purpose of this success criterion is to help a person know which element has the keyboard focus.

“Mode of operation” accounts for user agents which may not always show a focus indicator, or only show the focus indicator when the keyboard is used. User agents may optimize when the focus indicator is shown, such as only showing it when a keyboard is used. Authors are responsible for providing at least one mode of operation where the focus is visible. In most cases there is only one mode of operation so this success criterion applies. The focus indicator must not be time limited: when the keyboard focus is shown, it must remain visible.

Note

There may be situations where mouse/pointer users could also benefit from having a visible focus indicator, even though they did not set focus to an element using the keyboard. While not normatively required, authors may consider still providing an explicit focus indicator for these cases.

Focus indicators are visual information required to identify the focused state of a user interface component. As generally focus indication is provided using non-text content (for instance, using borders/outlines), that means that they are also subject to Success Criterion [1.4.11 Non-text Contrast (Level AA)](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast). See the [Relationship with Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html#related-focus) section of [](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)Understanding 1.4.11 Non-text Contrast for details and examples.

New in WCAG 2.2: Keyboard focus indicators can take different forms. While this criterion does not specify what that form is, [2.4.13 Focus Appearance (Level AAA)](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance) provides guidance on creating a consistent, visible indicator, dealing with issues such as its size and shape.

## Benefits

- This success criterion helps anyone who relies on the keyboard to operate the page, by letting them visually determine the component on which keyboard operations will interact at any point in time.
- People with attention limitations, short term memory limitations, or limitations in executive processes benefit by being able to discover where the focus is located.

## Examples

- When text fields receive focus, a vertical bar is displayed in the field, indicating that the user can insert text, OR all of the text is highlighted, indicating that the user can type over the text.
- When a user interface control receives focus, a visible border is displayed around it.

## Related Resources

Resources are for information purposes only, no endorsement implied.

- [MDN: `:focus` CSS pseudo-class](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:focus)
- [MDN: `:focus-visible` CSS pseudo-class](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:focus-visible)

## Techniques

Each item in this section represents a technique or combination of techniques that the Accessibility Guidelines Working Group deems sufficient for meeting this success criterion. A technique may go beyond the minimum requirement of the criterion. There may be other ways of meeting the criterion not covered by these techniques. For information on using other techniques, see [Understanding Techniques for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-techniques), particularly the "Other Techniques" section.

### Sufficient Techniques

- [G149: Using user interface components that are highlighted by the user agent when they receive focus](https://www.w3.org/WAI/WCAG22/Techniques/general/G149)
- [C15: Using CSS to change the presentation of a user interface component when it receives focus](https://www.w3.org/WAI/WCAG22/Techniques/css/C15)
- [G165: Using the default focus indicator for the platform so that high visibility default focus indicators will carry over](https://www.w3.org/WAI/WCAG22/Techniques/general/G165)
- [G195: Using an author-supplied, visible focus indicator](https://www.w3.org/WAI/WCAG22/Techniques/general/G195)
- [C40: Creating a two-color focus indicator to ensure sufficient contrast with all components](https://www.w3.org/WAI/WCAG22/Techniques/css/C40)
- [C45: Using CSS :focus-visible to provide keyboard focus indication](https://www.w3.org/WAI/WCAG22/Techniques/css/C45)
- [SCR31: Using script to change the background color or border of the element with focus](https://www.w3.org/WAI/WCAG22/Techniques/client-side-script/SCR31)

### Failures

The following are common mistakes that are considered failures of this success criterion by the Accessibility Guidelines Working Group.

- [F55: Failure of Success Criteria 2.1.1, 2.4.7, 2.4.13, and 3.2.1 due to using script to remove focus when focus is received](https://www.w3.org/WAI/WCAG22/Techniques/failures/F55)
- [F78: Failure of Success Criterion 1.4.11, 2.4.7 and 2.4.13 due to styling element outlines and borders in a way that removes or renders non-visible the visual focus indicator](https://www.w3.org/WAI/WCAG22/Techniques/failures/F78)

## Key Terms

focus indicator

pixels that are changed to visually indicate when a [user interface component](#dfn-user-interface-component) is in a focused [state](#dfn-state)

state

dynamic property expressing characteristics of a [user interface component](#dfn-user-interface-component) that may change in response to user action or automated processes

States do not affect the nature of the component, but represent data associated with the component or user interaction possibilities. Examples include focus, hover, select, press, check, visited/unvisited, and expand/collapse.

user interface component

a part of the content that is perceived by users as a single control for a distinct function

Note 1

Multiple user interface components may be implemented as a single programmatic element. "Components" here is not tied to programming techniques, but rather to what the user perceives as separate controls.

Note 2

User interface components include form elements and links as well as components generated by scripts.

Note 3

What is meant by "component" or "user interface component" here is also sometimes called "user interface element".

Example

An applet has a "control" that can be used to move through content by line or page or random access. Since each of these would need to have a name and be settable independently, they would each be a "user interface component."

## Test Rules

The following are Test Rules for certain aspects of this Success Criterion. It is not necessary to use these particular Test Rules to check for conformance with WCAG, but they are defined and approved test methods. For information on using Test Rules, see [Understanding Test Rules for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-act-rules.html).

- [Element in sequential focus order has visible focus](https://www.w3.org/WAI/standards-guidelines/act/rules/oj04fd/)

[Back to Top](#top)
