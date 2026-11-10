# Modal

Source: <https://designsystem.digital.gov/components/modal/>

Retrieved: 2026-11-09

U.S. Web Design System (USWDS), a work of the United States government. The page states no licence; the site's repository (https://github.com/uswds/uswds-site/blob/main/LICENSE.md) states that the project is in the public domain within the United States and waives copyright and related rights worldwide through the CC0 1.0 Universal public domain dedication (https://creativecommons.org/publicdomain/zero/1.0/). Converted from HTML to Markdown, with the site's navigation, header and footer left out.

---

A modal disables page content and focuses the user’s attention on a single task or message.

Passed WCAG 2.1 AA

## About the modal component

A modal prevents interaction with page content until the user completes an action or dismisses the modal. This intentionally interrupts the user’s workflow. **Use modals sparingly to minimize unnecessary disruptions.**

Modals should have a simple headline that explains its purpose. Use enough descriptive text to be clear what the user needs to do and why. Avoid using modals to display complex forms or large amounts of information.

## Component preview

## Are you sure you want to continue?

You have unsaved changes that will be lost.

- Continue without saving
- Go back

## Are you sure you want to continue?

You have unsaved changes that will be lost.

- Continue without saving
- Go back

## Your session will end soon.

You’ve been inactive for too long. Please choose to stay signed in or sign out. Otherwise, you’ll be signed out automatically in 5 minutes.

- Yes, stay signed in
- Sign out

## Component code

```text
<div class="margin-y-3">
  <a
    href="#example-modal-1"
    class="usa-button"
    aria-controls="example-modal-1"
    data-open-modal
    >Open default modal</a
  >
  <div
    class="usa-modal"
    id="example-modal-1"
    aria-labelledby="modal-1-heading"
    aria-describedby="modal-1-description"
  >
    <div class="usa-modal__content">
      <div class="usa-modal__main">
        <h2 class="usa-modal__heading" id="modal-1-heading">
          Are you sure you want to continue?
        </h2>
        <div class="usa-prose">
          <p id="modal-1-description">
            You have unsaved changes that will be lost.
          </p>
        </div>
        <div class="usa-modal__footer">
          <ul class="usa-button-group">
            <li class="usa-button-group__item">
              <button type="button" class="usa-button" data-close-modal>
                Continue without saving
              </button>
            </li>
            <li class="usa-button-group__item">
              <button
                type="button"
                class="usa-button usa-button--unstyled padding-105 text-center"
                data-close-modal
              >
                Go back
              </button>
            </li>
          </ul>
        </div>
      </div>
      <button
        type="button"
        class="usa-button usa-modal__close"
        aria-label="Close this window"
        data-close-modal
      >
        <svg class="usa-icon" aria-hidden="true" focusable="false" role="img">
          <use href="/assets/img/sprite.svg#close"></use>
        </svg>
      </button>
    </div>
  </div>
</div>

  <div class="margin-y-3">
  <a
    href="#example-modal-2"
    class="usa-button"
    aria-controls="example-modal-2"
    data-open-modal
    >Open large modal</a
  >
  <div
    class="usa-modal usa-modal--lg"
    id="example-modal-2"
    aria-labelledby="modal-2-heading"
    aria-describedby="modal-2-description"
  >
    <div class="usa-modal__content">
      <div class="usa-modal__main">
        <h2 class="usa-modal__heading" id="modal-2-heading">
          Are you sure you want to continue?
        </h2>
        <div class="usa-prose">
          <p id="modal-2-description">
            You have unsaved changes that will be lost.
          </p>
        </div>
        <div class="usa-modal__footer">
          <ul class="usa-button-group">
            <li class="usa-button-group__item">
              <button type="button" class="usa-button" data-close-modal>
                Continue without saving
              </button>
            </li>
            <li class="usa-button-group__item">
              <button
                type="button"
                class="usa-button usa-button--unstyled padding-105 text-center"
                data-close-modal
              >
                Go back
              </button>
            </li>
          </ul>
        </div>
      </div>
      <button
        type="button"
        class="usa-button usa-modal__close"
        aria-label="Close this window"
        data-close-modal
      >
        <svg class="usa-icon" aria-hidden="true" focusable="false" role="img">
          <use href="/assets/img/sprite.svg#close"></use>
        </svg>
      </button>
    </div>
  </div>
</div>

  <div class="margin-y-3">
  <a
    href="#example-modal-3"
    class="usa-button"
    aria-controls="example-modal-3"
    data-open-modal
    >Open modal with forced action</a
  >
  <div
    class="usa-modal"
    id="example-modal-3"
    aria-labelledby="modal-3-heading"
    aria-describedby="modal-3-description"
    data-force-action
  >
    <div class="usa-modal__content">
      <div class="usa-modal__main">
        <h2 class="usa-modal__heading" id="modal-3-heading">
          Your session will end soon.
        </h2>
        <div class="usa-prose">
          <p id="modal-3-description">
            You’ve been inactive for too long. Please choose to stay signed in
            or sign out. Otherwise, you’ll be signed out automatically in 5
            minutes.
          </p>
        </div>
        <div class="usa-modal__footer">
          <ul class="usa-button-group">
            <li class="usa-button-group__item">
              <button type="button" class="usa-button" data-close-modal>
                Yes, stay signed in
              </button>
            </li>
            <li class="usa-button-group__item">
              <button
                type="button"
                class="usa-button usa-button--unstyled padding-105 text-center"
                data-close-modal
              >
                Sign out
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</div>
```

