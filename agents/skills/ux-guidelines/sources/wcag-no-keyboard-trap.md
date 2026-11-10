# Understanding [SC 2.1.2](https://w3.org/TR/WCAG22#no-keyboard-trap) No Keyboard Trap (Level A)

Source: <https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html>

Retrieved: 2026-11-09

Copyright © 2026 World Wide Web Consortium. W3C® liability, trademark and permissive license rules apply (https://www.w3.org/copyright/software-license/); WAI's permission page puts WAI material under the W3C Document License (https://www.w3.org/Consortium/Legal/copyright-documents). Copied verbatim: the page's main content, converted from HTML to Markdown, with the site's navigation, header and footer left out. Page date: Updated 18 May 2026.

---

## In Brief

Goal

Keyboard users don't get stuck.

What to do

Ensure users always know how to navigate away from components.

Why it's important

People who rely on the keyboard often have no other means to navigate.

## Success Criterion (SC)

If keyboard focus can be moved to a component of the page using a [keyboard interface](https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html#dfn-keyboard-interface), then focus can be moved away from that component using only a keyboard interface, and, if it requires more than unmodified arrow or tab keys or other standard exit methods, the user is advised of the method for moving focus away.

Note

Since any content that does not meet this success criterion can interfere with a user's ability to use the whole page, all content on the web page (whether it is used to meet other success criteria or not) must meet this success criterion. See [Conformance Requirement 5: Non-Interference](https://www.w3.org/TR/WCAG22/#cc5).

## Intent

The intent of this success criterion is to ensure that content does not "trap" keyboard focus within subsections of content on a web page. This is a common problem when multiple formats are combined within a page and rendered using plug-ins or embedded applications, or when custom components and widgets are not implemented with keyboard users in mind.

There may be times when it's appropriate for a web page to restrict focus to a subsection of the content – for example, when the user is inside a modal dialog or popover. This does not fail the requirements of this criterion, as long as the user knows how to "untrap" the focus and leave that component.

Keyboard focus is not considered trapped when the user can navigate away from a component using only a keyboard interface, and if it only requires unmodified arrow or Tab keys or other "standard exit methods". This specification does not define what constitutes a "standard exit method" – this is dependent on the user's hardware, user agent, and operating system, and as such will require some interpretation from authors and auditors. Generally, in most environments with a physical keyboard, pressing the Esc key is a commonly used "standard exit method", but other platform-specific methods may be available.

If untrapping focus requires a different method (rather than unmodified arrow keys, the Tab key, or other "standard exit methods"), content can still pass this criterion provided that the user is advised how they can untrap focus using their keyboard interface.

## Benefits

- People who rely on a keyboard or keyboard interface to use the web including people who are blind and people with physical disabilities.

## Examples

A calendar widget

A calendar widget allows users to add, remove or update items in their calendar using the keyboard. The controls in the widget are part of the tab order within the web page, allowing users to tab through the controls in the widget as well as to any links or controls that follow.

A puzzle applet

Once a user tabs into an applet, further tabs and other keystrokes are handled by the applet. Instructions describing the keystroke used to exit the applet are provided prior to the applet as well as within the applet itself.

A modal dialog box

A web application opens a dialog box. At the bottom of the dialog are two buttons, "Cancel" and "OK". When the dialog is open, focus is trapped within the dialog – tabbing from the last control in the dialog takes focus to the first control in the dialog (though, depending on implementation, the focus cycle might still include user agent controls). The dialog is dismissed by activating the "Cancel" button, the "OK" button, or the Esc key.

A WYSIWYG rich text editor

Once the main editing area of a rich text editor receives focus, Tab / Shift+Tab are used to set the indentation of the current line being edited. When the editing area receives focus, an instruction appears, letting users know that they can use Alt+F10 / Option+F10 to move focus back out of the area and to the editor toolbar.

## Techniques

Each item in this section represents a technique or combination of techniques that the Accessibility Guidelines Working Group deems sufficient for meeting this success criterion. A technique may go beyond the minimum requirement of the criterion. There may be other ways of meeting the criterion not covered by these techniques. For information on using other techniques, see [Understanding Techniques for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-techniques), particularly the "Other Techniques" section.

### Sufficient Techniques

- [G21: Ensuring that users are not trapped in content](https://www.w3.org/WAI/WCAG22/Techniques/general/G21)

### Failures

The following are common mistakes that are considered failures of this success criterion by the Accessibility Guidelines Working Group.

- [F10: Failure of Success Criterion 2.1.2 and Conformance Requirement 5 due to combining multiple content formats in a way that traps users inside one format type](https://www.w3.org/WAI/WCAG22/Techniques/failures/F10)

## Key Terms

keyboard interface

interface used by software to obtain keystroke input

Note 1

A keyboard interface allows users to provide keystroke input to programs even if the native technology does not contain a keyboard.

Example

A touchscreen PDA has a keyboard interface built into its operating system as well as a connector for external keyboards. Applications on the PDA can use the interface to obtain keyboard input either from an external keyboard or from other applications that provide simulated keyboard output, such as handwriting interpreters or speech-to-text applications with "keyboard emulation" functionality.

Note 2

Operation of the application (or parts of the application) through a keyboard-operated mouse emulator, such as MouseKeys, does not qualify as operation through a keyboard interface because operation of the program is through its pointing device interface, not through its keyboard interface.

## Test Rules

The following are Test Rules for certain aspects of this Success Criterion. It is not necessary to use these particular Test Rules to check for conformance with WCAG, but they are defined and approved test methods. For information on using Test Rules, see [Understanding Test Rules for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-act-rules.html).

- [Focusable element has no keyboard trap](https://www.w3.org/WAI/standards-guidelines/act/rules/80af7b/proposed/)

[Back to Top](#top)
