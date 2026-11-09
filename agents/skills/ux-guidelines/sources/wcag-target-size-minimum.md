# Understanding [SC 2.5.8](https://w3.org/TR/WCAG22#target-size-minimum) Target Size (Minimum) (Level AA)

Source: <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>

Retrieved: 2026-11-06

Copyright © 2026 World Wide Web Consortium. W3C® liability, trademark and permissive license rules apply (https://www.w3.org/copyright/software-license/); WAI's permission page puts WAI material under the W3C Document License (https://www.w3.org/Consortium/Legal/copyright-documents). Copied verbatim: the page's main content, converted from HTML to Markdown, with the site's navigation, header and footer left out. Page date: Updated 02 November 2026.

---

## In Brief

Goal

Make controls easier to activate.

What to do

Ensure targets meet a minimum size or have sufficient spacing around them.

Why it's important

Some people with physical impairments cannot click small buttons that are close together.

## Success Criterion (SC)

The size of the [target](#dfn-target) for [pointer inputs](#dfn-pointer-input) is at least 24 by 24 [CSS pixels](#dfn-css-pixel), except when:

Spacing

Undersized targets (those less than 24 by 24 CSS pixels) are positioned so that if a 24 CSS pixel diameter circle is centered on the [bounding box](#dfn-minimum-bounding-box) of each, the circles do not intersect another target or the circle for another undersized target;

Equivalent

The function can be achieved through a different control on the same page that meets this criterion;

Inline

The target is in a sentence or its size is otherwise constrained by the line-height of non-target text;

User Agent Control

The size of the target is determined by the [user agent](#dfn-user-agent) and is not modified by the author;

Essential

A particular [presentation](#dfn-presentation) of the target is [essential](#dfn-essential) or is legally required for the information being conveyed.

Note 1

Targets that allow for values to be selected spatially based on position within the target are considered one target for the purpose of the success criterion. Examples include sliders, color pickers displaying a gradient of colors, or editable areas where you position the cursor.

Note 2

For inline targets the line-height should be interpreted as perpendicular to the flow of text. For example, in a language displayed vertically, the line-height would be horizontal.

## Intent

The intent of this success criterion is to help ensure targets can be easily activated without accidentally activating an adjacent target. Users with dexterity limitations and those who have difficulty with fine motor movement find it difficult to accurately activate small targets when there are other targets that are too close. Providing sufficient size, or sufficient spacing between targets, will reduce the likelihood of accidentally activating the wrong control.

Disabilities addressed by this requirement include hand tremors, spasticity, and quadriplegia. Some people with disabilities use specialized input devices instead of a computer mouse or trackpad. Typically these types of input device do not provide as much accuracy as mainstream pointing devices. Meeting this requirement also ensures that touchscreen interfaces are easier to use.

Note

This success criterion defines a _minimum size_ and, if this can't be met, a _minimum spacing_. It is still possible to have very small, and difficult to activate, targets and meet the requirements of this success criterion, provided that the targets don't have any adjacent targets that are too close. However, using larger target sizes will help many people use targets more easily. _While not normatively required_, authors are encouraged to at least meet the _minimum size_ requirement of the success criterion, regardless of spacing. For important links/controls, consider aiming for the stricter [2.5.5 Target Size (Enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced).

Note

When creating this success criterion, the Working Group reviewed existing research and guidelines. The majority of this material centers around _touchscreen_ interactions, and suggests relatively large minimum sizes. In contrast, this criterion is scoped to all pointer input modalities – not just touch, but also mouse, trackpad, stylus and others. Requiring large, touch-optimized minimum sizes would not have been appropriate as a threshold for all pointer inputs. For this reason – after reviewing the average target size of various high-traffic sites – the Working Group settled on the smaller measure of 24 by 24 CSS pixels for the "(Minimum)" version of this criterion, while [2.5.5 Target Size (Enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced) uses the larger 44 by 44 CSS pixel measure as its threshold size.

### Exceptions

The requirement is for targets to be at least 24 by 24 CSS pixels in size. There are five exceptions:

- **Spacing:** Undersized targets (those less than 24 by 24 CSS pixels) are positioned so that if a 24 CSS pixel diameter circle is centered on the [bounding box](#dfn-minimum-bounding-box) of each, the circles do not intersect another target or the circle for another undersized target.
- **Equivalent:** In cases where a target does not have a size equivalent to 24 by 24 CSS pixels, but there is another control that can achieve the underlying function that _does_ meet the requirements of this success criterion, the target can be excepted based on the "Equivalent" exception.
- **Inline:** The success criterion does not apply to inline targets in sentences, or where the size of the target is constrained by the line-height of non-target text. This exception is allowed because text reflow based on viewport size makes it impossible for authors to anticipate where links may be positioned relative to one another. Applying this success criterion when multiple links are embedded in blocks of smaller text often results in an undesirable design. It is more important to set the line height to a value that improves readability.
- **User agent control:** Browsers have default renderings of some controls, such as the days of the month calendar in an `<input type="date">`. As long as the author has not modified the user agent default size, the target size for a User agent control is excepted.
- **Essential:** If the size and spacing of the targets is fundamental to the information being conveyed, the Essential exception applies. For example, in digital maps, the position of pins is analogous to the position of places shown on the map. If there are many pins close together, the spacing between pins and neighboring pins will often be below 24 CSS pixels. It is essential to show the pins at the correct map location, therefore the Essential exception applies. A similar example is an interactive data visualization where targets are necessarily dense. Another example is where jurisdictions legally require online forms to replicate paper forms, which can impose constraints on the size of targets. In such jurisdictions, any legal requirement to replicate small targets can be considered essential. When the "Essential" exception is applicable, authors are strongly encouraged to provide equivalent functionality through alternative means to the extent practical.

### Size requirement

For a target to be "at least 24 by 24 CSS pixels", it must be conceptually possible to draw a solid 24 by 24 CSS pixel square, aligned to the horizontal and vertical axis such that the square is completely within the target (does not extend outside the target's area).

![Three square boxes next to each other, each with a height and width of 24px](https://www.w3.org/WAI/WCAG22/Understanding/img/target-size-basic.svg)

Figure 1. Where targets are at least a 24 by 24 CSS pixel square, they meet the size requirement of the criterion and pass (image shown to scale - [see the scalable original version](https://www.w3.org/WAI/WCAG22/Understanding/img/target-size-basic.svg))

The 24 by 24px square has to be aligned with the page, although the target itself could be skewed.

![A skewed rectangle that includes a 24 by 24px square within it.](https://www.w3.org/WAI/WCAG22/Understanding/img/target-size-skewed.svg)

Figure 2. So long as there is a solid 24 by 24px square within the target, it meets the size requirement of the criterion and passes (image shown to scale - [see the scalable original version](https://www.w3.org/WAI/WCAG22/Understanding/img/target-size-skewed.svg))

If a target is not large enough to allow for a 24 by 24px square to be drawn inside it, it is considered _undersized_, and does not pass the size requirement of the success criterion. However, if it has sufficient space around it without adjacent targets, it may still pass the criterion thanks to the spacing exception (below).

![A circle with a diameter of 24px, but not filling up a 24px square.](https://www.w3.org/WAI/WCAG22/Understanding/img/target-size-undersized-rounded.svg)

Figure 3. The rounded corners do not leave sufficient space to draw a 24 by 24px square inside the target, making the target _undersized_. Depending on the spacing to other targets, it may still pass if it has sufficient clearance (image shown at 1:1 and 2:1 scale - [see the scalable original version](https://www.w3.org/WAI/WCAG22/Understanding/img/target-size-undersized-rounded.svg))

The requirement is independent of the zoom factor of the page; when users zoom in, the CSS pixel size of elements does not change. This means that authors cannot meet it by claiming that the target will have enough spacing or sufficient size if the user zooms into the page.

The requirement does not apply to targets while they are obscured by content displayed as a result of a user interaction or scripted behavior of content, for example:

- interacting with a combobox shows a dropdown list of suggestions
- activating a button displays a modal dialog
- content displays a cookie banner after page load
- content displays a "Take a survey" dialog after some period of user inactivity

The requirement does however apply to targets in any new content that appears on top of other content.

While the success criterion primarily helps touch users by providing target sizing to prevent accidental triggering of adjacent targets, it is also useful for mouse or pen users. It reduces the chances of erroneous activation due to either a tremor or reduced precision, whether because of reduced fine motor control or input imprecision.

### Spacing

When the minimum size for a target is not met, spacing can at least improve the user experience. There is less chance of accidentally activating a neighboring target if a target is not immediately adjacent to another. Touchscreen devices and user agents generally have internal heuristics to identify which link or control is closest to a user's touch interaction - this means that sufficient spacing between targets can work as effectively as a larger target size itself.

When a target is smaller than 24 by 24 CSS pixels, it is _undersized_. In this case, we check if it at least has sufficient _spacing_ by drawing an imaginary 24 CSS pixel diameter circle over the undersized target, centered on the target's [bounding box](#dfn-minimum-bounding-box). For rectangular targets, the bounding box coincides with the target itself – thus, the circle is placed on the center of the target. If the target is _not_ rectangular – for instance, if the target is clipped, has rounded corners, or if it's a more complex clickable SVG shape – we need to first determine the bounding box, and then find the box's center. Note that for concave shapes, the center of the bounding box may be outside of the target itself. Now, we center the circle on the center of the bounding box.

![Three undersized targets - a square target, a convex target, and a concave target; the concave and convex targets have a bounding box around them; all three targets have a 24 CSS pixel circle centered on the center of their bounding box](https://www.w3.org/WAI/WCAG22/Understanding/img/target-size-bounding-boxes.svg)

Figure 4. For a square/rectangular target, the 24 CSS pixel diameter circle is centered on the target itself. For convex and concave targets, it is centered on the bounding box of the shape. Note the concave target, where in this case the center of the bounding box is outside of the actual target (image shown to scale - [see the scalable original version](https://www.w3.org/WAI/WCAG22/Understanding/img/target-size-bounding-boxes.svg))

We repeat this process for all adjacent undersized targets. To determine if an undersized target has sufficient spacing (to pass this Success Criterion's spacing exception), we check that the 24 CSS pixel diameter circle of the target does not intersect another target or the circle of any other adjacent undersized targets.

The following example shows three versions of a horizontal row of six icon-based buttons:

- In the top row, the dimensions of each target are 24 by 24 CSS pixels, passing this success criterion.
- In the second row, the same targets are only 20 by 20 CSS pixels, but have a 4 CSS pixel space between them – as the target size is below 24 by 24 CSS pixels, these need to be evaluated against the Success Criterion's spacing exception, and they pass.
- In the last row, the targets are again 20 by 20 CSS pixels, but have no space between them – these fail the spacing exception. This is because the imaginary 24 CSS pixel diameter circles over the targets would intersect.

![The first toolbar's targets have a dimension of 24 by 24 CSS pixels, so pass. The second toolbar, with smaller targets, shows 24 CSS pixel circles drawn on each target for assessment. The circles do not intersect and so the targets have enough space to pass. The third toolbar shows similar circles on the targets, but the circles intersect due to the lack of spacing between targets, so the toolbar fails.](https://www.w3.org/WAI/WCAG22/Understanding/img/target-spacing-toolbar.svg)

Figure 5. Three rows of targets, illustrating two ways of meeting this success criterion and one way of failing it (image shown to scale - [see the scalable original version](https://www.w3.org/WAI/WCAG22/Understanding/img/target-spacing-toolbar.svg))

The next two illustrations show sets of buttons which are only 16 CSS pixels tall. In the first set, there are no targets immediately above or below the buttons, so they pass. In the second illustration, there are further buttons, and they have been stacked on top of one another, resulting in a fail.

![A row of buttons which are more than 44px wide and 16 CSS pixels high. There are no close targets above or below. The buttons are overlaid with the 24 CSS pixel diameter circles, and do not intersect each other nor any other targets.](https://www.w3.org/WAI/WCAG22/Understanding/img/target-text-buttons-single-row.svg)

Figure 6. While the height of the targets is only 16 CSS pixels, the lack of adjacent targets above and below means that the targets pass this success criterion (image shown to scale - [see the scalable original version](https://www.w3.org/WAI/WCAG22/Understanding/img/target-text-buttons-single-row.svg))

![Two rows of buttons only 16 CSS pixels high, with no spacing between them. The buttons are overlaid with the 24 CSS pixel diameter circles, and all the circles either overlap another circle, or another target.](https://www.w3.org/WAI/WCAG22/Understanding/img/target-text-buttons-two-rows.svg)

Figure 7. Two rows of buttons, both with a height of only 16 CSS pixels. The rows are close, with only a 1 CSS pixel gap between them. This means that the 24 CSS pixel spacing circles of the targets in one row will _intersect_ the targets (and their circles, depending on their respective widths) in the other line, thus failing the success criterion. Image shown to scale - [see the scalable original version](https://www.w3.org/WAI/WCAG22/Understanding/img/target-text-buttons-two-rows.svg).

The following two illustrations show how menu items can be adjusted to properly meet this requirement. In the first illustration, the About us menu has been activated, showing that each of the menu item targets has a 24 CSS pixel height (text and padding), and so passes. In the second illustration, the same menu is expanded, but the menu items only achieve 18 CSS pixels in height, and so fail.

![Two examples of a dropdown menu - a pass example with menu items 24 CSS pixels high, and a fail example with menu items only 18 CSS pixels high. One item has a 24 CSS pixel diameter circle which intersects adjacent targets.](https://www.w3.org/WAI/WCAG22/Understanding/img/target-dropdown.svg)

Figure 8. The menu items with a height of 24 CSS pixels pass. For the menu items that are only 18 CSS pixels high, the 24 CSS pixel spacing circles of the targets in one row will intersect the adjacent menu item targets and circles, and fail (image shown to scale - [see the scalable original version](https://www.w3.org/WAI/WCAG22/Understanding/img/target-dropdown.svg))

The following example has one large target (an image that links to a new page related to that image) and a very small second target (a control with a magnifier icon to open a zoomed-in preview, possibly in a modal, of the image).

In the top row, the small target overlaps - or, to be more technically accurate, _clips_ - the large target. The small target itself has a size of 24 by 24 CSS pixels, so passes. In the second row, we see that if the second target is any smaller – in this case 16 by 16 CSS pixels – it fails the criterion, as the imaginary circle with a 24 CSS pixel diameter we draw over the small target will intersect the large target itself.

![Two rows showing a small target clipping a large target](https://www.w3.org/WAI/WCAG22/Understanding/img/target-large-small-clipping.svg)

Figure 9. The 24 by 24 CSS pixel small target passes, while the 16 by 16 CSS pixel small target fails, since the 24 CSS pixel diameter circle used for undersized targets intersect the large target (image shown to scale - [see the scalable original version](https://www.w3.org/WAI/WCAG22/Understanding/img/target-large-small-clipping.svg))

In the following example, we have the same two targets – a large target and a small target. This time, the small target touches/abuts the large target. If the small target is smaller than 24 by 24 CSS pixels, the imaginary circle with a 24 CSS pixel diameter we draw over the small target will intersect the large target itself, failing the requirement. The undersized target must be spaced further away from the large target until its circle doesn't intersect the large target.

![Two rows showing a small target and a large target touching/abutting](https://www.w3.org/WAI/WCAG22/Understanding/img/target-large-small-touching.svg)

Figure 10. In the first row, the 16 by 16 CSS pixel target touching/abutting the large target fails, as its 24 CSS pixel diameter circle used for undersized targets intersects the large target. In the second row we see that the only way the undersized target can pass is by adding a 4 CSS pixel spacing gap between the targets (image shown to scale - [see the scalable original version](https://www.w3.org/WAI/WCAG22/Understanding/img/target-large-small-touching.svg))

Note

Users with different disabilities have different needs for control sizes. It can be beneficial to provide an option to increase the active target area without increasing the visible target size. Another option is to provide a mechanism to control the density of layout and thereby change target size or spacing, or both. This can be beneficial for a wide range of users. For example, users with visual field loss may prefer a more condensed layout with smaller sized controls while users with other forms of low vision may prefer large controls.

### User agent control

This success criterion has an exception for the size of targets determined by a user agent and not modified by the author. An example of this kind of target is a browser's scrollbars. If a scrollbar's dimensions have been modified by the author then there must be a passing amount of spacing between the scrollbar and the content of the page. The following example shows a passing and a failing design.

![A page's scrollbar has been modified to give it custom track and thumb colors. The track is less than 24px wide and the thumb is narrower. The page has a back-to-top link that is next to the scrollbar.](https://www.w3.org/WAI/WCAG22/Understanding/img/target-custom-scrollbar-spacing.svg)

Figure 11. The passing example has enough space between the link and the scrollbar for a 24 CSS pixel diameter circle, placed over the scrollbar, to not overlap the link. The failing example has no space between the link and the scrollbar, which fails the criterion because the 24 CSS pixel diameter circle overlaps the link. (Image shown to scale - [see the scalable original version](https://www.w3.org/WAI/WCAG22/Understanding/img/target-custom-scrollbar-spacing.svg))

## Benefits

Having targets with sufficient size - or at least sufficient target spacing - can help all users who may have difficulty in confidently targeting or operating small controls. Users who benefit include, but are not limited to:

- People who use a mobile device where the touchscreen is the primary mode of interaction;
- People using mouse, stylus or touch input who have mobility impairments such as hand tremors;
- People using a device in environments where they are exposed to shaking such as public transportation;
- Mouse users who have difficulty with fine motor movements;
- People who access a device using one hand;
- People with large fingers, or who are operating the device with only a part of their finger or knuckle.

## Examples

- Three buttons are on-screen and the target size of each button is 24 by 24 CSS pixels. Since the target size itself is 24 by 24 CSS pixels, no additional spacing is required, the success criterion passes.
- A row of buttons, each of which has a horizontal width of more than 24 CSS pixels, a height of only 20 CSS pixels, and vertical margin of 4 CSS pixels above and below the row of buttons. Since there is sufficient spacing both above and below the row of buttons, the success criterion passes.
- Links within a paragraph of text have varying target dimensions. Links within paragraphs of text do not need to meet the 24 by 24 CSS pixels requirements, so the success criterion passes.

## Related Resources

Resources are for information purposes only, no endorsement implied.

- [Target size study for one-handed thumb use on small touchscreen devices](https://dl.acm.org/doi/10.1145/1152215.1152260)

## Techniques

Each item in this section represents a technique or combination of techniques that the Accessibility Guidelines Working Group deems sufficient for meeting this success criterion. A technique may go beyond the minimum requirement of the criterion. There may be other ways of meeting the criterion not covered by these techniques. For information on using other techniques, see [Understanding Techniques for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-techniques), particularly the "Other Techniques" section.

### Sufficient Techniques

- [C42: Using min-height and min-width on target container to ensure sufficient target spacing](https://www.w3.org/WAI/WCAG22/Techniques/css/C42)

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

blocks of text

more than one sentence of text

content

information and sensory experience to be communicated to the user by means of a [user agent](#dfn-user-agent), including code or markup that defines the content's [structure](#dfn-structure), [presentation](#dfn-presentation), and interactions

CSS pixel

visual angle of about 0.0213 degrees

A CSS pixel is the canonical unit of measure for all lengths and measurements in CSS. This unit is density-independent, and distinct from actual hardware pixels present in a display. User agents and operating systems should ensure that a CSS pixel is set as closely as possible to the [CSS Values and Units Module Level 3 reference pixel](https://www.w3.org/TR/css3-values/#reference-pixel) \[[css3-values](https://www.w3.org/TR/css-values-3/)\], which takes into account the physical dimensions of the display and the assumed viewing distance (factors that cannot be determined by content authors).

essential

if removed, would fundamentally change the information or functionality of the content, **and** information and functionality cannot be achieved in another way that would conform

minimum bounding box

the smallest enclosing rectangle aligned to the horizontal axis within which all the points of a shape lie. For components which wrap onto multiple lines as part of a sentence or [block of text](#dfn-blocks-of-text) (such as hypertext links), the bounding box is based on how the component would appear on a single line.

pointer input

input from a device that can target a specific coordinate (or set of coordinates) on a screen, such as a mouse, pen, or touch contact

Note

See the [Pointer Events definition for "pointer"](https://www.w3.org/TR/pointerevents/#dfn-pointer) \[[pointerevents](https://www.w3.org/TR/pointerevents4/)\].

presentation

rendering of the [content](#dfn-content) in a form to be perceived by users

structure

- The way the parts of a [web page](#dfn-web-page) are organized in relation to each other; and
- The way a collection of [web pages](#dfn-web-page) is organized

target

region of the display that will accept a pointer action, such as the interactive area of a [user interface component](#dfn-user-interface-component)

Note

If two or more targets are overlapping, the overlapping area should not be included in the measurement of the target size, except when the overlapping targets perform the same action or open the same page.

user agent

any software that retrieves and presents web content for users

Example

Web browsers, media players, plug-ins, and other programs — including [assistive technologies](#dfn-assistive-technology) — that help in retrieving, rendering, and interacting with web content.

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

web page

a non-embedded resource obtained from a single URI using HTTP plus any other resources that are used in the rendering or intended to be rendered together with it by a [user agent](#dfn-user-agent)

Note 1

Although any "other resources" would be rendered together with the primary resource, they would not necessarily be rendered simultaneously with each other.

Note 2

For the purposes of conformance with these guidelines, a resource must be "non-embedded" within the scope of conformance to be considered a web page.

Example 1

A web resource including all embedded images and media.

Example 2

A web mail program built using Asynchronous JavaScript and XML (AJAX). The program lives entirely at http://example.com/mail, but includes an inbox, a contacts area and a calendar. Links or buttons are provided that cause the inbox, contacts, or calendar to display, but do not change the URI of the page as a whole.

Example 3

A customizable portal site, where users can choose content to display from a set of different content modules.

Example 4

When you enter "http://shopping.example.com/" in your browser, you enter a movie-like interactive shopping environment where you visually move around in a store dragging products off of the shelves around you and into a visual shopping cart in front of you. Clicking on a product causes it to be demonstrated with a specification sheet floating alongside. This might be a single-page website or just one page within a website.

[Back to Top](#top)
