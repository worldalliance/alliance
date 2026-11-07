# Understanding [SC 3.2.4](https://w3.org/TR/WCAG22#consistent-identification) Consistent Identification (Level AA)

Source: <https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html>

Retrieved: 2026-11-06

Copyright © 2026 World Wide Web Consortium. W3C® liability, trademark and permissive license rules apply (https://www.w3.org/copyright/software-license/); WAI's permission page puts WAI material under the W3C Document License (https://www.w3.org/Consortium/Legal/copyright-documents). Copied verbatim: the page's main content, converted from HTML to Markdown, with the site's navigation, header and footer left out. Page date: Updated 04 October 2026.

---

## In Brief

Goal

Users can recognize the same functionality when it appears on different web pages.

What to do

Consistently identify components that have the same functionality throughout a set of web pages.

Why it's important

Consistent identification helps users recognize familiar functionality when it appears on different web pages, making websites easier to learn, navigate, and use.

## Success Criterion (SC)

Components that have the [same functionality](#dfn-same-functionality) within a [set of web pages](#dfn-set-of-web-pages) are identified consistently.

## Intent

The intent of this success criterion is to help users recognize components that perform the same functionality whenever they appear within a set of web pages. Consistent identification allows users to apply knowledge gained from one page when interacting with another, reducing the effort required to locate and understand familiar functionality.

This success criterion is intended to support the recognition of components that users are likely to encounter repeatedly within a set of web pages, allowing knowledge gained from previous interactions to be reused.

Note

This success criterion applies to components that are repeated within a set of web pages and provide the same functionality. It does not require components that provide the same functionality but are not repeated instances of the same component to have the same identification. For example, a "Contact us" link in a website footer and a "Contact our support team" link within the main content of a policy page may both allow users to contact the organization. However, users are unlikely to perceive them as recurring instances of the same component and therefore are less likely to rely on previous interactions to recognize them as equivalent. In contrast, recurring components such as global navigation links, search controls, account controls, or footer links are encountered repeatedly across a set of web pages and are the types of components for which consistent identification most directly supports user recognition.

Users often rely on consistent identification to predict the purpose of interface components. For example, people who use screen readers frequently navigate websites by recognizing familiar controls announced by assistive technologies, while people with cognitive disabilities may rely on consistent visual identification to recognize functionality without having to relearn it on each page. When components that perform the same functionality are identified differently, users may incorrectly assume that they perform different functions or spend additional time determining whether they are equivalent.

Depending on the type of component and the way users interact with it, identification may be conveyed through visible labels, accessible names, text alternatives, icons, or other means. These are mechanisms by which components may be identified rather than the subject of this success criterion itself. No particular identification mechanism is required, provided users can consistently recognize equivalent functionality. Identification is considered consistent when users can reliably recognize that components perform the same functionality, even if the specific mechanism used to identify them varies to reflect the context.

Consistent identification does not require _identical_ labels, names, or text alternatives. In many cases, using the same identification for components with the same functionality helps users recognize familiar functionality more easily and is encouraged. However, differences may be appropriate when they better reflect the component's purpose or context, given that users can still recognize that the components perform the same functionality. For example, in a sequence of pages, a navigation link identified as "Page 4" on one page may appropriately be identified as "Previous page" when viewed from page 5. Although the labels are different, users can still recognize that both components provide the same navigation functionality, even though their labels differ to reflect the current context.

Repeated components with the same functionality may appear on different pages, multiple times on the same page, or in both situations within a set of web pages. Wherever they appear within the set, consistent identification helps users recognize equivalent functionality and apply knowledge gained from previous interactions.

Note

Although consistent identification may also benefit users when applied to non-functional content, this success criterion only applies to _functional_ components. While not normatively required, consistently identifying non-functional content is encouraged.

Note

This success criterion only applies to components that have the same functionality. Components that perform different functions or produce different results are not expected to be identified consistently, even if they appear visually similar or use similar labels or icons. Conversely, components that have the same functionality are expected to be identified consistently, even when their identification appropriately varies to reflect their context.

## Benefits

- People who recognize the functionality of a component on one page within a set of web pages can more easily recognize components with the same functionality elsewhere in the set.
- People with cognitive and learning disabilities benefit from consistent identification because it reduces the effort required to learn, recognize, and locate familiar functionality.
- People who use assistive technologies benefit from consistent identification because familiar components are presented in a predictable way, making it easier to understand and operate web content.
- When components with the same functionality are identified consistently, users can more easily recognize equivalent functionality across a set of web pages.

## Examples

Examples in this Understanding document focus on components that users encounter repeatedly within a set of web pages, since these are the situations in which consistent identification most directly supports recognition and predictability.

Example 1: Button identified by a text label

A website provides a "Search" button throughout the site. Each button performs the same search functionality and is consistently identified as "Search", allowing users to immediately recognize the function wherever it appears.

Example 2: Button identified by an icon

A web application provides a Save button on multiple pages. Each button performs the same save functionality and is consistently identified by the same save icon with the same text alternative, allowing users to immediately recognize the same functionality wherever the button appears.

Example 3: Repeated component within the same page

A web page contains a "Search" button in both the page header and the page footer. Both buttons perform the same search functionality and are consistently identified as "Search". Users can recognize the same functionality regardless of which instance they encounter.

Example 4: Consistent identification adapted to context

In a sequence of pages, a navigation link identified as "Page 4" on one page is appropriately identified as "Previous page" when viewed from page 5. Although the labels are different, users can still recognize that both components provide the same navigation functionality because the identification reflects the current context.

Example 5: Consistent identification across responsive presentations

A website provides a Search button throughout the site. In the large viewport ("desktop") presentation, the button is identified by the visible label "Search". In the small viewport ("mobile") presentation, the same button is identified by a magnifying glass icon with the accessible name "Search". Despite the different presentations, users can consistently recognize the same search functionality.

Example 6 - Out of scope: Components with different functionality

An e-commerce application provides two buttons identified with a printer icon. One button prints receipts, while the other prints invoices. Because the buttons do not have the same functionality, this success criterion does not apply. Although identifying the buttons as "Print receipt" and "Print invoice" helps users understand their different functions and is encouraged as good design practice, it is not required for conformance to this success criterion.

Example 7 - Failure: Different text labels for the same functionality

A website provides the same search functionality on multiple pages. On some pages the search button is identified as "Search", while on others it is identified as "Find". Although the buttons perform the same functionality, the inconsistent identification may lead users to question whether they perform the same action. This is a failure of this success criterion.

Example 8 - Failure: Different accessible names for the same functionality

Two buttons that perform the same functionality display the visible label "Search". However, one button has the accessible name "Search" while the other has the accessible name "Find". Although the buttons appear identical visually, users of assistive technologies encounter inconsistent identification because the components are announced differently. This also fails [Success Criterion 2.5.3 Label in Name](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name) because the accessible name "Find" does not contain the visible label "Search".

Example 9 - Failure: Different icons for the same functionality

A web application provides a save button on multiple pages. On one page the button is identified by a floppy disk icon, while on another it is identified by a checkmark icon. Although both buttons have the accessible name "Save", users who rely on visual recognition may not immediately recognize that the components perform the same functionality. This is a failure of this success criterion.

## Techniques

Each item in this section represents a technique or combination of techniques that the Accessibility Guidelines Working Group deems sufficient for meeting this success criterion. A technique may go beyond the minimum requirement of the criterion. There may be other ways of meeting the criterion not covered by these techniques. For information on using other techniques, see [Understanding Techniques for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-techniques), particularly the "Other Techniques" section.

### Sufficient Techniques

- [G197: Using labels, names, and text alternatives consistently for content that has the same functionality](https://www.w3.org/WAI/WCAG22/Techniques/general/G197) **AND** following the [sufficient techniques for Success Criterion 1.1.1](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content#techniques) and [sufficient techniques for Success Criterion 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value#techniques) for providing labels, names, and text alternatives

Note

Text alternatives that are "consistent" are not always "identical." For instance, you may have a graphical arrow at the bottom of a web page that links to the next web page. The text alternative may say "Go to page 4." Naturally, it would not be appropriate to repeat this exact text alternative on the next web page. It would be more appropriate to say "Go to page 5". Although these text alternatives would not be identical, they would be consistent, and therefore would satisfy this success criterion.

A single non-text-content-item may be used to serve different functions. In such cases, different text alternatives are necessary and should be used. Examples can be commonly found with the use of icons such as check marks, cross marks, and traffic signs. Their functions can be different depending on the context of the web page. A check mark icon may function as "approved", "completed", or "included", to name a few, depending on the situation. Using "check mark" as text alternative across all web pages does not help users understand the function of the icon. Different text alternatives can be used when the same non-text content serves multiple functions.

### Failures

The following are common mistakes that are considered failures of this success criterion by the Accessibility Guidelines Working Group.

- [F31: Failure of Success Criterion 3.2.4 due to using two different labels for the same function on different web pages within a set of web pages](https://www.w3.org/WAI/WCAG22/Techniques/failures/F31)

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

same functionality

same result when used

Example

A submit "search" button on one web page and a "find" button on another web page may both have a field to enter a term and list topics in the website related to the term submitted. In this case, they would have the same functionality but would not be labeled consistently.

set of web pages

collection of [web pages](#dfn-web-page) that share a common purpose and that are created by the same author, group or organization

Example

Examples include:

- a publication which is split across multiple web pages, where each page contains one chapter or other significant section of the work. The publication is logically a single contiguous unit, and contains navigation features that enable access to the full set of pages.
- an e-commerce website shows products in a set of web pages that all share the same navigation and identification. However, when progressing to the checkout process, the template changes; the navigation and other elements are removed, so the pages in that process are functionally and visually different. The checkout pages are not part of the set of product pages.
- a blog on a sub-domain (e.g. blog.example.com) which has a different navigation and is authored by a distinct set of people from the pages on the primary domain (example.com).

Note

Different language versions would be considered different sets of web pages.

user agent

any software that retrieves and presents web content for users

Example

Web browsers, media players, plug-ins, and other programs — including [assistive technologies](#dfn-assistive-technology) — that help in retrieving, rendering, and interacting with web content.

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
