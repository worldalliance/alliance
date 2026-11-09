# Understanding [SC 1.2.2](https://w3.org/TR/WCAG22#captions-prerecorded) Captions (Prerecorded) (Level A)

Source: <https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html>

Retrieved: 2026-11-06

Copyright © 2026 World Wide Web Consortium. W3C® liability, trademark and permissive license rules apply (https://www.w3.org/copyright/software-license/); WAI's permission page puts WAI material under the W3C Document License (https://www.w3.org/Consortium/Legal/copyright-documents). Copied verbatim: the page's main content, converted from HTML to Markdown, with the site's navigation, header and footer left out. Page date: Updated 10 August 2026.

---

## In Brief

Goal

Videos can be played with captions.

What to do

Provide synchronized text for audio content in existing videos.

Why it's important

People who are deaf or hard of hearing can understand audio in videos.

## Success Criterion (SC)

[Captions](#dfn-captions) are provided for all [prerecorded](#dfn-prerecorded) [audio](#dfn-audio) content in [synchronized media](#dfn-synchronized-media), except when the media is a [media alternative for text](#dfn-media-alternative-for-text) and is clearly labeled as such.

## Intent

The intent of this success criterion is to enable people who are deaf or hard of hearing to watch synchronized media presentations. Captions provide the part of the content available via the audio track. Captions not only include dialogue, but identify who is speaking and include non-speech information conveyed through sound, including meaningful sound effects.

It is acknowledged that at the present time there may be difficulty in creating captions for time-sensitive material and this may result in the author being faced with the choice of delaying the information until captions are available, or publishing time-sensitive content that is inaccessible to the deaf, at least for the interval until captions are available. Over time, the tools for captioning as well as building the captioning into the delivery process can shorten or eliminate such delays.

Captions are not needed when the synchronized media is, itself, an alternate presentation of information that is also presented via text on the web page. For example, if information on a page is accompanied by a synchronized media presentation that presents no more information than is already presented in text, but is easier for people with cognitive, language, or learning disabilities to understand, then it would not need to be captioned since the information is already presented on the page in text or in text alternatives (e.g., for images).

See also [1.2.4 Captions (Live)](https://www.w3.org/WAI/WCAG22/Understanding/captions-live).

## Benefits

- People who are deaf or have a hearing loss can access the auditory information in the synchronized media content through captions.

## Examples

- **A captioned tutorial**

  A video clip shows how to tie a knot. The captions read,

  "(music)

  Using rope to tie knots was an important skill

  for the likes of sailors, soldiers and woodsmen."

  From Sample Transcript Formatting by Whit Anderson.

- A complex legal document contains synchronized media clips for different paragraphs that show a person speaking the contents of the paragraph. Each clip is associated with its corresponding paragraph. No captions are provided for the synchronized media.
- An instruction manual containing a description of a part and its necessary orientation is accompanied by a synchronized media clip showing the part in its correct orientation. No captions are provided for the synchronized media clip.
- An orchestra provides captions for videos of performances. In addition to capturing dialog and lyrics verbatim, captions identify non-vocal music by title, movement, composer, and any information that will help the user comprehend the nature of the audio. For instance captions read,

  "\[Orchestral Suite No. 3.2 in D major, BWV 1068, Air\]

  \[Johann Sebastian Bach, Composer\]

  ♪ Calm melody with a slow tempo ♪"

  Note

  Style guides for captions may differ among different languages.

## Related Resources

Resources are for information purposes only, no endorsement implied.

### Guides to Captioning

- [Captions/Subtitles](https://www.w3.org/WAI/media/av/captions/), in [Making Audio and Video Media Accessible](https://www.w3.org/WAI/media/av/), W3C Web Accessibility Initiative (WAI)
- [BBC: Subtitle Guidelines](https://www.bbc.co.uk/accessibility/forproducts/guides/subtitles/)
- [Captioning Key: Guidelines and Preferred Techniques](https://dcmp.org/learn/captioningkey)
- [Best Practices in Online Captioning](https://joeclark.org/access/captioning/bpoc/)

### SMIL Resources

- [Synchronized Multimedia Integration Language (SMIL) 3.0](https://www.w3.org/TR/SMIL/)
- [Accessibility Features of SMIL](https://www.w3.org/TR/SMIL-access/)

### Other Captioning Resources

- [National Center for Accessible Media](https://www.wgbh.org/foundation/what-we-do/ncam)
- [WebAIM: Captioning Resource List](https://webaim.org/techniques/captions/)

## Techniques

Each item in this section represents a technique or combination of techniques that the Accessibility Guidelines Working Group deems sufficient for meeting this success criterion. A technique may go beyond the minimum requirement of the criterion. There may be other ways of meeting the criterion not covered by these techniques. For information on using other techniques, see [Understanding Techniques for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-techniques), particularly the "Other Techniques" section.

### Sufficient Techniques

- [G93: Providing open (always visible) captions](https://www.w3.org/WAI/WCAG22/Techniques/general/G93)
- [G87: Providing closed captions](https://www.w3.org/WAI/WCAG22/Techniques/general/G87) using any of the following techniques:
  - [SM11: Providing captions through synchronized text streams in SMIL 1.0](https://www.w3.org/WAI/WCAG22/Techniques/smil/SM11)
  - [SM12: Providing captions through synchronized text streams in SMIL 2.0](https://www.w3.org/WAI/WCAG22/Techniques/smil/SM12)
  - [H95: Using the track element to provide captions](https://www.w3.org/WAI/WCAG22/Techniques/html/H95)
  - Using any readily available media format that has a video player that supports closed captioning

### Failures

The following are common mistakes that are considered failures of this success criterion by the Accessibility Guidelines Working Group.

- [F8: Failure of Success Criterion 1.2.2 due to captions omitting some dialogue or important sound effects](https://www.w3.org/WAI/WCAG22/Techniques/failures/F8)
- [F75: Failure of Success Criterion 1.2.2 by providing synchronized media without captions when the synchronized media presents more information than is presented on the page](https://www.w3.org/WAI/WCAG22/Techniques/failures/F75)
- [F74: Failure of Success Criterion 1.2.2 and 1.2.8 due to not labeling a synchronized media alternative to text as an alternative](https://www.w3.org/WAI/WCAG22/Techniques/failures/F74)

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

live

information captured from a real-world event and transmitted to the receiver with no more than a broadcast delay

Note 1

A broadcast delay is a short (usually automated) delay, for example used in order to give the broadcaster time to cue or censor the audio (or video) feed, but not sufficient to allow significant editing.

Note 2

If information is completely computer generated, it is not live.

media alternative for text

media that presents no more information than is already presented in text (directly or via text alternatives)

Note

A media alternative for text is provided for those who benefit from alternate representations of text. Media alternatives for text may be audio-only, video-only (including sign-language video), or audio-video.

non-text content

any content that is not a sequence of characters that can be [programmatically determined](#dfn-programmatically-determined) or where the sequence is not expressing something in [human language](#dfn-human-language)

Note

This includes [ASCII art](#dfn-ascii-art) (which is a pattern of characters), emoticons, leetspeak (which uses character substitution), and images representing text

prerecorded

information that is not [live](#dfn-live)

programmatically determined

determined by software from author-supplied data provided in a way that different [user agents](#dfn-user-agent), including [assistive technologies](#dfn-assistive-technology), can extract and present this information to users in different modalities

Example 1

Determined in a markup language from elements and attributes that are accessed directly by commonly available assistive technology.

Example 2

Determined from technology-specific data structures in a non-markup language and exposed to assistive technology via an accessibility API that is supported by commonly available assistive technology.

sign language

a language using combinations of movements of the hands and arms, facial expressions, or body positions to convey meaning

synchronized media

[audio](#dfn-audio) or [video](#dfn-video) synchronized with another format for presenting information and/or with time-based interactive components, unless the media is a [media alternative for text](#dfn-media-alternative-for-text) that is clearly labeled as such

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

- [Video element auditory content has accessible alternative](https://www.w3.org/WAI/standards-guidelines/act/rules/eac66b/proposed/)

[Back to Top](#top)
