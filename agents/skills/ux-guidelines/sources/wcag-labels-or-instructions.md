# Understanding [SC 3.3.2](https://w3.org/TR/WCAG22#labels-or-instructions) Labels or Instructions (Level A)

Source: <https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html>

Retrieved: 2026-11-06

Copyright © 2026 World Wide Web Consortium. W3C® liability, trademark and permissive license rules apply (https://www.w3.org/copyright/software-license/); WAI's permission page puts WAI material under the W3C Document License (https://www.w3.org/Consortium/Legal/copyright-documents). Copied verbatim: the page's main content, converted from HTML to Markdown, with the site's navigation, header and footer left out. Page date: Updated 02 November 2026.

---

## In Brief

Goal

Users know what information to enter.

What to do

Provide labels or instructions for inputs.

Why it's important

Everyone, especially those with cognitive disabilities, will know how to respond.

## Success Criterion (SC)

[Labels](#dfn-label) or instructions are provided when content requires user input.

## Intent

The intent of this success criterion is to have content authors present instructions or labels to identify the purpose of fields and controls that expect user input, so that users will know what sort of value or input to provide. Commonly, labels or instructions will be necessary to help users understand how to fill out the input fields of a form.

Despite colloquially being referred to as "form fields", these inputs and controls are not limited to use within a form. They are often used in web pages to allow a user to create or manipulate content. Labels, instructions, or both will commonly be needed for these controls to help ensure users understand their purpose and the expected values they will need to enter or adjust to use the controls efficiently while mitigating errors.

In the case of radio buttons, checkboxes, comboboxes, or similar controls that provide users with choices, each choice will need a label so that users know what they might be selecting. In some cases, the labels of these controls (choices) may be enough to indicate the purpose of the parent control (such as a select-only combobox), or grouping of controls (like groupings of radios or checkboxes). In such instances a visible label for the parent control or grouping might not be necessary. However, when the labels for the choices are do not adequately convey the purpose of the parent control or grouping, authors do need to provide an overarching label, legend or instructions.

Beyond identifying the purpose of a field or control, instructions or labels may specify the necessary format(s) for data entry, especially if they are out of the customary formats or if there are specific rules for correct input. Content authors can choose to make such instructions available to users only when the individual control has focus, or they can provide a means to display or link to the instructions, especially for when they are long and verbose.

The intent of this success criterion is not to clutter the page with unnecessary information but to provide important cues and instructions that will benefit people with disabilities. Too much information or instruction can be just as harmful as too little. Rather, the goal is to ensure enough information is provided for the user to accomplish the task without undue confusion or navigation.

When labels or instructions are provided, they need to be persistently available to users. In many cases, the best way to do this is to make them visually persistent as part of the UI. However, sometimes labels or instructions are better suited to the interface when they are made available on request. For instance, within the context of a toolbar, a select-only combobox's label may only be available on hover or focus of the control. Or, a form field with verbose instructions may provide those instructions by using a button to invoke them as necessary.

Note that the majority of form control labels are text-based. Using images as labels meets the requirements of the criterion, but care should be taken to ensure that the images are widely understood by the intended target audience. Authors may consider providing additional hints, such as text-based tooltips or supplementary text, to support clarity when using image-based labels.

This success criterion does not require that labels or instructions be correctly marked up, identified, or associated with their respective controls — that aspect is covered separately by [1.3.1 Info and Relationships](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships). It is possible for content to pass this success criterion (providing relevant labels and instructions) while failing Success Criterion 1.3.1 (if the labels or instructions aren't correctly marked up, identified, or associated).

Further, this success criterion does not take into consideration whether or not alternative methods of providing an accessible name or description for form controls and inputs has been used — that aspect is covered separately by [4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value). It is possible for controls and inputs to have an appropriate accessible name or description (for example, using `aria-label="..."`) and therefore pass Success Criterion 4.1.2 Name, Role, Value, but to still fail this success criterion (because the labels or instructions are not presented to all users, but only to those using assistive technologies). Additionally, it can be possible to pass this success criterion by providing a visible label, but fail Success Criterion 2.5.3 Label in Name, if the visible text label is not included in the accessible name of the control.

This success criterion does not apply to links or other controls (such as an expand/collapse widget, or similar interactive components) that are not associated with data entry.

While this success criterion requires that form fields and controls have labels or instructions, whether or not labels (if used) are accurate, sufficiently clear, or descriptive is covered separately by [2.4.6 Headings and Labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels).

Note

The use of "requires" in this criterion's normative wording does not mean that the criterion only applies to _required_ form fields. It is used here as a synonym for "accepts", "expects", or "allows". The criterion applies to all form fields, whether they're required or optional.

## Benefits

- Providing labels and instructions (including examples of expected data formats) helps all users — but particularly those with cognitive, language, and learning disabilities — to enter information correctly.
- Providing labels and instructions (including identification of required fields) can prevent users from making incomplete or incorrect form submissions, which prevents users from having to navigate once more through a page/form in order to fix submission errors.
- Providing labels can help users identify the expected accessible name of a control, so that it may be accessed more efficiently by voice commands.

## Examples

- A text field which asks the user to enter the two character abbreviation for a U.S. state has a link next to it which will open another window with an alphabetized list of state names and the correct abbreviation – meaning that the instructions are available, but on a separate page.
- A single form field for entering a date has text instructions to indicate the expected format for the date (such as `dd/mm/yyyy` or `mm/dd/yyyy`).
- A website has specific rules about what characters can be used to create a username. Additional instructions need to accompany the field to prevent users from encountering unnecessary errors.
- A website provides a global search field in the header of the site. Any term can be entered, so there are no instructions needed, but the field needs a cue to communicate its purpose. Commonly, such search field will be paired with a "loupe" or "magnify glass" search icon, serving as its visible label, if not also doubling as the visual identifier for the button that submits the search query.
- To enter their name, users are provided with two separate text fields. Rather than having a single label "Name" (which would appear to leave the second text field unlabelled), each field is given an explicit label — "Given Name" and "Family Name".
- A rich text editor presents two select-only comboboxes to allow a user to choose the font family and font size of the text they are editing. Each of the combobox options are accurately labeled. The comboboxes are given accessible names ("font family" and "font size", respectively). The context of being part of the rich text editor's toolbar, as well as the clear option labels allow a user to determine the purpose of the controls, without the need for persistently visible combobox labels.
- A U.S. phone number separates the area code, exchange, and number into three fields. There is only one overarching "Phone number" label. Parentheses surround the area code field, and a dash separates the exchange and number fields. The punctuation provides visual clues/labels for each of the three fields (at least to those familiar with the U.S. telephone number format), so no additional visible labels are required. The three fields are grouped in a `<fieldset>`, with the overarching "Phone number" label marked up as a `<legend>`. In order to satisfy the requirements of [Success Criterion 4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value), the three fields have been given an accessible name (for instance, using `aria-label`) – respectively, "Area Code", "Exchange", and "Number".
- A website presents a form as a series of individual pages (a wizard) rather than on one large page. All pages in the wizard are introduced by a heading. A few pages contain only a single form field. For these pages the form field is not given its own distinct label, as the heading is enough to indicate the purpose and expected value the user is to enter. For instance, a page with the heading of "Email address" is sufficient in indicating the purpose of the single form field present on the page.
- A shopping site presents users with a list of products; each product has a quantity input field with a plus/minus control. Even though the input itself lacks an explicit "Quantity" text label, the visual context serves as the label by conveying the input field's purpose.
- A chat interface has a single text input field, followed by a "paper plane in flight" icon button to send the message. The purpose of the input is clear from a combination of the graphical label (signifying a submit action) and the context (a chat interface), without requiring a visible "Message" label. A placeholder hint, when visible, can further enhance understanding.

## Techniques

Each item in this section represents a technique or combination of techniques that the Accessibility Guidelines Working Group deems sufficient for meeting this success criterion. A technique may go beyond the minimum requirement of the criterion. There may be other ways of meeting the criterion not covered by these techniques. For information on using other techniques, see [Understanding Techniques for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-techniques), particularly the "Other Techniques" section.

### Sufficient Techniques

- [G131: Providing descriptive labels](https://www.w3.org/WAI/WCAG22/Techniques/general/G131) **AND** one of the following techniques:
  - [ARIA1: Using the aria-describedby property to provide a descriptive label for user interface controls](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA1)
  - [ARIA9: Using aria-labelledby to concatenate a label from several text nodes](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA9)
  - [ARIA17: Using grouping roles to identify related form controls](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA17)
  - [G89: Providing expected data format and example](https://www.w3.org/WAI/WCAG22/Techniques/general/G89)
  - [G184: Providing text instructions at the beginning of a form or set of fields that describes the necessary input](https://www.w3.org/WAI/WCAG22/Techniques/general/G184)
  - [G162: Positioning labels to maximize predictability of relationships](https://www.w3.org/WAI/WCAG22/Techniques/general/G162)
  - [G83: Providing text descriptions to identify required fields that were not completed](https://www.w3.org/WAI/WCAG22/Techniques/general/G83)
  - [H90: Indicating required form controls using label or legend](https://www.w3.org/WAI/WCAG22/Techniques/html/H90)
  - [PDF5: Indicating required form controls in PDF forms](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF5)

- [H44: Using label elements to associate text labels with form controls](https://www.w3.org/WAI/WCAG22/Techniques/html/H44)
- [PDF10: Providing labels for interactive form controls in PDF documents](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF10)
- [H71: Providing a description for groups of form controls using fieldset and legend elements](https://www.w3.org/WAI/WCAG22/Techniques/html/H71)
- [G167: Using an adjacent button to label the purpose of a field](https://www.w3.org/WAI/WCAG22/Techniques/general/G167)

Note

The techniques at the end of the above list should be considered "last resort" and only used when the other techniques cannot be applied to the page. The earlier techniques are preferred because they increase accessibility to a wider user group.

### Advisory Techniques

Although not required for conformance, the following additional techniques should be considered in order to make content more accessible. Not all techniques can be used or would be effective in all situations.

- [G13: Describing what will happen before a change to a form control that causes a change of context to occur is made](https://www.w3.org/WAI/WCAG22/Techniques/general/G13)
- [ARIA2: Identifying a required field with the aria-required property](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA2)

### Failures

The following are common mistakes that are considered failures of this success criterion by the Accessibility Guidelines Working Group.

- [F82: Failure of Success Criterion 3.3.2 by visually formatting a set of phone number fields but not including a text label](https://www.w3.org/WAI/WCAG22/Techniques/failures/F82)

## Key Terms

ASCII art

picture created by a spatial arrangement of characters or glyphs (typically from the 95 printable characters defined by ASCII)

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

content

information and sensory experience to be communicated to the user by means of a [user agent](#dfn-user-agent), including code or markup that defines the content's [structure](#dfn-structure), [presentation](#dfn-presentation), and interactions

human language

language that is spoken, written or signed (through visual or tactile means) to communicate with humans

Note

See also [sign language](#dfn-sign-language).

label

[text](#dfn-text) or other component with a [text alternative](#dfn-text-alternative) that is presented to a user to identify a component within web [content](#dfn-content)

Note 1

A label is presented to all users whereas the [name](#dfn-name) may be hidden and only exposed by assistive technology. In many (but not all) cases the name and the label are the same.

Note 2

The term label is not limited to the label element in HTML.

name

text by which software can identify a component within web content to the user

Note 1

The name may be hidden and only exposed by assistive technology, whereas a [label](#dfn-label) is presented to all users. In many (but not all) cases, the label and the name are the same.

Note 2

This is unrelated to the name attribute in HTML.

non-text content

any content that is not a sequence of characters that can be [programmatically determined](#dfn-programmatically-determined) or where the sequence is not expressing something in [human language](#dfn-human-language)

Note

This includes [ASCII art](#dfn-ascii-art) (which is a pattern of characters), emoticons, leetspeak (which uses character substitution), and images representing text

presentation

rendering of the [content](#dfn-content) in a form to be perceived by users

programmatically determined

determined by software from author-supplied data provided in a way that different [user agents](#dfn-user-agent), including [assistive technologies](#dfn-assistive-technology), can extract and present this information to users in different modalities

Example 1

Determined in a markup language from elements and attributes that are accessed directly by commonly available assistive technology.

Example 2

Determined from technology-specific data structures in a non-markup language and exposed to assistive technology via an accessibility API that is supported by commonly available assistive technology.

sign language

a language using combinations of movements of the hands and arms, facial expressions, or body positions to convey meaning

structure

- The way the parts of a [web page](#dfn-web-page) are organized in relation to each other; and
- The way a collection of [web pages](#dfn-web-page) is organized

text

sequence of characters that can be [programmatically determined](#dfn-programmatically-determined), where the sequence is expressing something in [human language](#dfn-human-language)

text alternative

[Text](#dfn-text) that is programmatically associated with [non-text content](#dfn-non-text-content) or referred to from text that is programmatically associated with non-text content. Programmatically associated text is text whose location can be [programmatically determined](#dfn-programmatically-determined) from the non-text content.

Example

An image of a chart is described in text in the paragraph after the chart. The short text alternative for the chart indicates that a description follows.

Note

Refer to [Understanding Text Alternatives](https://www.w3.org/WAI/WCAG21/Understanding/conformance#text-alternatives) for more information.

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
