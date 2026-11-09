# Understanding [SC 2.4.11](https://w3.org/TR/WCAG22#focus-not-obscured-minimum) Focus Not Obscured (Minimum) (Level AA)

Source: <https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html>

Retrieved: 2026-11-06

Copyright © 2026 World Wide Web Consortium. W3C® liability, trademark and permissive license rules apply (https://www.w3.org/copyright/software-license/); WAI's permission page puts WAI material under the W3C Document License (https://www.w3.org/Consortium/Legal/copyright-documents). Copied verbatim: the page's main content, converted from HTML to Markdown, with the site's navigation, header and footer left out. Page date: Updated 15 June 2026.

---

## In Brief

Goal

Keep the focused item visible.

What to do

Ensure when an item gets keyboard focus, it is at least partially visible.

Why it's important

People who can't use a mouse need to see what has keyboard focus.

## Success Criterion (SC)

When a [user interface component](#dfn-user-interface-component) receives keyboard focus, the component is not entirely hidden due to author-created content.

Note 1

Where content in a configurable interface can be repositioned by the user, then only the initial positions of user-movable content are considered for testing and conformance of this success criterion.

Note 2

Content opened by the _user_ may obscure the component receiving focus. If the user can reveal the focused component without advancing the keyboard focus, the component with focus is not considered visually hidden due to author-created content.

## Intent

The intent of this success criterion is to ensure that the item receiving keyboard focus is always partially visible in the user's viewport. For sighted people who rely on a keyboard (or on a device that operates through the keyboard interface, such as a switch or voice input), knowing the current point of focus is critical. The component with focus signals the interaction point on the page. Where users cannot see the item with focus, they may not know how to proceed, or may even think the system has become unresponsive.

In recognition of the complex responsive designs common today, this AA criterion allows for the component receiving focus to be _partially_ obscured by other author-created content. A partly obscured component can still be very visible, although the more of it that is obscured, the less easy it is to see. For that reason, authors should attempt to design interactions to reduce the degree and frequency with which the item receiving focus is partly obscured. For best visibility, _none_ of the component receiving focus should be obscured. This preferred outcome is covered by the AAA criterion [Focus Not Obscured (Enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-enhanced.html).

Typical types of content that can overlap focused items are sticky footers, sticky headers, and non-modal dialogs. As a user tabs through the page, these layers of content can obscure the item receiving focus, along with its focus indicator.

A notification implemented as sticky content, such as a cookie banner, will fail this success criterion if it entirely obscures a component receiving focus. Ways of passing include making the banner modal so the user has to dismiss the banner before navigating through the page, or using [scroll padding](https://www.w3.org/TR/css-scroll-snap/#propdef-scroll-padding) so the banner does not overlap other content. Notifications that do not require user action could also meet this criterion by closing on loss of focus.

Another form of obscuring can occur when semi-transparent overlays, or overlays that apply a blur or other dimming effect, overlap the focused item. While the focused item may not be entirely obscured by these overlays, thereby passing this criterion, it may separately fail [1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/understanding/non-text-contrast.html). In such cases, the focus indicator must be evaluated against the contrast requirements of 1.4.11 while its appearance is affected by the overlays. The intention is for an item’s focused state to be clearly identifiable at all times.

Note

This criterion evaluates the focused _component_, rather than the focus _indicator_. The component itself does not include the focus indicator when checking that "the component is not entirely hidden" - unless the focus indicator is inside the component, or focus is indicated by a change to the component itself. Although users benefit from both the component and the focus indicator (if external to the component) not being obscured when tracking the focus, for the purposes of this criterion only checking the component provides a clearer metric. However, if the focus indicator is fully obscured, it would likely fail [2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible).

### User-movable content

This SC contains a note regarding content that can be repositioned. If users can move content regions, then they can potentially position the movable content such that it obscures other content that may receive focus. In such a case, the author is only responsible for ensuring that the movable content _in its initial position_ does not obscure the item receiving focus.

This note is intended to accommodate a common interaction in complex applications such as authoring tools, where the main editing region (also called a canvas) can be enhanced by displaying toolbars or other panels, which can be repositioned around the canvas. It is possible to design such toolbars so they do _not_ obscure focus. Authors are encouraged to do so, as well as pursue techniques which ensure equitable keyboard use of such toolbars. However, in recognition of the complexities involved in responsive design as well as in supporting the ability to transform the text size and spacing of content, only the starting position of such movable panels is assessed.

### User-opened content

This SC contains a note regarding content that is opened or disclosed by the user. One example of such content is a menu button opened by a user that opens a list of choices over pre-existing content on the screen. Such content can obscure other information on the screen, but it does not obscure an item receiving keyboard focus, because the new content doesn't stay open through a change of focus. However, authors may create user-opened content that is intentionally designed to persist until closed by the user, such as a chat window. Such persistent content has the potential to fail Focus Not Obscured (Minimum). Various types are described in this section. All can be designed so that they pass this success criterion.

This section only applies to content that the user actively discloses. Content pre-positioned by the author (such as a sticky footer), or content that appears without direct user initiation, such as system warnings, must not prevent the item receiving focus from being immediately visible in the viewport. Also, this note is not intended to apply to disclosures that are by convention non-persistent. As discussed in the following sub-section, an open dropdown that does not close when no longer focused is not following this convention.

#### Non-persistent opened information

A number of components on the web open (or disclose) additional content (on activation or on focus) intended for immediate user interaction or information. This new content is often on top of other content, obscuring it. Examples of such components are menu items, select element items, combobox lists (and other dropdown items), date picker calendars, and tooltips. The common trait of all these components is that they are not expected to persist after being acted on or once they are no longer the primary point of user interaction. Such non-persistent disclosures do not fail this SC since they do not obscure the item with focus. However, if an author allows such components to **persist** after the user has 1) activated one of the opened items or 2) moved the focus away from the triggering item and the additional content, it is at risk of failing this criterion by obscuring the item with focus.

#### User openable, persistent disclosures

Some disclosure patterns provide a mechanism for the user to open additional content that remains open until intentionally closed by the user. Accordions are a simple example of such a pattern. Chatbots and expandable side navigation are more complex examples. All of these patterns can be implemented so they are not at risk of failing this SC. Some possible approaches are:

- **When the additional content appears, it displaces existing content.** An accordion is an example of this. When an accordion is opened, the disclosed content shifts existing content further down the page. Since the new content does not obscure existing content, it cannot obscure the item with focus.
- **When the additional content appears, existing content reflows.** The pop-out sidebar on the [WCAG standard](https://www.w3.org/TR/WCAG22/) is an example of this pattern. When the side menu is activated, it opens a new section of information along the left side of the page. The main content area is reduced horizontally to accommodate the new content, and the existing content reflows to fit in the thinner space. As a result, there is no overlapping content between the two sections; the item receiving focus, whether in the left navigation or in the main content, will not be obscured by the other section.
- **When the additional content is opened, it takes focus and the tab ring is constrained to the new content until it is dismissed.** This modality is somewhat like a dialog, in that a user cannot navigate beyond the opened content by keyboard without dismissing it first (typically by pressing Esc). However, unlike in a modal dialog, in some implementations a pointer user may be able to interact with content outside the opened section without dismissing it. Since this pattern potentially creates an inequitable experience between keyboard and pointer users, it should be used cautiously. That said, it does prevent the opened content from obscuring the keyboard focus in the main content, and thus should pass this SC. This is described and demonstrated in a short video in the Knowbility article in the reference section, under the section heading [Keep keyboard focus in the slide-out navigation until it's closed](https://knowbility.org/blog/2020/accessible-slide-menus#keep-keyboard-focus-in-the-slide-out-navigation-until-its-closed).
- **The disclosure expands into an area of the page containing no other content.** Many pages are designed with wide margins, providing significant white space into which new content can be opened. Many chatbots and toast notifications are designed to 'slide up' into the right unpopulated side of a page. Where authors are careful to ensure content is not obscured at each breakpoint in a responsive design, no obscuring of other operable content need occur.
- **When focus leaves the additional content, the additional content is automatically hidden or collapsed, or the content can be hidden or collapsed by use of a dedicated keyboard command (for example, the Escape key**.) This is very similar to patterns discussed previously under Non-persistent opened information. A distinguishing factor can be that the user's last point of interaction in the disclosure is preserved (it persists) even though it may be hidden until a user returns. Some trees and side navigation patterns behave this way.

In recognition of more complex interfaces and user needs there is a note: Content opened by the user may obscure the component receiving focus. If the user can bring the item with focus into view using a method without having to navigate back to the user-opened content to dismiss it, this criterion would be passed. For example, keyboard actions that may allow the item with focus to be revealed include:

- using the Escape key to dismiss the obscuring content;
- using keys to scroll the content in the viewport to reveal the item with focus;
- issuing a key to move between overlays.

For example:

- A user opens a chat interface, which is a popover non-modal dialog. This results in some content of the underlying page being fully obscured. The user navigates away from the chat interface by use of the tab key, focusing onto a link that has been fully obscured by the dialog. The user presses the Escape key to close the chat interface, which un-obscures the link.
- A user expands a fixed-position page feedback component at the bottom of a web page. They then use their keyboard to navigate to a link that's fully obscured by the expanded component and press the down arrow or space key on their keyboard to scroll the content on the page, un-obscuring the link.
- A user opens a web-based multi-user authoring application. An overlay appears displaying a list of people who have contributed to the document. The user tabs through the list of contributors and activates one of them. The application displays a new overlay, which obscures the first one, that displays that person's recent contributions. The user presses the F6 key to toggle the stacking order of the two overlays.

### Modal dialogs

A properly constructed modal dialog will always pass this SC. Even if it appears directly on top of an item with focus, the dialog takes focus on appearance, and thus the item receiving focus -- the dialog or one of its components -- is visible. A properly constructed modal maintains that focus and prevents interaction outside the modal until it is dismissed.

A dialog-like overlay that does not take focus on appearance and does not either constrain interaction to the overlay or dismiss itself on loss of focus (thus allowing focus to exit into the content behind it) will be at risk of failing this SC, where it is positioned such that it can obscure other focusable items.

## Benefits

- Sighted users who rely on a keyboard interface to operate the page will be able to see the component which gets keyboard focus. Such users include those who rely on a keyboard or on devices which use the keyboard interface, including speech input, sip-and-puff software, onscreen keyboards, scanning software, and a variety of assistive technologies and alternate keyboards.
- People with limited or low vision, who may primarily user a pointer for screen orientation and repositioning, nonetheless benefit from a visible indication of the current point of keyboard interaction, especially where magnification reduces the overall viewing portion of the screen.
- People with attention limitations, short term memory limitations, or limitations in executive processes benefit by being able to discover where the focus is located.

## Examples

- A page has a sticky footer (attached to the bottom of the viewport). When tabbing down the page the focused item is not completely visually obscured by the footer because content in the viewport scrolls up to always display the item with keyboard focus using [scroll padding](https://www.w3.org/TR/css-scroll-snap/#propdef-scroll-padding).
- A page has a full-width cookie approval dialog. The dialog is modal, preventing access to the other controls in the page until it has been dismissed. Focus is not obscured because the major portion of the cookie approval dialog remains on screen (until selections are made and submitted), and so the major portion of the keyboard focus indicator remains visible.
- A notification is implemented as a sticky header and the keyboard focus is moved to the notification so at least part of the focus indicator is in view. The notification disappears when it loses focus so it does not obscure any other controls, and part of the prior keyboard focus indicator is visible.

## Related Resources

Resources are for information purposes only, no endorsement implied.

- [Let's Focus on Slide-Out Navigation](https://knowbility.org/blog/2020/accessible-slide-menus)

## Techniques

Each item in this section represents a technique or combination of techniques that the Accessibility Guidelines Working Group deems sufficient for meeting this success criterion. A technique may go beyond the minimum requirement of the criterion. There may be other ways of meeting the criterion not covered by these techniques. For information on using other techniques, see [Understanding Techniques for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-techniques), particularly the "Other Techniques" section.

### Sufficient Techniques

- [C43: Using CSS scroll-padding to un-obscure content](https://www.w3.org/WAI/WCAG22/Techniques/css/C43)

### Failures

The following are common mistakes that are considered failures of this success criterion by the Accessibility Guidelines Working Group.

- [F110: Failure of Success Criterion 2.4.11 Focus Not Obscured (Minimum) due to a sticky footer or header completely hiding focused elements](https://www.w3.org/WAI/WCAG22/Techniques/failures/F110)

## Key Terms

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

[Back to Top](#top)
