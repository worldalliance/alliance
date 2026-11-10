# Typography

Source: <https://designsystem.digital.gov/components/typography/>

Retrieved: 2026-11-09

U.S. Web Design System (USWDS), a work of the United States government. The page states no licence; the site's repository (https://github.com/uswds/uswds-site/blob/main/LICENSE.md) states that the project is in the public domain within the United States and waives copyright and related rights worldwide through the CC0 1.0 Universal public domain dedication (https://creativecommons.org/publicdomain/zero/1.0/). Converted from HTML to Markdown, with the site's navigation, header and footer left out.

---

Government websites need clear and consistent headings, highly legible body paragraphs, clear labels, and easy-to-use input fields. Our default typefaces are designed for legibility and can adapt to a variety of visual tones.

Passed WCAG 2.1 AA

## Typesetting with USWDS

Typesetting controls the readability of a text with the size, style, and spacing of its type. It’s a function of microtypography (how text is styled within a text block) and macrotypography (how content elements are arranged on the page). The more readable a text is the more easily users can understand its content. Text with poor readability turns off readers and can make it challenging for them to stay focused.

The U.S. Web Design System controls typesetting values with a token system. You can learn more about typesetting tokens in the [Typesetting tokens](https://designsystem.digital.gov/design-tokens/typesetting/overview/) section and the [Utilities](https://designsystem.digital.gov/utilities/) section.

[Accessibility for Teams](https://digital.gov/guides/accessibility-for-teams/visual-design#typography) also provides good guidance around typesetting.

### Font size

- **Use a comfortable reading size for body text.** For most text, including body copy, use at least an effective size of 16px ([font-size 5](https://designsystem.digital.gov/design-tokens/typesetting/font-size/)). Smaller and larger text can be used sparingly for special purposes (like headings, captions, photo credits, footnotes, data tables, or specialized UI elements).
- **Font size tokens.** The following two points are basic guidelines for selecting font size tokens:
  - Use tokens between [font-size 5](https://designsystem.digital.gov/design-tokens/typesetting/font-size/) and [font-size 8](https://designsystem.digital.gov/design-tokens/typesetting/font-size/) for most running text.
  - Use tokens smaller than [font-size 5](https://designsystem.digital.gov/design-tokens/typesetting/font-size/) more sparingly — for shorter companion text like captions, footnotes, photo credits, or specialized UI elements.

### Text alignment

While right-aligned, centered, and justified text have their place, most websites benefit from a consistent use of left-aligned text. Justified text, common in print, does not yet display well enough in a web browser to be considered a best practice.

- **Set type flush left.** Type set flush left provides the eye a constant starting point for each line, making text easier to read.
- **Alignment tokens:** none.

### Measure (line length)

Controlling the length of lines of text (also known as _measure_) helps readers’ attention flow easily from one line to the next, making reading more natural and comfortable.

- **Most lines of text should be 45–90 characters.** The current standard range for readable line length is 45 ([measure 1](https://designsystem.digital.gov/design-tokens/typesetting/measure/)) to 90 characters per line ([measure 5](https://designsystem.digital.gov/design-tokens/typesetting/measure/)). A good target for long texts is 66 characters ([measure 2](https://designsystem.digital.gov/design-tokens/typesetting/measure/)).
- **Text with greater line height can have a longer measure.** Since one of the functions of measure is to help readers move from one line of text to another more naturally, the effects of a long measure can be lessened by increasing the space between lines. Thus, text with more space between lines can have somewhat longer line length.
- **Short passages can have measure outside the ideal range.** In contexts when users will be reading short passages of text (such as footnotes or alerts), you can safely set somewhat longer or shorter lines than usual.
- **Large text can have a shorter measure.** Since larger text takes up more screen real estate, it may make sense to assign it a relatively small measure.
- **Measure tokens.** The following three points are basic guidelines for selecting measure tokens:
  - Tokens between [measure 2](https://designsystem.digital.gov/design-tokens/typesetting/measure/) and [measure 5](https://designsystem.digital.gov/design-tokens/typesetting/measure/) are appropriate for most long-running text.
  - The [measure 6](https://designsystem.digital.gov/design-tokens/typesetting/measure/) token can be appropriate for shorter blocks of text, like captions of fewer than three lines, or for text that isn’t meant for longform reading.
  - The [measure 1](https://designsystem.digital.gov/design-tokens/typesetting/measure/) token can be appropriate for helper text (no longer than a paragraph or two) or for larger text (like a subheading or intro text).

### Line height

Line height controls the vertical rhythm and density of a block of text. It is written as a unitless multiplier of the text’s font size — for instance, a line height of 1.5 on 16px text results in a line height of 24px.

- **Longer texts require more line height.** Headings and other content elements no longer than a line or two can have a line height between 1 ([line-height 1](https://designsystem.digital.gov/design-tokens/typesetting/line-height/)) and 1.35 ([line-height 3](https://designsystem.digital.gov/design-tokens/typesetting/line-height/)). Longer texts should have a line height of at least 1.5 ([line-height 4](https://designsystem.digital.gov/design-tokens/typesetting/line-height/)).
- **Longer lines usually require more line height.** Distinguishing between lines of text can be difficult when the eye has to travel from the end of one long line to the beginning of the next. Using more line height makes it easier for readers to distinguish individual lines. Though, somewhat counterintuitively, long lines of text can benefit from slightly less line height than usual, as too much line height can make each individual line appear too prominent.
- **Readable text has a medium density.** Strive for text that appears neither very dense nor loose. The reader typically shouldn’t notice the space between lines of text.
- **Line height tokens.** The following six points are basic guidelines for selecting line height tokens:
  - The [line-height 1](https://designsystem.digital.gov/design-tokens/typesetting/line-height/) token is a good option for most buttons and other short UI elements. (This option is often best for clear vertical alignment.)
  - The [line-height 2](https://designsystem.digital.gov/design-tokens/typesetting/line-height/) token is a good option for most headings and introductory text no longer than 1-2 sentences.
  - The [line-height 3](https://designsystem.digital.gov/design-tokens/typesetting/line-height/) token is a good option for short text (under a paragraph), captions, and long lines.
  - The [line-height 4](https://designsystem.digital.gov/design-tokens/typesetting/line-height/) token is a good option when your chunks of running text are a paragraph or two long, especially when using a short measure (like [measure 1](https://designsystem.digital.gov/design-tokens/typesetting/measure/) or [measure 2](https://designsystem.digital.gov/design-tokens/typesetting/measure/).
  - The [line-height 5](https://designsystem.digital.gov/design-tokens/typesetting/line-height/) token is a good option for most reading text, especially text meant for extended reading.
  - The [line-height 6](https://designsystem.digital.gov/design-tokens/typesetting/line-height/) token is a good option for shorter text (around 1-2 paragraphs) meant to be distinguished from other page text, like pullquotes.

### Whitespace

The space around your content elements affects the relationship between these elements. Use less whitespace to group elements and more whitespace to distinguish them from each other.

- **Don’t indent paragraphs, use whitespace before.** While most longform print design uses indented lines to distinguish paragraphs, it’s more conventional on the web to use unindented paragraphs separated by whitespace.
- **Use at least 1em of whitespace between paragraphs.** To properly separate paragraphs from one another, use the equivalent of one blank line of whitespace between them. Using more than 1.5em disturbs the flow of the text, and using less than 0.5em doesn’t provide enough separation.
- **Use at least 0.5em of whitespace between list items.** List items should also be separated by whitespace, but they need less space than paragraphs because the list item indicator also helps distinguish adjacent items.
- **Headings should be closer to the text they introduce than the text that preceeds them.** It’s important that headings are more visually connected to the text for which they’re the heading than the text of the previous section to reduce ambiguity and cognitive dissonance. Use at least 1.5 times the amount of whitespace above the heading as below it.
- **Text should have sufficient margin on the left and right**. Running text requires right and left margin proportional to the width of the viewport. Use at least [1 unit](https://designsystem.digital.gov/design-tokens/spacing-units/) of margin between the text and the edge of the viewport at mobile widths and at least [2 units](https://designsystem.digital.gov/design-tokens/spacing-units/) on a tablet. Desktop widths can require as much as [4-5 units](https://designsystem.digital.gov/design-tokens/spacing-units/) of minimum horizontal margin between the body of the text and any adjacent elements.

### Font style

The style of a typeface affects its readability. In general, serif typefaces are more appropriate for long blocks of text and sans serif typefaces are more appropriate for UIs — but this norm is not a hard-and-fast rule. The conventions of the web are more forgiving of longer, sans serifed texts and serif UIs are not out of the question for sites of a certain tone.

- **Serif faces can be a good choice for long texts.** Serif typefaces tend to be designed for readability. While they are most useful for true extended longform reading like novels, nonfiction, and essays, any site that requires long stretches of continuous reading could benefit from using a serif body typeface.
- **Neutral faces can be a good choice for interfaces.** UIs are the practical expression of a site’s organization and functionality. A straightforward and neutral typeface can help the user focus on using the interface as a tool.
- **Avoid long sections of italic or bold text.** Both italic and bold text can degrade readability. Both are best used for limited sections of contrast. Consider replacing long sections of bold or italic text with a callout box, a section header, or some other technique that avoids extended stretches of styled text.
- **Avoid long sections of uppercase text.** Uppercase text has a serious negative effect on readability. Unless mandated by law, consider other type treatments for any uppercase text longer than just a few words.

### Letterspacing

Letterspacing is the spacing between individual letterforms in a block of text. Typically, letterspacing is defined by the type designer and shouldn’t be modified. Certain situations, however, can call for letterspacing adjustments.

- **Very small text can use looser letterspacing.** At very small type sizes, extra letterspacing improves readability. Consider using [letterspacing 1](https://designsystem.digital.gov/design-tokens/typesetting/letterspacing/) when using [font size micro](https://designsystem.digital.gov/design-tokens/typesetting/font-size/) or [font size 1](https://designsystem.digital.gov/design-tokens/typesetting/font-size/).
- **Very large text can use tighter letterspacing.** Tighter letterspacing can improve large headings. Headings of [font-size 9+](https://designsystem.digital.gov/design-tokens/typesetting/font-size/) could use [letterspacing -1](https://designsystem.digital.gov/design-tokens/typesetting/letterspacing/). Headings of [font-size 12+](https://designsystem.digital.gov/design-tokens/typesetting/font-size/) could use [letterspacing -2](https://designsystem.digital.gov/design-tokens/typesetting/letterspacing/). Headings of [font-size 17+](https://designsystem.digital.gov/design-tokens/typesetting/font-size/) could use [letterspacing -3](https://designsystem.digital.gov/design-tokens/typesetting/letterspacing/).
- **Text set in uppercase or small caps should use looser letterspacing.** Uppercase text and small caps can appear too tight with normal letterspacing. Consider using [letterspacing 1](https://designsystem.digital.gov/design-tokens/typesetting/letterspacing/) with uppercase buttons and [letterspacing 2-3](https://designsystem.digital.gov/design-tokens/typesetting/letterspacing/) with longer stretches of uppercase or small cap text (like acronyms or section intros).

## Included typefaces

### Source Sans Pro

Source Sans Pro, designed by Paul D. Hunt, is an open-source sans serif typeface created for legibility in UI design. With a variety of weights that read easily at all sizes, Source Sans Pro provides clear headers as well as highly readable body text.

Inspired by 20th-century American gothic typeface design, its slender but open letters offer a clean and friendly simplicity. Advanced hinting allows Source Sans Pro to render well on Windows systems, which run Cleartype, and across browsers and devices. Moreover, it supports a variety of languages and alphabets, including Western and European languages, Vietnamese, pinyin Romanization of Chinese, and Navajo.

Aa

A B C D E F G H I J K L M N O P Q R S T U V W X Y Z

a b c d e f g h i j k l m n o p q r s t u v w x y z

0 1 2 3 4 5 6 7 8 9

### Merriweather

Merriweather, designed by Sorkin Type, is an open-source serif typeface designed for on-screen reading. This font is ideal for text-dense design: the letterforms have a tall x-height but remain relatively small, making for excellent readability across screen sizes while not occupying extra horizontal space.

The combination of thin and thick weights gives the typeface stylistic range while conveying a desirable mix of classic, yet modern, simplicity. Merriweather communicates warmth and credibility at both large and small font sizes.

Aa

A B C D E F G H I J K L M N O P Q R S T U V W X Y Z

a b c d e f g h i j k l m n o p q r s t u v w x y z

0 1 2 3 4 5 6 7 8 9

### Public Sans

[Public Sans](https://github.com/uswds/public-sans) (available on GitHub) is an open-source sans serif typeface designed and maintained by the Design System and derived from [Libre Franklin](https://github.com/impallari/Libre-Franklin) (also available on GitHub). It is a strong, neutral, principles-driven typeface for text or display based on a traditional American form. (The Franklin form is most noticeable in the two-story design of the “g” character.) It uses metrics similar to common system fonts for smoother progressive enhancement. It has a plain, straightforward style, appropriate for interfaces and running text. Its large x-height makes it legible at small sizes. It features a broad range of weights — and its heavier weights have tighter letterspacing than its lighter weights, meaning running text (which tends to be relatively small) is spaced more generously and headings (which tend to be relatively large) are more compact. It has tabular numerals for aligning numbers in tables.

Aa

A B C D E F G H I J K L M N O P Q R S T U V W X Y Z

a b c d e f g h i j k l m n o p q r s t u v w x y z

0 1 2 3 4 5 6 7 8 9

### Roboto Mono

Roboto Mono, designed by Christian Robinson, is a monospaced addition to the Roboto type family. Like the other members of the Roboto family, the fonts are optimized for readability on screens across a wide variety of devices and reading environments.

Special consideration is given to glyphs important for reading and writing code. Letters with similar shapes are easy to tell apart.

Aa

A B C D E F G H I J K L M N O P Q R S T U V W X Y Z

a b c d e f g h i j k l m n o p q r s t u v w x y z

0 1 2 3 4 5 6 7 8 9

## Latest updates

Meaningful code and guidance updates are listed in the following table:

| Date       | USWDS version                                               | Affects                        | Breaking | Description                                                                                                                                                                                                                                                                                                                                                              |
| ---------- | ----------------------------------------------------------- | ------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2024-03-20 | N/A                                                         | - Guidance                     | No       | **Added WCAG compliance tag.** More information: [uswds-site#2540](https://github.com/uswds/uswds-site/pull/2540)                                                                                                                                                                                                                                                        |
| 2023-06-09 | [3.5.0](https://github.com/uswds/uswds/releases/tag/v3.5.0) | - Styles                       | No       | **Stopped using font smoothing.** No longer use font smoothing for dark backgrounds and disabled buttons. More information: [uswds#5250](https://github.com/uswds/uswds/pull/5250)                                                                                                                                                                                       |
| 2023-03-09 | [3.4.0](https://github.com/uswds/uswds/releases/tag/v3.4.0) | - Guidance - Settings          | No       | **Use only `woff2` in our `@font-face` declarations.** Since modern browsers only need the `woff2` font format, we now only output `woff2` fonts in our `@font-face` rules. If you need `woff` and `ttf` for IE11 compatibility, set `$theme-font-browser-compatibility` to `true` in settings. More information: [uswds#5108](https://github.com/uswds/uswds/pull/5108) |
| 2022-04-28 | [3.0.0](https://github.com/uswds/uswds/releases/tag/v3.0.0) | - Assets - JavaScript - Styles | Breaking | Breaking **Updated to Sass module syntax and new package structure.** More information: [uswds#4656](https://github.com/uswds/uswds/pull/4656)                                                                                                                                                                                                                           |
