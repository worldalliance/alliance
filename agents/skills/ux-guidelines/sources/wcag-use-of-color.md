# Understanding [SC 1.4.1](https://w3.org/TR/WCAG22#use-of-color) Use of Color (Level A)

Source: <https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html>

Retrieved: 2026-11-06

Copyright © 2026 World Wide Web Consortium. W3C® liability, trademark and permissive license rules apply (https://www.w3.org/copyright/software-license/); WAI's permission page puts WAI material under the W3C Document License (https://www.w3.org/Consortium/Legal/copyright-documents). Copied verbatim: the page's main content, converted from HTML to Markdown, with the site's navigation, header and footer left out. Page date: Updated 16 September 2025.

---

## In Brief

Goal

Color is not the only way of distinguishing information.

What to do

Use information in addition to color, such as shape or text, to convey meaning.

Why it's important

Not everyone sees colors or sees them the same way.

## Success Criterion (SC)

Color is not used as the only visual means of conveying information, indicating an action, prompting a response, or distinguishing a visual element.

Note

This success criterion addresses color perception specifically. Other forms of perception are covered in [Guideline 1.3](https://www.w3.org/TR/WCAG22/#adaptable) including programmatic access to color and other visual presentation coding.

## Intent

The intent of this success criterion is to ensure that all sighted users can access information that is conveyed by color differences, that is, by the use of color where each color has a meaning assigned to it. If the information is conveyed through color differences in an image (or other non-text format), the color may not be seen by users with color deficiencies. In this case, providing the information conveyed with color through another visual means ensures users who cannot see color can still perceive the information.

Color is an important asset in the design of web content, enhancing its aesthetic appeal, its usability, and its accessibility. However, some users have difficulty perceiving color. People with partial sight often experience limited color vision, and many older users do not see color well. In addition, people using limited-color or monochrome displays and browsers will be unable to access information that is presented only in color.

Examples of information conveyed by color differences: “required fields are red", “error is shown in red", and “Mary's sales are in red, Tom's are in blue". Examples of indications of an action include: using color to indicate that a link will open in a new window or that a database entry has been updated successfully. An example of prompting a response would be: using highlighting on form fields to indicate that a required field had been left blank.

Note

This should not in any way discourage the use of color on a page, or even color coding if it is complemented by other visual indication.

Note

If content is conveyed through the use of colors that differ not only in their hue, but that also have a significant difference in lightness, then this counts as an additional visual distinction, as long as the difference in relative luminance between the colors leads to a contrast ratio of 3:1 or greater. For example, a light green and a dark red differ **both** by color (hue) **and** by lightness, so they would pass if the contrast ratio is at least 3:1. Similarly, if content is distinguished by inverting an element's foreground and background colors, this would pass (again, assuming that the foreground and background colors have a sufficient contrast).

However, if content relies on the user's ability to accurately perceive or differentiate a particular color an additional visual indicator will be required regardless of the contrast ratio between those colors. For example, knowing whether an outline is green for valid or red for invalid.

Note

This criterion does not apply to situations where color has _not_ been used to convey information, indicate an action, prompt a response or distinguish a visual element. For instance, a hyperlink which has been styled to appear no different than neighboring static text would not fail this success criterion, as there would be no color differentiation between the actionable hyperlink text and the adjacent static text. Such lack of styling differentiation could result in poor usability for anyone looking at the interface, regardless of disability.

Note

This criterion does not directly address the needs of users with assistive technologies. It aims to ensure that sighted users who cannot distinguish between some colors can still understand content. How information is conveyed to assistive technology users is covered separately in other criteria, including (but not limited to) [1.1.1 Non-text Content](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content), [1.3.1 Info and Relationships](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships), and [4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value).

Conversely, even if information that is conveyed by color differences is appropriately conveyed to assistive technologies, it does not necessarily pass this criterion, as sighted users who cannot distinguish between certain color may not necessarily be using any assistive technologies. This criterion requires a visible alternative to color.

Note

Most user agents provide users with a color-only cue that a link has been previously activated by them ("visited"). However, several technical constraints result in authors having very limited control over these color-only indications of visited links. The technical constraints are as follows:

- User agents constrain the exposure of a link's visited state due to [privacy concerns](https://developer.mozilla.org/en-US/docs/Web/CSS/Privacy_and_the_:visited_selector). Author queries to user agents will indicate all links have not been visited.
- Any available information on the visited state of a link would be inaccurate since it is both user and browser-dependent. Even if an author could accurately get information on previously activated links by a certain user, the author would be constrained to the current browser's preserved history, and would be unable to determine if the user had visited the page using a different browser (or if the history was not preserved, either from cache clearing or use of private sessions).
- Authors can _only_ use color to modify the `:visited` CSS pseudoclass style. The technology constrains any non-color styling. Due to palette limitations, an author cannot use color alone to achieve 3:1 contrast between link and non-link text as well as between visited and unvisited links while also achieving 4.5:1 contrast for all link and non-link text.
- Authors also cannot set the visited state of links. The anchor element does not include a "visited" attribute; therefore the author has no ability to alter the state through an attribute setting. As such, authors cannot achieve [1.3.1 Info and Relationships](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships) or [4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value) in regard to visited links.

For these reasons, setting or conveying a link's visited status is not an author responsibility. Where color alone distinguishes between visited and unvisited links, it does not result in a failure of this Success Criterion, even where the contrast between the two link colors is below 3:1. Note that authors must continue to ensure that all text links meet contrast minimums against the page background (SC 1.4.3).

## Benefits

- Users with partial sight often experience limited color vision.
- Some older users may not be able to see color well.
- Users with color vision deficiency who cannot distinguish between certain colors benefit when information conveyed by color is available in other visual ways.
- People using limited color monochrome displays may be unable to access color-dependent information.
- Users who have problems distinguishing between colors can look or listen for text cues.

## Examples

A form that uses color and text to indicate required fields

A form contains both required and optional fields. Instructions at the top of the form explain that required fields are labeled with red text and also with an icon. Users who cannot perceive the difference between the optional field labels and the red labels for the required fields will still be able to see the icon next to the red labels.

An examination

Students view an SVG image of a chemical compound and identify the chemical elements present based **both** on the colors used, as well as numbers next to each element. A legend shows the color and number for each type of element. Sighted users who cannot perceive all the color differences can still understand the image by relying on the numbers.

## Related Resources

Resources are for information purposes only, no endorsement implied.

- [Vischeck](https://www.vischeck.com/)
- [AWARE Color Laboratory](http://colorlab.wickline.org/colorblind/colorlab/)
- [Wikipedia: Color vision deficiency](https://en.wikipedia.org/wiki/Color_vision_deficiency)
- [Microsoft: Verify that a page is usable by people with color blindness](https://docs.microsoft.com/en-us/microsoft-edge/devtools-guide-chromium/accessibility/test-color-blindness)
- [Causes and Incidence of Colorblindness](http://www.webexhibits.org/causesofcolor/2C.html)
- [How to make figures and presentations that are friendly to Colorblind people](https://jfly.uni-koeln.de/color/)
- [The Color Tutor application](https://colortutorial.design/tutor.html)

## Techniques

Each item in this section represents a technique or combination of techniques that the Accessibility Guidelines Working Group deems sufficient for meeting this success criterion. A technique may go beyond the minimum requirement of the criterion. There may be other ways of meeting the criterion not covered by these techniques. For information on using other techniques, see [Understanding Techniques for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-techniques), particularly the "Other Techniques" section.

### Sufficient Techniques

Select the situation below that matches your content. Each situation includes techniques or combinations of techniques that are known and documented to be sufficient for that situation.

#### Situation A: If the color of particular words, backgrounds, or other content is used to indicate information:

- [G14: Ensuring that information conveyed by color differences is also available in text](https://www.w3.org/WAI/WCAG22/Techniques/general/G14)
- [G205: Including a text cue for colored form control labels](https://www.w3.org/WAI/WCAG22/Techniques/general/G205)
- [G182: Ensuring that additional visual cues are available when text color differences are used to convey information](https://www.w3.org/WAI/WCAG22/Techniques/general/G182)
- [G183: Using a contrast ratio of at least 3:1 to distinguish inline text links from surrounding text](https://www.w3.org/WAI/WCAG22/Techniques/general/G183)

#### Situation B: If color is used within an image to convey information:

- [G111: Using color and pattern](https://www.w3.org/WAI/WCAG22/Techniques/general/G111)
- [G14: Ensuring that information conveyed by color differences is also available in text](https://www.w3.org/WAI/WCAG22/Techniques/general/G14)

### Advisory Techniques

Although not required for conformance, the following additional techniques should be considered in order to make content more accessible. Not all techniques can be used or would be effective in all situations.

- [C15: Using CSS to change the presentation of a user interface component when it receives focus](https://www.w3.org/WAI/WCAG22/Techniques/css/C15)

### Failures

The following are common mistakes that are considered failures of this success criterion by the Accessibility Guidelines Working Group.

- [F13: Failure of Success Criteria 1.1.1, 1.3.3, and 1.4.1 due to having a chart that conveys information by color, instructions that only refer to color, and a text alternative that does not include information that is conveyed by color differences in the image](https://www.w3.org/WAI/WCAG22/Techniques/failures/F13)
- [F73: Failure of Success Criterion 1.4.1 due to creating links that are not visually evident without color vision](https://www.w3.org/WAI/WCAG22/Techniques/failures/F73)
- [F81: Failure of Success Criterion 1.4.1 due to identifying required or error fields using color differences only](https://www.w3.org/WAI/WCAG22/Techniques/failures/F81)

[Back to Top](#top)
