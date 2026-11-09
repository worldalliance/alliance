# Understanding [SC 1.1.1](https://w3.org/TR/WCAG22#non-text-content) Non-text Content (Level A)

Source: <https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html>

Retrieved: 2026-11-06

Copyright © 2026 World Wide Web Consortium. W3C® liability, trademark and permissive license rules apply (https://www.w3.org/copyright/software-license/); WAI's permission page puts WAI material under the W3C Document License (https://www.w3.org/Consortium/Legal/copyright-documents). Copied verbatim: the page's main content, converted from HTML to Markdown, with the site's navigation, header and footer left out. Page date: Updated 06 September 2026.

---

## In Brief

Goal

Non-text information is available to more people.

What to do

Create a text alternative for visual and auditory content.

Why it's important

People who can’t fully see or hear content can understand it.

## Success Criterion (SC)

All [non-text content](#dfn-non-text-content) that is presented to the user has a [text alternative](#dfn-text-alternative) that serves the equivalent purpose, except for the situations listed below.

Controls, Input

If non-text content is a control or accepts user input, then it has a [name](#dfn-name) that describes its purpose. (Refer to [Success Criterion 4.1.2](https://www.w3.org/TR/WCAG22/#name-role-value) for additional requirements for controls and content that accepts user input.)

Time-Based Media

If non-text content is time-based media, then text alternatives at least provide descriptive identification of the non-text content. (Refer to [Guideline 1.2](https://www.w3.org/TR/WCAG22/#time-based-media) for additional requirements for media.)

Test

If non-text content is a test or exercise that would be invalid if presented in [text](#dfn-text), then text alternatives at least provide descriptive identification of the non-text content.

Sensory

If non-text content is primarily intended to create a [specific sensory experience](#dfn-specific-sensory-experience), then text alternatives at least provide descriptive identification of the non-text content.

[CAPTCHA](#dfn-captcha)

If the purpose of non-text content is to confirm that content is being accessed by a person rather than a computer, then text alternatives that identify and describe the purpose of the non-text content are provided, and alternative forms of CAPTCHA using output modes for different types of sensory perception are provided to accommodate different disabilities.

Decoration, Formatting, Invisible

If non-text content is [pure decoration](#dfn-pure-decoration), is used only for visual formatting, or is not presented to users, then it is implemented in a way that it can be ignored by [assistive technology](#dfn-assistive-technology).

## Intent

The intent of this success criterion is to make information conveyed by non-text content accessible through the use of a text alternative. Text alternatives are a primary way for making information accessible because they can be rendered through any sensory modality (for example, visual, auditory or tactile) to match the needs of the user. Providing text alternatives allows the information to be rendered in a variety of ways by a variety of user agents. For example, people who cannot see a picture can have the text alternative read aloud using synthesized speech. People who cannot hear an audio file can have the text alternative displayed so that they can read it. In the future, text alternatives will also allow information to be more easily translated into sign language or into a simpler form of the same language.

### Note on CAPTCHA

CAPTCHAs are a controversial topic in the accessibility community. As is described in the paper [Inaccessibility of CAPTCHA](https://www.w3.org/TR/turingtest/), CAPTCHAs intrinsically push the edges of human abilities in an attempt to defeat automated processes. Every type of CAPTCHA will be unsolvable by users with certain disabilities. However, they are widely used, and the Web Content Accessibility Guidelines Working Group believes that if CAPTCHAs were forbidden outright, websites would choose not to conform to WCAG rather than abandon CAPTCHA. This would create barriers for a great many more users with disabilities. For this reason the Working Group has chosen to structure the requirement about CAPTCHA in a way that meets the needs of most people with disabilities, yet is also considered adoptable by sites. Requiring two different forms of CAPTCHA on a given site ensures that most people with disabilities will find a form they can use.

Because some users with disabilities will still not be able to access sites that meet the minimum requirements, the Working Group provides recommendations for additional steps. Organizations motivated to conform to WCAG should be aware of the importance of this topic and should go as far beyond the minimum requirements of the guidelines as possible. Additional recommended steps include:

- Providing more than two modalities of CAPTCHAs
- Providing access to a human customer service representative who can bypass CAPTCHA
- Not requiring CAPTCHAs for authorized users

### Note on alternatives matching the language of content

Text alternatives and equivalents should match the human language of the original content (normally the default human language of the page). The [5.2 Conformance Requirements](https://www.w3.org/TR/WCAG22/#conformance-reqs) section, through the defined terms used there, states that success criteria be met through accessibility-supported ways (5.2.4), where the technology is used “in the human language of the content.” Where an alternative version is used (5.2.1), it is defined as something that “provides all of the same information and functionality in the same human language.”

### Additional information

Non-text content can take a number of forms, and this success criterion specifies how each is to be handled.

**For non-text content that is not covered by one of the other situations listed below,** such as charts, diagrams, audio recordings, pictures, and animations, text alternatives can make the same information available in a form that can be rendered through any modality (for example, visual, auditory or tactile). Short and long text alternatives can be used as needed to convey the information in the non-text content. Note that **prerecorded audio-only** and **prerecorded video-only** files are covered here. **Live-audio-only** and **Live-video-only** files are covered below (see 3rd paragraph following this one).

**For non-text content that is a control or accepts user input** , such as images used as submit buttons, image maps or complex animations, a name is provided to describe the purpose of the non-text content so that the person at least knows what the non-text content is and why it is there.

**Non-text content that is time-based media** is made accessible through [1.2: Time-Based Media](https://www.w3.org/WAI/WCAG22/Understanding/time-based-media). However, it is important that users know what it is when they encounter it on a page so they can decide what action if any they want to take with it. A text alternative that describes the time-based media and/or gives its title is therefore provided.

**For Live Audio-only and live video-only content** , it can be much more difficult to provide text alternatives that provide equivalent information as live audio-only and live video-only content. For these types of non-text content, text alternatives provide a descriptive label.

**Sometimes a test or exercise must be partially or completely presented in non-text format.** Audio or visual information is provided that cannot be changed to text because the test or exercise must be conducted using that sense. For example, a hearing test would be invalid if a text alternative were provided. A visual skill development exercise would similarly make no sense in text form. And a spelling test with text alternatives would not be very effective. For these cases, text alternatives should be provided to describe the purpose of the non-text content; of course, the text alternatives would not provide the same information needed to pass the test.

**Sometimes content is primarily intended to create a specific sensory experience** that words cannot fully capture. Examples include a symphony performance, works of visual art etc. For such content, text alternatives at least identify the non-text content with a descriptive label and where possible, additional descriptive text. If the reason for including the content in the page is known and can be described it is helpful to include that information.

**Sometimes there are non-text exercises that are used to prove you are human.** To avoid spam robots and other software from gaining access to a site a device called a CAPTCHA is used. These usually involve visual or auditory tasks that are beyond the current capabilities of web robots. Providing a text alternative to them would however make them operable by Robots, thus defeating their purpose. In this case a text alternative would describe the purpose of the CAPTCHA, and alternate forms using different modalities would be provided to address the needs of people with different disabilities.

**Sometimes there is non-text content that really is not meant to be seen or understood by the user.** Transparent images used to move text over on a page; an invisible image that is used to track usage statistics; and a swirl in the corner that conveys no information but just fills up a blank space to create an aesthetic effect are all examples of this. Putting alternative text on such items just distracts people using screen readers from the content on the page. Not marking the content in any way, though, leaves users guessing what the non-text content is and what information they may have missed (even though they have not missed anything in reality). This type of non-text content, therefore, is marked or implemented in a way that assistive technologies (AT) will ignore it and not present anything to the user.

## Benefits

- This success criterion helps people who have difficulty perceiving visual content. Assistive technology can read text aloud, present it visually, or convert it to braille.
- Text alternatives may help some people who have difficulty understanding the meaning of photographs, drawings, and other images (e.g., line drawings, graphic designs, paintings, three-dimensional representations), graphs, charts, animations, etc.
- People who are deaf, are hard of hearing, or who are having trouble understanding audio information for any reason can read the text presentation. Research is ongoing regarding automatic translation of text into sign language.
- People who are deaf-blind can read the text in braille.
- Additionally, text alternatives support the ability to search for non-text content and to repurpose content in a variety of ways.

## Examples

A data chart

A bar chart compares how many widgets were sold in June, July, and August. The short label says, "Figure one - Sales in June, July and August." The longer description identifies the type of chart, provides a high-level summary of the data, trends and implications comparable to those available from the chart. Where possible and practical, the actual data is provided in a table.

An audio recording of a speech

The link to an audio clip says, "Chairman's speech to the assembly." A link to a text transcript is provided immediately after the link to the audio clip.

An animation that illustrates how a car engine works

An animation shows how a car engine works. There is no audio and the animation is part of a tutorial that describes how an engine works. Since the text of the tutorial already provides a full explanation, the image is an alternative for text and the text alternative includes only a brief description of the animation and refers to the tutorial text for more information.

A traffic web camera

A website allows users to select from a variety of web cameras positioned throughout a major city. After a camera is selected, the image updates every two minutes. A short text alternative identifies the web camera as "traffic web camera." The site also provides a table of travel times for each of the routes covered by the web cameras. The table is also updated every two minutes.

A photograph of a historic event in a news story

A photograph of two world leaders shaking hands accompanies a news story about an international summit meeting. The text alternative says, "President X of Country X shakes hands with Prime Minister Y of country Y."

A photograph of a historic event in content discussing diplomatic relationships

The same image is used in a different context intended to explain nuances in diplomatic encounters. The image of the president shaking hands with the prime minister appears on a website discussing intricate diplomatic relationships. The first text alternative reads, "President X of country X shakes hands with Prime Minister Y of country Y on January 2, 2009." An additional text alternative describes the room where the leaders are standing as well as the expressions on the leaders' faces, and identifies the other people in the room. The additional description might be included on the same page as the photograph or in a separate file associated with the image through a link or other standard programmatic mechanism.

An audio recording of a press conference

A web page includes a link to an audio recording of a press conference. The link text identifies the audio recording. The page also links to a text transcript of the press conference. The transcript includes a verbatim record of everything the speakers say. It identifies who is speaking as well as noting other significant sounds that are part of the recording, such as applause, laughter, questions from the audience, and so on.

An e-learning application

An e-learning application uses sound effects to indicate whether or not the answers are correct. The chime sound indicates that the answer is correct and the beep sound indicates that the answer is incorrect. A text description is also included so that people who can't hear or understand the sound understand whether the answer is correct or incorrect.

A linked thumbnail image

A thumbnail image of the front page of a newspaper links to the home page of the "Smallville Times". The text alternative says "Smallville Times".

The same image used on different sites

Different alternatives for an image of the world: An image of the world that is used on a travel site as a link to the International Travel section has the text alternative "International Travel". The same image is used as a link on a university website with the text alternative "International Campuses".

An image map

An image of a building floor plan is interactive, allowing the user to select a particular room and navigate to a page containing information about that room. The short text alternative describes the image and its interactive purpose: "Building floor plan. Select a room for more information."

## Related Resources

Resources are for information purposes only, no endorsement implied.

- [WAI Images Tutorial: Decision Tree](https://www.w3.org/WAI/tutorials/images/decision-tree/)
- [Excerpts from the NBA Tape Recording Manual, Third Edition](https://www.w3.org/2000/08/nba-manual/Overview.html)
- [Inaccessibility of CAPTCHA](https://www.w3.org/TR/turingtest/)

## Techniques

Each item in this section represents a technique or combination of techniques that the Accessibility Guidelines Working Group deems sufficient for meeting this success criterion. A technique may go beyond the minimum requirement of the criterion. There may be other ways of meeting the criterion not covered by these techniques. For information on using other techniques, see [Understanding Techniques for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-techniques), particularly the "Other Techniques" section.

### Sufficient Techniques

Select the situation below that matches your content. Each situation includes techniques or combinations of techniques that are known and documented to be sufficient for that situation.

#### Situation A: If a short description can serve the same purpose and present the same information as the non-text content:

- [G94: Providing short text alternative for non-text content that serves the same purpose and presents the same information as the non-text content](https://www.w3.org/WAI/WCAG22/Techniques/general/G94) using one of the following **[Short text alternative techniques for Situation A](#text-equiv-all-situation-a-shorttext)**

**Short text alternative techniques for Situation A**:

- [ARIA6: Using aria-label to provide labels for objects](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA6)
- [ARIA10: Using aria-labelledby to provide a text alternative for non-text content](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA10)
- [G196: Using a text alternative on one item within a group of images that describes all items in the group](https://www.w3.org/WAI/WCAG22/Techniques/general/G196)
- [H2: Combining adjacent image and text links for the same resource](https://www.w3.org/WAI/WCAG22/Techniques/html/H2)
- [H37: Using alt attributes on img elements](https://www.w3.org/WAI/WCAG22/Techniques/html/H37)
- [H53: Using the body of the object element](https://www.w3.org/WAI/WCAG22/Techniques/html/H53)
- [H86: Providing text alternatives for emojis, emoticons, ASCII art, and leetspeak](https://www.w3.org/WAI/WCAG22/Techniques/html/H86)
- [PDF1: Applying text alternatives to images with the Alt entry in PDF documents](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF1)

#### Situation B: If a short description can **not** serve the same purpose and present the same information as the non-text content (e.g., a chart or diagram):

- [G95: Providing short text alternatives that provide a brief description of the non-text content](https://www.w3.org/WAI/WCAG22/Techniques/general/G95) using one of the following **[Short text alternative techniques for Situation B](#text-equiv-all-situation-b-shorttext)** **AND** one of the following **[Long text alternative techniques for Situation B](#text-equiv-all-situation-b-longtext)**

**Short text alternative techniques for Situation B**:

- [ARIA6: Using aria-label to provide labels for objects](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA6)
- [ARIA10: Using aria-labelledby to provide a text alternative for non-text content](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA10)
- [G196: Using a text alternative on one item within a group of images that describes all items in the group](https://www.w3.org/WAI/WCAG22/Techniques/general/G196)
- [H2: Combining adjacent image and text links for the same resource](https://www.w3.org/WAI/WCAG22/Techniques/html/H2)
- [H37: Using alt attributes on img elements](https://www.w3.org/WAI/WCAG22/Techniques/html/H37)
- [H53: Using the body of the object element](https://www.w3.org/WAI/WCAG22/Techniques/html/H53)
- [H86: Providing text alternatives for emojis, emoticons, ASCII art, and leetspeak](https://www.w3.org/WAI/WCAG22/Techniques/html/H86)
- [PDF1: Applying text alternatives to images with the Alt entry in PDF documents](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF1)

**Long text alternative techniques for Situation B**:

- [ARIA15: Using aria-describedby to provide descriptions of images](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA15)
- [G73: Providing a long description in another location with a link to it that is immediately adjacent to the non-text content](https://www.w3.org/WAI/WCAG22/Techniques/general/G73)
- [G74: Providing a long description in text near the non-text content, with a reference to the location of the long description in the short description](https://www.w3.org/WAI/WCAG22/Techniques/general/G74)
- [G92: Providing long description for non-text content that serves the same purpose and presents the same information](https://www.w3.org/WAI/WCAG22/Techniques/general/G92)
- [H53: Using the body of the object element](https://www.w3.org/WAI/WCAG22/Techniques/html/H53)

#### Situation C: If non-text content is a control or accepts user input:

- [G82: Providing a text alternative that identifies the purpose of interactive non-text content](https://www.w3.org/WAI/WCAG22/Techniques/general/G82) using one of the following **[Text alternative techniques for controls and input for Situation C](#text-equiv-all-situation-c-controls)**

**Text alternative techniques for controls and input for Situation C**:

- [ARIA6: Using aria-label to provide labels for objects](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA6)
- [ARIA9: Using aria-labelledby to concatenate a label from several text nodes](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA9)
- [H24: Providing text alternatives for the area elements of image maps](https://www.w3.org/WAI/WCAG22/Techniques/html/H24)
- [H30: Providing link text that describes the purpose of a link for anchor elements](https://www.w3.org/WAI/WCAG22/Techniques/html/H30)
- [H36: Using alt attributes on images used as submit buttons](https://www.w3.org/WAI/WCAG22/Techniques/html/H36)
- [H44: Using label elements to associate text labels with form controls](https://www.w3.org/WAI/WCAG22/Techniques/html/H44)
- [H65: Using the title attribute to identify form controls when the label element cannot be used](https://www.w3.org/WAI/WCAG22/Techniques/html/H65)

#### Situation D: If non-text content is time-based media (including live video-only and live audio-only); a test or exercise that would be invalid if presented in text; or primarily intended to create a specific sensory experience:

- Providing a descriptive label using one of the following **[Short text alternative techniques for Situation D](#text-equiv-all-situation-d-shorttext)**
- [G68: Providing a short text alternative that describes the purpose of live audio-only and live video-only content](https://www.w3.org/WAI/WCAG22/Techniques/general/G68) using one of the following **[Short text alternative techniques for Situation D](#text-equiv-all-situation-d-shorttext)**
- [G100: Providing a short text alternative which is the accepted name or a descriptive name of the non-text content](https://www.w3.org/WAI/WCAG22/Techniques/general/G100) using one of the following **[Short text alternative techniques for Situation D](#text-equiv-all-situation-d-shorttext)**

**Short text alternative techniques for Situation D**:

- [ARIA6: Using aria-label to provide labels for objects](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA6)
- [ARIA10: Using aria-labelledby to provide a text alternative for non-text content](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA10)
- [G196: Using a text alternative on one item within a group of images that describes all items in the group](https://www.w3.org/WAI/WCAG22/Techniques/general/G196)
- [H2: Combining adjacent image and text links for the same resource](https://www.w3.org/WAI/WCAG22/Techniques/html/H2)
- [H37: Using alt attributes on img elements](https://www.w3.org/WAI/WCAG22/Techniques/html/H37)
- [H53: Using the body of the object element](https://www.w3.org/WAI/WCAG22/Techniques/html/H53)
- [H86: Providing text alternatives for emojis, emoticons, ASCII art, and leetspeak](https://www.w3.org/WAI/WCAG22/Techniques/html/H86)
- [PDF1: Applying text alternatives to images with the Alt entry in PDF documents](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF1)

#### Situation E: If non-text content is a CAPTCHA:

- [G143: Providing a text alternative that describes the purpose of the CAPTCHA](https://www.w3.org/WAI/WCAG22/Techniques/general/G143) **AND** [G144: Ensuring that the web page contains another CAPTCHA serving the same purpose using a different modality](https://www.w3.org/WAI/WCAG22/Techniques/general/G144)

#### Situation F: If the non-text content should be ignored by assistive technology:

- Implementing or marking the non-text content so that it will be ignored by assistive technology using one of the following **[Techniques to indicate that text alternatives are not required for Situation F](#text-equiv-all-situation-f-notrequired)**

**Techniques to indicate that text alternatives are not required for Situation F**:

- [C9: Using CSS to include decorative images](https://www.w3.org/WAI/WCAG22/Techniques/css/C9)
- [H67: Using null alt text and no title attribute on img elements for images that assistive technology should ignore](https://www.w3.org/WAI/WCAG22/Techniques/html/H67)
- [PDF4: Hiding decorative images with the Artifact tag in PDF documents](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF4)

### Advisory Techniques

Although not required for conformance, the following additional techniques should be considered in order to make content more accessible. Not all techniques can be used or would be effective in all situations.

- [C18: Using CSS margin and padding rules instead of spacer images for layout design](https://www.w3.org/WAI/WCAG22/Techniques/css/C18)

### Failures

The following are common mistakes that are considered failures of this success criterion by the Accessibility Guidelines Working Group.

- [F3: Failure of Success Criterion 1.1.1 due to conveying information exclusively using CSS background images](https://www.w3.org/WAI/WCAG22/Techniques/failures/F3)
- [F13: Failure of Success Criteria 1.1.1, 1.3.3, and 1.4.1 due to having a chart that conveys information by color, instructions that only refer to color, and a text alternative that does not include information that is conveyed by color differences in the image](https://www.w3.org/WAI/WCAG22/Techniques/failures/F13)
- [F20: Failure of Success Criterion 1.1.1 and 4.1.2 due to not updating text alternatives when changes to non-text content occur](https://www.w3.org/WAI/WCAG22/Techniques/failures/F20)
- [F30: Failure of Success Criterion 1.1.1 and 1.2.1 due to using text alternatives that are not alternatives (e.g., filenames or placeholder text)](https://www.w3.org/WAI/WCAG22/Techniques/failures/F30)
- [F38: Failure of Success Criterion 1.1.1 due to not marking up decorative images in HTML in a way that allows assistive technology to ignore them](https://www.w3.org/WAI/WCAG22/Techniques/failures/F38)
- [F39: Failure of Success Criterion 1.1.1 due to providing a text alternative that is not null (e.g., alt="spacer" or alt="image") for images that should be ignored by assistive technology](https://www.w3.org/WAI/WCAG22/Techniques/failures/F39)
- [F65: Failure of Success Criterion 1.1.1 due to omitting the alt attribute or text alternative on img elements, area elements, and input elements of type "image"](https://www.w3.org/WAI/WCAG22/Techniques/failures/F65)
- [F67: Failure of Success Criterion 1.1.1 and 1.2.1 due to providing long descriptions for non-text content that does not serve the same purpose or does not present the same information](https://www.w3.org/WAI/WCAG22/Techniques/failures/F67)
- [F71: Failure of Success Criterion 1.1.1 due to using text look-alikes to represent text without providing a text alternative](https://www.w3.org/WAI/WCAG22/Techniques/failures/F71)
- [F72: Failure of Success Criterion 1.1.1 due to using ASCII art without providing a text alternative](https://www.w3.org/WAI/WCAG22/Techniques/failures/F72)

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

CAPTCHA

initialism for "Completely Automated Public Turing test to tell Computers and Humans Apart"

Note 1

CAPTCHA tests often involve asking the user to type in text that is displayed in an obscured image or audio file.

Note 2

A Turing test is any system of tests designed to differentiate a human from a computer. It is named after famed computer scientist Alan Turing. The term was coined by researchers at Carnegie Mellon University.

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

pure decoration

serving only an aesthetic purpose, providing no information, and having no functionality

Note

Text is only purely decorative if the words can be rearranged or substituted without changing their purpose.

Example

The cover page of a dictionary has random words in very light text in the background.

sign language

a language using combinations of movements of the hands and arms, facial expressions, or body positions to convey meaning

specific sensory experience

a sensory experience that is not purely decorative and does not primarily convey important information or perform a function

Example

Examples include a performance of a flute solo, works of visual art etc.

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

## Test Rules

The following are Test Rules for certain aspects of this Success Criterion. It is not necessary to use these particular Test Rules to check for conformance with WCAG, but they are defined and approved test methods. For information on using Test Rules, see [Understanding Test Rules for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-act-rules.html).

- [Element marked as decorative is not exposed](https://www.w3.org/WAI/standards-guidelines/act/rules/46ca7f/)
- [Image accessible name is descriptive](https://www.w3.org/WAI/standards-guidelines/act/rules/qt1vmo/)
- [Image button has non-empty accessible name](https://www.w3.org/WAI/standards-guidelines/act/rules/59796f/)
- [Image has non-empty accessible name](https://www.w3.org/WAI/standards-guidelines/act/rules/23a2a8/)
- [Link has non-empty accessible name](https://www.w3.org/WAI/standards-guidelines/act/rules/c487ae/)
- [Object element rendering non-text content has non-empty accessible name](https://www.w3.org/WAI/standards-guidelines/act/rules/8fc3b6/)
- [SVG element with explicit role has non-empty accessible name](https://www.w3.org/WAI/standards-guidelines/act/rules/7d6734/)
- [Image filename is accessible name for image](https://www.w3.org/WAI/standards-guidelines/act/rules/9eb3f6/proposed/)
- [Image not in the accessibility tree is decorative](https://www.w3.org/WAI/standards-guidelines/act/rules/e88epe/proposed/)

[Back to Top](#top)
