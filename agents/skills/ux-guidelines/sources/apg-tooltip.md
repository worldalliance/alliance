# Tooltip Pattern

Source: <https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/>

Retrieved: 2026-11-09

Copyright © 2026 World Wide Web Consortium. W3C® liability, trademark and permissive license rules apply (https://www.w3.org/copyright/software-license/); WAI's permission page puts WAI material under the W3C Document License (https://www.w3.org/Consortium/Legal/copyright-documents). Copied verbatim: the page's main content, converted from HTML to Markdown, with the site's navigation, header and footer left out.

---

Tooltip Pattern

## About This Pattern

**NOTE:** This design pattern is work in progress; it does not yet have task force consensus. Progress and discussions are captured in [issue 128.](https://github.com/w3c/aria-practices/issues/128)

A tooltip is a popup that displays information related to an element when the element receives keyboard focus or the mouse hovers over it. It typically appears after a small delay and disappears when Escape is pressed or on mouse out.

Tooltip widgets do not receive focus. A hover that contains focusable elements can be made using a non-modal dialog.

## Example

Work to develop a tooltip example is tracked by [issue 127.](https://github.com/w3c/aria-practices/issues/127)

## Keyboard Interaction

Escape: Dismisses the Tooltip.

### Note

1. Focus stays on the triggering element while the tooltip is displayed.
2. If the tooltip is invoked when the trigger element receives focus, then it is dismissed when it no longer has focus (onBlur).
3. If the tooltip is invoked when a pointing cursor moves over the trigger element, then it remains open as long as the cursor is over the trigger or the tooltip.

## WAI-ARIA Roles, States, and Properties

- The element that serves as the tooltip container has role [tooltip](https://w3c.github.io/aria/#tooltip).
- The element that triggers the tooltip references the tooltip element with [aria-describedby](https://w3c.github.io/aria/#aria-describedby).
