# Error summary

Source: <https://design-system.service.gov.uk/components/error-summary/>

Retrieved: 2026-11-06

Contains public sector information licensed under the Open Government Licence v3.0 (https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/). © Crown copyright. Converted from HTML to Markdown, with the site's navigation, header and footer left out.

---

- [History for](https://design-system.service.gov.uk/components/error-summary/history/)
- [Use with Nunjucks for](https://design-system.service.gov.uk/components/error-summary/nunjucks/)

Use this component at the top of a page to summarise any errors a user has made.

When a user makes an error, you must show both an error summary and an [Error message component](https://design-system.service.gov.uk/components/error-message/) next to each answer that contains an error.

[Open this example in a new tab: error summary](https://design-system.service.gov.uk/components/error-summary/default/)

- [HTML](#error-summary-example-html)
- [Nunjucks](#error-summary-example-nunjucks)

[HTML](#error-summary-example-html)

```html
<div class="govuk-error-summary" data-module="govuk-error-summary">
  <div role="alert">
    <h2 class="govuk-error-summary__title">There is a problem</h2>
    <div class="govuk-error-summary__body">
      <ul class="govuk-list govuk-error-summary__list">
        <li>
          <a href="#">Enter your full name</a>
        </li>
        <li>
          <a href="#">The date your passport was issued must be in the past</a>
        </li>
      </ul>
    </div>
  </div>
</div>
```

[Nunjucks](#error-summary-example-nunjucks)

[See options and how to use with Nunjucks](https://design-system.service.gov.uk/components/error-summary/nunjucks/)

```njk
{% from "govuk/components/error-summary/macro.njk" import govukErrorSummary %}

{{ govukErrorSummary({
  titleText: "There is a problem",
  errorList: [
    {
      text: "Enter your full name",
      href: "#"
    },
    {
      text: "The date your passport was issued must be in the past",
      href: "#"
    }
  ]
}) }}
```

## When to use this component

Always show an error summary when there is a validation error, even if there’s only one.

## How it works

You must:

- move keyboard focus to the error summary (the govuk-frontend javascript will do this for you)
- include the heading ‘There is a problem’
- link to each of the answers that have validation errors
- make sure the error messages in the error summary are worded the same as those which appear next to the inputs with errors

As well as showing an error summary, follow the [Validation pattern](https://design-system.service.gov.uk/patterns/validation/) - for example, by adding ‘Error: ’ to the beginning of the page `<title>` so screen readers read it out as soon as possible.

And [make your error messages clear and concise](https://design-system.service.gov.uk/components/error-message/#be-clear-and-concise).

There are 2 ways to use the error summary component. You can use HTML or, if you are using [Nunjucks](https://mozilla.github.io/nunjucks/) or the [GOV.UK Prototype Kit](https://prototype-kit.service.gov.uk/), you can use the Nunjucks macro.

[Open this example in a new tab: error summary second](https://design-system.service.gov.uk/components/error-summary/default/)

- [HTML](#error-summary-second-example-html)
- [Nunjucks](#error-summary-second-example-nunjucks)

[HTML](#error-summary-second-example-html)

```html
<div class="govuk-error-summary" data-module="govuk-error-summary">
  <div role="alert">
    <h2 class="govuk-error-summary__title">There is a problem</h2>
    <div class="govuk-error-summary__body">
      <ul class="govuk-list govuk-error-summary__list">
        <li>
          <a href="#">Enter your full name</a>
        </li>
        <li>
          <a href="#">The date your passport was issued must be in the past</a>
        </li>
      </ul>
    </div>
  </div>
</div>
```

[Nunjucks](#error-summary-second-example-nunjucks)

[See options and how to use with Nunjucks](https://design-system.service.gov.uk/components/error-summary/nunjucks/)

```njk
{% from "govuk/components/error-summary/macro.njk" import govukErrorSummary %}

{{ govukErrorSummary({
  titleText: "There is a problem",
  errorList: [
    {
      text: "Enter your full name",
      href: "#"
    },
    {
      text: "The date your passport was issued must be in the past",
      href: "#"
    }
  ]
}) }}
```

### Linking from the error summary to each answer

You must link the errors in the error summary to the answer they relate to.

For questions that require a user to answer using a single field, like a file upload, select, textarea, text input or character count, link to the field.

[Open this example in a new tab: linking from the error summary to an answer that uses a single field – error summary](https://design-system.service.gov.uk/components/error-summary/linking/)

- [HTML](#linking-from-the-error-summary-to-an-answer-that-uses-a-single-field-error-summary-example-html)
- [Nunjucks](#linking-from-the-error-summary-to-an-answer-that-uses-a-single-field-error-summary-example-nunjucks)

[HTML](#linking-from-the-error-summary-to-an-answer-that-uses-a-single-field-error-summary-example-html)

```html
<div class="govuk-error-summary" data-module="govuk-error-summary">
  <div role="alert">
    <h2 class="govuk-error-summary__title">There is a problem</h2>
    <div class="govuk-error-summary__body">
      <ul class="govuk-list govuk-error-summary__list">
        <li>
          <a href="#full-name-input">Enter your full name</a>
        </li>
      </ul>
    </div>
  </div>
</div>
<h1 class="govuk-heading-l">Your details</h1>
<div class="govuk-form-group govuk-form-group--error">
  <label class="govuk-label" for="full-name-input"> Full name </label>
  <p id="full-name-input-error" class="govuk-error-message">
    <span class="govuk-visually-hidden">Error:</span> Enter your full name
  </p>
  <input
    class="govuk-input govuk-input--error"
    id="full-name-input"
    name="name"
    type="text"
    aria-describedby="full-name-input-error"
    autocomplete="name"
  />
</div>
```

[Nunjucks](#linking-from-the-error-summary-to-an-answer-that-uses-a-single-field-error-summary-example-nunjucks)

[See options and how to use with Nunjucks](https://design-system.service.gov.uk/components/error-summary/nunjucks/)

```njk
{% from "govuk/components/error-summary/macro.njk" import govukErrorSummary %}
{% from "govuk/components/input/macro.njk" import govukInput %}

{{ govukErrorSummary({
  titleText: "There is a problem",
  errorList: [
    {
      text: "Enter your full name",
      href: "#full-name-input"
    }
  ]
}) }}

<h1 class="govuk-heading-l">Your details</h1>

{{ govukInput({
  label: {
    text: "Full name"
  },
  id: "full-name-input",
  name: "name",
  autocomplete: "name",
  errorMessage: {
    text: "Enter your full name"
  }
}) }}
```

When a user has to enter their answer into multiple fields, such as the day, month and year fields in the date input component, link to the first field that contains an error.

If you do not know which field contains an error, link to the first field.

[Open this example in a new tab: linking from the error summary to an answer that uses multiple fields – error summary](https://design-system.service.gov.uk/components/error-summary/linking-multiple-fields/)

- [HTML](#linking-from-the-error-summary-to-an-answer-that-uses-multiple-fields-error-summary-example-html)
- [Nunjucks](#linking-from-the-error-summary-to-an-answer-that-uses-multiple-fields-error-summary-example-nunjucks)

[HTML](#linking-from-the-error-summary-to-an-answer-that-uses-multiple-fields-error-summary-example-html)

```html
<div class="govuk-error-summary" data-module="govuk-error-summary">
  <div role="alert">
    <h2 class="govuk-error-summary__title">There is a problem</h2>
    <div class="govuk-error-summary__body">
      <ul class="govuk-list govuk-error-summary__list">
        <li>
          <a href="#passport-issued-year"
            >Passport issue date must include a year</a
          >
        </li>
      </ul>
    </div>
  </div>
</div>
<div class="govuk-form-group govuk-form-group--error">
  <fieldset
    class="govuk-fieldset"
    role="group"
    aria-describedby="passport-issued-error"
  >
    <legend class="govuk-fieldset__legend govuk-fieldset__legend--l">
      <h1 class="govuk-fieldset__heading">When was your passport issued?</h1>
    </legend>
    <p id="passport-issued-error" class="govuk-error-message">
      <span class="govuk-visually-hidden">Error:</span> Passport issue date must
      include a year
    </p>
    <div class="govuk-date-input" id="passport-issued">
      <div class="govuk-date-input__item">
        <div class="govuk-form-group">
          <label
            class="govuk-label govuk-date-input__label"
            for="passport-issued-day"
          >
            Day
          </label>
          <input
            class="govuk-input govuk-date-input__input govuk-input--width-2"
            id="passport-issued-day"
            name="passport-issued-day"
            type="text"
            value="5"
            inputmode="numeric"
          />
        </div>
      </div>
      <div class="govuk-date-input__item">
        <div class="govuk-form-group">
          <label
            class="govuk-label govuk-date-input__label"
            for="passport-issued-month"
          >
            Month
          </label>
          <input
            class="govuk-input govuk-date-input__input govuk-input--width-2"
            id="passport-issued-month"
            name="passport-issued-month"
            type="text"
            value="12"
            inputmode="numeric"
          />
        </div>
      </div>
      <div class="govuk-date-input__item">
        <div class="govuk-form-group">
          <label
            class="govuk-label govuk-date-input__label"
            for="passport-issued-year"
          >
            Year
          </label>
          <input
            class="govuk-input govuk-date-input__input govuk-input--error govuk-input--width-4"
            id="passport-issued-year"
            name="passport-issued-year"
            type="text"
            inputmode="numeric"
          />
        </div>
      </div>
    </div>
  </fieldset>
</div>
```

[Nunjucks](#linking-from-the-error-summary-to-an-answer-that-uses-multiple-fields-error-summary-example-nunjucks)

[See options and how to use with Nunjucks](https://design-system.service.gov.uk/components/error-summary/nunjucks/)

```njk
{% from "govuk/components/date-input/macro.njk" import govukDateInput %}
{% from "govuk/components/error-summary/macro.njk" import govukErrorSummary %}

{{ govukErrorSummary({
  titleText: "There is a problem",
  errorList: [
    {
      text: "Passport issue date must include a year",
      href: "#passport-issued-year"
    }
  ]
}) }}

{{ govukDateInput({
  fieldset: {
    legend: {
      isPageHeading: true,
      text: "When was your passport issued?",
      classes: "govuk-fieldset__legend--l"
    }
  },
  id: "passport-issued",
  namePrefix: "passport-issued",
  errorMessage: {
    text: "Passport issue date must include a year"
  },
  values: {
    day: 5,
    month: 12
  },
  year: {
    error: true
  }
  })
}}
```

For questions that require a user to select one or more options from a list using radios or checkboxes, link to the first radio or checkbox.

[Open this example in a new tab: linking from the error summary to checkboxes – error summary](https://design-system.service.gov.uk/components/error-summary/linking-checkboxes-radios/)

- [HTML](#linking-from-the-error-summary-to-checkboxes-error-summary-example-html)
- [Nunjucks](#linking-from-the-error-summary-to-checkboxes-error-summary-example-nunjucks)

[HTML](#linking-from-the-error-summary-to-checkboxes-error-summary-example-html)

```html
<div class="govuk-error-summary" data-module="govuk-error-summary">
  <div role="alert">
    <h2 class="govuk-error-summary__title">There is a problem</h2>
    <div class="govuk-error-summary__body">
      <ul class="govuk-list govuk-error-summary__list">
        <li>
          <a href="#nationality"
            >Select if you are British, Irish or a citizen of a different
            country</a
          >
        </li>
      </ul>
    </div>
  </div>
</div>
<div class="govuk-form-group govuk-form-group--error">
  <fieldset
    class="govuk-fieldset"
    aria-describedby="nationality-hint nationality-error"
  >
    <legend class="govuk-fieldset__legend govuk-fieldset__legend--l">
      <h1 class="govuk-fieldset__heading">What is your nationality?</h1>
    </legend>
    <div id="nationality-hint" class="govuk-hint">
      If you have dual nationality, select all options that are relevant to you
    </div>
    <p id="nationality-error" class="govuk-error-message">
      <span class="govuk-visually-hidden">Error:</span> Select if you are
      British, Irish or a citizen of a different country
    </p>
    <div class="govuk-checkboxes" data-module="govuk-checkboxes">
      <div class="govuk-checkboxes__item">
        <input
          class="govuk-checkboxes__input"
          id="nationality"
          name="nationality"
          type="checkbox"
          value="british"
          aria-describedby="nationality-item-hint"
        />
        <label class="govuk-label govuk-checkboxes__label" for="nationality">
          British
        </label>
        <div
          id="nationality-item-hint"
          class="govuk-hint govuk-checkboxes__hint"
        >
          including English, Scottish, Welsh and Northern Irish
        </div>
      </div>
      <div class="govuk-checkboxes__item">
        <input
          class="govuk-checkboxes__input"
          id="nationality-2"
          name="nationality"
          type="checkbox"
          value="irish"
        />
        <label class="govuk-label govuk-checkboxes__label" for="nationality-2">
          Irish
        </label>
      </div>
      <div class="govuk-checkboxes__item">
        <input
          class="govuk-checkboxes__input"
          id="nationality-3"
          name="nationality"
          type="checkbox"
          value="other"
        />
        <label class="govuk-label govuk-checkboxes__label" for="nationality-3">
          Citizen of another country
        </label>
      </div>
    </div>
  </fieldset>
</div>
```

[Nunjucks](#linking-from-the-error-summary-to-checkboxes-error-summary-example-nunjucks)

[See options and how to use with Nunjucks](https://design-system.service.gov.uk/components/error-summary/nunjucks/)

```njk
{% from "govuk/components/error-summary/macro.njk" import govukErrorSummary %}
{% from "govuk/components/checkboxes/macro.njk" import govukCheckboxes %}

{{ govukErrorSummary({
  titleText: "There is a problem",
  errorList: [
    {
      text: "Select if you are British, Irish or a citizen of a different country",
      href: "#nationality"
    }
  ]
}) }}

{{ govukCheckboxes({
  name: "nationality",
  fieldset: {
    legend: {
      text: "What is your nationality?",
      isPageHeading: true,
      classes: "govuk-fieldset__legend--l"
    }
  },
  hint: {
    text: "If you have dual nationality, select all options that are relevant to you"
  },
  errorMessage: {
    text: "Select if you are British, Irish or a citizen of a different country"
  },
  items: [
    {
      value: "british",
      text: "British",
      hint: {
        text: "including English, Scottish, Welsh and Northern Irish"
      }
    },
    {
      value: "irish",
      text: "Irish"
    },
    {
      value: "other",
      text: "Citizen of another country"
    }
  ]
}) }}
```

### Where to put the error summary

Put the error summary at the top of the `main` container. If your page includes breadcrumbs or a back link, place it below these, but above the `<h1>`.

[Open this example in a new tab: full page example – error summary](https://design-system.service.gov.uk/components/error-summary/full-page-example/)

- [HTML](#full-page-example-error-summary-example-html)
- [Nunjucks](#full-page-example-error-summary-example-nunjucks)

[HTML](#full-page-example-error-summary-example-html)

```html
<div class="govuk-width-container">
  <a href="#" class="govuk-back-link">Back</a>
  <main class="govuk-main-wrapper " id="main-content" role="main">
    <div class="govuk-grid-row">
      <div class="govuk-grid-column-two-thirds">
        <form action="/form-handler" method="post" novalidate>
          <div class="govuk-error-summary" data-module="govuk-error-summary">
            <div role="alert">
              <h2 class="govuk-error-summary__title">There is a problem</h2>
              <div class="govuk-error-summary__body">
                <ul class="govuk-list govuk-error-summary__list">
                  <li>
                    <a href="#passport-issued-year"
                      >Passport issue date must include a year</a
                    >
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div class="govuk-form-group govuk-form-group--error">
            <fieldset
              class="govuk-fieldset"
              role="group"
              aria-describedby="passport-issued-error"
            >
              <legend class="govuk-fieldset__legend govuk-fieldset__legend--l">
                <h1 class="govuk-fieldset__heading">
                  When was your passport issued?
                </h1>
              </legend>
              <p id="passport-issued-error" class="govuk-error-message">
                <span class="govuk-visually-hidden">Error:</span> Passport issue
                date must include a year
              </p>
              <div class="govuk-date-input" id="passport-issued">
                <div class="govuk-date-input__item">
                  <div class="govuk-form-group">
                    <label
                      class="govuk-label govuk-date-input__label"
                      for="passport-issued-day"
                    >
                      Day
                    </label>
                    <input
                      class="govuk-input govuk-date-input__input govuk-input--width-2"
                      id="passport-issued-day"
                      name="passport-issued-day"
                      type="text"
                      value="5"
                      inputmode="numeric"
                    />
                  </div>
                </div>
                <div class="govuk-date-input__item">
                  <div class="govuk-form-group">
                    <label
                      class="govuk-label govuk-date-input__label"
                      for="passport-issued-month"
                    >
                      Month
                    </label>
                    <input
                      class="govuk-input govuk-date-input__input govuk-input--width-2"
                      id="passport-issued-month"
                      name="passport-issued-month"
                      type="text"
                      value="12"
                      inputmode="numeric"
                    />
                  </div>
                </div>
                <div class="govuk-date-input__item">
                  <div class="govuk-form-group">
                    <label
                      class="govuk-label govuk-date-input__label"
                      for="passport-issued-year"
                    >
                      Year
                    </label>
                    <input
                      class="govuk-input govuk-date-input__input govuk-input--error govuk-input--width-4"
                      id="passport-issued-year"
                      name="passport-issued-year"
                      type="text"
                      inputmode="numeric"
                    />
                  </div>
                </div>
              </div>
            </fieldset>
          </div>
          <button type="submit" class="govuk-button" data-module="govuk-button">
            Continue
          </button>
        </form>
      </div>
    </div>
  </main>
</div>
```

[Nunjucks](#full-page-example-error-summary-example-nunjucks)

[See options and how to use with Nunjucks](https://design-system.service.gov.uk/components/error-summary/nunjucks/)

```njk
{% from "govuk/components/back-link/macro.njk" import govukBackLink %}
{% from "govuk/components/button/macro.njk" import govukButton %}
{% from "govuk/components/date-input/macro.njk" import govukDateInput %}
{% from "govuk/components/error-summary/macro.njk" import govukErrorSummary %}

{% block containerStart %}
  {{ govukBackLink({
    text: "Back"
  }) }}
{% endblock %}

{% block content %}
  <div class="govuk-grid-row">
    <div class="govuk-grid-column-two-thirds">
      <form action="/form-handler" method="post" novalidate>
        {{ govukErrorSummary({
          titleText: "There is a problem",
          errorList: [
            {
              text: "Passport issue date must include a year",
              href: "#passport-issued-year"
            }
          ]
        }) }}

        {{ govukDateInput({
          fieldset: {
            legend: {
              isPageHeading: true,
              text: "When was your passport issued?",
              classes: "govuk-fieldset__legend--l"
            }
          },
          id: "passport-issued",
          namePrefix: "passport-issued",
          errorMessage: {
            text: "Passport issue date must include a year"
          },
          day: {
            value: 5
          },
          month: {
            value: 12
          },
          year: {
            error: true
          }
          })
        }}

        {{ govukButton({
          text: "Continue"
        }) }}

      </form>
    </div>
  </div>
{% endblock %}
```

## Recent changes

| Date     | Changed                                                                                  | Description |
| -------- | ---------------------------------------------------------------------------------------- | ----------- |
| Jun 2026 | [GOV.UK Frontend v6.2.0](https://github.com/alphagov/govuk-frontend/releases/tag/v6.2.0) |

Fixed component CSS outputting list code twice.

|
| Feb 2025 | Guidance |

Added clarification that GOV.UK Frontend will automatically move keyboard focus to the Error summary component.

|
| Jul 2024 | [GOV.UK Frontend v5.4.1](https://github.com/alphagov/govuk-frontend/releases/tag/v5.4.1) |

Re-added spacing at the bottom of the component that was removed in v5.4.0.

|
| May 2024 | [GOV.UK Frontend v5.4.0](https://github.com/alphagov/govuk-frontend/releases/tag/v5.4.0) |

Fixed an empty `<ul>` element being output when there are no errors to display.

|
| Nov 2022 | [GOV.UK Frontend v4.4.0](https://github.com/alphagov/govuk-frontend/releases/tag/v4.4.0) |

Removed `aria-labelledby` and moved `role="alert"` from the component root to an element nested inside of it. This resolved an issue in the JAWS screen reader where it would not read the entire Error summary.

|

[View full change history](https://design-system.service.gov.uk/components/error-summary/history/)

## Help improve this component

To help make sure that this page is useful, relevant and up to date, you can:

- take part in the [‘Error summary’ discussion on GitHub](https://github.com/alphagov/govuk-design-system/discussions/6252/) and share your research
- [propose a change on GitHub](https://github.com/alphagov/govuk-design-system/edit/main/src/components/error-summary/index.md) – read more about [how to propose changes in GitHub](https://design-system.service.gov.uk/community/propose-a-content-change-using-github/)

## Need help?

If you’ve got a question about the GOV.UK Design System, [contact the team](https://design-system.service.gov.uk/contact/).
