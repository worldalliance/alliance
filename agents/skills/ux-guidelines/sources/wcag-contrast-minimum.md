# Understanding [SC 1.4.3](https://w3.org/TR/WCAG22#contrast-minimum) Contrast (Minimum) (Level AA)

Source: <https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html>

Retrieved: 2026-11-06

Copyright © 2026 World Wide Web Consortium. W3C® liability, trademark and permissive license rules apply (https://www.w3.org/copyright/software-license/); WAI's permission page puts WAI material under the W3C Document License (https://www.w3.org/Consortium/Legal/copyright-documents). Copied verbatim: the page's main content, converted from HTML to Markdown, with the site's navigation, header and footer left out. Page date: Updated 04 October 2026.

---

## In Brief

Goal

Text can be seen by more people.

What to do

Provide sufficient contrast between text and its background.

Why it's important

Some people cannot read faint text.

## Success Criterion (SC)

The visual presentation of [text](#dfn-text) and [images of text](#dfn-image-of-text) has a [contrast ratio](#dfn-contrast-ratio) of at least 4.5:1, except for the following:

Large Text

[Large-scale](#dfn-large-scale) text and images of large-scale text have a contrast ratio of at least 3:1;

Incidental

Text or images of text that are part of an inactive [user interface component](#dfn-user-interface-component), that are [pure decoration](#dfn-pure-decoration), that are not visible to anyone, or that are part of a picture that contains significant other visual content, have no contrast requirement.

Logotypes

Text that is part of a logo or brand name has no contrast requirement.

## Intent

The intent of this success criterion is to provide enough contrast between text and its background, so that it can be read by people with moderately low vision or impaired contrast perception, without the use of contrast-enhancing assistive technology.

For all consumers of visual content, adequate light-dark contrast is needed between the relative luminance of text and its background for good readability. Many different visual impairments can substantially impact contrast sensitivity, requiring more light-dark contrast, regardless of color (hue). For people with color vision deficiency who are not able to distinguish certain shades of color, hue and saturation have minimal or no effect on legibility as assessed by reading performance. Further, the inability to distinguish certain shades of color does not negatively affect light-dark contrast perception. Therefore, in the recommendation, contrast is calculated in such a way that color (hue) is not a key factor.

Text that is decorative and conveys no information is excluded. For example, if random words are used to create a background and the words could be rearranged or substituted without changing meaning, then it would be decorative and would not need to meet this criterion.

Text that is larger and has wider character strokes is easier to read at lower contrast. The contrast requirement for larger text is therefore lower. This allows authors to use a wider range of color choices for large text, which is helpful for design of pages, particularly titles. 18 point text or 14 point bold text is judged to be large enough to require a lower contrast ratio. (See The American Printing House for the Blind Guidelines for Large Printing and The Library of Congress Guidelines for Large Print under [Resources](#resources)). "18 point" and "bold" can both have different meanings in different fonts but, except for very thin or unusual fonts, they should be sufficient. Since there are so many different fonts, the general measures are used and a note regarding thin or unusual fonts is included in the definition for [large-scale](#dfn-large-scale) text.

Note

When evaluating this Success Criterion, the font size in points should be obtained from the user agent or calculated on font metrics in the way that user agents do. Point sizes are based on the CSS `pt` size as defined in [CSS3 Values](https://www.w3.org/TR/css-values-3/#reference-pixel). The ratio between sizes in points and CSS pixels is `1pt = 1.333px`, therefore `14pt` and `18pt` are equivalent to approximately `18.5px` and `24px`.

Because different image editing applications default to different pixel densities (e.g., `72ppi` or `96ppi`), specifying point sizes for fonts from within an image editing application can be unreliable when it comes to presenting text at a specific size. When creating images of large-scale text, authors should ensure that the text in the resulting image is roughly equivalent to 1.2 and 1.5 em or to 120% or 150% of the default size for body text. For example, for a `72ppi` image, an author would need to use approximately 19pt and 24pt font sizes in order to successfully present images of large-scale text to a user.

The 3:1 and 4.5:1 contrast ratios referenced in this success criterion are intended to be treated as threshold values. When comparing the computed contrast ratio to the Success Criterion ratio, the computed values should not be rounded (e.g., 4.499:1 would not meet the 4.5:1 threshold).

Note

Because authors do not have control over user settings for font smoothing/anti-aliasing, when evaluating this Success Criterion, refer to the foreground and background colors obtained from the user agent, or the underlying markup and stylesheets, rather than the text as presented on screen.

Due to anti-aliasing, particularly thin or unusual fonts may be rendered by user agents with a much fainter color than the actual text color defined in the underlying CSS. This can lead to situations where text has a contrast ratio that nominally passes the Success Criterion, but has a much lower contrast in practice. Although not normatively required, in these cases authors are encouraged to choose a font with stronger/thicker lines, or to aim for a foreground/background color combination that exceeds the normative requirements of this success criterion.

The contrast requirements for text also apply to images of text (text that has been rendered into pixels and then stored in an image format) - see [Success Criterion 1.4.5 Images of Text](https://www.w3.org/WAI/WCAG22/Understanding/images-of-text).

This requirement applies to situations in which images of text were intended to be understood as text. Incidental text, such as in photographs that happen to include a street sign, are not included. Nor is text that for some reason is designed to be invisible or hard to discern to all viewers.

Beyond logos and logotypes, text that has insufficient contrast due to corporate identity or brand guidelines is _not_ exempted from the requirements of this criterion.

In this provision there is an exception that reads "that are part of a picture that contains significant other visual content,". This exception is intended to separate pictures that have text in them from images of text that are done to replace text in order to get a particular look.

Note

Images of text do not scale as well as text because they tend to pixelate. It is also harder to change foreground and background contrast and color combinations for images of text, which is necessary for some users. Therefore, we suggest using text wherever possible, and when not, consider supplying an image of higher resolution.

This success criterion applies to text in the page, including placeholder text and text that is shown when a pointer is hovering over an object or when an object has keyboard focus. If any of these are used in a page, the text needs to provide sufficient contrast.

Although this success criterion only applies to text, similar issues occur for content presented in charts, graphs, diagrams, and other non-text-based information, which is covered by [Success Criterion 1.4.11 Non-Text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast).

Note

There are cases where text is heavily stylized – for instance, using a very ornate or distorted typeface – to the point where it acts more as a graphic, rather than text. Similarly, there are situations where text characters are used as symbols – used for their visual appearance, rather than expressing something in human language. These cases fall under the definition of [non-text content](#dfn-non-text-content) and the requirements of [1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast).

Figure 1. Text using a geometric typeface – arguably acting as an image/non-text content.

Figure 2. Even though the two buttons use text characters — an uppercase X, often used for "Close" buttons, and a \> character, to act as a right-pointing arrow — they count as non-text characters/symbols. Their contrast ratio of just above 3:1 passes [Success Criterion 1.4.11 Non-Text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast).

See also [1.4.6 Contrast (Enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced).

### Logos

Text used as part of a logo or logotype is exempted from contrast requirements, under the assumption that logos/logotypes must comply with stricter color choices mandated by corporate identity or brand guidelines.

However, this can be problematic when logos or logotypes act as [user interface components](#dfn-user-interface-component) (such as a link or other interactive control). While not normatively required, in these cases authors are encouraged to choose a variant of the logo or logotype that has sufficient text contrast, if allowed by the corporate identity or brand guidelines. Alternatively, authors should consider providing an equivalent [user interface component](#dfn-user-interface-component) which serves the same purpose and meets contrast requirements.

If logos normally have sufficient contrast but are presented with an insufficient contrast as an author choice, rather than because of corporate identity or brand guidelines, then that particular low contrast presentation is _not_ exempt from the contrast requirements.

![A heading: 'ACME tool is trusted by the world's most innovative companies.'; below the heading, a series of nine company logos, all presented as very dark grey logos on the page's black background, with very low contrast; one logo is hovered with the mouse, and is displayed in white, with high contrast against the page background.](https://www.w3.org/WAI/WCAG22/Understanding/img/1.4.3-1.4.6-logos-author-choice-logos.png)

Figure 3. An author chooses to present company logos with low contrast by default, until they are hovered; the fact that these are logos doesn't exempt this scenario from failing the requirements of this success criterion, as the initial low contrast presentation is not "essential".

### Rationale for the Ratios Chosen

A contrast ratio of 3:1 is the minimum level recommended by \[[ISO-9241-3](#ISO-9241-3)\] and \[[ANSI-HFES-100-1988](#ANSI-HFES-100-1988)\] for standard text and vision. The 4.5:1 ratio is used in this success criterion to account for the loss in contrast that results from moderately low visual acuity, congenital or acquired color deficiencies, or the loss of contrast sensitivity that typically accompanies aging.

The rationale is based on a) adoption of the 3:1 contrast ratio for minimum acceptable contrast for normal observers, in the ANSI standard, and b) the empirical finding that in the population, visual acuity of 20/40 is associated with a contrast sensitivity loss of roughly 1.5 \[[ARDITI-FAYE](#ARDITI-FAYE)\]. A user with 20/40 would thus require a contrast ratio of `3 * 1.5 = 4.5 to 1`. Following analogous empirical findings and the same logic, the user with 20/80 visual acuity would require contrast of about 7:1. This ratio is used in Success Criterion 1.4.6.

Hues are perceived differently by users with color vision deficiencies (both congenital and acquired) resulting in different colors and relative luminance contrasts than for normally sighted users. Because of this, effective contrast and readability are different for this population. However, color deficiencies are so diverse that prescribing effective general use color pairs (for contrast) based on quantitative data is not feasible. Requiring good luminance contrast accommodates this by requiring contrast that is independent of color perception. Fortunately, most of the luminance contribution is from the mid and long wave receptors which largely overlap in their spectral responses. The result is that effective luminance contrast can generally be computed without regard to specific color deficiency, except for the use of predominantly long wavelength colors against darker colors (generally appearing black) for those who have protanopia. (We provide an advisory technique on avoiding red on black for that reason). For more information see \[[ARDITI-KNOBLAUCH-1994](#ARDITI-KNOBLAUCH-1994)\] \[[ARDITI-KNOBLAUCH-1996](#ARDITI-KNOBLAUCH-1996)\] \[[ARDITI](#ARDITI)\].

Note

Some people with cognitive disabilities require color combinations or hues that have low contrast, and therefore we allow and encourage authors to provide mechanisms to adjust the foreground and background colors of the content. Some of the combinations that could be chosen may have contrast levels that will be lower than those specified here. This is not a violation of this Success Criterion, provided there is a mechanism that will return to the required values set out here.

The contrast ratio of 4.5:1 was chosen for level AA because it compensated for the loss in contrast sensitivity usually experienced by users with vision loss equivalent to approximately 20/40 vision. (20/40 calculates to approximately 4.5:1.) 20/40 is commonly reported as typical visual acuity of elders at roughly age 80. \[[GITTINGS-FOZARD](#GITTINGS-FOZARD)\]

The contrast ratio of 7:1 was chosen for level AAA because it compensated for the loss in contrast sensitivity usually experienced by users with vision loss equivalent to approximately 20/80 vision. People with more than this degree of vision loss usually use assistive technologies to access their content (and the assistive technologies usually have contrast enhancing, as well as magnification capability built into them). The 7:1 level therefore generally provides compensation for the loss in contrast sensitivity experienced by users with low vision who do not use assistive technology and provides contrast enhancement for color deficiency as well.

Note

Calculations in \[[ISO-9241-3](#ISO-9241-3)\] and \[[ANSI-HFES-100-1988](#ANSI-HFES-100-1988)\] are for body text. A relaxed contrast ratio is provided for text that is much larger.

### Notes on formula

Conversion from nonlinear to linear RGB values is based on IEC/4WD 61966-2-1 \[[IEC-4WD](#IEC-4WD)\].

The formula (`L1/L2`) for contrast is based on \[[ISO-9241-3](#ISO-9241-3)\] and \[[ANSI-HFES-100-1988](#ANSI-HFES-100-1988)\] standards.

The ANSI/HFS 100-1988 standard calls for the contribution from ambient light to be included in the calculation of L1 and L2. The `.05` value used is based on Typical Viewing Flare from \[[IEC-4WD](#IEC-4WD)\].

This success criterion and its definitions use the terms "contrast ratio" and "relative luminance" rather than "luminance" to reflect the fact that web content does not emit light itself. The contrast ratio gives a measure of the relative luminance that would result when displayed. (Because it is a ratio, it is dimensionless.)

Note

Refer to [related resources](#resources) for a list of tools that utilize the contrast ratio to analyze the contrast of web content.

See also [2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible) for techniques for indicating keyboard focus.

### Inactive User Interface Components

User Interface Components that are not available for user interaction (e.g., a disabled control in HTML) are not required to meet contrast requirements. An inactive user interface component is visible but not currently operable. An example would be a submit button at the bottom of a form that is visible but cannot be activated until all the required fields in the form are completed.

Figure 4. An inactive button using default browser styles

## Benefits

- People with low vision often have difficulty reading text that does not contrast with its background. This can be exacerbated if the person has a color vision deficiency that lowers the contrast even further. Providing a minimum luminance contrast ratio between the text and its background can make the text more readable even if the person does not see the full range of colors. It also works for the rare individuals who see no color.

## Related Resources

Resources are for information purposes only, no endorsement implied.

- [Colour Contrast Analyser application](https://vispero.com/lp/color-contrast-checker/)
- [Luminosity Colour Contrast Ratio Analyser](https://juicystudio.com/services/luminositycontrastratio.php)
- [Colour Contrast Check](https://snook.ca/technical/colour_contrast/colour.html)
- [Atypical colour response](https://www.w3.org/Graphics/atypical-color-response)
- [Colors On the Web Color Contrast Analyzer](https://colorsontheweb.com/color-accessibility/contrast-checker/)
- [The American Printing House for the Blind Guidelines for Large Printing](https://www.aph.org/resources/large-print-guidelines/)
- [National Library Service for the Blind and Physically Handicapped (NLS), The Library of Congress reference guide on large print materials](https://www.loc.gov/nls/services-and-resources/informational-publications/large-print-materials/)
- [Types of Color Vision Deficiency, National Eye Institute (NEI), National Institutes of Health (NIH), U.S. Department of Health and Human Services (HHS)](https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/color-blindness/types-color-vision-deficiency)
- [Effects of chromatic and luminance contrast on reading, Knoblauch et al., 1991](https://opg.optica.org/josaa/abstract.cfm?uri=josaa-8-2-428)
- [Achromatic luminance contrast sensitivity in X-linked color-deficient observers: an addition to the debate, Márta Janáky et al., 2013](https://pubmed.ncbi.nlm.nih.gov/24103453/)
- [Contrast sensitivity of patients with congenital color vision deficiency, Cagri Ilhan et al., 2018](https://link.springer.com/article/10.1007/s10792-018-0881-7)

## Techniques

Each item in this section represents a technique or combination of techniques that the Accessibility Guidelines Working Group deems sufficient for meeting this success criterion. A technique may go beyond the minimum requirement of the criterion. There may be other ways of meeting the criterion not covered by these techniques. For information on using other techniques, see [Understanding Techniques for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-techniques), particularly the "Other Techniques" section.

### Sufficient Techniques

Select the situation below that matches your content. Each situation includes techniques or combinations of techniques that are known and documented to be sufficient for that situation.

#### Situation A: text is less than 18 point if not bold and less than 14 point if bold

- [G18: Ensuring that a contrast ratio of at least 4.5:1 exists between text (and images of text) and background behind the text](https://www.w3.org/WAI/WCAG22/Techniques/general/G18)
- [G148: Not specifying background color, not specifying text color, and not using technology features that change those defaults](https://www.w3.org/WAI/WCAG22/Techniques/general/G148)
- [G174: Providing a control with a sufficient contrast ratio that allows users to switch to a presentation that uses sufficient contrast](https://www.w3.org/WAI/WCAG22/Techniques/general/G174)

#### Situation B: text is at least 18 point if not bold and at least 14 point if bold

- [G145: Ensuring that a contrast ratio of at least 3:1 exists between text (and images of text) and background behind the text](https://www.w3.org/WAI/WCAG22/Techniques/general/G145)
- [G148: Not specifying background color, not specifying text color, and not using technology features that change those defaults](https://www.w3.org/WAI/WCAG22/Techniques/general/G148)
- [G174: Providing a control with a sufficient contrast ratio that allows users to switch to a presentation that uses sufficient contrast](https://www.w3.org/WAI/WCAG22/Techniques/general/G174)

### Advisory Techniques

Although not required for conformance, the following additional techniques should be considered in order to make content more accessible. Not all techniques can be used or would be effective in all situations.

- [G156: Using a technology that has commonly-available user agents that can change the foreground and background of blocks of text](https://www.w3.org/WAI/WCAG22/Techniques/general/G156)

### Failures

The following are common mistakes that are considered failures of this success criterion by the Accessibility Guidelines Working Group.

- [F24: Failure of Success Criterion 1.4.3, 1.4.6 and 1.4.8 due to specifying foreground colors without specifying background colors or vice versa](https://www.w3.org/WAI/WCAG22/Techniques/failures/F24)
- [F83: Failure of Success Criterion 1.4.3 and 1.4.6 due to using background images that do not provide sufficient contrast with foreground text (or images of text)](https://www.w3.org/WAI/WCAG22/Techniques/failures/F83)

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

contrast ratio

(L1 + 0.05) / (L2 + 0.05), where

- L1 is the [relative luminance](#dfn-relative-luminance) of the lighter of the colors, and
- L2 is the [relative luminance](#dfn-relative-luminance) of the darker of the colors.

Note 1

Contrast ratios can range from 1 to 21 (commonly written 1:1 to 21:1).

Note 2

Because authors do not have control over user settings as to how text is rendered (for example font smoothing or anti-aliasing), the contrast ratio for text can be evaluated with anti-aliasing turned off.

Note 3

For the purpose of Success Criteria 1.4.3 and 1.4.6, contrast is measured with respect to the specified background over which the text is rendered in normal usage. If no background color is specified, then white is assumed.

Note 4

Background color is the specified color of content over which the text is to be rendered in normal usage. It is a failure if no background color is specified when the text color is specified, because the user's default background color is unknown and cannot be evaluated for sufficient contrast. For the same reason, it is a failure if no text color is specified when a background color is specified.

Note 5

When there is a border around the letter, the border can add contrast and would be used in calculating the contrast between the letter and its background. A narrow border around the letter would be used as the letter. A wide border around the letter that fills in the inner details of the letters acts as a halo and would be considered background.

Note 6

WCAG conformance should be evaluated for color pairs specified in the content that an author would expect to appear adjacent in typical presentation. Authors need not consider unusual presentations, such as color changes made by the user agent, except where caused by authors' code.

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

large scale

with at least 18 point or 14 point bold or font size that would yield equivalent size for Chinese, Japanese and Korean (CJK) fonts

Note 1

Fonts with extraordinarily thin strokes or unusual features and characteristics that reduce the familiarity of their letter forms are harder to read, especially at lower contrast levels.

Note 2

Font size is the size when the content is delivered. It does not include resizing that may be done by a user.

Note 3

The actual size of the character that a user sees is dependent both on the author-defined size and the user's display or user agent settings. For many mainstream body text fonts, 14 and 18 point is roughly equivalent to 1.2 and 1.5 em or to 120% or 150% of the default size for body text (assuming that the body font is 100%), but authors would need to check this for the particular fonts in use. When fonts are defined in relative units, the actual point size is calculated by the user agent for display. The point size should be obtained from the user agent, or calculated based on font metrics as the user agent does, when evaluating this success criterion. Users who have low vision would be responsible for choosing appropriate settings.

Note 4

When using text without specifying the font size, the smallest font size used on major browsers for unspecified text would be a reasonable size to assume for the font. If a level 1 heading is rendered in 14pt bold or higher on major browsers, then it would be reasonable to assume it is large text. Relative scaling can be calculated from the default sizes in a similar fashion.

Note 5

The 18 and 14 point sizes for roman texts are taken from the minimum size for large print (14pt) and the larger standard font size (18pt). For other fonts such as CJK languages, the "equivalent" sizes would be the minimum large print size used for those languages and the next larger standard large print size.

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

pure decoration

serving only an aesthetic purpose, providing no information, and having no functionality

Note

Text is only purely decorative if the words can be rearranged or substituted without changing their purpose.

Example

The cover page of a dictionary has random words in very light text in the background.

relative luminance

the relative brightness of any point in a colorspace, normalized to 0 for darkest black and 1 for lightest white

Note 1

For the sRGB colorspace, the relative luminance of a color is defined as L = 0.2126 \* **R** + 0.7152 \* **G** + 0.0722 \* **B** where **R**, **G** and **B** are defined as:

- if RsRGB <= 0.04045 then **R** = RsRGB/12.92 else **R** = ((RsRGB+0.055)/1.055) ^ 2.4
- if GsRGB <= 0.04045 then **G** = GsRGB/12.92 else **G** = ((GsRGB+0.055)/1.055) ^ 2.4
- if BsRGB <= 0.04045 then **B** = BsRGB/12.92 else **B** = ((BsRGB+0.055)/1.055) ^ 2.4

and RsRGB, GsRGB, and BsRGB are defined as:

- RsRGB = R8bit/255
- GsRGB = G8bit/255
- BsRGB = B8bit/255

The "^" character is the exponentiation operator. (Formula taken from \[[SRGB](https://webstore.iec.ch/publication/6169)\].)

Note 2

Before May 2021 the value of 0.04045 in the definition was different (0.03928). It was taken from an older version of the specification and has been updated. It has no practical effect on the calculations in the context of these guidelines.

Note 3

Almost all systems used today to view web content assume sRGB encoding. Unless it is known that another color space will be used to process and display the content, authors should evaluate using sRGB colorspace. If using other color spaces, see [Understanding Success Criterion 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum).

Note 4

If dithering occurs after delivery, then the source color value is used. For colors that are dithered at the source, the average values of the colors that are dithered should be used (average R, average G, and average B).

Note 5

Tools are available that automatically do the calculations when testing contrast and flash.

Note 6

A [separate page giving the relative luminance definition using MathML](https://www.w3.org/WAI/WCAG22/Understanding/relative-luminance.html) to display the formulas is available.

sign language

a language using combinations of movements of the hands and arms, facial expressions, or body positions to convey meaning

text

sequence of characters that can be [programmatically determined](#dfn-programmatically-determined), where the sequence is expressing something in [human language](#dfn-human-language)

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

## References

ANSI-HFES-100-1988

ANSI/HFS 100-1988, American National Standard for Human Factors Engineering of Visual Display Terminal Workstations, Section 6, pp. 17-20.

ARDITI

Arditi, A. (2002). Effective color contrast: designing for people with partial sight and color deficiencies. New York, Arlene R. Gordon Research Institute, Lighthouse International.

ARDITI-FAYE

Arditi, A. and Faye, E. (2004). Monocular and binocular letter contrast sensitivity and letter acuity in a diverse ophthalmologic practice. Supplement to Optometry and Vision Science, 81 (12S), 287.

ARDITI-KNOBLAUCH-1994

Arditi, A. and Knoblauch, K. (1994). Choosing effective display colors for the partially-sighted. Society for Information Display International Symposium Digest of Technical Papers, 25, 32-35.

ARDITI-KNOBLAUCH-1996

Arditi, A. and Knoblauch, K. (1996). Effective color contrast and low vision. In B. Rosenthal and R. Cole (Eds.) Functional Assessment of Low Vision. St. Louis, Mosby, 129-135.

GITTINGS-FOZARD

Gittings, NS and Fozard, JL (1986). Age related changes in visual acuity. Experimental Gerontology, 21(4-5), 423-433.

IEC-4WD

IEC/4WD 61966-2-1: Colour Measurement and Management in Multimedia Systems and Equipment - Part 2.1: Default Colour Space - sRGB. May 5, 1998.

ISO-9241-3

ISO 9241-3, Ergonomic requirements for office work with visual display terminals (VDTs) - Part 3: Visual display requirements. Amendment 1.

## Test Rules

The following are Test Rules for certain aspects of this Success Criterion. It is not necessary to use these particular Test Rules to check for conformance with WCAG, but they are defined and approved test methods. For information on using Test Rules, see [Understanding Test Rules for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-act-rules.html).

- [Text has enhanced contrast](https://www.w3.org/WAI/standards-guidelines/act/rules/09o5cg/)
- [Text has minimum contrast](https://www.w3.org/WAI/standards-guidelines/act/rules/afw4f7/)

[Back to Top](#top)
