# Understanding [SC 2.1.1](https://w3.org/TR/WCAG22#keyboard) Keyboard (Level A)

Source: <https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html>

Retrieved: 2026-11-06

Copyright © 2026 World Wide Web Consortium. W3C® liability, trademark and permissive license rules apply (https://www.w3.org/copyright/software-license/); WAI's permission page puts WAI material under the W3C Document License (https://www.w3.org/Consortium/Legal/copyright-documents). Copied verbatim: the page's main content, converted from HTML to Markdown, with the site's navigation, header and footer left out. Page date: Updated 04 October 2026.

---

## In Brief

Goal

Everything can be done with a keyboard except freehand movements.

What to do

Ensure pointer actions have a keyboard equivalent.

Why it's important

Many people rely on the keyboard interface, including blind and some mobility impaired people.

## Success Criterion (SC)

All [functionality](#dfn-functionality) of the content is operable through a [keyboard interface](#dfn-keyboard-interface) without requiring specific timings for individual keystrokes, except where the underlying function requires input that depends on the path of the user's movement and not just the endpoints.

Note 1

This exception relates to the underlying function, not the input technique. For example, if using handwriting to enter text, the input technique (handwriting) requires path-dependent input but the underlying function (text input) does not.

Note 2

This does not forbid and should not discourage providing mouse input or other input methods in addition to keyboard operation.

## Intent

The intent of this success criterion is to ensure that, wherever possible, content can be operated through a keyboard or keyboard interface (so an alternate keyboard can be used). When content can be operated through a keyboard or alternate keyboard, it is operable by people with no vision (who cannot use devices such as mice that require eye-hand coordination) as well as by people who must use alternate keyboards or input devices that act as keyboard emulators. Keyboard emulators include speech input software, sip-and-puff software, on-screen keyboards, scanning software and a variety of assistive technologies and alternate keyboards. Individuals with low vision also may have trouble tracking a pointer and find the use of software much easier (or only possible) if they can control it from the keyboard.

Examples of "specific timings for individual keystrokes" include situations where a user would be required to repeat or execute multiple keystrokes within a short period of time or where a key must be held down for an extended period before the keystroke is registered.

The phrase "except where the underlying function requires input that depends on the path of the user's movement and not just the endpoints" is included to separate those things that cannot reasonably be controlled from a keyboard.

Most actions carried out by a pointing device can also be done from the keyboard (for example, clicking, selecting, moving, sizing). However, there is a small class of input that is done with a pointing device that cannot be done from the keyboard in any known fashion without requiring an inordinate number of keystrokes. Free hand drawing, or watercolor painting require path dependent input. Drawing straight lines, regular geometric shapes, re-sizing windows and dragging objects to a location (when the path to that location is not relevant) do not require path dependent input.

The use of MouseKeys would not satisfy this success criterion because it is not a keyboard equivalent to the application; it is a mouse equivalent (i.e., it looks like a mouse to the application).

It is assumed that the design of user input features takes into account that operating system keyboard accessibility features may be in use. For example, modifier key locking may be turned on. Content continues to function in such an environment, not sending events that would collide with the modifier key lock to produce unexpected results.

Note

Platforms and user agents usually have conventions for how web content or applications are controlled with a keyboard interface. If content does not follow the platform/user agent conventions it may be difficult to use, as users will need to learn different interaction methods. While not normatively required, authors are encouraged to follow the platform/user agent conventions. However, deviating from these conventions does _not_ fail the normative requirement of this success criterion.

For instance, buttons that have focus can generally be activated using both the Enter key and the Space bar. If a custom button control in a web application instead only reacts to Enter (or even a completely custom key or key combination), this still **satisfies** the requirements of this success criterion.

Note

This success criterion does not require that every visible control that can be activated using a mouse or touchscreen must also be focusable and actionable using the keyboard. The normative requirement is only that there must be a way for keyboard interface users to perform the same, or comparable, actions and to operate the content. Generally, the easiest way to achieve this is to provide controls that can be operated with all possible input devices; however, if a web application implements a separate mode of operation for keyboard interface users, it will **not** fail the success criterion. However, authors are advised to consider how users will discover any keyboard equivalents which are available.

## Benefits

- People who are blind (who cannot use devices such as mice that require eye-hand coordination)
- People with low vision (who may have trouble finding or tracking a pointer indicator on screen)
- Some people with hand tremors find using a mouse very difficult and therefore usually use a keyboard

## Examples

Example 1: A drawing Program

A drawing program allows users to create, size, position and rotate objects from the keyboard.

Example 2: A drag and Drop Feature

An application that uses drag and drop also supports "cut" and "paste" or form controls to move objects.

Example 3: Moving between and connecting discrete points

A connect-the-dots program allows the user to move between dots on a screen and use the spacebar to connect the current dot to the previous one.

Example 4: Exception - Painting Program

A watercolor painting program passes as an exception because the brush strokes vary depending on the speed and duration of the movements.

Example 5: Exception - Model helicopter flight training simulator

A model helicopter flight training simulator passes as an exception because the nature of the simulator is to teach real-time behavior of a model helicopter.

Example 6: A PDA with an optional keyboard

A PDA device that is usually operated via a stylus has an optional keyboard that can be attached. The keyboard allows full web browsing in standard fashion. The web content is operable because it was designed to work with keyboard-only access.

Example 7: Simple search form with pointer-operable submit button

A search form includes a text input field followed by a submit button. The submit button itself has been coded so that it does _not_ receive focus, and can only be activated using a pointer input. However, since keyboard users can submit the search by pressing Enter in the text input after typing their search terms, the form passes this success criterion.

## Techniques

Each item in this section represents a technique or combination of techniques that the Accessibility Guidelines Working Group deems sufficient for meeting this success criterion. A technique may go beyond the minimum requirement of the criterion. There may be other ways of meeting the criterion not covered by these techniques. For information on using other techniques, see [Understanding Techniques for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-techniques), particularly the "Other Techniques" section.

### Sufficient Techniques

- [G202: Ensuring keyboard control for all functionality](https://www.w3.org/WAI/WCAG22/Techniques/general/G202)
- Ensuring keyboard control using one of the following techniques:
  - [H91: Using HTML form controls and links](https://www.w3.org/WAI/WCAG22/Techniques/html/H91)
  - [PDF3: Ensuring correct tab and reading order in PDF documents](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF3)
  - [PDF11: Providing links and link text using the Link annotation and the /Link structure element in PDF documents](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF11)
  - [PDF23: Providing interactive form controls in PDF documents](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF23)

- [G90: Providing keyboard-triggered event handlers](https://www.w3.org/WAI/WCAG22/Techniques/general/G90) using one of the following techniques:
  - [SCR20: Using both keyboard and other device-specific functions](https://www.w3.org/WAI/WCAG22/Techniques/client-side-script/SCR20)
  - [SCR35: Making actions keyboard accessible by using the onclick event of anchors and buttons](https://www.w3.org/WAI/WCAG22/Techniques/client-side-script/SCR35)
  - [SCR2: Using redundant keyboard and mouse event handlers](https://www.w3.org/WAI/WCAG22/Techniques/client-side-script/SCR2)

### Advisory Techniques

Although not required for conformance, the following additional techniques should be considered in order to make content more accessible. Not all techniques can be used or would be effective in all situations.

- Using WAI-ARIA role, state, and value attributes if repurposing static elements as interactive user interface components (future link) **AND** [SCR29: Adding keyboard-accessible actions to static HTML elements](https://www.w3.org/WAI/WCAG22/Techniques/client-side-script/SCR29)

### Failures

The following are common mistakes that are considered failures of this success criterion by the Accessibility Guidelines Working Group.

- [F54: Failure of Success Criterion 2.1.1 due to using only pointing-device-specific event handlers (including gesture) for a function](https://www.w3.org/WAI/WCAG22/Techniques/failures/F54)
- [F55: Failure of Success Criteria 2.1.1, 2.4.7, 2.4.13, and 3.2.1 due to using script to remove focus when focus is received](https://www.w3.org/WAI/WCAG22/Techniques/failures/F55)
- [F42: Failure of Success Criteria 1.3.1, 2.1.1, 2.1.3, or 4.1.2 when emulating links](https://www.w3.org/WAI/WCAG22/Techniques/failures/F42)

## Key Terms

functionality

[processes](#dfn-process) and outcomes achievable through user action

keyboard interface

interface used by software to obtain keystroke input

Note 1

A keyboard interface allows users to provide keystroke input to programs even if the native technology does not contain a keyboard.

Example

A touchscreen PDA has a keyboard interface built into its operating system as well as a connector for external keyboards. Applications on the PDA can use the interface to obtain keyboard input either from an external keyboard or from other applications that provide simulated keyboard output, such as handwriting interpreters or speech-to-text applications with "keyboard emulation" functionality.

Note 2

Operation of the application (or parts of the application) through a keyboard-operated mouse emulator, such as MouseKeys, does not qualify as operation through a keyboard interface because operation of the program is through its pointing device interface, not through its keyboard interface.

process

series of user actions where each action is required in order to complete an activity

Example 1

Successful use of a series of web pages on a shopping site requires users to view alternative products, prices and offers, select products, submit an order, provide shipping information and provide payment information.

Example 2

An account registration page requires successful completion of a [Turing test](https://www.w3.org/TR/turingtest/) before the registration form can be accessed.

**Errata:**

- Changing the example provided to avoid potential confusion

[View all errata](https://www.w3.org/WAI/WCAG22/errata/)

## Test Rules

The following are Test Rules for certain aspects of this Success Criterion. It is not necessary to use these particular Test Rules to check for conformance with WCAG, but they are defined and approved test methods. For information on using Test Rules, see [Understanding Test Rules for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-act-rules.html).

- [Iframe with interactive elements is not excluded from tab-order](https://www.w3.org/WAI/standards-guidelines/act/rules/akn7bn/)
- [Scrollable content can be reached with sequential focus navigation](https://www.w3.org/WAI/standards-guidelines/act/rules/0ssw9k/)

[Back to Top](#top)
