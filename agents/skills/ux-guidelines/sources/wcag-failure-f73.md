# Technique F73: Failure of Success Criterion 1.4.1 due to creating links that are not visually evident without color vision

Source: <https://www.w3.org/WAI/WCAG22/Techniques/failures/F73>

Retrieved: 2026-11-09

Copyright © 2026 World Wide Web Consortium. W3C® liability, trademark and permissive license rules apply (https://www.w3.org/copyright/software-license/); WAI's permission page puts WAI material under the W3C Document License (https://www.w3.org/Consortium/Legal/copyright-documents). Copied verbatim: the page's main content, converted from HTML to Markdown, with the site's navigation, header and footer left out. Page date: Updated 12 January 2026.

---

## About this Technique

This technique relates to [1.4.1 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color) (**Failure**).

This failure applies to any technology.

Failure techniques show examples of how content can fail particular WCAG success criteria. However, content may still satisfy those criteria if it includes equivalent/alternative content or functionality that **does** meet the normative requirements. See [About WCAG Techniques](https://www.w3.org/WAI/WCAG22/Techniques/about).

## Description

The objective of this failure is to avoid situations in which people who cannot perceive color differences cannot identify links (when people with color vision can identify links). Link underlines or some other non-color visual distinction are required (when the links are discernible to those with color vision).

While some links may be visually evident from page design and context, such as navigational links, links within text are often visually understood only from their own display attributes. Removing the underline and leaving only the color difference for such links would be a failure because there would be no other visual indication (besides color) that it is a link.

Note

Red and pink are the same color (hue) but they have different lightness (which is not color). So red and pink would pass the requirement for "not distinguished by color (hue) alone" since they differ by lightness (which is not color) - as long as the difference in lightness (contrast) is 3:1 or greater. For example, if surrounding text is red and the link is pink it would pass. Similarly a light green and a dark red differ **both** by color **and** by lightness so they would pass if the contrast (lightness) difference is 3:1 or greater before focus or pointing.

There is no requirement that links be identifiable by people who cannot perceive color if they are not perceivable for those with color vision. (e.g. if the links are hidden for everyone – as in a game or test).

If the non-color cue only happens when the mouse hovers over the link or when the link receives focus, it is still a failure.

If the link is a different color and bold it would not fail because the boldness is not color dependent.

## Examples

### Example 1: Links with no underlines and similar contrast to body text

A web page includes a large number of links within the body text. The links are styled so that they do not have underlines and are very similar in color to the body text. This would be a failure because users would be unable to differentiate the links from the body text.

### Example 2: Removing the underline from a link in a sentence or paragraph without providing another visual cue besides color

```html
<head>
  <style>
    p a:link {
      text-decoration: none;
    }
    p a:visited {
      text-decoration: none;
    }
    p a:active {
      text-decoration: none;
    }
    p a:hover {
      text-decoration: underline;
      color: red;
    }
  </style>
</head>
<body>
  <p>
    There are many resources to find out more about the
    <a href="rain-in-spain.html">rain in Spain</a>.
  </p>
</body>
```

Note

If the visual cue is only provided on hover (as in the example above), it would still fail.

## Related Techniques

- [G182: Ensuring that additional visual cues are available when text color differences are used to convey information](https://www.w3.org/WAI/WCAG22/Techniques/general/G182)
- [G183: Using a contrast ratio of at least 3:1 to distinguish inline text links from surrounding text](https://www.w3.org/WAI/WCAG22/Techniques/general/G183)

## Tests

### Procedure

1. Check that each link in the page that is identifiable by color (hue) is visually identifiable via some other means (e.g., underlined, bolded, italicized, sufficient difference in lightness, etc).

### Expected Results

- If check #1 is false, then this failure condition applies and the content fails this Success Criterion.

[Back to Top](#top)
