# Understanding [SC 3.3.3](https://w3.org/TR/WCAG22#error-suggestion) Error Suggestion (Level AA)

Source: <https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html>

Retrieved: 2026-11-06

Copyright © 2026 World Wide Web Consortium. W3C® liability, trademark and permissive license rules apply (https://www.w3.org/copyright/software-license/); WAI's permission page puts WAI material under the W3C Document License (https://www.w3.org/Consortium/Legal/copyright-documents). Copied verbatim: the page's main content, converted from HTML to Markdown, with the site's navigation, header and footer left out. Page date: Updated 09 March 2026.

---

## In Brief

Goal

Users get suggestions on how to resolve errors.

What to do

Where errors are detected, suggest known ways to correct them.

Why it's important

People can address errors faster and with reduced effort.

## Success Criterion (SC)

If an [input error](#dfn-input-error) is automatically detected and suggestions for correction are known, then the suggestions are provided to the user, unless it would jeopardize the security or purpose of the content.

## Intent

The intent of this success criterion is to ensure that users receive appropriate suggestions for correction of an input error if it is possible. The definition of "input error" says that it is "information provided by the user that is not accepted" by the system. Some examples of information that is not accepted include information that is required but omitted by the user and information that is provided by the user but that falls outside the required data format or allowed values.

Success Criterion 3.3.1 Error Identification provides for notification of errors. However, persons with cognitive limitations may find it difficult to understand how to correct the errors. People with visual disabilities may not be able to figure out exactly how to correct the error. In the case of an unsuccessful form submission, users may abandon the form because they may be unsure of how to correct the error even though they are aware that it has occurred.

The content author may provide the description of the error, or the user agent may provide the description of the error based on technology-specific, programmatically determined information.

## Benefits

- Providing information about how to correct input errors allows users who have learning disabilities to fill in a form successfully.
- Users who are blind or have impaired vision understand more easily the nature of the input error and how to correct it.
- People with motion impairment can reduce the number of times they need to change an input value.

## Examples

Additional Help for Correcting An Input Error

The result of a form that was not successfully submitted describes an input error in place in the page along with the correct input and offers additional help for the form field that caused the input error.

Suggestions from a Limited Set of Values

An input field requires that a month name be entered. If the user enters "12," suggestions for correction may include:

- A list of the acceptable values, e.g., "Choose one of: January, February, March, April, May, June, July, August, September, October, November, December."
- The conversion of the input data interpreted as a different month format, e.g., "Do you mean 'December'?"

## Techniques

Each item in this section represents a technique or combination of techniques that the Accessibility Guidelines Working Group deems sufficient for meeting this success criterion. A technique may go beyond the minimum requirement of the criterion. There may be other ways of meeting the criterion not covered by these techniques. For information on using other techniques, see [Understanding Techniques for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-techniques), particularly the "Other Techniques" section.

### Sufficient Techniques

Select the situation below that matches your content. Each situation includes techniques or combinations of techniques that are known and documented to be sufficient for that situation.

#### Situation A: If information for a field is required to be in a specific data format:

- [ARIA18: Using aria-alertdialog to Identify Errors](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA18)
- [G85: Providing a text description when user input falls outside the required format or values](https://www.w3.org/WAI/WCAG22/Techniques/general/G85)
- [G177: Providing suggested correction text](https://www.w3.org/WAI/WCAG22/Techniques/general/G177)
- [PDF22: Indicating when user input falls outside the required format or values in PDF forms](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF22)

#### Situation B: Information provided by the user is required to be one of a limited set of values:

- [ARIA18: Using aria-alertdialog to Identify Errors](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA18)
- [G84: Providing a text description when the user provides information that is not in the list of allowed values](https://www.w3.org/WAI/WCAG22/Techniques/general/G84)
- [G177: Providing suggested correction text](https://www.w3.org/WAI/WCAG22/Techniques/general/G177)
- [PDF22: Indicating when user input falls outside the required format or values in PDF forms](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF22)

Note

In some cases, more than one of these situations may apply. For example, when a mandatory field also requires the data to be in a specific format.

### Advisory Techniques

Although not required for conformance, the following additional techniques should be considered in order to make content more accessible. Not all techniques can be used or would be effective in all situations.

- [G139: Creating a mechanism that allows users to jump to errors](https://www.w3.org/WAI/WCAG22/Techniques/general/G139)
- [G199: Providing success feedback when data is submitted successfully](https://www.w3.org/WAI/WCAG22/Techniques/general/G199)
- [SCR18: Providing client-side validation and alert](https://www.w3.org/WAI/WCAG22/Techniques/client-side-script/SCR18)
- [SCR32: Providing client-side validation and adding error text via the DOM](https://www.w3.org/WAI/WCAG22/Techniques/client-side-script/SCR32)

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

input error

information provided by the user that is not accepted

Note

This includes:

1.  Information that is required by the [web page](#dfn-web-page) but omitted by the user
2.  Information that is provided by the user but that falls outside the required data format or values

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