```html
<div class="margin-y-3">
  <a
    href="#example-modal-1"
    class="usa-button"
    aria-controls="example-modal-1"
    data-open-modal
    >Open default modal</a
  >
  <div
    class="usa-modal"
    id="example-modal-1"
    aria-labelledby="modal-1-heading"
    aria-describedby="modal-1-description"
  >
    <div class="usa-modal__content">
      <div class="usa-modal__main">
        <h2 class="usa-modal__heading" id="modal-1-heading">
          Are you sure you want to continue?
        </h2>
        <div class="usa-prose">
          <p id="modal-1-description">
            You have unsaved changes that will be lost.
          </p>
        </div>
        <div class="usa-modal__footer">
          <ul class="usa-button-group">
            <li class="usa-button-group__item">
              <button type="button" class="usa-button" data-close-modal>
                Continue without saving
              </button>
            </li>
            <li class="usa-button-group__item">
              <button
                type="button"
                class="usa-button usa-button--unstyled padding-105 text-center"
                data-close-modal
              >
                Go back
              </button>
            </li>
          </ul>
        </div>
      </div>
      <button
        type="button"
        class="usa-button usa-modal__close"
        aria-label="Close this window"
        data-close-modal
      >
        <svg class="usa-icon" aria-hidden="true" focusable="false" role="img">
          <use href="/assets/img/sprite.svg#close"></use>
        </svg>
      </button>
    </div>
  </div>
</div>

<div class="margin-y-3">
  <a
    href="#example-modal-2"
    class="usa-button"
    aria-controls="example-modal-2"
    data-open-modal
    >Open large modal</a
  >
  <div
    class="usa-modal usa-modal--lg"
    id="example-modal-2"
    aria-labelledby="modal-2-heading"
    aria-describedby="modal-2-description"
  >
    <div class="usa-modal__content">
      <div class="usa-modal__main">
        <h2 class="usa-modal__heading" id="modal-2-heading">
          Are you sure you want to continue?
        </h2>
        <div class="usa-prose">
          <p id="modal-2-description">
            You have unsaved changes that will be lost.
          </p>
        </div>
        <div class="usa-modal__footer">
          <ul class="usa-button-group">
            <li class="usa-button-group__item">
              <button type="button" class="usa-button" data-close-modal>
                Continue without saving
              </button>
            </li>
            <li class="usa-button-group__item">
              <button
                type="button"
                class="usa-button usa-button--unstyled padding-105 text-center"
                data-close-modal
              >
                Go back
              </button>
            </li>
          </ul>
        </div>
      </div>
      <button
        type="button"
        class="usa-button usa-modal__close"
        aria-label="Close this window"
        data-close-modal
      >
        <svg class="usa-icon" aria-hidden="true" focusable="false" role="img">
          <use href="/assets/img/sprite.svg#close"></use>
        </svg>
      </button>
    </div>
  </div>
</div>

<div class="margin-y-3">
  <a
    href="#example-modal-3"
    class="usa-button"
    aria-controls="example-modal-3"
    data-open-modal
    >Open modal with forced action</a
  >
  <div
    class="usa-modal"
    id="example-modal-3"
    aria-labelledby="modal-3-heading"
    aria-describedby="modal-3-description"
    data-force-action
  >
    <div class="usa-modal__content">
      <div class="usa-modal__main">
        <h2 class="usa-modal__heading" id="modal-3-heading">
          Your session will end soon.
        </h2>
        <div class="usa-prose">
          <p id="modal-3-description">
            You’ve been inactive for too long. Please choose to stay signed in
            or sign out. Otherwise, you’ll be signed out automatically in 5
            minutes.
          </p>
        </div>
        <div class="usa-modal__footer">
          <ul class="usa-button-group">
            <li class="usa-button-group__item">
              <button type="button" class="usa-button" data-close-modal>
                Yes, stay signed in
              </button>
            </li>
            <li class="usa-button-group__item">
              <button
                type="button"
                class="usa-button usa-button--unstyled padding-105 text-center"
                data-close-modal
              >
                Sign out
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</div>
```

