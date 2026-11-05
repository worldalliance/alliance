# Understanding [SC 2.5.3](https://w3.org/TR/WCAG22#label-in-name) Label in Name (Level A)

Source: <https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html>

Retrieved: 2026-11-06

Copyright © 2026 World Wide Web Consortium. W3C® liability, trademark and permissive license rules apply (https://www.w3.org/copyright/software-license/); WAI's permission page puts WAI material under the W3C Document License (https://www.w3.org/Consortium/Legal/copyright-documents). Copied verbatim: the page's main content, converted from HTML to Markdown, with the site's navigation, header and footer left out. Page date: Updated 04 October 2026.

---

## In Brief

Goal

The visual label for controls is a trigger for speech activation.

What to do

Where practical, make the control’s text label and name match.

Why it's important

People who operate with voice interaction use the visible labels in their commands.

## Success Criterion (SC)

For [user interface components](#dfn-user-interface-component) with [labels](#dfn-label) that include [text](#dfn-text) or [images of text](#dfn-image-of-text), the [name](#dfn-name) contains the text that is presented visually.

Note

A best practice is to have the text of the label at the start of the name.

## Intent

The intent of this success criterion is to ensure that the words which visually label a component are also the words associated with the component programmatically. This helps ensure that people with disabilities can rely on visible labels as a means to interact with the components.

Most controls are accompanied by a visible text **label**. Those same controls have a programmatic **name**, also known as the [accessible name](https://www.w3.org/TR/accname/#dfn-accessible-name). Users typically have a much better experience if the words and characters in the visible label of a control match or are contained within the accessible name. When these match, speech-input users (i.e., users of speech recognition applications) can navigate by speaking the visible text labels of components, such as menus, links, and buttons, that appear on the screen. Sighted users who use text-to-speech (e.g., screen readers) will also have a better experience if the text they hear matches the text they see on the screen.

Note that where a visible text label does not exist for a component, this success criterion does not apply to that component.

Where text labels exist and are properly linked to the user interface components through established authoring practices, the label and name will normally match. When they don't match, speech-input users who attempt to use the visible text label as a means of navigation or selection (e.g., "move to Password") will be unsuccessful. The speech-based navigation fails because the visible label spoken by the users does not match (or is not part of) the accessible name that is enabled as a speech-input command. In addition, when the accessible name is different from the visible label, it may function as a hidden command that can be accidentally activated by speech-input users.

Mismatches between visible labels and programmatic names for controls are even more of an issue for speech-input and text-to-speech users who also have cognitive challenges. Mismatches create an extra cognitive load for speech-input users, who must remember to say a speech command that is different from the visible label they see on a control. It also creates extra cognitive load for a text-to-speech user to absorb and understand speech output that does not match the visible label.

Note that when a [user interface component](#dfn-user-interface-component) lacks an [accessible name](https://www.w3.org/TR/accname/#dfn-accessible-name) — a failure of [4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value) — and has a visible text label, then it also fails this success criterion.

### Identifying label text for components

In order for the label text and accessible name to be matched, it is first necessary to determine which text on the screen should be considered a label for any given control. There are often multiple text strings in a user interface that may be relevant to a control. However, there are reasons why it is best to conservatively interpret the label as being only the text in close proximity.

Conventionally the label for user interface components is the adjacent text string. The typical positioning for left to right languages is:

- immediately to the left of comboboxes, dropdown lists, text inputs, and other widgets (or in the absence of left-side labels, immediately above and aligned with the left edge of each input)
- immediately to the right of checkboxes and radio buttons
- inside buttons and tabs or immediately below icons serving as buttons

The rationale for some of these conventions is explained in [G162: Positioning labels to maximize predictability of relationships](https://www.w3.org/WAI/WCAG22/Techniques/general/G162).

It is important to bias towards treating only the adjacent text as a label because liberal interpretations of what constitutes a text label can jeopardize the value of this success criterion (SC) by lessening predictability. Isolating the label to the single string in close proximity to the component makes it easier for developers, testers, and end users to identify the label targeted for evaluation in this SC. Predictable interpretation of labeling allows users of speech recognition technologies to interact with the element via its conventionally positioned label, and allows users of screen reading technologies to enjoy consistency between the nearby visible label and the announced name of the component.

Note that placeholder text within an input field is not considered an appropriate means of providing a label. The [HTML Standard](https://html.spec.whatwg.org/multipage/input.html#the-placeholder-attribute) states The placeholder attribute should not be used as an alternative to a `label`. However, it is worth noting that "label" in that statement is in code brackets and links to the `label` element. For the purposes of this Label in Name Success Criterion, "label" is not used in such a programmatic sense but is simply referring to a text string in close visual proximity to a component. As such, in the absence of any other nearby text string (as described in the preceding list), if an input contains placeholder text, such text may be a candidate for Label in Name. This is supported both through the accessible name calculation (discussed later) and from the practical sense that where a visible label is not otherwise provided, it is likely that a speech-input user may attempt to use the placeholder text value as a means of interacting with the input.

### Text labels "express something in human language"

#### Symbolic text characters

For the purposes of this SC, text should not be considered a visible label if it is used in a symbolic manner, rather than directly expressing something in human language as per the definition of [text](#dfn-text) in WCAG. For example, [1.4.5 Images of Text](https://www.w3.org/WAI/WCAG22/Understanding/images-of-text) describes considerations for "symbolic text characters." In the images of text example "B", "I", and "ABC" appear on icons in a text editor, where they are meant to symbolize the functions for Bold, Italics, and Spelling, respectively. In such a case, the accessible name should be the function the button serves (e.g., "Spell check" or "Check spelling"), not the visible symbolic characters. A similar text editor is shown in the figure below.

![Icons for transforming text, including heading, bold, italic, quote, code, and link, along with icons for ordered and unordered lists and other controls](https://www.w3.org/WAI/WCAG22/Understanding/img/2.5.3-rich-text-editor-detail.png)

Figure 1. A detail of the rich text editor in Github, showing a variety of unlabeled icons, including icons resembling text characters.

Likewise, where an author has used a greater-than symbol (">") to mimic the appearance of the right-facing arrow, the text does not convey something in human language. It is a symbol, in this scenario likely meant to mimic the icons used for a "Play" button or a "Next" arrow.

#### Punctuation and capitalization

This criterion is primarily aimed at users of speech recognition / voice control. Capitalization (upper- or lowercase) and most punctuation are generally ignored when a user speaks a label as a means of interacting with a control. For this reason, differences in capitalization and punctuation are not relevant when evaluating this criterion.

In the following example, while it is certainly not an error to include the colon and capitalization in the accessible name, a computed name of "first name" is considered equivalent to "First Name:" and passes the requirements of this criterion.

![](https://www.w3.org/WAI/WCAG22/Understanding/img/2.5.3-punctuation-capitalisation-firstname.png)

Figure 2. A text input with a label of "First Name:" above it.

```html
<p>First Name:</p>
<input type="text" … aria-label="first name" />
```

Likewise, in the following example, while the visible label for the button is "Next…", having "Next" as the accessible name passes.

![](https://www.w3.org/WAI/WCAG22/Understanding/img/2.5.3-punctuation-capitalisation-next.png)

Figure 3. A large button labelled "Next…".

```html
<button … aria-label="Next">Next…</button>
```

Note

There are situations where capitalization can impact meaning – for instance, where the use of uppercase letters indicates an abbreviation. While in the context of speech recognition / voice control this won't matter, the difference may be relevant for screen reader users. While normatively this success criterion is "case-insensitive", it's still a good idea for authors to match the case/capitalization of the visible label and the accessible name in these cases.

#### Mathematical expressions and formulae

Mathematical expressions are an exception to the previous subsection about symbolic characters. Math symbols can be used as labels; for example "A>B" and "11×3=33" and convey meaning.

![](https://www.w3.org/WAI/WCAG22/Understanding/img/2.5.3-mathematical.png)

Figure 4. Two radio buttons – the first labelled "A>B", the second labelled "11×3=33".

The label should not be overwritten in the accessible name, and substitutions of words where a formula is used should be avoided since there are multiple ways to express the same equation. For example, making the name "eleven multiplied by three is equivalent to thirty-three" might mean a user who said "eleven times three equals thirty-three" may not match. It is best to leave the formulas as used in the label and count on the user's familiarity with their speech software to achieve a match. Further, converting a mathematical formula label into an accessible name that is a spelled-out equivalent may create issues for translation. The name should match the label's formula text. Note that a consideration for authors is to use the proper symbol in the formula. For instance `11x3` (with a lower or upper case letter "X"), `11*3` (with the asterisk symbol), and `11×3` (with the `&times;` symbol) are all easy for sighted users to interpret as meaning the same formula, but may not all be matched to "11 times 3" by speech recognition / voice control software. The proper operator symbol (in this case the `&times;` symbol) should be used.

### Accessible Name and Description Computation specification

It is important to understand how the accessible name is derived. The [Accessible Name and Description Computation 1.1](https://www.w3.org/TR/accname-1.1/) and the [HTML Accessibility API Mappings 1.0](https://w3c.github.io/html-aam/#accessible-name-and-description-computation) describe how the accessible name is computed, including which attributes are considered in its calculation, and in what order of preference. If a component has multiple possible attribute values that could be used for its accessible name, only the most preferred of those values will be computed. None of the other, less preferred values will be part of the name. For the most part, existing established programmatic relationships between labels and controls are reinforced by the specification.

Other text displayed on the screen that is correctly coded to meet [1.3.1 Info and Relationships](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships) is **not** normally factored into the calculation for the accessible name of a UI component without author intervention (via ARIA labeling techniques). The most common of these are:

- headings and instructions
- group labels for sets of components (i.e., used with `legend`/`fieldset` or with role of `group` or `radiogroup`)

Such textual information may constitute part of the component's _description_. So from both a programmatic viewpoint, and from the conservative tactic of only considering a label to be "adjacent text," neither headings, instructions, nor group 'labels' should normally be considered **labels** for the purpose of this success criterion.

It is important to note that the specification allows authors to override the name calculated through native semantics. Both `aria-label` and `aria-labelledby` take precedence in the name calculation, overriding the visible text as the accessible name even when the visible text label is programmatically associated with the control. For this reason, when a visible label already exists, `aria-label` should be avoided or used carefully, and `aria-labelledby` should be used as a supplement with care.

Finally, `aria-describedby` is not included in the Accessible Name computation (instead it is part of the Accessible Description computation). By convention, text associated with a control through `aria-describedby` is announced immediately after the accessible name by screen readers. Therefore, the context of headings, instructions, and group labels can be provided through the accessible description to assist users of screen readers without affecting the experience of those who navigate using speech recognition software.

#### Text in parentheses

Note: The term "parenthetical" in this section is describing text that literally appears within a set of round brackets (). It is not used in the more abstract sense of "information related to".

It is important to mention parenthetical text in labels in the context of accessible name versus description. In common usage, text in parentheses is considered secondary but relevant to meaning. Users of speech recognition would not typically announce text in parentheses as part of the input name. For that reason, parenthetical text may be optionally considered a description and left out of the accessible name.

However, where parenthetical information provides important context, such as indication of a required field or limitations on what is allowed for input, this information must be provided programmatically in some other way to the user if that information is not included as part of the accessible name. For example, "Name (required)" and "Date (YYYY-MM-DD)" could accept "Name" and "Date" as the accessible names. However, in order to pass [1.3.1 Info and Relationships](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships), authors would need to programmatically surface both the required state and the limit on the allowed data formatting (in this example, eight integers fitting the YYYY-MM-DD pattern). The "required" state could be surfaced through the HTML `required` attribute or by using `aria-required="true"`. The allowed data formatting could be surfaced by being referenced using the `aria-describedby` attribute.

## Benefits

- Speech-input users can directly activate controls on a page with fewer surprising changes of focus.
- Text-to-speech users will have a better experience because the labels that they hear match the visible text labels that they see on the screen.

## Examples

- **Accessible name matches visible label:** The accessible name and visible label of a control match.
- **Accessible name starts with visible label:** The accessible name "Search for a value" begins with the text of the visible label, "Search".

## Related Resources

Resources are for information purposes only, no endorsement implied.

- [Accessible Name and Description Computation](https://www.w3.org/TR/accname-aam-1.1/)
- [Accessible Name and Description Computation in HTML Accessibility API Mappings 1.0](https://www.w3.org/TR/html-aam-1.0/#accessible-name-and-description-computation)

## Techniques

Each item in this section represents a technique or combination of techniques that the Accessibility Guidelines Working Group deems sufficient for meeting this success criterion. A technique may go beyond the minimum requirement of the criterion. There may be other ways of meeting the criterion not covered by these techniques. For information on using other techniques, see [Understanding Techniques for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-techniques), particularly the "Other Techniques" section.

### Sufficient Techniques

- [G208: Including the text of the visible label as part of the accessible name](https://www.w3.org/WAI/WCAG22/Techniques/general/G208)
- [G211: Matching the accessible name to the visible label](https://www.w3.org/WAI/WCAG22/Techniques/general/G211)

### Advisory Techniques

Although not required for conformance, the following additional techniques should be considered in order to make content more accessible. Not all techniques can be used or would be effective in all situations.

- [G162: Positioning labels to maximize predictability of relationships](https://www.w3.org/WAI/WCAG22/Techniques/general/G162)
- If an icon has no accompanying text, consider using its hover text as its accessible name (Potential future technique)

### Failures

The following are common mistakes that are considered failures of this success criterion by the Accessibility Guidelines Working Group.

- [F96: Failure due to the accessible name not containing the visible label text](https://www.w3.org/WAI/WCAG22/Techniques/failures/F96)
- [F111: Failure of Success Criteria 1.3.1, 2.5.3, and 4.1.2 due to a control with visible label text but no accessible name](https://www.w3.org/WAI/WCAG22/Techniques/failures/F111)
- Accessible name contains the visible label text, but the words of the visible label are not in the same order as they are in the visible label text (Potential future technique)
- Accessible name contains the visible label text, but one or more other words are interspersed in the label (Potential future technique)

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

image of text

text that has been rendered in a non-text form (e.g., an image) in order to achieve a particular visual effect

Note

This does not include text that is part of a picture that contains significant other visual content.

Example

A person's name on a nametag in a photograph.

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

## Test Rules

The following are Test Rules for certain aspects of this Success Criterion. It is not necessary to use these particular Test Rules to check for conformance with WCAG, but they are defined and approved test methods. For information on using Test Rules, see [Understanding Test Rules for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-act-rules.html).

- [Form field has non-empty accessible name](https://www.w3.org/WAI/standards-guidelines/act/rules/e086e5/)
- [Visible label is part of accessible name](https://www.w3.org/WAI/standards-guidelines/act/rules/2ee8b8/proposed/)

[Back to Top](#top)
