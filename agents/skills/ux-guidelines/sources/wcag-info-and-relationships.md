# Understanding [SC 1.3.1](https://w3.org/TR/WCAG22#info-and-relationships) Info and Relationships (Level A)

Source: <https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html>

Retrieved: 2026-11-09

Copyright © 2026 World Wide Web Consortium. W3C® liability, trademark and permissive license rules apply (https://www.w3.org/copyright/software-license/); WAI's permission page puts WAI material under the W3C Document License (https://www.w3.org/Consortium/Legal/copyright-documents). Copied verbatim: the page's main content, converted from HTML to Markdown, with the site's navigation, header and footer left out. Page date: Updated 09 March 2026.

---

## In Brief

Goal

Information about content structure is available to more people.

What to do

Use code to reinforce relationships and information conveyed through presentation.

Why it's important

People can adapt the presentation to suit their needs while preserving the original meaning.

## Success Criterion (SC)

Information, [structure](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html#dfn-structure), and [relationships](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html#dfn-relationships) conveyed through [presentation](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html#dfn-presentation) can be [programmatically determined](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html#dfn-programmatically-determined) or are available in text.

## Intent

The intent of this success criterion is to ensure that information and relationships that are implied by visual or auditory formatting are preserved when the presentation format changes. For example, the presentation format changes when the content is read by a screen reader or when a user style sheet is substituted for the style sheet provided by the author.

Sighted users perceive structure and relationships through various visual cues — headings are often in a larger, bold font separated from paragraphs by blank lines; list items are preceded by a bullet and perhaps indented; paragraphs are separated by a blank line; items that share a common characteristic are organized into tabular rows and columns; form fields may be positioned as groups that share text labels; a different background color may be used to indicate that several items are related to each other; words that have special status are indicated by changing the font family and /or bolding, italicizing, or underlining them; items that share a common characteristic are organized into a table where the relationship of cells sharing the same row or column and the relationship of each cell to its row and/or column header are necessary for understanding; and so on. Having these structures and these relationships programmatically determined or available in text ensures that information important for comprehension will be perceivable to all.

Auditory cues may be used as well. For example, a chime might indicate the beginning of a new section; a change in voice pitch or speech rate may be used to emphasize important information or to indicate quoted text; etc.

When such relationships are perceivable to one set of users, those relationships can be made to be perceivable to all. One method of determining whether or not information has been properly provided to all users is to access the information serially in different modalities.

If links to glossary items are implemented using anchor elements (or the proper link element for the technology in use) and identified using a different font face, a screen reader user will hear that the item is a link when the glossary term is encountered even though they may not receive information about the change in font face. An on-line catalog may indicate prices using a larger font colored red. A screen reader or person who cannot perceive red, still has the information about the price as long as it is preceded by the currency symbol.

Some technologies do not provide a means to programmatically determine some types of information and relationships. In that case then there should be a text description of the information and relationships. For instance, "all required fields are marked with an asterisk (\*)". The text description should be near the information it is describing (when the page is linearized), such as in the parent element or in the adjacent element.

There may also be cases where it may be a judgment call as to whether the relationships should be programmatically determined or be presented in text. However, when technologies support programmatic relationships, it is strongly encouraged that information and relationships be programmatically determined rather than described in text.

Note

It is not required that color values be programmatically determined. The information conveyed by color cannot be adequately presented simply by exposing the value. Therefore, [Success Criterion 1.4.1 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color) addresses the specific case of color, rather than Success Criterion 1.3.1 Info and Relationships.

## Benefits

- This success criterion helps people with different disabilities by allowing user agents to adapt content according to the needs of individual users.
- Users who are blind (using a screen reader) benefit when information conveyed through color is also available in text (including text alternatives for images that use color to convey information).
- Users who are deaf-blind using braille (text) refreshable displays may be unable to access color-dependent information.

## Examples

A form with required fields

A form contains several required fields. The labels for the required fields are displayed in red. In addition, at the end of each label is an asterisk character, \*. The instructions for completing the form indicate that "all required fields are displayed in red and marked with an asterisk \*", followed by an example.

A form that uses color and text to indicate required fields

A form contains both required and optional fields. Instructions at the top of the form explain that required fields are labeled with red text and also with an icon whose text alternative says, "Required." Both the red text and the icon are programmatically associated with the appropriate form fields so that assistive technology users can determine the required fields.

A bus schedule table where the headers for each cell can be programmatically determined

A bus schedule consists of a table with the bus stops listed vertically in the first column and the different buses listed horizontally across the first row. Each cell contains the time when the bus will be at that bus stop. The bus stop and bus cells are identified as headers for their corresponding row or column so that assistive technology can programmatically determine which bus and which bus stop are associated with the time in each cell.

A form where the labels for the checkboxes can be programmatically determined

In a form, the labels for each checkbox can be programmatically determined by assistive technology.

A text document

A simple text document is formatted with double blank lines before titles, asterisks to indicate list items and other standard formatting conventions so that its structure can be programmatically determined.

## Related Resources

Resources are for information purposes only, no endorsement implied.

- [WebAIM: Semantic Structure](http://webaim.org/techniques/semanticstructure/)
- [Heading Tags](http://accessibility.psu.edu/headingshtml/)

## Techniques

Each item in this section represents a technique or combination of techniques that the Accessibility Guidelines Working Group deems sufficient for meeting this success criterion. A technique may go beyond the minimum requirement of the criterion. There may be other ways of meeting the criterion not covered by these techniques. For information on using other techniques, see [Understanding Techniques for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-techniques), particularly the "Other Techniques" section.

### Sufficient Techniques

Select the situation below that matches your content. Each situation includes techniques or combinations of techniques that are known and documented to be sufficient for that situation.

#### Situation A: The technology provides semantic structure to make information and relationships conveyed through presentation programmatically determinable:

- [ARIA11: Using ARIA landmarks to identify regions of a page](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA11)
- [H101: Using semantic HTML elements to identify regions of a page](https://www.w3.org/WAI/WCAG22/Techniques/html/H101)
- [ARIA12: Using role=heading to identify headings](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA12)
- [ARIA13: Using aria-labelledby to name regions and landmarks](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA13)
- [ARIA16: Using aria-labelledby to provide a name for user interface controls](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA16)
- [ARIA17: Using grouping roles to identify related form controls](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA17)
- [ARIA20: Using the region role to identify a region of the page](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA20)
- [G115: Using semantic elements to mark up structure](https://www.w3.org/WAI/WCAG22/Techniques/general/G115) **AND** [H49: Using semantic markup to mark emphasized or special text](https://www.w3.org/WAI/WCAG22/Techniques/html/H49)
- [G117: Using text to convey information that is conveyed by variations in presentation of text](https://www.w3.org/WAI/WCAG22/Techniques/general/G117)
- [G140: Separating information and structure from presentation to enable different presentations](https://www.w3.org/WAI/WCAG22/Techniques/general/G140)
- [ARIA24: Semantically identifying a font icon with role="img"](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA24)
- Making information and relationships conveyed through presentation programmatically determinable using the following techniques:
  - [ARIA26: Using aria-current to identify the current item in a set](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA26)
  - [G138: Using semantic markup whenever color cues are used](https://www.w3.org/WAI/WCAG22/Techniques/general/G138)
  - [H51: Using table markup to present tabular information](https://www.w3.org/WAI/WCAG22/Techniques/html/H51)
  - [PDF6: Using table elements for table markup in PDF Documents](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF6)
  - [PDF20: Using Adobe Acrobat Pro's Table Editor to repair mistagged tables](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF20)
  - [H39: Using caption elements to associate data table captions with data tables](https://www.w3.org/WAI/WCAG22/Techniques/html/H39)
  - [H63: Using the scope attribute to associate header cells with data cells in data tables](https://www.w3.org/WAI/WCAG22/Techniques/html/H63)
  - [H43: Using id and headers attributes to associate data cells with header cells in data tables](https://www.w3.org/WAI/WCAG22/Techniques/html/H43)
  - [H44: Using label elements to associate text labels with form controls](https://www.w3.org/WAI/WCAG22/Techniques/html/H44)
  - [H65: Using the title attribute to identify form controls when the label element cannot be used](https://www.w3.org/WAI/WCAG22/Techniques/html/H65)
  - [PDF10: Providing labels for interactive form controls in PDF documents](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF10)
  - [PDF12: Providing name, role, value information for form fields in PDF documents](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF12)
  - [H71: Providing a description for groups of form controls using fieldset and legend elements](https://www.w3.org/WAI/WCAG22/Techniques/html/H71)
  - [H85: Using optgroup to group option elements inside a select](https://www.w3.org/WAI/WCAG22/Techniques/html/H85)
  - [H48: Using ol, ul and dl for lists or groups of links](https://www.w3.org/WAI/WCAG22/Techniques/html/H48)
  - [H42: Using h1-h6 to identify headings](https://www.w3.org/WAI/WCAG22/Techniques/html/H42)
  - [PDF9: Providing headings by marking content with heading tags in PDF documents](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF9)
  - [PDF11: Providing links and link text using the Link annotation and the /Link structure element in PDF documents](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF11)
  - [PDF17: Specifying consistent page numbering for PDF documents](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF17)
  - [PDF21: Using List tags for lists in PDF documents](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF21)
  - [H97: Grouping related links using the nav element](https://www.w3.org/WAI/WCAG22/Techniques/html/H97)

#### Situation B: The technology in use does NOT provide the semantic structure to make the information and relationships conveyed through presentation programmatically determinable:

- [G117: Using text to convey information that is conveyed by variations in presentation of text](https://www.w3.org/WAI/WCAG22/Techniques/general/G117)
- Making information and relationships conveyed through presentation programmatically determinable or available in text using the following techniques:
  - [T1: Using standard text formatting conventions for paragraphs](https://www.w3.org/WAI/WCAG22/Techniques/text/T1)
  - [T2: Using standard text formatting conventions for lists](https://www.w3.org/WAI/WCAG22/Techniques/text/T2)
  - [T3: Using standard text formatting conventions for headings](https://www.w3.org/WAI/WCAG22/Techniques/text/T3)

### Advisory Techniques

Although not required for conformance, the following additional techniques should be considered in order to make content more accessible. Not all techniques can be used or would be effective in all situations.

- [C22: Using CSS to control visual presentation of text](https://www.w3.org/WAI/WCAG22/Techniques/css/C22)
- [G162: Positioning labels to maximize predictability of relationships](https://www.w3.org/WAI/WCAG22/Techniques/general/G162)
- [ARIA1: Using the aria-describedby property to provide a descriptive label for user interface controls](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA1)
- [ARIA2: Identifying a required field with the aria-required property](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA2)
- [G141: Organizing a page using headings](https://www.w3.org/WAI/WCAG22/Techniques/general/G141)

### Failures

The following are common mistakes that are considered failures of this success criterion by the Accessibility Guidelines Working Group.

- [F2: Failure of Success Criterion 1.3.1 due to using changes in text presentation to convey information without using the appropriate markup or text](https://www.w3.org/WAI/WCAG22/Techniques/failures/F2)
- [F33: Failure of Success Criterion 1.3.1 and 1.3.2 due to using white space characters to create multiple columns in plain text content](https://www.w3.org/WAI/WCAG22/Techniques/failures/F33)
- [F34: Failure of Success Criterion 1.3.1 and 1.3.2 due to using white space characters to format tables in plain text content](https://www.w3.org/WAI/WCAG22/Techniques/failures/F34)
- [F42: Failure of Success Criteria 1.3.1, 2.1.1, 2.1.3, or 4.1.2 when emulating links](https://www.w3.org/WAI/WCAG22/Techniques/failures/F42)
- [F43: Failure of Success Criterion 1.3.1 due to using structural markup in a way that does not represent relationships in the content](https://www.w3.org/WAI/WCAG22/Techniques/failures/F43)
- [F46: Failure of Success Criterion 1.3.1 due to using th elements, … layout tables](https://www.w3.org/WAI/WCAG22/Techniques/failures/F46)
- [F48: Failure of Success Criterion 1.3.1 due to using the pre element to markup tabular information](https://www.w3.org/WAI/WCAG22/Techniques/failures/F48)
- [F90: Failure of Success Criterion 1.3.1 for incorrectly associating table headers and content via the headers and id attributes](https://www.w3.org/WAI/WCAG22/Techniques/failures/F90)
- [F91: Failure of Success Criterion 1.3.1 for not correctly marking up table headers](https://www.w3.org/WAI/WCAG22/Techniques/failures/F91)
- [F92: Failure of Success Criterion 1.3.1 due to the use of role presentation on content which conveys semantic information](https://www.w3.org/WAI/WCAG22/Techniques/failures/F92)
- [F111: Failure of Success Criteria 1.3.1, 2.5.3, and 4.1.2 due to a control with visible label text but no accessible name](https://www.w3.org/WAI/WCAG22/Techniques/failures/F111)

## Key Terms

assistive technology

hardware and/or software that acts as a [user agent](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html#dfn-user-agent), or along with a mainstream user agent, to provide functionality to meet the requirements of users with disabilities that go beyond those offered by mainstream user agents

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

information and sensory experience to be communicated to the user by means of a [user agent](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html#dfn-user-agent), including code or markup that defines the content's [structure](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html#dfn-structure), [presentation](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html#dfn-presentation), and interactions

presentation

rendering of the [content](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html#dfn-content) in a form to be perceived by users

programmatically determined

determined by software from author-supplied data provided in a way that different [user agents](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html#dfn-user-agent), including [assistive technologies](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html#dfn-assistive-technology), can extract and present this information to users in different modalities

Example 1

Determined in a markup language from elements and attributes that are accessed directly by commonly available assistive technology.

Example 2

Determined from technology-specific data structures in a non-markup language and exposed to assistive technology via an accessibility API that is supported by commonly available assistive technology.

relationships

meaningful associations between distinct pieces of content

structure

- The way the parts of a [web page](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html#dfn-web-page) are organized in relation to each other; and
- The way a collection of [web pages](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html#dfn-web-page) is organized

user agent

any software that retrieves and presents web content for users

Example

Web browsers, media players, plug-ins, and other programs — including [assistive technologies](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html#dfn-assistive-technology) — that help in retrieving, rendering, and interacting with web content.

web page

a non-embedded resource obtained from a single URI using HTTP plus any other resources that are used in the rendering or intended to be rendered together with it by a [user agent](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html#dfn-user-agent)

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

- [ARIA attribute is defined in WAI-ARIA](https://www.w3.org/WAI/standards-guidelines/act/rules/5f99a7/)
- [ARIA state or property has valid value](https://www.w3.org/WAI/standards-guidelines/act/rules/6a7281/)
- [Element with role attribute has required states and properties](https://www.w3.org/WAI/standards-guidelines/act/rules/4e8ab6/)
- [Form field has non-empty accessible name](https://www.w3.org/WAI/standards-guidelines/act/rules/e086e5/)
- [Headers attribute specified on a cell refers to cells in the same table element](https://www.w3.org/WAI/standards-guidelines/act/rules/a25f45/)
- [Role attribute has valid value](https://www.w3.org/WAI/standards-guidelines/act/rules/674b10/)
- [ARIA global properties not used where prohibited](https://www.w3.org/WAI/standards-guidelines/act/rules/kb1m8s/proposed/)
- [ARIA required context role](https://www.w3.org/WAI/standards-guidelines/act/rules/ff89c9/proposed/)
- [ARIA required ID references exist](https://www.w3.org/WAI/standards-guidelines/act/rules/in6db8/proposed/)
- [ARIA required owned elements](https://www.w3.org/WAI/standards-guidelines/act/rules/bc4a75/proposed/)
- [ARIA state or property is permitted](https://www.w3.org/WAI/standards-guidelines/act/rules/5c01ea/proposed/)
- [Audio and visuals of video element have transcript](https://www.w3.org/WAI/standards-guidelines/act/rules/1a02b0/proposed/)
- [Table header cell has assigned cells](https://www.w3.org/WAI/standards-guidelines/act/rules/d0f69e/proposed/)
- [Video element visual-only content has transcript](https://www.w3.org/WAI/standards-guidelines/act/rules/ee13b5/proposed/)

[Back to Top](#top)
