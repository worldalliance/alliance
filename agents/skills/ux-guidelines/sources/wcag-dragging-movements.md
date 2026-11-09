# Understanding [SC 2.5.7](https://w3.org/TR/WCAG22#dragging-movements) Dragging Movements (Level AA)

Source: <https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html>

Retrieved: 2026-11-06

Copyright © 2026 World Wide Web Consortium. W3C® liability, trademark and permissive license rules apply (https://www.w3.org/copyright/software-license/); WAI's permission page puts WAI material under the W3C Document License (https://www.w3.org/Consortium/Legal/copyright-documents). Copied verbatim: the page's main content, converted from HTML to Markdown, with the site's navigation, header and footer left out. Page date: Updated 10 August 2026.

---

## In Brief

Goal

Don’t rely on dragging for user actions.

What to do

For any action that involves dragging, provide a simple pointer alternative.

Why it's important

Some people cannot use a mouse to drag items.

## Success Criterion (SC)

All [functionality](#dfn-functionality) that uses a [dragging movement](#dfn-dragging-movement) for operation can be achieved by a [single pointer](#dfn-single-pointer) without dragging, unless dragging is [essential](#dfn-essential) or the functionality is determined by the [user agent](#dfn-user-agent) and not modified by the author.

Note

This requirement applies to web content that interprets pointer actions (i.e., this does not apply to actions that are required to operate the user agent or assistive technology).

## Intent

The intent of this success criterion is to ensure functionality that uses a dragging movement has another [single pointer](#dfn-single-pointer) mode of operation without the need for the dexterity required to drag elements.

Some people cannot perform dragging movements in a precise manner. Others use a specialized or adapted input device, such as a trackball, head pointer, eye-gaze system, or speech-controlled mouse emulator, which may make dragging cumbersome and error-prone.

When an interface implements functionality that uses dragging movements, users perform four discrete actions:

1.  tap or click to establish a start-point, then
2.  press and hold that contact while...
3.  performing a repositioning of the pointer, before...
4.  releasing the pointer at the end-point.

Not all users can accurately press and hold that contact while also repositioning the pointer. An alternative method must be provided so that users with mobility impairments who use a pointer (mouse, pen, or touch contact) can use the functionality.

![A range input slider with a hand-shaped mouse pointer on the slider thumb](https://www.w3.org/WAI/WCAG22/Understanding/img/dragging-movement-input-slider.png)

Figure 1. Example of a typical horizontal range slider being dragged.

For example, while a range slider is operated by dragging the slider thumb, an alternative pointer method to change the value is to click/tap anywhere on the slider track to move the thumb to that position.

![A draggable content carousel, showing one slide being dragged with the mouse to reveal the next slide](https://www.w3.org/WAI/WCAG22/Understanding/img/dragging-movement-content-carousel.png)

Figure 2. Example of a typical draggable content carousel.

This requirement is separate from keyboard accessibility because people using a touchscreen device may not use a physical keyboard. Keyboard specific interactions such as tabbing or arrow keys may not be possible when encountering a drag and drop control. Note, however, that providing a text input can be an acceptable single-pointer alternative to dragging. For example, an input beside a slider could allow any user to enter a precise value for the slider. In such a situation, the on-screen keyboard that appears for touch users offers a single-pointer means of entering an alphanumeric value.

Note that the [single pointer](#dfn-single-pointer) alternative can't exclusively rely on a path-based gesture, such as swiping or "flicking", as this would fail the requirements of [2.5.1 Pointer Gestures](https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures).

This criterion _does not_ apply to scrolling and dragging gestures enabled by the user agent, as it's the user agent's responsibility to provide an accessibility-supported mechanism for these. In browsers operated with a mouse, users generally scroll content by dragging the browser's scrollbar. In touchscreen browsers, users generally scroll by "dragging" the page on the screen. Similarly, most touchscreen browsers provide a "drag to refresh" gesture to refresh/reload a page. In all these cases, the functionality is provided by the browser, rather than implemented by the content – so this criterion _does not_ apply. This criterion also _does not_ apply to the use of techniques such as CSS `overflow` that make a section of content scrollable, as the actual scrolling mechanism even in these situations is provided by the user agent. The criterion _does_ apply if content actively suppresses the user agent's own scrolling functionality and/or implements its own scrolling mechanism – in these cases, the scrolling/dragging gesture is interpreted and processed by the content itself, and thus falls under the responsibility of the content author.

### Relationship to keyboard accessibility requirements

Success Criteria [2.1.1 Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard) and [2.1.3 Keyboard (No Exception)](https://www.w3.org/WAI/WCAG22/Understanding/keyboard-no-exception) require dragging features to be keyboard accessible. However, achieving keyboard equivalence for a dragging operation does not automatically meet this success criterion, unless that equivalent keyboard operation also provides controls that can be clicked or tapped with a pointer. It is possible to create an interface that works with dragging and keyboard controls, but still does not work using only clicks or taps. While many designs can be created for a dragging alternative which address both keyboard accessibility and operability by single pointer operation, the two requirements are evaluated independently.

### Distinguishing dragging movements from path-based pointer gestures

This success criterion applies to dragging movements in general, which involve the user "grabbing" an element and moving it to another position. Once the pointer engages with a target to pick up/grab it, the direction of the dragging movement does not factor into the interaction at all. [Success Criterion 2.5.1 Pointer Gestures](https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures) is concerned with gestures that are path-based, as well as multi-point gestures. For pointer gestures, the direction of the pointer movement matters. However, if an action involves _both_ a dragging movement (such as grabbing a slider thumb, moving it, and then releasing it) _and_ a path-based gesture (if the slider requires the user to exactly follow its track, or otherwise the user's grip on the slider thumb is "lost"), it may fail against the requirements of _both_ success criteria.

### Alternatives for dragging movements on the same page

Where functionality can be executed via dragging movements and an equivalent option exists that allows for single-pointer access without dragging, this success criterion is satisfied. It does not have to be the same component, so long as the functionality is equivalent. An example is a color wheel where a color can be changed by dragging an indicator. In addition, text fields for the numerical input of color values allow the definition of a color without requiring dragging movements. (Note that a text input is considered device agnostic; although the purpose is to enter characters, text entry can take place through voice, pointer or keyboard.)

## Benefits

- Users who struggle with performing dragging movements can still operate an interface with a pointer interface.

## Examples

- A map allows users to drag the view of the map around, and the map has up/down/left/right buttons to move the view as well.
- A sortable list of elements may, after tapping or clicking on a list element, provide adjacent controls for moving the element up or down in the list by simply tapping or clicking on those controls.
- A task board that allows users to drag and drop items between columns also provides an additional pop-up menu after tapping or clicking on items for moving the selected element to another column by tapping or clicking on pop-up menu entries.
- A radial control widget (color wheel) where the value can be set by dragging the marker for the currently selected color to another position, also allows picking another color value by tapping or clicking on another place in the color wheel.
- A range slider control widget, where the value can be set by dragging the visual indicator (thumb) showing the current value, allows tapping or clicking on any point of the slider track to change the value and set the thumb to that position.
- A widget where you can drag a gift to one person in a photo of a group of people also has a menu alternative where users can select the person that should receive the gift from the menu.
- A graphical interface allows the user to draw a selection rectangle on an image by first setting one corner of the rectangle on the pointer down-event, dragging the opposite corner with the pointer, and then setting that second corner position on the pointer up-event. As a non-drag alternative, the user can enable a selection mode, click/tap the first corner, then click/tap the opposite corner, without the need to keep the pointer pressed and dragging.
- In an online quiz, users are expected to draw a connecting line between each item in one column and its respective counterpart item in a second column. Users who can't (or don't want to) draw those lines manually can also just click/tap on one item in the first column, then click/tap on an item in the second column, and the connecting line is drawn automatically.
- A kanban widget with several vertical columns representing states in a defined process allows the user drag elements to move them to another column. The user can also accomplish this by selecting the element with a single tap or click, and then activating an arrow button to move the selected element.
- A news site has a horizontal carousel with different news teasers that can be dragged to move items into view. It also offers forward and backward buttons on the left and right of the carousel, to move the carousel to the previous and next item with a simple click/tap. These buttons can be visible (for instance, as large arrow icons) or visually hidden (but still operable with a pointer).

## Techniques

Each item in this section represents a technique or combination of techniques that the Accessibility Guidelines Working Group deems sufficient for meeting this success criterion. A technique may go beyond the minimum requirement of the criterion. There may be other ways of meeting the criterion not covered by these techniques. For information on using other techniques, see [Understanding Techniques for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-techniques), particularly the "Other Techniques" section.

### Sufficient Techniques

- [G219: Ensuring that an alternative is available for dragging movements that operate on content](https://www.w3.org/WAI/WCAG22/Techniques/general/G219)

### Failures

The following are common mistakes that are considered failures of this success criterion by the Accessibility Guidelines Working Group.

- [F108: Failure of Success Criterion 2.5.7 Dragging Movements due to not providing a single pointer method that does not require a dragging movement](https://www.w3.org/WAI/WCAG22/Techniques/failures/F108)

## Key Terms

assistive technology

hardware and/or software that acts as a [user agent](#dfn-user-agent), or along with a mainstream user agent, to provide functionality to meet the requirements of users with disabilities that go beyond those offered by mainstream user agents

Note 1

Functionality provided by assistive technology includes alternative presentations (e.g., as synthesized speech or magnified content), alternative input methods (e.g., voice), additional navigation or orientation mechanisms, and content transformations (e.g., to make tables more accessible).

Note 2

Assistive technologies often communicate data and messages with mainstream user agents by using and monitoring APIs.

Note 3

The distinction between mainstream user agents and assistive technologies is not absolute. Many mainstream user agents provide some features to assist individuals with disabilities. The basic difference is that mainstream user agents target broad and diverse audiences that usually include people with and without disabilities. Assistive technologies target narrowly defined populations of users with specific disabilities. The assistance provided by an assistive technology is more specific and appropriate to the needs of its target users. The mainstream user agent may provide important functionality to assistive technologies like retrieving web content from program objects or parsing markup into identifiable bundles.

Example

Assistive technologies that are important in the context of this document include the following:

- screen magnifiers, and other visual reading assistants, which are used by people with visual, perceptual and physical print disabilities to change text font, size, spacing, color, synchronization with speech, etc. in order to improve the visual readability of rendered text and images;
- screen readers, which are used by people who are blind to read textual information through synthesized speech or braille;
- text-to-speech software, which is used by some people with cognitive, language, and learning disabilities to convert text into synthetic speech;
- speech recognition software, which may be used by people who have some physical disabilities;
- alternative keyboards, which are used by people with certain physical disabilities to simulate the keyboard (including alternate keyboards that use head pointers, single switches, sip/puff and other special input devices.);
- alternative pointing devices, which are used by people with certain physical disabilities to simulate mouse pointing and button activations.

down-event

platform event that occurs when the trigger stimulus of a pointer is depressed

The down-event may have different names on different platforms, such as "touchstart" or "mousedown".

dragging movement

an operation where the pointer engages with an element on the [down-event](#dfn-down-event) and the element (or a representation of its position) follows the pointer until an [up-event](#dfn-up-event)

Note

Examples of draggable elements include list items, text elements, and images.

essential

if removed, would fundamentally change the information or functionality of the content, **and** information and functionality cannot be achieved in another way that would conform

functionality

[processes](#dfn-process) and outcomes achievable through user action

process

series of user actions where each action is required in order to complete an activity

Example 1

Successful use of a series of web pages on a shopping site requires users to view alternative products, prices and offers, select products, submit an order, provide shipping information and provide payment information.

Example 2

An account registration page requires successful completion of a [Turing test](https://www.w3.org/TR/turingtest/) before the registration form can be accessed.

**Errata:**

- Changing the example provided to avoid potential confusion

[View all errata](https://www.w3.org/WAI/WCAG22/errata/)

single pointer

an input modality that only targets a single point on the page/screen at a time – such as a mouse, single finger on a touch screen, or stylus.

Note

Single pointer interactions include clicks, double clicks, taps, dragging motions, and single-finger swipe gestures. In contrast, multipoint interactions involve the use of two or more pointers at the same time, such as two-finger interactions on a touchscreen, or the simultaneous use of a mouse and stylus.

**Errata:**

- Changing "touch screen" to "touchscreen" for consistency

[View all errata](https://www.w3.org/WAI/WCAG22/errata/)

up-event

platform event that occurs when the trigger stimulus of a pointer is released

The up-event may have different names on different platforms, such as "touchend" or "mouseup".

user agent

any software that retrieves and presents web content for users

Example

Web browsers, media players, plug-ins, and other programs — including [assistive technologies](#dfn-assistive-technology) — that help in retrieving, rendering, and interacting with web content.

[Back to Top](#top)
