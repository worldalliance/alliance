# Understanding [SC 1.3.5](https://w3.org/TR/WCAG22#identify-input-purpose) Identify Input Purpose (Level AA)

Source: <https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html>

Retrieved: 2026-11-09

Copyright © 2026 World Wide Web Consortium. W3C® liability, trademark and permissive license rules apply (https://www.w3.org/copyright/software-license/); WAI's permission page puts WAI material under the W3C Document License (https://www.w3.org/Consortium/Legal/copyright-documents). Copied verbatim: the page's main content, converted from HTML to Markdown, with the site's navigation, header and footer left out. Page date: Updated 08 September 2026.

---

## In Brief

Goal

It is easier to fill out forms.

What to do

Use code to indicate the purpose of common inputs, where technology allows.

Why it's important

Some people with cognitive disabilities may not understand the input's purpose from the label alone.

## Success Criterion (SC)

The purpose of each input field collecting information about the user can be [programmatically determined](https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html#dfn-programmatically-determined) when:

- The input field serves a purpose identified in the [Input Purposes for user interface components section](https://www.w3.org/TR/WCAG22/#input-purposes); and
- The content is implemented using technologies with support for identifying the expected meaning for form input data.

## Intent

The intent of this success criterion is to ensure that the purpose of a form input collecting information about the user can be programmatically determined, so that user agents can extract and present this purpose to users using different modalities. The ability to programmatically declare the specific kind of data expected in a particular field makes filling out forms easier, especially for people with certain cognitive disabilities.

Appropriate visible labels and instruction can help users understand the purpose of form input fields, but users may benefit from having fields that collect specific types of information be rendered in an unambiguous, consistent, and possibly customized way for different modalities - either through defaults in their user agent, or through the aid of assistive technologies.

For some input fields, the `type` attribute already offers a way to broadly specify the intention of the input field, for example, `<input type="tel">`, `<input type="email">`, or `<input type="password">`. However, these are only very broad categories, describing the type of input, but not necessarily its purpose, especially as it relates to user-specific input fields. As an example, `type="email"` indicates that the field is for an email address but does not clarify if the purpose is for entering the user's email address or some other person's email.

This success criterion defines the types of user interface component input purposes, found in [Section 7 of the WCAG 2.1 Recommendation](https://www.w3.org/TR/WCAG22/#input-purposes), that must be programmatically identifiable. When these user input purposes are present, and if the technology supports doing so, the field purpose must be programmatically identifiable.

The list of [Input Purposes for User Interface Components](https://www.w3.org/TR/WCAG22/#input-purposes) borrows from the [HTML specification's autofill definitions](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill), but conceptually the listed purposes apply to other technologies.

The HTML `autocomplete` attribute only accepts a certain number of specific well-defined fixed values. This allows a more fine-grained definition or identification of purpose than the type attribute, for example, by allowing the author to specify a specific type of name: Name (`autocomplete="name"`), Given Name (`autocomplete="given-name"`), Family Name (`autocomplete="family-name"`), as well as Username (`autocomplete="username"`), and Nickname (`autocomplete="nickname"`).

By adopting and repurposing this predefined taxonomy of definitions, user agents and assistive technologies can now present the purpose of the inputs to users in different modalities. For example, assistive technologies may display familiar icons next to input fields to help users who have difficulties reading. An icon of a birthday cake may be shown in front of an input field with `autocomplete="bday"`, or the icon of a telephone in front of an input field with `autocomplete="tel"`.

In addition to repurposing this taxonomy, when the `autocomplete` attribute technique is used to meet this success criterion for HTML content, browsers and other user agents can suggest and 'autofill' the right content by autocompleting these fields based on past user input stored in the browser. By defining more granular definitions of common input purposes, for example “Birthday” (`autocomplete="bday"`), browsers can store personalized values for each of these fields (the user's birthday date). The user is relieved of having to type the information and can instead confirm or, if needed, change the value of the field, a significant benefit for users with memory issues, dyslexia, and other disabilities. Because the `autocomplete` values are independent of language, users that may not be familiar with the text used to visually identify user input fields (the label) can still have that purpose consistently identified to them due to the fixed taxonomy of terms.

Whether or not user agents actually autofill inputs is _not_ relevant when evaluating this criterion. What matters is whether or not the inputs programmatically expose their purpose. Conversely, user agents may use heuristics, rather than programmatically determined purposes, to autofill inputs – this is _not_ sufficient to meet the requirements of this criterion.

If an input field accepts two different types of input purpose (as in combined user name/user email fields) and the technology used does not allow multiple purpose values to be defined, it is valid to provide either one or the other value or leave out the designation of input purpose altogether.

When the user agent and assistive technology support for other metadata formats matures, metadata schemes like the [WAI-Adapt: Symbols Module](https://www.w3.org/TR/adapt-symbols/) may be used in addition or instead of the HTML autocomplete attribute to identify the purpose of input fields. They can also support automated adaptations that identify and match author-provided input labels to defined vocabularies or symbols that are used instead for labelling inputs.

Note

This success criterion is specifically scoped to inputs collecting _information about the user_. The list of [Input Purposes](https://www.w3.org/TR/WCAG22/#input-purposes) includes a few values that may not strictly be interpreted as directly relating to a user – most prominently, `transaction-amount`. An input field for information that is not _about the user_ does not need to programmatically expose its purpose, even if that purpose is included in the [Input Purposes](https://www.w3.org/TR/WCAG22/#input-purposes) list.

Note

The term input is used here as a generic way to refer to form controls that accept user input. For instance, in HTML, it is not limited to the `<input>` element, but also covers other controls such as `<textarea>` and `<select>`.

Note

In some instances, authors may want to prevent user agents from autofilling form fields. However, in order to meet the requirements of this criterion, input purposes still need to be programmatically determinable. For HTML, there are methods to turn off autocomplete/autofill behavior in browsers at form level, while still allowing for an explicit purpose to be specified for inputs – for example, see [MDN: How to turn off form autocompletion](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Turning_off_form_autocompletion)

## Benefits

- People with language and memory related disabilities or disabilities that affects executive function and decision-making benefit from the browser auto-filling personal information (such as name or address) when the autocomplete attribute is used to meet this Success Criterion, which means information does not need to be remembered by the user.
- People with cerebral palsy, stroke, head injury, motor neuron disease or learning disability sometimes prefer images for communication. They can employ assistive technology which adds icons to input fields to communicate the purpose of the fields visually.
- People with motor impairments also benefit from reducing the need for manual input when filling out forms.

## Examples

A contact form

A contact form explicitly identifies the purpose for its various fields: name, street, post code, city, telephone number and email address. This makes it possible for the user's browser to then autofill the fields with previously stored values. Assistive technologies can offer a customized way of identifying particular input fields, for example showing a set of symbols / icons that is familiar to the user, in order to communicate the purpose of the fields visually.

An order form with separate billing and shipping address

A product order form explicitly identifies the address fields for the billing address and a separate set of address fields for the shipping address, using the HTML `autocomplete` detail tokens 'billing' and 'shipping'

## Related Resources

Resources are for information purposes only, no endorsement implied.

- [COGA Gap Analysis Table 3: Entering Data, Error Prevention, & Recovery](https://www.w3.org/TR/coga-gap-analysis/#table3)
- [MDN: How to turn off form autocompletion](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Turning_off_form_autocompletion) while keeping `autocomplete` attributes on form fields

## Techniques

Each item in this section represents a technique or combination of techniques that the Accessibility Guidelines Working Group deems sufficient for meeting this success criterion. A technique may go beyond the minimum requirement of the criterion. There may be other ways of meeting the criterion not covered by these techniques. For information on using other techniques, see [Understanding Techniques for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-techniques), particularly the "Other Techniques" section.

### Sufficient Techniques

- [H98: Using HTML autocomplete attributes](https://www.w3.org/WAI/WCAG22/Techniques/html/H98)

### Failures

The following are common mistakes that are considered failures of this success criterion by the Accessibility Guidelines Working Group.

- [F107: Failure of Success Criterion 1.3.5 due to incorrect autocomplete attribute values](https://www.w3.org/WAI/WCAG22/Techniques/failures/F107)

## Key Terms

assistive technology

hardware and/or software that acts as a [user agent](https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html#dfn-user-agent), or along with a mainstream user agent, to provide functionality to meet the requirements of users with disabilities that go beyond those offered by mainstream user agents

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

programmatically determined

determined by software from author-supplied data provided in a way that different [user agents](https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html#dfn-user-agent), including [assistive technologies](https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html#dfn-assistive-technology), can extract and present this information to users in different modalities

Example 1

Determined in a markup language from elements and attributes that are accessed directly by commonly available assistive technology.

Example 2

Determined from technology-specific data structures in a non-markup language and exposed to assistive technology via an accessibility API that is supported by commonly available assistive technology.

user agent

any software that retrieves and presents web content for users

Example

Web browsers, media players, plug-ins, and other programs — including [assistive technologies](https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html#dfn-assistive-technology) — that help in retrieving, rendering, and interacting with web content.

## Test Rules

The following are Test Rules for certain aspects of this Success Criterion. It is not necessary to use these particular Test Rules to check for conformance with WCAG, but they are defined and approved test methods. For information on using Test Rules, see [Understanding Test Rules for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-act-rules.html).

- [Autocomplete attribute has valid value](https://www.w3.org/WAI/standards-guidelines/act/rules/73f2c2/)

[Back to Top](#top)
