# Understanding [SC 3.3.1](https://w3.org/TR/WCAG22#error-identification) Error Identification (Level A)

Source: <https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html>

Retrieved: 2026-11-06

Copyright © 2026 World Wide Web Consortium. W3C® liability, trademark and permissive license rules apply (https://www.w3.org/copyright/software-license/); WAI's permission page puts WAI material under the W3C Document License (https://www.w3.org/Consortium/Legal/copyright-documents). Copied verbatim: the page's main content, converted from HTML to Markdown, with the site's navigation, header and footer left out. Page date: Updated 02 November 2026.

---

## In Brief

Goal

Users know an error exists and what is wrong.

What to do

Provide descriptive notification of errors.

Why it's important

Flagging errors helps people with reduced sight and cognitive disabilities resolve them.

## Success Criterion (SC)

If an [input error](#dfn-input-error) is automatically detected, the item that is in error is identified and the error is described to the user in text.

## Intent

The intent of this success criterion is to ensure that users are aware that an error has occurred and can determine what is wrong. In the case of an unsuccessful form submission, it is not sufficient to only re-display the form without providing any hint that the submission failed. The error must be indicated in [text](#dfn-text).

This SC requires that users be provided with information about the nature of the error, including the identity of the item in error. What the user should do to correct the item in error is covered by [3.3.3 Error Suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion). Often, the error description can be phrased so that it meets both Success Criteria 3.3.1 Error Identification and 3.3.3 Error Suggestion at the same time. For instance, "Email is not valid" would pass 3.3.1, but "Please provide a valid email address in the format name@domain.com" also conveys how it can be fixed and passes both.

An "input error" includes:

- information that is required by the web page but omitted by the user, or
- information that is provided by the user but that falls outside the required data format or allowed values.

For example:

- the user fails to enter the proper abbreviation in a state, province, or region field;
- the user enters a state abbreviation that is not a valid state;
- the user enters a non existent zip or postal code;
- the user enters a birth date 2 years in the future;
- the user enters alphabetic characters or parentheses into their phone number field that only accepts numbers;
- the user enters a bid that is below the previous bid or the minimum bid increment.

Note

If a user enters a value that is too high or too low, and the coding on the page automatically changes that value to fall within the allowed range, the user's error would still need to be described to them as required by the success criterion. Such an error description telling the person of the changed value would meet both this success criterion (Error Identification) and [3.3.3 Error Suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion).

The identification and description of an error can be combined with programmatic information that user agents or assistive technologies can use to identify an error and provide error information to the user. For example, certain technologies can specify that the user's input must not fall outside a specific range, or that a form field is required. This type of programmatic information is not required for this success criterion, but may be covered by other criteria such as [4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value) for communicating the error state of input, and [1.3.1 Info And Relationships](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html) for creating a programmatic connection between the input and the error message.

It is perfectly acceptable to indicate the error in other ways such as through the use of an image, color, or other visual indicator, in addition to the text description.

Note

This criterion does not mandate any particular way in which errors should be displayed. Depending on the situation, it may be more suitable for all errors to be listed at the start or before a form. In other cases, it may be more appropriate to show errors inline, with error messages next to the specific fields that are in error. Errors could also be listed in an alert, or dialog. This criterion does not cover which of these methods should be used - the only requirement is for errors to be presented to users in text or a text alternative.

### User agent native HTML form validation

When using native HTML [client-side form validation](https://html.spec.whatwg.org/multipage/forms.html#client-side-form-validation), user agents will automatically prevent the submission of incomplete or invalid forms, and display generic error messages to the user. The user agent will generally set focus back to the first form field that is in error, and as a result scroll the page so that the field in error and the generated error message will be visible in the viewport.

In most common user agent and screen reader combinations, the screen reader will announce the error message and the programmatic name of the focused field. While this meets the requirements of this success criterion, it should be noted that there are several disadvantages related to this approach:

- Depending on the user agent, the message may not be permanent, or fail to scroll with the page.
- Depending on the user agent, even if a user has zoomed-in (magnified) the content, the error messages will not appear magnified, as the text in the validation message will be displayed at the same size as the user agent interface; the message may be too small for users to read.
- The default HTML validation error messages are generally quite generic, and they may not provide sufficiently helpful or specific suggestions to the user that would conform to [3.3.3 Error Suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion).
- If several errors are present, only the first error message is exposed; once the user has provided an input that conforms to the type of field, and resubmits the form, the next error (if present) will be exposed. This means that repeated resubmissions and corrections may be required.

As these problems relate to user agent behavior, developers will need to carefully consider if native browser validation is [accessibility supported](#dfn-accessibility-supported).

## Benefits

- Providing information about input errors in text allows users who are blind, have low vision, or have color vision deficiency to perceive the fact that an error occurred.
- This success criterion may help people with cognitive, language, and learning disabilities who have difficulty understanding the specific reason why a form submission failed (in cases where this is not already made obvious by the nature of the form).

## Examples

Identifying errors in a form submission

An airline website offers a special promotion on discounted flights. The user is asked to complete a simple form that asks for personal information such as name, address, phone number, seating preference and email address. If any of the fields of the form are either not completed or completed incorrectly, an alert is displayed notifying the user which field or fields were missing or incorrect.

Note

This success criterion does not mean that color or text styles cannot be used to indicate errors. It simply requires that errors also be identified using text.

Providing multiple cues

The user fails to fill in two fields on the form. In addition to describing the error and providing a unique character to make it easy to search for the fields, the fields are highlighted in yellow to make it easier to visually search for them as well.

## Techniques

Each item in this section represents a technique or combination of techniques that the Accessibility Guidelines Working Group deems sufficient for meeting this success criterion. A technique may go beyond the minimum requirement of the criterion. There may be other ways of meeting the criterion not covered by these techniques. For information on using other techniques, see [Understanding Techniques for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-techniques), particularly the "Other Techniques" section.

### Sufficient Techniques

Select the situation below that matches your content. Each situation includes techniques or combinations of techniques that are known and documented to be sufficient for that situation.

#### Situation A: If a form contains fields for which information from the user is mandatory.

- [G83: Providing text descriptions to identify required fields that were not completed](https://www.w3.org/WAI/WCAG22/Techniques/general/G83)
- [SCR18: Providing client-side validation and alert](https://www.w3.org/WAI/WCAG22/Techniques/client-side-script/SCR18)
- [PDF5: Indicating required form controls in PDF forms](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF5)

#### Situation B: If information provided by the user is required to be in a specific data format or of certain values.

- [ARIA18: Using aria-alertdialog to Identify Errors](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA18)
- [G84: Providing a text description when the user provides information that is not in the list of allowed values](https://www.w3.org/WAI/WCAG22/Techniques/general/G84)
- [G85: Providing a text description when user input falls outside the required format or values](https://www.w3.org/WAI/WCAG22/Techniques/general/G85)
- [SCR18: Providing client-side validation and alert](https://www.w3.org/WAI/WCAG22/Techniques/client-side-script/SCR18)
- [SCR32: Providing client-side validation and adding error text via the DOM](https://www.w3.org/WAI/WCAG22/Techniques/client-side-script/SCR32)
- [PDF22: Indicating when user input falls outside the required format or values in PDF forms](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF22)

### Advisory Techniques

Although not required for conformance, the following additional techniques should be considered in order to make content more accessible. Not all techniques can be used or would be effective in all situations.

- [G139: Creating a mechanism that allows users to jump to errors](https://www.w3.org/WAI/WCAG22/Techniques/general/G139)
- [G199: Providing success feedback when data is submitted successfully](https://www.w3.org/WAI/WCAG22/Techniques/general/G199)

## Key Terms

accessibility supported

supported by users' [assistive technologies](#dfn-assistive-technology) as well as the accessibility features in browsers and other [user agents](#dfn-user-agent)

To qualify as an accessibility-supported use of a web content technology (or feature of a technology), both 1 and 2 must be satisfied for a web content technology (or feature):

1.  **The way that the [web content technology](#dfn-technology) is used must be supported by users' assistive technology (AT).** This means that the way that the technology is used has been tested for interoperability with users' assistive technology in the [human language(s)](#dfn-human-language) of the content,

    **AND**

2.  **The web content technology must have accessibility-supported user agents that are available to users.** This means that at least one of the following four statements is true:
    1.  The technology is supported natively in widely-distributed user agents that are also accessibility supported (such as HTML and CSS);

        **OR**

    2.  The technology is supported in a widely-distributed plug-in that is also accessibility supported;

        **OR**

    3.  The content is available in a closed environment, such as a university or corporate network, where the user agent required by the technology and used by the organization is also accessibility supported;

        **OR**

    4.  The user agent(s) that support the technology are accessibility supported and are available for download or purchase in a way that:
        - does not cost a person with a disability any more than a person without a disability **and**
        - is as easy to find and obtain for a person with a disability as it is for a person without disabilities.

Note 1

The Accessibility Guidelines Working Group and the W3C do not specify which or how much support by assistive technologies there must be for a particular use of a web technology in order for it to be classified as accessibility supported. (See [Level of Assistive Technology Support Needed for "Accessibility Support"](https://www.w3.org/WAI/WCAG21/Understanding/conformance#support-level).)

Note 2

Web technologies can be used in ways that are not accessibility supported as long as they are not [relied upon](#dfn-relied-upon) and the page as a whole meets the conformance requirements, including [Conformance Requirement 4](https://www.w3.org/TR/WCAG22/#cc4) and [Conformance Requirement 5](https://www.w3.org/TR/WCAG22/#cc5).

Note 3

When a [web technology](#dfn-technology) is used in a way that is "accessibility supported," it does not imply that the entire technology or all uses of the technology are supported. Most technologies, including HTML, lack support for at least one feature or use. Pages conform to WCAG only if the uses of the technology that are accessibility supported can be relied upon to meet WCAG requirements.

Note 4

When citing web content technologies that have multiple versions, the version(s) supported should be specified.

Note 5

One way for authors to locate uses of a technology that are accessibility supported would be to consult compilations of uses that are documented to be accessibility supported. (See [Understanding Accessibility-Supported Web Technology Uses](https://www.w3.org/WAI/WCAG21/Understanding/conformance#documented-lists).) Authors, companies, technology vendors, or others may document accessibility-supported ways of using web content technologies. However, all ways of using technologies in the documentation would need to meet the definition of accessibility-supported Web content technologies above.

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

conformance

satisfying all the requirements of a given standard, guideline or specification

human language

language that is spoken, written or signed (through visual or tactile means) to communicate with humans

Note

See also [sign language](#dfn-sign-language).

input error

information provided by the user that is not accepted

Note

This includes:

1.  Information that is required by the [web page](#dfn-web-page) but omitted by the user
2.  Information that is provided by the user but that falls outside the required data format or values

mechanism

[process](#dfn-process) or technique for achieving a result

Note 1

The mechanism may be explicitly provided in the content, or may be [relied upon](#dfn-relied-upon) to be provided by either the platform or by [user agents](#dfn-user-agent), including [assistive technologies](#dfn-assistive-technology).

Note 2

The mechanism needs to meet all success criteria for the conformance level claimed.

process

series of user actions where each action is required in order to complete an activity

Example 1

Successful use of a series of web pages on a shopping site requires users to view alternative products, prices and offers, select products, submit an order, provide shipping information and provide payment information.

Example 2

An account registration page requires successful completion of a [Turing test](https://www.w3.org/TR/turingtest/) before the registration form can be accessed.

**Errata:**

- Changing the example provided to avoid potential confusion

[View all errata](https://www.w3.org/WAI/WCAG22/errata/)

programmatically determined

determined by software from author-supplied data provided in a way that different [user agents](#dfn-user-agent), including [assistive technologies](#dfn-assistive-technology), can extract and present this information to users in different modalities

Example 1

Determined in a markup language from elements and attributes that are accessed directly by commonly available assistive technology.

Example 2

Determined from technology-specific data structures in a non-markup language and exposed to assistive technology via an accessibility API that is supported by commonly available assistive technology.

relied upon

the content would not [conform](#dfn-conformance) if that [technology](#dfn-technology) is turned off or is not supported

sign language

a language using combinations of movements of the hands and arms, facial expressions, or body positions to convey meaning

technology

[mechanism](#dfn-mechanism) for encoding instructions to be rendered, played or executed by [user agents](#dfn-user-agent)

Note 1

As used in these guidelines "web technology" and the word "technology" (when used alone) both refer to web content technologies.

Note 2

Web content technologies may include markup languages, data formats, or programming languages that authors may use alone or in combination to create end-user experiences that range from static web pages to synchronized media presentations to dynamic Web applications.

Example

Some common examples of web content technologies include HTML, CSS, SVG, PNG, PDF, Flash, and JavaScript.

text

sequence of characters that can be [programmatically determined](#dfn-programmatically-determined), where the sequence is expressing something in [human language](#dfn-human-language)

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

## Test Rules

The following are Test Rules for certain aspects of this Success Criterion. It is not necessary to use these particular Test Rules to check for conformance with WCAG, but they are defined and approved test methods. For information on using Test Rules, see [Understanding Test Rules for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-act-rules.html).

- [Error message describes invalid form field value](https://www.w3.org/WAI/standards-guidelines/act/rules/36b590/proposed/)

[Back to Top](#top)
