# Date and time

Source: <https://design.gitlab.com/content/date-and-time>

Retrieved: 2026-11-09

Copyright GitLab Inc. The page states no licence; the design.gitlab.com repository is under the MIT License (https://gitlab.com/gitlab-org/gitlab-services/design.gitlab.com/-/blob/main/LICENSE). Converted from HTML to Markdown, with the site's navigation, header and footer left out.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

Dates and times clarify when an event occurred. The way they are formatted should be informative, not disruptive. While users can choose a preferred date and time format, there are occasions when we default to a specified format instead.

## [Date and time options](#date-and-time-options)

### [Absolute format](#absolute-format)

The absolute format clarifies the precise date and time that something occurred.

We can either display a [localized time and date format](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat) based on the user's browser location, or use a non-localized format following the [ISO 8601 standard](https://www.iso.org/iso-8601-date-and-time-format.html).

- Localized dates display the day, month, and full year by default (for example, `Jan 3, 2022`). The date can be shortened to the day and month when space is limited (like `Jan 3`).
  - Use the `numeric` value of the `year` [parameter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#parameters) to display the year in full (for example, `2022`). The shortened version of the year may be used instead if there is limited space (like `22`).
  - For the `month` parameter, use the `short` value (for example, `Mar`). Note that the API will auto-adjust to `full` if the language can't be shortened.
  - For the `day` parameter, use the `numeric` value (for example, `1`).
  - For `timeZoneName`, use either `short` (for example, `UTC-8`) or `long` (such as, `Pacific Standard Time`), depending on space and what is needed to make the time zone clear in context.
- ISO 8601 format is displayed `YYYY-MM-DD`. Time can also be appended to the end of the date if necessary (`HH:MM:SS`).

Dates are localized to each user's browser location. For dates shortened due to limited space, use a tooltip to show the full date, time, and timezone.

| Location          | Locale | Formatted display               |
| ----------------- | ------ | ------------------------------- |
| New York City, US | en-US  | Jan 3, 2022 11:00:00 UTC-5      |
| London, UK        | en-GB  | 3 Jan 2022 16:00:00 GMT (UTC+0) |

### [Relative format](#relative-format)

The relative format communicates the approximate amount of time that has passed since an event occurred; whether that event occurred XX minute(s), hour(s), day(s), week(s), month(s), or year(s) ago. For example, it is used to communicate that an issue was opened `1 minute ago` or `10 months ago`.

When using the relative format, always display the absolute time in a tooltip following the [Guidelines](#guidelines) below.

## [Guidelines](#guidelines)

### [Which format to use when](#which-format-to-use-when)

- Display date and time information in the absolute format unless [users specify they want to use relative formatting](https://docs.gitlab.com/ee/user/profile/preferences.html#use-relative-times) instead.
- If it's possible to detect the browser settings, display the localized time, for example, `Jan 3, 2021`. Otherwise, fall back to displaying the date in ISO 8601: `YYYY-MM-DD` (time is optionally appended after the date, `HH:MM:SS`).

1.  Start: Which date/time format to use?
2.  Does the situation meet the exceptions for always using absolute format?
    - **YES**: → Skip to question 5
    - **NO**: → Continue to next question
3.  Does the situation meet the exceptions for always using relative format?
    - **YES**: → Use relative format (for example, `30 minutes ago`)
    - **NO**: → Continue to next question
4.  Does user set "Use relative format" in preferences? (On by default)
    - **YES**: → Use relative format (for example, `30 minutes ago`)
    - **NO**: → Continue to next question
5.  Can browser detect user's region automatically?
    - **YES**: → Continue to next question
    - **NO**: → Use absolute: ISO 8601 format (for example, `YYYY-MM-DD`)
6.  Is there limited space to display?
    - **YES**: → Use absolute: localized shortened format (for example, `Jan 2` in European style)
    - **NO**: → Use absolute: localized normal format (for example, `Jan 2, 2021` in European style)

### [Exceptions](#exceptions)

In certain scenarios, the date and time are displayed in a specific format and the user's preference is overridden.

Use [absolute format](#absolute-format) when:

- Users need specific dates and/or times for technical, security, or legal reasons. For example, in an audit log, a tax form, or a security alert.
- Users would need to convert relative time to absolute time in order to complete a task.
- A range of time is displayed, for example in a date picker.

Use [relative format](#relative-format) when:

- Content is updated frequently and specifics are not critical. For example, a live newsfeed or notification.

### [Adding timezone data](#adding-timezone-data)

In situations where timezone context is important, for example in alerts or incidents, append the timezone information to the end of the date and time.
