# Make apps more accessible

Source: <https://developer.android.com/guide/topics/ui/accessibility/apps>

Retrieved: 2026-11-06

Portions of this page are reproduced from work created and shared by the Android Open Source Project and used according to terms described in the Creative Commons 2.5 Attribution License (https://creativecommons.org/licenses/by/2.5/). Converted from HTML to Markdown; the site's navigation and page controls are left out.

---

**Note:** Documentation across [developer.android.com](https://developer.android.com/) is being refactored to show how to accomplish tasks with Compose. We recommend using Compose for your app, but you can still access the Views-specific information for the concepts on this page at [Make apps more accessible (Views)](https://developer.android.com/guide/topics/ui/accessibility/views/apps-views).

Try to make your Android app usable for everyone, including people with accessibility needs.

People with impaired vision, color blindness, impaired hearing, impaired dexterity, cognitive disabilities, and many other disabilities use Android devices. When you develop apps with accessibility in mind, you make the user experience better for people with accessibility needs.

This page presents guidelines for implementing key elements of accessibility so that everyone can use your app more easily. For more in-depth guidance on how to make your app more accessible, see [Principles for improving app accessibility](https://developer.android.com/guide/topics/ui/accessibility/principles).

## Increase text visibility

For each set of text within your app, we recommend the _color contrast_—or difference in perceived brightness between the color of the text and the color of the background behind the text—to be above a specific threshold. The exact threshold depends on the text's font size and whether the text appears in bold:

- If the text is smaller than 18sp, or if the text is bold and smaller than 14sp, use foreground and background colors that result in a [color contrast ratio](https://m3.material.io/foundations/designing/color-contrast) of at least 4.5:1.
- For all other text, set the color contrast ratio to at least 3:1.

The following image shows two examples of text-to-background color contrast:

![Two examples of the word 'Text' on colored backgrounds. The example on the left has low color contrast between the text and background, while the example on right has sufficient color contrast.](https://developer.android.com/static/images/guide/topics/ui/accessibility/color-contrast.svg)

**Figure 1.** Lower than recommended (left) and sufficient (right) color contrast.

To check the text-to-background color contrast in your app, use an online color contrast checker or the [Accessibility Scanner](https://play.google.com/store/apps/details?id=com.google.android.apps.accessibility.auditor) app.

## Use large, simple controls

Your app's UI is easier to use if its controls are easier to see and tap. For touch interfaces, we recommend that each interactive UI element have a focusable area, or _touch target size_, of at least 48dpx48dp. Larger is even better.

**Note:** For precise input (mouses and trackpads), the touch target can be smaller. See [Pointer interactions](https://developer.android.com/design/ui/desktop/guides/interaction/pointer-interactions) for more information.

In Jetpack Compose, many built-in Material components like `Button`, `IconButton`, and `ListItem` already enforce this minimum size. However, when creating custom interactive elements, you need to set the size yourself.

In the following snippet, a small UI element is made accessible by giving it a larger touch target:

@Composable
private fun LargeBox() {
var clicked by remember { mutableStateOf(false) }
Box(
Modifier
.size(100.dp)
.background(if (clicked) Color.DarkGray else Color.LightGray)
) {
Box(
Modifier
.align(Alignment.Center)
.clickable { clicked \= !clicked }
.background(Color.Black)
.sizeIn(minWidth \= 48.dp, minHeight \= 48.dp)
)
}
}

[AccessibilitySnippets.kt](https://github.com/android/snippets/blob/b160bad98c32bcd4caad9a887add19fc28979284/compose/snippets/src/main/java/com/example/compose/snippets/accessibility/AccessibilitySnippets.kt#L157-L173)

For more information about touch target sizes, see [Minimum touch target sizes](https://developer.android.com/develop/ui/compose/accessibility/api-defaults#minimum-target-sizes).

## Describe each UI element

For each UI element in your app, include a description that describes the element's purpose. In most cases, you include this description in the element's `contentDescription` attribute, as shown in the following code snippet:

@Composable
private fun ShareButton(onClick: () \-\> Unit) {
IconButton(onClick \= onClick) {
Icon(
imageVector \= Icons.Filled.Share,
contentDescription \= stringResource(R.string.label_share)
)
}
}

[AccessibilitySnippets.kt](https://github.com/android/snippets/blob/b160bad98c32bcd4caad9a887add19fc28979284/compose/snippets/src/main/java/com/example/compose/snippets/accessibility/AccessibilitySnippets.kt#L225-L233)

Note that you do not need to provide a `contentDescription` for `Text` composables. Android accessibility services (like TalkBack) automatically announce the text itself.

When adding descriptions to your app's UI elements, keep the following best practices in mind:

- Use descriptions to convey the purpose and result of the interaction, not the visual details. Use the [`Role` semantics property](https://developer.android.com/guide/topics/ui/accessibility/composables#describe) (like `Role.Button` or `Role.Switch`) to expose a UI element's type. This way, screen readers can announce the element correctly.
- Avoid redundancies in descriptions. For example, if selecting a button causes a "submit" action to occur in your app, make the button's description `"Submit"`, not `"Submit button"`.
- Each description should be unique. That way, when screen reader users encounter a repeated element description, they correctly recognize that the focus is on an element that already had focus earlier. In particular, each item within a list such as `LazyColumn` should have a different description, each reflecting the content that's unique to a given item, such as the name of a city in a list of locations.
- Use the `hideFromAccessibility` API to mark purely decorative elements so that accessibility services can ignore them. If a UI element has a `contentDescription` parameter but is purely decorative (such as an `Icon` that is part of another UI element), pass `null` to avoid redundant labeling. For more elaborate use cases, see [Merging and clearing](https://developer.android.com/develop/ui/compose/accessibility/merging-clearing).
- Test your code to make sure the content description is delivered as expected. Android Lint, Compose testing, and [manual and automated test tools](https://developer.android.com/develop/ui/compose/accessibility/testing) can flag common issues and expose problems in your implementation.

## Additional resources

To learn more about making your app more accessible, see the following additional resources:

### Codelabs

- [Accessibility in Jetpack Compose](https://developer.android.com/codelabs/jetpack-compose-accessibility#0)

### Videos

- [Build more accessible UIs with Jetpack Compose](https://www.youtube.com/watch?v=80qkStdDWXQ)

### Views content

- [Make apps more accessible (Views)](https://developer.android.com/guide/topics/ui/accessibility/views/apps-views)
