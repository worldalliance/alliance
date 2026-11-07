# Task list

Source: <https://design-system.service.gov.uk/components/task-list/>

Retrieved: 2026-11-06

Contains public sector information licensed under the Open Government Licence v3.0 (https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/). © Crown copyright. Converted from HTML to Markdown, with the site's navigation, header and footer left out.

---

- [History for](https://design-system.service.gov.uk/components/task-list/history/)
- [Use with Nunjucks for](https://design-system.service.gov.uk/components/task-list/nunjucks/)

The task list component displays all the tasks a user needs to do, and allows users to easily identify which ones are done and which they still need to do.

[Open this example in a new tab: task list](https://design-system.service.gov.uk/components/task-list/default/)

- [HTML](#default-1-html)
- [Nunjucks](#default-1-nunjucks)

[HTML](#default-1-html)

```html
<ul class="govuk-task-list">
  <li class="govuk-task-list__item govuk-task-list__item--with-link">
    <div class="govuk-task-list__name-and-hint">
      <a
        class="govuk-link govuk-task-list__link"
        href="#"
        aria-describedby="company-details-1-status"
      >
        Company Directors
      </a>
    </div>
    <div class="govuk-task-list__status" id="company-details-1-status">
      Completed
    </div>
  </li>
  <li class="govuk-task-list__item govuk-task-list__item--with-link">
    <div class="govuk-task-list__name-and-hint">
      <a
        class="govuk-link govuk-task-list__link"
        href="#"
        aria-describedby="company-details-2-status"
      >
        Registered company details
      </a>
    </div>
    <div class="govuk-task-list__status" id="company-details-2-status">
      <strong class="govuk-tag govuk-tag--blue"> Incomplete </strong>
    </div>
  </li>
  <li class="govuk-task-list__item govuk-task-list__item--with-link">
    <div class="govuk-task-list__name-and-hint">
      <a
        class="govuk-link govuk-task-list__link"
        href="#"
        aria-describedby="company-details-3-hint company-details-3-status"
      >
        Financial history
      </a>
      <div id="company-details-3-hint" class="govuk-task-list__hint">
        Include 5 years of the company’s relevant financial information
      </div>
    </div>
    <div class="govuk-task-list__status" id="company-details-3-status">
      <strong class="govuk-tag govuk-tag--blue"> Incomplete </strong>
    </div>
  </li>
  <li class="govuk-task-list__item govuk-task-list__item--with-link">
    <div class="govuk-task-list__name-and-hint">
      <a
        class="govuk-link govuk-task-list__link"
        href="#"
        aria-describedby="company-details-4-status"
      >
        Business plan
      </a>
    </div>
    <div class="govuk-task-list__status" id="company-details-4-status">
      <strong class="govuk-tag govuk-tag--blue"> Incomplete </strong>
    </div>
  </li>
  <li class="govuk-task-list__item govuk-task-list__item--with-link">
    <div class="govuk-task-list__name-and-hint">
      <a
        class="govuk-link govuk-task-list__link"
        href="#"
        aria-describedby="company-details-5-status"
      >
        References
      </a>
    </div>
    <div class="govuk-task-list__status" id="company-details-5-status">
      <strong class="govuk-tag govuk-tag--blue"> Incomplete </strong>
    </div>
  </li>
</ul>
```

[Nunjucks](#default-1-nunjucks)

[See options and how to use with Nunjucks](https://design-system.service.gov.uk/components/task-list/nunjucks/)

```njk
{% from "govuk/components/task-list/macro.njk" import govukTaskList %}

{{ govukTaskList({
  idPrefix: "company-details",
  items: [
    {
      title: {
        text: "Company Directors"
      },
      href: "#",
      status: {
        text: "Completed"
      }
    },
    {
      title: {
        text: "Registered company details"
      },
      href: "#",
      status: {
        tag: {
          text: "Incomplete",
          classes: "govuk-tag--blue"
        }
      }
    },
    {
      title: {
        text: "Financial history"
      },
      hint: {
        text: "Include 5 years of the company’s relevant financial information"
      },
      href: "#",
      status: {
        tag: {
          text: "Incomplete",
          classes: "govuk-tag--blue"
        }
      }
    },
    {
      title: {
        text: "Business plan"
      },
      href: "#",
      status: {
        tag: {
          text: "Incomplete",
          classes: "govuk-tag--blue"
        }
      }
    },
    {
      title: {
        text: "References"
      },
      href: "#",
      status: {
        tag: {
          text: "Incomplete",
          classes: "govuk-tag--blue"
        }
      }
    }
  ]
}) }}
```

## When to use this component

Use the task list to give users more control over how they complete long, complex services.

Only use the task list if there’s evidence that users:

- do not want to, or cannot, complete all the tasks in one sitting
- need to be able to choose the order they complete the tasks in

## When not to use this component

Try to simplify the service before you use a task list. If you’re able to reduce the number of tasks or steps involved, you might not need one.

Do not use the task list for a long service that needs to be completed in a specific order. If it needs to be completed over multiple sessions, consider allowing users to save their progress, and then to continue where they left off when they return. Use the start page to explain what users will be expected to do during the service.

The task list should not be used as a way of showing users their answers. For this, you should use a [Summary list component](https://design-system.service.gov.uk/components/summary-list/) instead.

## How it works

There are 2 ways to use the task list component. You can use HTML or, if you’re using [Nunjucks](https://mozilla.github.io/nunjucks/) or the [GOV.UK Prototype Kit](https://prototype-kit.service.gov.uk/docs/), you can use the Nunjucks macro.

[Open this example in a new tab: task list second](https://design-system.service.gov.uk/components/task-list/default/)

- [HTML](#task-list-second-example-html)
- [Nunjucks](#task-list-second-example-nunjucks)

[HTML](#task-list-second-example-html)

```html
<ul class="govuk-task-list">
  <li class="govuk-task-list__item govuk-task-list__item--with-link">
    <div class="govuk-task-list__name-and-hint">
      <a
        class="govuk-link govuk-task-list__link"
        href="#"
        aria-describedby="company-details-1-status"
      >
        Company Directors
      </a>
    </div>
    <div class="govuk-task-list__status" id="company-details-1-status">
      Completed
    </div>
  </li>
  <li class="govuk-task-list__item govuk-task-list__item--with-link">
    <div class="govuk-task-list__name-and-hint">
      <a
        class="govuk-link govuk-task-list__link"
        href="#"
        aria-describedby="company-details-2-status"
      >
        Registered company details
      </a>
    </div>
    <div class="govuk-task-list__status" id="company-details-2-status">
      <strong class="govuk-tag govuk-tag--blue"> Incomplete </strong>
    </div>
  </li>
  <li class="govuk-task-list__item govuk-task-list__item--with-link">
    <div class="govuk-task-list__name-and-hint">
      <a
        class="govuk-link govuk-task-list__link"
        href="#"
        aria-describedby="company-details-3-hint company-details-3-status"
      >
        Financial history
      </a>
      <div id="company-details-3-hint" class="govuk-task-list__hint">
        Include 5 years of the company’s relevant financial information
      </div>
    </div>
    <div class="govuk-task-list__status" id="company-details-3-status">
      <strong class="govuk-tag govuk-tag--blue"> Incomplete </strong>
    </div>
  </li>
  <li class="govuk-task-list__item govuk-task-list__item--with-link">
    <div class="govuk-task-list__name-and-hint">
      <a
        class="govuk-link govuk-task-list__link"
        href="#"
        aria-describedby="company-details-4-status"
      >
        Business plan
      </a>
    </div>
    <div class="govuk-task-list__status" id="company-details-4-status">
      <strong class="govuk-tag govuk-tag--blue"> Incomplete </strong>
    </div>
  </li>
  <li class="govuk-task-list__item govuk-task-list__item--with-link">
    <div class="govuk-task-list__name-and-hint">
      <a
        class="govuk-link govuk-task-list__link"
        href="#"
        aria-describedby="company-details-5-status"
      >
        References
      </a>
    </div>
    <div class="govuk-task-list__status" id="company-details-5-status">
      <strong class="govuk-tag govuk-tag--blue"> Incomplete </strong>
    </div>
  </li>
</ul>
```

[Nunjucks](#task-list-second-example-nunjucks)

[See options and how to use with Nunjucks](https://design-system.service.gov.uk/components/task-list/nunjucks/)

```njk
{% from "govuk/components/task-list/macro.njk" import govukTaskList %}

{{ govukTaskList({
  idPrefix: "company-details",
  items: [
    {
      title: {
        text: "Company Directors"
      },
      href: "#",
      status: {
        text: "Completed"
      }
    },
    {
      title: {
        text: "Registered company details"
      },
      href: "#",
      status: {
        tag: {
          text: "Incomplete",
          classes: "govuk-tag--blue"
        }
      }
    },
    {
      title: {
        text: "Financial history"
      },
      hint: {
        text: "Include 5 years of the company’s relevant financial information"
      },
      href: "#",
      status: {
        tag: {
          text: "Incomplete",
          classes: "govuk-tag--blue"
        }
      }
    },
    {
      title: {
        text: "Business plan"
      },
      href: "#",
      status: {
        tag: {
          text: "Incomplete",
          classes: "govuk-tag--blue"
        }
      }
    },
    {
      title: {
        text: "References"
      },
      href: "#",
      status: {
        tag: {
          text: "Incomplete",
          classes: "govuk-tag--blue"
        }
      }
    }
  ]
}) }}
```

Users should be able to complete tasks in whatever order they like.

The status alongside the task indicates whether they can start it. Users can select a task to start completing it. Once they have completed it and returned to the task list, the status for that task will have changed to ‘Completed’.

Users can only move on from the task list when all tasks are shown as ‘Completed’.

Read the [Complete multiple tasks pattern guidance](https://design-system.service.gov.uk/patterns/complete-multiple-tasks/) for more information on how to use the task list within a service.

### Tasks

Tasks are usually actions that the user needs to take to complete a service. In a task list, the user should be able to choose to complete tasks in any order that works for them.

Each task within a task list includes a task name and a status. It can also include hint text if you decide this is needed.

The whole row is linked, allowing users to select anywhere within it to start the task.

#### Write clear task descriptions

The task name gives users a reasonable expectation of what that task is about. For example, ‘Your contact details’ or ‘Upload evidence’. Use sentence case, and keep it short. Users of screen readers might find it difficult to navigate the task list if the task names are too long.

If you’re finding it difficult to come up with a clear and concise task name, it might be because the task itself is too complex and may need to be separated into smaller tasks. Group questions and actions into tasks in a way that makes sense to users, based on their needs.

#### Adding hint text

Only use hint text if there is evidence that the user needs more information about what the task will include.

Keep hint text to a single short sentence, without any full stops. Screen readers will read out the entire text when users interact with the task link. This could frustrate users if the text is long.

Do not include links within the hint text. The whole task row links users to the task itself, so any links within the hint text will not work.

#### Grouping tasks

If there are a lot of tasks to complete, you might find that grouping them makes it easier for users to understand and plan what they need to do. Tasks can be grouped into separate task lists on a page. Give each task list a short heading that clearly explains the grouping.

Read the [Complete multiple tasks pattern guidance](https://design-system.service.gov.uk/patterns/complete-multiple-tasks/) for more information on grouping tasks.

### Statuses

Statuses use colour and a short descriptor to give users a quick overview of how much of the task list they have completed, and how much is left to do.

Read the [Complete multiple tasks pattern guidance](https://design-system.service.gov.uk/patterns/complete-multiple-tasks/) for more information on status colours and text.

## Research on this component

This component was created by a cross-government group using research from the previous task list pattern.

### Linking the whole task row to the task

User feedback from the task list pattern has shown that some users currently try to select task statuses, thinking they are buttons or links. The statuses have been redesigned to look less like buttons, and now the whole task row is linked so that users can select anywhere within it to enter and begin the task.

### Formatting of statuses

The use of uppercase in task statuses makes them harder to read. User research has also shown that once a few tasks have been completed, it is harder for users to scan the page and spot incomplete tasks.

Statuses are now written in sentence case to make them easier to read. The ‘Completed’ task now uses black text with no background colour, which will draw more attention to tasks that require action.

We have also introduced a new colour palette for statuses, using colour contrasts that meet accessibility guidance.

### Known issues and gaps

While this new component is based on user research from the task list pattern, we still need to carry out user testing with this new component. In particular, we would like to test the following assumptions:

- the benefits of linking the whole task row outweigh the risks of accidental clicking
- the contrast of the statuses is sufficient
- the suggested wording of the statuses make the most sense to users

If you are using this component in a service, we would like to hear about any user research so that we can identify any potential issues.

## Recent changes

| Date     | Changed                                                                                  | Description |
| -------- | ---------------------------------------------------------------------------------------- | ----------- |
| Aug 2024 | [GOV.UK Frontend v5.5.0](https://github.com/alphagov/govuk-frontend/releases/tag/v5.5.0) |

Fixed task list rows being rendered when no content was provided for them.

|
| Dec 2023 | [GOV.UK Frontend v5.0.0](https://github.com/alphagov/govuk-frontend/releases/tag/v5.0.0) |

Component introduced.

|

[View full change history](https://design-system.service.gov.uk/components/task-list/history/)

## Help improve this component

To help make sure that this page is useful, relevant and up to date, you can:

- take part in the [‘Task list’ discussion on GitHub](https://github.com/alphagov/govuk-design-system/discussions/6251/) and share your research
- [propose a change on GitHub](https://github.com/alphagov/govuk-design-system/edit/main/src/components/task-list/index.md) – read more about [how to propose changes in GitHub](https://design-system.service.gov.uk/community/propose-a-content-change-using-github/)

## Need help?

If you’ve got a question about the GOV.UK Design System, [contact the team](https://design-system.service.gov.uk/contact/).
