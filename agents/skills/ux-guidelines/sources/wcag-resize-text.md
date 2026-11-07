# Understanding [SC 1.4.4](https://w3.org/TR/WCAG22#resize-text) Resize Text (Level AA)

Source: <https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html>

Retrieved: 2026-11-06

Copyright © 2026 World Wide Web Consortium. W3C® liability, trademark and permissive license rules apply (https://www.w3.org/copyright/software-license/); WAI's permission page puts WAI material under the W3C Document License (https://www.w3.org/Consortium/Legal/copyright-documents). Copied verbatim: the page's main content, converted from HTML to Markdown, with the site's navigation, header and footer left out. Page date: Updated 06 September 2026.

---

## In Brief

Goal

Text can be enlarged.

What to do

Ensure text can be doubled in size.

Why it's important

Some people can only read text when it is bigger.

## Success Criterion (SC)

Except for [captions](#dfn-captions) and [images of text](#dfn-image-of-text), [text](#dfn-text) can be resized without [assistive technology](#dfn-assistive-technology) up to 200 percent without loss of content or functionality.

## Intent

The intent of this success criterion is to ensure that visually rendered text, including controls and labels using text, can be made larger so that it can be read more easily by people with milder visual impairments, without requiring the use of assistive technology (such as a screen magnifier). Users may benefit from scaling all content on the web page, but text is most critical.

The scaling of content is primarily a user agent responsibility. User agents that satisfy [UAAG 1.0 Checkpoint 4.1](https://www.w3.org/TR/WAI-USERAGENT/guidelines.html#tech-configure-text-scale) allow users to configure text scale through a number of mechanisms - including zoom (of the entire page's content), magnification, text-only resizing, and allowing the user to configure a size for rendered text. The author's responsibility is to create web content that does not prevent the user agent from scaling the content effectively. Authors may satisfy this success criterion by verifying that content does not interfere with user agent support for resizing text, including text-based controls, or by providing direct support for resizing text or changing the layout. An example of direct support might be via server-side script that can be used to assign different style sheets.

Content satisfies the success criterion if it can be scaled up to 200% using at least one text scaling mechanism supported by user agents.

If the author is using a technology whose user agents do not provide support for specific text scaling mechanisms, the author is responsible for providing this type of functionality directly, or providing content that works with the type of functionality provided by the user agent. For instance, if the user agent doesn't provide full-page zoom functionality, but does let the user change the text size, the author is responsible for ensuring that the content remains usable when the text is resized.

Some user interface components that function as a label and require activation by the user to access content are not wide enough to accommodate the label's content. For example, in web mail applications the subject column may not be wide enough to accommodate every possible subject header, but activating the subject header takes the user to the full message with the full subject header. In Web-based spreadsheets, cell content that is too long to be displayed in a column can be truncated, and the full content of the cell is available to the user when the cell receives focus. The content of a user interface component may also become too wide in user interfaces where the user can resize the column width. In this type of user interface component, line wrapping is not required; truncation is acceptable if the component's full content is available on focus or after user activation and an indication that this information can be accessed, is provided to the user in some way besides the fact that it is truncated.

Content satisfies the success criterion if it can be scaled up to 200% - that is, up to twice the width and height. Authors may support scaling beyond that limit, however, as scaling becomes more extreme, adaptive layouts may introduce usability problems. For example, words may be too wide to fit into the horizontal space available to them, causing them to be truncated; layout constraints may cause text to overlap with other content when it is scaled larger; or only one word of a sentence may fit on each line, causing the sentence to be displayed as a vertical column of text that is difficult to read.

If the resizing mechanism (whether it's provided by the user agent, or implemented by the author) offers incremental resizing steps between 100% and 200%, authors must ensure that there is no loss of content or functionality at these incremental steps.

The working group feels that 200% is a reasonable accommodation that can support a wide range of designs and layouts, and complements older screen magnifiers that provide a minimum magnification of 200%. Above 200%, zoom (which resizes text, images, and layout regions and creates a larger canvas that may require both horizontal and vertical scrolling) may be more effective than text resizing. Assistive technology dedicated to zoom support would usually be used in such a situation, and may provide better accessibility than attempts by the author to support the user directly.

Note

Images of text do not scale as well as text because they tend to pixelate, and therefore we suggest using text wherever possible. It is also harder to change foreground and background contrast and color combinations for images of text, which are necessary for some users. See also [Success Criterion 1.4.5 Images of Text](#images-of-text).

Note

The criterion does not apply to content or interface elements controlled by the user agent or platform.

For instance, in most browsers, the `title` attribute on an element causes a tooltip to appear when the element is hovered with the mouse. Another example is that activating an `<input type="file">` to upload a file will open the platform's file browser. In both these examples, the size of the text is determined by the browser or platform, rather than the content author, and is therefore not covered by the criterion.

Note

As with most other success criteria, this criterion applies to each variation of the page that is automatically presented for various screen sizes (e.g. media query variations in a responsive site). In an implementation where text does not consistently increase its size as people zoom in (such as when it is transformed based on a media query to adapt to small-screen usage), it must still be possible to get to 200% enlargement in order to satisfy the criterion.

For example, if at the default browser setting of 100% zoom, text is set at 20px when the window is 1280 CSS pixels wide, at 200% zoom it will visually appear at twice the size. After zooming by 400% the page reflows to fit within the 320 CSS pixel viewport, the author may decide to set the page's text size to 10px. The text is now half the original size in CSS pixels, but as it has been enlarged to 400%, it is still displayed at twice the size compared to the default browser setting at 100% zoom. It is not required to achieve 200% text enlargement while remaining inside a specific breakpoint (as zooming may result in the variation for a new breakpoint becoming active), but it should still be possible to get 200% text enlargement in some way compared to the default 100% zoom.

See also [1.4.8 Visual Presentation](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation).

## Benefits

- This success criterion helps people with low vision by letting them increase text size in content so that they can read it.

## Examples

- A user with vision impairments increases the text size on a web page in a browser from 1 em to 1.2 ems. While the user could not read the text at the smaller size, they can read the larger text. All the information on the page is still displayed when the larger font is used for the text.
- A web page contains a control for changing the scale of the page. Selecting different settings changes the layout of the page to use the best design for that scale.
- A user changes the scale of the content with the browser's full-page zoom function. All the content scales uniformly, and the browser provides scroll bars, if necessary.

## Related Resources

Resources are for information purposes only, no endorsement implied.

- [CSS 2 Box Model](https://www.w3.org/TR/CSS2/box.html)
- [CSS 2 Visual formatting Model](https://www.w3.org/TR/CSS2/visuren.html)
- [CSS 2 Visual formatting Model Details](https://www.w3.org/TR/CSS2/visudet.html)
- [Accessible CSS](https://cookiecrook.com/AIR/2003/train/accessiblecss.php)

## Techniques

Each item in this section represents a technique or combination of techniques that the Accessibility Guidelines Working Group deems sufficient for meeting this success criterion. A technique may go beyond the minimum requirement of the criterion. There may be other ways of meeting the criterion not covered by these techniques. For information on using other techniques, see [Understanding Techniques for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-techniques), particularly the "Other Techniques" section.

### Sufficient Techniques

- [G142: Using a technology that has commonly-available user agents that support zoom](https://www.w3.org/WAI/WCAG22/Techniques/general/G142)
- Ensuring that text containers resize when the text resizes **AND** using measurements that are relative to other measurements in the content by using one or more of the following techniques:
  - [C28: Specifying the size of text containers using em units](https://www.w3.org/WAI/WCAG22/Techniques/css/C28)
  - Techniques for relative measurements:
    - [C12: Using percent for font sizes](https://www.w3.org/WAI/WCAG22/Techniques/css/C12)
    - [C13: Using named font sizes](https://www.w3.org/WAI/WCAG22/Techniques/css/C13)
    - [C14: Using em units for font sizes](https://www.w3.org/WAI/WCAG22/Techniques/css/C14)

  - Techniques for text container resizing:
    - [SCR34: Calculating size and position in a way that scales with text size](https://www.w3.org/WAI/WCAG22/Techniques/client-side-script/SCR34)
    - [G146: Using liquid layout](https://www.w3.org/WAI/WCAG22/Techniques/general/G146)

- [G178: Providing controls on the web page that allow users to incrementally change the size of all text on the page up to 200 percent](https://www.w3.org/WAI/WCAG22/Techniques/general/G178)
- [G179: Ensuring that there is no loss of content or functionality when the text resizes and text containers do not change their width](https://www.w3.org/WAI/WCAG22/Techniques/general/G179)

### Advisory Techniques

Although not required for conformance, the following additional techniques should be considered in order to make content more accessible. Not all techniques can be used or would be effective in all situations.

- [C17: Scaling form elements which contain text](https://www.w3.org/WAI/WCAG22/Techniques/css/C17)
- [C20: Using relative measurements to set column widths so that lines can average 80 characters or less when the browser is resized](https://www.w3.org/WAI/WCAG22/Techniques/css/C20)
- [C22: Using CSS to control visual presentation of text](https://www.w3.org/WAI/WCAG22/Techniques/css/C22)

### Failures

The following are common mistakes that are considered failures of this success criterion by the Accessibility Guidelines Working Group.

- [F69: Failure of Success Criterion 1.4.4 when resizing visually rendered text up to 200 percent causes the text, image or controls to be clipped, truncated or obscured](https://www.w3.org/WAI/WCAG22/Techniques/failures/F69)
- [F80: Failure of Success Criterion 1.4.4 when text-based form controls do not resize when visually rendered text is resized up to 200%](https://www.w3.org/WAI/WCAG22/Techniques/failures/F80)
- [F94: Failure of Success Criterion 1.4.4 due to incorrect use of viewport units to resize text](https://www.w3.org/WAI/WCAG22/Techniques/failures/F94)

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

audio

the technology of sound reproduction

Note

Audio can be created synthetically (including speech synthesis), recorded from real world sounds, or both.

audio description

narration added to the soundtrack to describe important visual details that cannot be understood from the main soundtrack alone

Note 1

Audio description of [video](#dfn-video) provides information about actions, characters, scene changes, on-screen text, and other visual content.

Note 2

In standard audio description, narration is added during existing pauses in dialogue. (See also [extended audio description](#dfn-extended-audio-description).)

Note 3

Where all of the [video](#dfn-video) information is already provided in existing [audio](#dfn-audio), no additional audio description is necessary.

Note 4

Also called "video description" and "descriptive narration."

captions

synchronized visual and/or [text alternative](#dfn-text-alternative) for both speech and non-speech audio information needed to understand the media content

Note 1

Captions are similar to dialogue-only subtitles except captions convey not only the content of spoken dialogue, but also equivalents for non-dialogue audio information needed to understand the program content, including sound effects, music, laughter, speaker identification and location.

Note 2

Closed Captions are equivalents that can be turned on and off with some players.

Note 3

Open Captions are any captions that cannot be turned off. For example, if the captions are visual equivalent [images of text](#dfn-image-of-text) embedded in [video](#dfn-video).

Note 4

Captions should not obscure or obstruct relevant information in the video.

Note 5

In some countries, captions are called subtitles.

Note 6

[Audio descriptions](#dfn-audio-description) can be, but do not need to be, captioned since they are descriptions of information that is already presented visually.

extended audio description

audio description that is added to an audiovisual presentation by pausing the [video](#dfn-video) so that there is time to add additional description

Note

This technique is only used when the sense of the [video](#dfn-video) would be lost without the additional [audio description](#dfn-audio-description) and the pauses between dialogue/narration are too short.

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

non-text content

any content that is not a sequence of characters that can be [programmatically determined](#dfn-programmatically-determined) or where the sequence is not expressing something in [human language](#dfn-human-language)

Note

This includes [ASCII art](#dfn-ascii-art) (which is a pattern of characters), emoticons, leetspeak (which uses character substitution), and images representing text

programmatically determined

determined by software from author-supplied data provided in a way that different [user agents](#dfn-user-agent), including [assistive technologies](#dfn-assistive-technology), can extract and present this information to users in different modalities

Example 1

Determined in a markup language from elements and attributes that are accessed directly by commonly available assistive technology.

Example 2

Determined from technology-specific data structures in a non-markup language and exposed to assistive technology via an accessibility API that is supported by commonly available assistive technology.

sign language

a language using combinations of movements of the hands and arms, facial expressions, or body positions to convey meaning

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

video

the technology of moving or sequenced pictures or images

Note

Video can be made up of animated or photographic images, or both.

## Test Rules

The following are Test Rules for certain aspects of this Success Criterion. It is not necessary to use these particular Test Rules to check for conformance with WCAG, but they are defined and approved test methods. For information on using Test Rules, see [Understanding Test Rules for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-act-rules.html).

- [Meta viewport allows for zoom](https://www.w3.org/WAI/standards-guidelines/act/rules/b4f0c3/)
- [Zoomed text node is not clipped with CSS overflow](https://www.w3.org/WAI/standards-guidelines/act/rules/59br37/proposed/)

[Back to Top](#top)
