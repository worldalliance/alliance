# Apply other effects: enable automatic dark theme, emulate focus, and more

Source: <https://developer.chrome.com/docs/devtools/rendering/apply-effects>

Retrieved: 2026-11-09

Except as otherwise noted, the content of this page is licensed under the Creative Commons Attribution 4.0 License (https://creativecommons.org/licenses/by/4.0/). Converted from HTML to Markdown, with the site's navigation, header and footer left out.

---

Discover useful effects to apply to your page with this reference of the **Rendering** tab options.

## Highlight ad frames

To check if frames are tagged as ads:

1.  [Open the **Rendering** tab](/docs/devtools/rendering#open-rendering) on this [demo](https://rowan.fyi/made/heavy-ads/) and check **Highlight ad frames**.
2.  Observe the ad frame highlighted in red.

![Ad highlighted in red](/static/docs/devtools/rendering/apply-effects/image/ad-highlighted-red-8dd423b31a55d.png)

## Emulate a focused page

If you switch focus from the page to DevTools, some overlay elements automatically hide if they are triggered by focus. For example, drop-down lists, menus, or date pickers. The check_box **Emulate a focused page** option lets you debug such an element as if it is in focus.

**Caution:** With this option turned on, the `document.visibilityState` is set to `visible` and the `visibilitychange` event doesn't fire. For more information, see [Page Visibility API](https://developer.mozilla.org/docs/Web/API/Page_Visibility_API).

To emulate a focused page:

1.  Open a page with the element to debug, for example, the [YouTube website](https://www.youtube.com/watch?v=zFVWeOKZBHs) with its search bar.
2.  On the page, [open the **Rendering** tab](/docs/devtools/rendering#open-rendering), then check and clear **Emulate a focused page**.

    ![Emulate a focused page](/static/docs/devtools/rendering/apply-effects/image/emulate-focused-page-20423a81bcb42.gif)

You can also find [the same option under the **`:hov`** button](/docs/devtools/css/reference#focus) on the action bar in **Elements** > **Styles**.

To discover more ways to freeze an element, see [Freeze screen and inspect disappearing elements](/blog/devtools-tips-35).

## Disable local fonts

Check if the local font alternatives work as expected by disabling `local()` sources in `@font-face` rules.

Often, developers and designers use two different copies of the same font during development:

- A local font for your design tools, and
- A web font for your code

Disabling local fonts makes it easier for you to:

- Debug and measure web fonts loading performance and optimization
- Verify correctness of your CSS `@font-face` rules
- Discover any differences between web fonts and their local versions

Chrome renders this sentence in Courier New if it finds this font on your device.

Emulate missing `local()` sources in `@font-face` rules:

1.  [Inspect](/docs/devtools/open#elements) the sentence above, open **Elements** > **Computed**, scroll all the way down, and, under **Rendered Fonts**, discover that Chrome found **Courier New** in local files.

    ![Rendered fonts: local](/static/docs/devtools/rendering/apply-effects/image/rendered-fonts-local-5c4049ddd4da2.png)

2.  [Open the **Rendering** tab](/docs/devtools/rendering#open-rendering), check **Disable local fonts**, and refresh reload the page.

3.  Observe the sentence in Roboto found on the web.

    ![Rendered fonts: network resource](/static/docs/devtools/rendering/apply-effects/image/rendered-fonts-network-r-e6f5e3dd39dae.png)

## Enable automatic dark mode

See what your site can look like in dark mode even if you didn't implement it.

Chrome 96 introduced an [Origin Trial](/blog/origin-trials) for [Auto Dark Theme](/blog/auto-dark-theme) on Android. With this feature, the browser applies an automatically generated dark theme to light themed sites if the user opted into dark themes in the operating system.

To enable automatic dark mode:

1.  On this page, [open the **Rendering** tab](/docs/devtools/rendering#open-rendering) and check **Enable automatic dark mode**.
2.  Observe this page in dark mode.

![Automatic dark mode enabled](/static/docs/devtools/rendering/apply-effects/image/automatic-dark-mode-enabl-31c7d63d2e94b.png)

**Key point:** With [Auto Dark Theme](/blog/auto-dark-theme) enabled, the [**Emulate CSS media feature `prefers-color-scheme`**](/docs/devtools/rendering/emulate-css#emulate_css_media_feature_prefers-color-scheme) drop-down list is disabled and set to `prefers-color-scheme: dark` automatically.

## Emulate vision deficiencies

Everyone should be able to access and enjoy the web. [Google is committed to making that a reality](https://www.google.com/accessibility/).

With Chrome DevTools, you can see how people with [vision deficiencies](https://web.dev/learn/accessibility/color-contrast) see your site, so you can make it better for them. For more information, see [Simulating color vision deficiencies](/blog/cvd).

To emulate vision deficiencies:

1.  [Open the **Rendering** tab](/docs/devtools/rendering#open-rendering).
2.  Under **Emulate vision deficiencies**, select one of the following from the drop-down list:
    - **No emulation**.
    - **Blurred vision**.
    - **Reduced contrast**.
    - **Protanopia (no red)**. Low perception of red; confusion of greens, reds, and yellows.
    - **Deuteranopia (no green)**. Low perception of green; confusion of greens, reds, and yellows.
    - **Tritanopia (no blue)**. Low perception of blue; confusion of greens and blues.
    - **Achromatopsia (no color)**. Partial or total absence of color vision.

![Selected Tritanopia (no blue).](/static/docs/devtools/rendering/apply-effects/image/selected-tritanopia-blu-8ea9bb6e277ec.png)

## Disable AVIF and WebP image formats

These emulations make it easier for developers to test different image loading scenarios without having to switch browsers.

Suppose you have the following HTML code to serve an image in [AVIF](https://web.dev/articles/compress-images-avif) and [WebP](https://web.dev/articles/serve-images-webp) formats for newer browsers, with a fallback PNG image for older browsers.

```
<picture>
  <source srcset="test.avif" type="image/avif">
  <source srcset="test.webp" type="image/webp">
  <img src="test.png" alt="A test image">
</picture>
```

To disable all AVIF images on a page (or, similarly, WebP images):

1.  [Open the **Rendering** tab](/docs/devtools/rendering#open-rendering), check **Disable AVIF image format**.
2.  refresh Reload the page and hover over the `img src`. The current image src (`currentSrc`) is now the fallback WebP image.

![Emulate image types](/static/docs/devtools/rendering/apply-effects/image/emulate-image-types-eedcf1ae99441.png)

Similarly, you can disable WebP images.

**Key point:** These options disable image caching automatically.
