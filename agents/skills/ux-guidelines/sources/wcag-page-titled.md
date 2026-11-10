# Understanding [SC 2.4.2](https://w3.org/TR/WCAG22#page-titled) Page Titled (Level A)

Source: <https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html>

Retrieved: 2026-11-09

Copyright © 2026 World Wide Web Consortium. W3C® liability, trademark and permissive license rules apply (https://www.w3.org/copyright/software-license/); WAI's permission page puts WAI material under the W3C Document License (https://www.w3.org/Consortium/Legal/copyright-documents). Copied verbatim: the page's main content, converted from HTML to Markdown, with the site's navigation, header and footer left out. Page date: Updated 09 March 2026.

---

## In Brief

Goal

Each web page has a meaningful title.

What to do

Provide a descriptive page title using appropriate technology.

Why it's important

Page titles help users identify and distinguish different pages.

## Success Criterion (SC)

[Web pages](https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html#dfn-web-page) have titles that describe topic or purpose.

## Intent

The intent of this success criterion is to help users find content and orient themselves within it by ensuring that each web page has a descriptive title. Titles identify the current location without requiring users to read or interpret page content. When titles appear in site maps or lists of search results, users can more quickly identify the content they need. User agents make the title of the page easily available to the user for identifying the page. For instance, a user agent may display the page title in the window title bar or as the name of the tab containing the page.

In cases where the page is a document or a web application, the name of the document or web application would be sufficient to describe the purpose of the page. Note that it is not required to use the name of the document or web application; other things may also describe the purpose or the topic of the page.

In cases such as Single Page Applications (SPAs), where various distinct pages/views are all nominally served from the same URI and the content of the page is changed dynamically, the title of the page should also be changed dynamically to reflect the content or topic of the current view.

[Success Criteria 2.4.4 Link Purpose (In Context)](https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context) and [2.4.9 Link Purpose (Link Only)](https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-link-only) deal with the purpose of links, many of which are links to web pages. Here also, the name of a document or web application being linked to would be sufficient to describe the purpose of the link. Having the link and the title agree, or be very similar, is good practice and provides continuity between the link 'clicked on' and the web page that the user lands on.

## Benefits

- This criterion benefits all users in allowing users to quickly and easily identify whether the information contained in the web page is relevant to their needs.
- People with visual disabilities will benefit from being able to differentiate content when multiple web pages are open.
- People with cognitive disabilities, limited short-term memory and reading disabilities also benefit from the ability to identify content by its title.
- This criterion also benefits people with severe mobility impairments whose mode of operation relies on audio when navigating between web pages.

## Examples

An HTML web page

The descriptive title of an HTML web page is marked up with the <title> element so that it will be displayed in the title bar of the user agent.

A set of web pages

The title of the landing page is "ARIA Authoring Practices Guide | APG | WAI | W3C"

- The patterns list page has the title "Patterns | APG | WAI | W3C"
  - Specific patterns are pages titled "X Pattern | APG | WAI | W3C" (e.g., "Alert and Message Dialogs Pattern | APG | WAI | W3C")
    - Specific examples for each pattern are pages titled "X Example | APG | WAI | W3C" (e.g., "Alert Dialog Example | APG | WAI | W3C")
- Practices page has the title "Practices | APG | WAI | W3C"
- Index page has the title "Index | APG | WAI | W3C"

A web application

A banking application lets users inspect their bank accounts, view past statements, and perform transactions. The web application dynamically generates titles for each web page, e.g., "Bank XYZ, accounts for Alex Smith" "Bank XYZ, December 2005 statement for Account 1234-5678".

## Related Resources

Resources are for information purposes only, no endorsement implied.

- [<title>: The Document Title element: Usage notes (Accessibility)](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/title#accessibility).
- [Guidelines for Accessible and Usable Web Sites: Observing Users Who Work With Screen Readers (PDF)](https://redish.net/wp-content/uploads/Theorfanos_Redish_InteractionsPaperAuthorsVer.pdf) . Theofanos, M.F., and Redish, J. (2003). Interactions, Volume X, Issue 6, November-December 2003, pages 38-51, [https://dl.acm.org/doi/10.1145/947226.947227](https://dl.acm.org/doi/10.1145/947226.947227)

## Techniques

Each item in this section represents a technique or combination of techniques that the Accessibility Guidelines Working Group deems sufficient for meeting this success criterion. A technique may go beyond the minimum requirement of the criterion. There may be other ways of meeting the criterion not covered by these techniques. For information on using other techniques, see [Understanding Techniques for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-techniques), particularly the "Other Techniques" section.

### Sufficient Techniques

- [G88: Providing descriptive titles for web pages](https://www.w3.org/WAI/WCAG22/Techniques/general/G88) **AND** associating a title with a web page using one of the following techniques:
  - [H25: Providing a title using the title element](https://www.w3.org/WAI/WCAG22/Techniques/html/H25)
  - [PDF18: Specifying the document title using the Title entry in the document information dictionary of a PDF document](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF18)

### Advisory Techniques

Although not required for conformance, the following additional techniques should be considered in order to make content more accessible. Not all techniques can be used or would be effective in all situations.

- [G127: Identifying a web page's relationship to a larger collection of web pages](https://www.w3.org/WAI/WCAG22/Techniques/general/G127)

### Failures

The following are common mistakes that are considered failures of this success criterion by the Accessibility Guidelines Working Group.

- [F25: Failure of Success Criterion 2.4.2 due to the title of a web page not identifying the contents](https://www.w3.org/WAI/WCAG22/Techniques/failures/F25)

## Key Terms

assistive technology

hardware and/or software that acts as a [user agent](https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html#dfn-user-agent), or along with a mainstream user agent, to provide functionality to meet the requirements of users with disabilities that go beyond those offered by mainstream user agents

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

user agent

any software that retrieves and presents web content for users

Example

Web browsers, media players, plug-ins, and other programs — including [assistive technologies](https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html#dfn-assistive-technology) — that help in retrieving, rendering, and interacting with web content.

web page

a non-embedded resource obtained from a single URI using HTTP plus any other resources that are used in the rendering or intended to be rendered together with it by a [user agent](https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html#dfn-user-agent)

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

## Test Rules

The following are Test Rules for certain aspects of this Success Criterion. It is not necessary to use these particular Test Rules to check for conformance with WCAG, but they are defined and approved test methods. For information on using Test Rules, see [Understanding Test Rules for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-act-rules.html).

- [HTML page has non-empty title](https://www.w3.org/WAI/standards-guidelines/act/rules/2779a5/)
- [HTML page title is descriptive](https://www.w3.org/WAI/standards-guidelines/act/rules/c4a8a4/)

[Back to Top](#top)
