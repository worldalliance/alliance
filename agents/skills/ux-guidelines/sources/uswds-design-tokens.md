# Design tokens

Source: <https://designsystem.digital.gov/design-tokens/>

Retrieved: 2026-11-09

U.S. Web Design System (USWDS), a work of the United States government. The page states no licence; the site's repository (https://github.com/uswds/uswds-site/blob/main/LICENSE.md) states that the project is in the public domain within the United States and waives copyright and related rights worldwide through the CC0 1.0 Universal public domain dedication (https://creativecommons.org/publicdomain/zero/1.0/). Converted from HTML to Markdown, with the site's navigation, header and footer left out.

---

The Design System’s visual design is based on consistent palettes of typography, spacing units, color, and other discrete elements of style we call **design tokens**.

## Introducing design tokens

Anything we see on a website is built from elements of style: color, spacing, typography, line height, and opacity. The CSS rules associated with these elements can accept a broad continuum of values — in the case of color, there are over 16 million separate colors in the RGB color space. Font size, line height, spacing, and others can accept a similarly wide range of values.

This degree of choice can slow down design work and make communication between designer and developer unnecessarily granular. The Design System seeks to maximize design efficiency and improve communication with **design tokens**: the discrete palettes of values from which we base all our visual design.

Our System design tokens are a limited set of discrete options, just like a scale of musical notes is drawn from the spectrum of all possible frequencies. Or like the presets on a car radio — not every option, just a specific selection. Take the following figure for instance: In the spectrum of hues between white and black, we provide a curated selection of five:

![continuous and tokenized values](https://designsystem.digital.gov/assets/img/design-tokens/continuous-v-token.svg)

### Example: Measure (line length)

For example, measure (or line length) expressed with the `max-width` CSS property can accept any value in units like `em`, `rem`, `ch`, `ex`, and `px` to at least two decimal places. The Design System limits itself to seven [measure](https://designsystem.digital.gov/design-tokens/typesetting/measure/) tokens, the values of which are given in the following table:

| token    | value        |
| -------- | ------------ |
| `1`      | `44ex`       |
| `2`      | `60ex`       |
| `3`      | `64ex`       |
| `4`      | `68ex`       |
| `5`      | `72ex`       |
| `6`      | `88ex`       |
| `'none'` | no max width |

Anything built using the Design System will use one of these seven [measure](https://designsystem.digital.gov/design-tokens/typesetting/measure/) tokens when specifying measure.

## Keys and values

You can think of a design token as a **key** that unlocks a specific **value**. Often, the specific value is less important than its effect. Each token is a quoted string or, with only the exceptions of `1px` and `2px`, a unitless number — and the mechanism by which the final display value is unlocked is a **function**, **mixin**, or **utility class**.

We can’t include tokens, like `max-width: 1`, directly in our Sass. Rather, we use a helper function like `max-width: measure(1)` or a mixin like `@include u-measure(1)`. All our design tokens have helper mixins and functions to use them in component Sass.

**Note:** We do not include the token’s value directly into our Sass rules.

### Example: Tokens in settings and component Sass

Tokens can be expressed as variables, which is how most Design System theme settings work. For instance, the following is an example of theme settings in your [USWDS settings configuration](https://designsystem.digital.gov/documentation/settings). This example shows spacing unit tokens assigned to settings variables:

```
@use "uswds-core" with (
  $theme-grid-container-max-width:    'desktop',
  $theme-site-margins-breakpoint:     'desktop',
  $theme-site-margins-width:          4,
  $theme-site-margins-mobile-width:   2,
);
```

The Design System’s component Sass uses those variableized tokens to build component styles as in the following code:

```
.usa-example {
  @include u-padding-x($theme-site-margins-mobile-width);
  max-width: units($theme-grid-container-max-width);

  @include at-media($theme-site-margins-breakpoint) {
    @include u-padding-x($theme-site-margins-width);
  }
}
```

This example is the functional equivalent of the following code:

```
.usa-example {
  @include u-padding-x(2);
  max-width: units('desktop');

  @include at-media('desktop') {
    @include u-padding-x(4);
  }
}
```

In this case, if `$theme-respect-user-font-size` is set to true, the output would be something like the following code:

```
.usa-example {
  padding-left: 1rem;
  padding-right: 1rem;
  max-width: 64rem;
}

@media screen and (min-width: 64em) {
  .usa-example {
    padding-left: 2rem;
    padding-right: 2rem;
  }
}
```

In general, the Design System sets variables with tokens and passes those variables into functions and mixins in the source Sass.

## Using design tokens

Use design tokens, like `$theme-grid-container-max-width: 'desktop'`, directly to set the value of settings variables in our theme settings files. Otherwise, use functions, mixins, or utility classes as in the following tables on color, spacing units, font size, font family, and font family and size together:

### Color

| Token                                                          | Function                                                              | Mixin                                                                    | Utility class                                                          |
| -------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| [color](https://designsystem.digital.gov/design-tokens/color/) | color([color](https://designsystem.digital.gov/design-tokens/color/)) | u-border([color](https://designsystem.digital.gov/design-tokens/color/)) | .border-[color](https://designsystem.digital.gov/design-tokens/color/) |
| 'red'                                                          | color('red')                                                          | u-border('red')                                                          | .border-red                                                            |
| 'primary-vivid'                                                | color('primary-vivid')                                                | u-text('primary-vivid')                                                  | .text-primary-vivid                                                    |
| 'white'                                                        | color('white')                                                        | u-bg('white')                                                            | .bg-white                                                              |

### Spacing units

| Token                                                                  | Function                                                                      | Mixin                                                                               | Utility class                                                                     |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [units](https://designsystem.digital.gov/design-tokens/spacing-units/) | units([units](https://designsystem.digital.gov/design-tokens/spacing-units/)) | u-padding-x([units](https://designsystem.digital.gov/design-tokens/spacing-units/)) | .padding-x-[units](https://designsystem.digital.gov/design-tokens/spacing-units/) |
| 0.5 '05'                                                               | units(0.5) units('05')                                                        | u-padding-x(0.5) u-padding-x('05')                                                  | .padding-x-05                                                                     |
| 1                                                                      | units(1)                                                                      | u-border(1)                                                                         | .border-1                                                                         |
| 'card-lg'                                                              | units('card-lg')                                                              | u-width('card-lg')                                                                  | .width-card-lg                                                                    |

### Font size

| Token                                                                                                                                                           | Function                                                                                                                                                              | Mixin                                                                                                                                                                        | Utility class |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| [family](https://designsystem.digital.gov/design-tokens/typesetting/font-family), [size](https://designsystem.digital.gov/design-tokens/typesetting/font-size/) | size([family](https://designsystem.digital.gov/design-tokens/typesetting/font-family), [size](https://designsystem.digital.gov/design-tokens/typesetting/font-size/)) | u-font-size([family](https://designsystem.digital.gov/design-tokens/typesetting/font-family), [size](https://designsystem.digital.gov/design-tokens/typesetting/font-size/)) | —             |
| 'sans', '3xs'                                                                                                                                                   | size('sans', '3xs')                                                                                                                                                   | u-font-size('sans', '3xs')                                                                                                                                                   | —             |
| 'ui', 'micro'                                                                                                                                                   | size('ui', 'micro')                                                                                                                                                   | u-font-size('ui', 'micro')                                                                                                                                                   | —             |
| 'body', 15                                                                                                                                                      | size('body', 15)                                                                                                                                                      | u-font-size('body', 15)                                                                                                                                                      | —             |

### Font family

| Token                                                                            | Function                                                                                 | Mixin                                                                                           | Utility class                                                                                 |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [family](https://designsystem.digital.gov/design-tokens/typesetting/font-family) | family([family](https://designsystem.digital.gov/design-tokens/typesetting/font-family)) | u-font-family([family](https://designsystem.digital.gov/design-tokens/typesetting/font-family)) | .font-family-[family](https://designsystem.digital.gov/design-tokens/typesetting/font-family) |
| 'sans'                                                                           | family('sans')                                                                           | u-font-family('sans')                                                                           | .font-family-sans                                                                             |
| 'ui'                                                                             | family('ui')                                                                             | u-font-family('ui')                                                                             | .font-family-ui                                                                               |
| 'body'                                                                           | family('body')                                                                           | u-font-family('body')                                                                           | .font-family-body                                                                             |

### Font family and size together

| Token                                                                                                                                                           | Function | Mixin                                                                                                                                                                   | Utility class                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [family](https://designsystem.digital.gov/design-tokens/typesetting/font-family), [size](https://designsystem.digital.gov/design-tokens/typesetting/font-size/) | —        | u-font([family](https://designsystem.digital.gov/design-tokens/typesetting/font-family), [size](https://designsystem.digital.gov/design-tokens/typesetting/font-size/)) | .font-[family](https://designsystem.digital.gov/design-tokens/typesetting/font-family)\-[size](https://designsystem.digital.gov/design-tokens/typesetting/font-size/) |
| 'sans', '3xs'                                                                                                                                                   | —        | u-font('sans', '3xs')                                                                                                                                                   | .font-sans-3xs                                                                                                                                                        |
| 'ui', 'lg'                                                                                                                                                      | —        | u-font('ui', 'lg')                                                                                                                                                      | .font-ui-lg                                                                                                                                                           |
| 'body', '2xl'                                                                                                                                                   | —        | u-font('body', '2xl')                                                                                                                                                   | .font-body-2xl                                                                                                                                                        |

## Latest updates

Meaningful code and guidance updates are listed in the following table:

| Date       | USWDS version | Affects    | Breaking | Description                                                                                                                                       |
| ---------- | ------------- | ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2023-12-04 | N/A           | - Guidance | No       | **Updated token references in “Using design tokens” section.** More information: [uswds-site#2366](https://github.com/uswds/uswds-site/pull/2366) |
| 2023-12-04 | N/A           | - Guidance | No       | **Updated the settings configuration code example.** More information: [uswds-site#2366](https://github.com/uswds/uswds-site/pull/2366)           |