## Guidance

### When to use the modal component

- **Confirmation.** Use modals to force the user to complete a task or make a decision that requires their full attention outside of the main workflow. These modals are usually triggered by a user action on the page and offer more than one option to proceed — such as a “yes” and “no” button. They are commonly used to confirm user actions or tasks that can’t be undone.
  Examples:
  - “Your work isn’t saved. Do you want to proceed?”
  - “Are you sure you want to cancel?”
- **Acknowledgement before continuing.** These modals are used as a “gate” to prevent users from moving forward without acknowledging or answering specific information in the modal. A key differentiator of these modals is that a user should not be able to close the modal or escape without making a selection — this means the “close” button should be disabled on these modals. It also means there needs to be a clear way to accept or reject the content in the modal.
  Examples:
  - “By using this website, you are agreeing to our privacy policy.”
  - “Your session is about to timeout. Do you need more time?”
  - “Are you 65 or older?”
- **Explanatory content without disrupting a process.** A modal can be used to display information without taking users away from a process or task. These modals usually show optional information to help a user gain further understanding about what they’re doing — for instance, displaying a privacy policy while creating an account or viewing an in-depth definition or explanation while filling out a form. Typically these modals don’t require a user to take action other than closing it.

### When to consider something else

- **Every time!** Before using a modal, consider whether there’s another component that might be less disruptive for the user. Modals should be a last resort.
- **Multi-step process.** Avoid complicated user flows in a modal that may take the user away from the original page. A multi-step process is better suited to an individual page, guiding the user and accommodating complexities in the user flow.
- **Error, success, or warning messages.** When these relate to a form field, these are better displayed in the context of the page (such as showing an error next to a missing required field). When these relate to page-level messages (such as confirming that a form has been successfully submitted), they should appear as an [alert](https://designsystem.digital.gov/components/alert/) at the top of the page where the user is taken next.

### Usability guidance

- **Users should trigger modals.** Modals should appear as a result of an action made by the user or (less commonly) inactivity. A modal should not surprise the user, so don’t automatically display them. Some **exceptions** would be to alert the user that their authenticated session in a web application is about to expire due to inactivity or if information needs to be displayed when arriving at a webpage for the first time (like accepting the use of cookies).
- **Choose the modal size that fits your content.** There are two sizes to choose from: default and large. If a modal’s content can’t fit without scrolling, you may need to use the large variant or consider moving the content to its own page.
- **Use clear header and button text.** The header should clearly state what’s happening or what action the modal is prompting the user to do. The button text should indicate what will happen when selected and avoid ambiguity. For example, if a modal asks “Do you want to cancel?” the button options should not be “yes” and “cancel” — instead use something like “Yes, cancel” and “No, don’t cancel.”
- **Limit in-modal interactions.** Avoid using components other than buttons inside the modal. Components such as accordions and form fields often don’t scale well for mobile users and they can easily lose context that they’re viewing a modal. If you need to include links that navigate away from a modal to another webpage, refer to our link guidance about how to handle external links.
- **Consider what happens when the modal is dismissed.** The page underneath should not reload or change to new content.
- **Avoid long content that requires scrolling.** If a lot of content is needed, make sure it’s clear that users have to scroll to see all of it. Lengthy content can be problematic because it pushes buttons out of a user’s initial view, which may cause confusion.
- **Don’t roadblock external links with a modal window or dialog box.** Allow users to follow external links without taking a separate action to acknowledge leaving your site. Roadblock notices result in a poor user experience and are redundant with both the link’s destination context and your site’s policies and notices page (see [Link guidance](https://designsystem.digital.gov/components/link)).

### Accessibility guidance

Test the modal component in your own project.

USWDS tested the modal component for accessibility. You should test your implementation, too.

[Use modal accessibility tests](https://designsystem.digital.gov/components/modal/accessibility-tests)

- **Label the modal with its heading.** Use `aria-labelledby=”[id]”` on `.usa-modal` to read out the modal title when opening the modal. The `[id]` should match the value of the `id` attribute on the `usa-modal__heading` element.
- **Share more context with `aria-describedby`.** Optionally, you may also use `aria-describedby=”[id]”` on `.usa-modal` to associate descriptive text to the modal window so that it’s read when opening the modal. The `id` should belong to a paragraph or a brief piece of content.
- **Include the “X” close button at the end of the modal code.** CSS will display `.usa-modal__close` at the top right of the modal window, but placing the close button at the bottom of the modal will prevent some screen readers from reading the close button first and allow users to navigate directly to the main content instead.
- **Ensure keyboard focus is trapped inside the modal.** When using a keyboard to test the modal, ensure focus does not move to the page behind it.

### Using the modal component

- **Use unique ids.** Each `.usa-modal` must have a unique `id` so that openers can associate them with their `aria-controls` attribute.
- **Openers.** A single modal can have multiple openers. Each opener requires `data-open-modal` and `aria-controls=”[modal_id]”` attributes. Openers can be coded as either `<button>` or `<a>` elements. Using `<a>` helps link to modals in the event JavaScript fails.
- **Closers.** Place a `data-close-modal` attribute on any button that will close a modal. Closers may have event listeners attached to them. Code closers as `<button type="button">`.
- **Disabling close when an action is required.** In instances that a user must make a choice before continuing, you want to prevent them from closing the modal without taking action. Add `data-force-action` attribute to `.usa-modal` to prevent the user from closing the modal without taking an action.

**Note:** We recommend loading `uswds-init.js` when using banner, header, or modal components to assist in preventing flashes of unstyled content (FOUC) as well as cumulative layout shift (CLS). This small JavaScript file (less than 1 KB minified) helps the browser know if the USWDS JavaScript library is loading properly.

To add `uswds-init` to your site, simply copy `uswds-init.js` into your site assets from either the [`uswds-core/src/js`](https://github.com/uswds/uswds/blob/develop/packages/uswds-core/src/js) package or the `dist/js` directory in the [downloadable package](https://designsystem.digital.gov/download/). Then, reference the file in the `<head>` of your HTML files. Alternatively, you can inline its contents directly into a `<script>` tag in your HTML files.

#### Modal settings

| Variable                            | Description                                              |
| ----------------------------------- | -------------------------------------------------------- |
| `$theme-modal-border-radius`        | The border radius of the modal window.                   |
| `$theme-modal-default-max-width`    | Maximum width of default modal window.                   |
| `$theme-modal-lg-max-width`         | Maximum width of large modal window.                     |
| `$theme-modal-lg-content-max-width` | Maximum width of content area within large modal window. |

#### Modal variants

| Variant          | Description                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `.usa-modal--lg` | Add `.usa-modal--lg` to `.usa-modal` for a larger window and larger heading size on wider screens. |

## Accessibility test status

The USWDS team did 14 tests based on WCAG 2.1 AA success criteria.

| Total tests | Passed | Passed with exceptions | Conditional | Failed |
| ----------- | ------ | ---------------------- | ----------- | ------ |
| 14          | 13     | 0                      | 1           | 0      |

Overview of recent accessibility test results:

- **Passed:** 13
- **Passed with exceptions:** 0
- **Conditional:** 1
- **Failed:** 0

Learn more on the [modal accessibility tests page](https://designsystem.digital.gov/components/modal/accessibility-tests/).

## Package

- **Package usage:** `@forward "usa-modal";`
- **Dependencies:** `uswds-fonts`, `usa-button`

## Latest updates

Meaningful code and guidance updates are listed in the following table:

| Date       | USWDS version                                                 | Affects                                                            | Breaking | Description                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------- | ------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-18 | [3.14.0](https://github.com/uswds/uswds/releases/tag/v3.14.0) | - Accessibility - JavaScript                                       | No       | **Fixed page content staying hidden from screen readers after closing a modal.** If the element that opened the modal was no longer in the document when the modal closed, page content kept aria-hidden and stayed invisible to assistive technology until reload. Closing now always restores page content, independent of whether the opener still exists. More information: [uswds#6786](https://github.com/uswds/uswds/pull/6786) |
| 2026-08-18 | [3.14.0](https://github.com/uswds/uswds/releases/tag/v3.14.0) | - Accessibility - JavaScript                                       | No       | **Fixed screen readers announcing modal content twice.** The modal now controls initial focus (first footer button), disables focus-trap auto-focus, and sets aria-modal on the wrapper to prevent duplicate announcements, especially in NVDA. More information: [uswds#6703](https://github.com/uswds/uswds/pull/6703)                                                                                                               |
| 2025-05-23 | [3.13.0](https://github.com/uswds/uswds/releases/tag/v3.13.0) | - Accessibility - Styles                                           | No       | **Disabled the nonessential modal transition when reduced motion is requested.** The transition utility respects the operating system’s reduced-motion preference. More information: [uswds#6268](https://github.com/uswds/uswds/pull/6268)                                                                                                                                                                                            |
| 2025-02-14 | N/A                                                           | - Guidance                                                         | No       | **Added WCAG compliance tag and accessibility test status section.** More information: [uswds-site#3103](https://github.com/uswds/uswds-site/pull/3103)                                                                                                                                                                                                                                                                                |
| 2024-12-18 | [3.11.0](https://github.com/uswds/uswds/releases/tag/v3.11.0) | - Markup                                                           | No       | **Replaced deprecated `xlink:href` references with `href`.** More information: [uswds#6165](https://github.com/uswds/uswds/pull/6165)                                                                                                                                                                                                                                                                                                  |
| 2024-11-13 | [3.10.0](https://github.com/uswds/uswds/releases/tag/v3.10.0) | - JavaScript                                                       | No       | **Fixed a bug that prevented bundling the modal package with a custom prefix.** This update removed hard-coded class names from the modal JavaScript. More information: [uswds#6026](https://github.com/uswds/uswds/pull/6026)                                                                                                                                                                                                         |
| 2024-11-6  | [3.9.0](https://github.com/uswds/uswds/releases/tag/v3.9.0)   | - Guidance                                                         | No       | **Added focus trap guidance.** Updated guidance to ensure users trap focus inside the modal so that it doesn’t move to the content behind it. More information: [uswds-site#2874](https://github.com/uswds/uswds-site/pull/2874)                                                                                                                                                                                                       |
| 2023-11-09 | [3.7.0](https://github.com/uswds/uswds/releases/tag/v3.7.0)   | - JavaScript                                                       | No       | **Updated JavaScript to include fallbacks and error messages when initialization cannot be completed.** Additionally, this improved code consistency and prevented errors when trying to initialize modal twice. More information: [uswds#5315](https://github.com/uswds/uswds/pull/5315)                                                                                                                                              |
| 2023-09-29 | [3.6.1](https://github.com/uswds/uswds/releases/tag/v3.6.1)   | - JavaScript - Styles                                              | No       | **Updated how the modal JavaScript resets body padding and improved body padding detection.** Now the component will rely on the CSS to reset body padding rather than injecting an inline style with JavaScript. More information: [uswds#5493](https://github.com/uswds/uswds/pull/5493)                                                                                                                                             |
| 2023-03-09 | [3.4.0](https://github.com/uswds/uswds/releases/tag/v3.4.0)   | - JavaScript                                                       | No       | **Fixed the display of interactive form elements (like Date Picker) in modal windows.** Now any element in a modal should work as expected. More information: [uswds#5049](https://github.com/uswds/uswds/pull/5049)                                                                                                                                                                                                                   |
| 2022-08-05 | [3.1.0](https://github.com/uswds/uswds/releases/tag/v3.1.0)   | - Accessibility - Styles                                           | No       | **Styled aria-disabled to match disabled.** Now disabled styling is applied whether you use `disabled` (disabled and hidden from screen readers) or `aria-disabled` (disabled and visible to screen readers). More information: [uswds#4783](https://github.com/uswds/uswds/pull/4783)                                                                                                                                                 |
| 2022-08-05 | [3.1.0](https://github.com/uswds/uswds/releases/tag/v3.1.0)   | - JavaScript - Markup                                              | No       | **Added `type="button"` to all non-form buttons to prevent default submit behaviors.** This allowed us to remove `preventDefault()` from the relevant component JavaScript. More information: [uswds#4695](https://github.com/uswds/uswds/pull/4695)                                                                                                                                                                                   |
| 2022-04-28 | [3.0.0](https://github.com/uswds/uswds/releases/tag/v3.0.0)   | - Accessibility - Assets - Guidance - JavaScript - Markup - Styles | Breaking | Breaking **Updated to Sass module syntax and new package structure.** More information: [uswds#4656](https://github.com/uswds/uswds/pull/4656)                                                                                                                                                                                                                                                                                         |
| 2022-06-16 | N/A                                                           | - Guidance                                                         | No       | **Added guidance for handling external links.** More information: [uswds-site#1225](https://github.com/uswds/uswds-site/pull/1225)                                                                                                                                                                                                                                                                                                     |
| 2021-03-17 | N/A                                                           | - Guidance                                                         | No       | **Added modal documentation.** More information: [uswds-site#1180](https://github.com/uswds/uswds-site/pull/1180)                                                                                                                                                                                                                                                                                                                      |
| 2021-03-17 | [2.11.0](https://github.com/uswds/uswds/releases/tag/v2.11.0) | - Guidance - JavaScript - Markup - Styles                          | No       | **Added modal component.** A modal disables page content and focuses the user’s attention on a single task or message. More information: [uswds#3981](https://github.com/uswds/uswds/pull/3981)                                                                                                                                                                                                                                        |
