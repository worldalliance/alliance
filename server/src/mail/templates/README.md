# Email templates

Every automatic email extends `layout.pug`, so members get one recognisable design: the email's text in a white card, a full-width green button, then "The Alliance" logotype with grey links to the site. A good new email reads like the others: short paragraphs, one clear next step, nothing that feels like marketing.

## Rules

- **Every email has a button**, except one-time code emails, where the reader types the code into the tab they came from, and emails staff write themselves, where the button is theirs to choose. Call `+button(url, label)` where the email's main link belongs, usually after the text that leads up to it. Don't also show the button's URL as text; a URL the reader is meant to copy, such as a waitlist share link, stays.
- **Button labels** are short verbs in sentence case: "Verify email", "Start reviewing", "Join again".
- **Small print** (who can ignore the email, when a code expires) goes under the button as `p.fine-print`, which renders 14px grey.
- **Wording:** "agreement", never "contract"; "paused", never "suspended"; members complete or enter into the agreement, they don't "sign" it.
- The layout reads `siteUrl`, which `MailService.renderHtml` supplies; templates don't pass it.
- Links the layout carries for navigation are marked `data-untracked`, so opening them doesn't mark the email clicked.

## Signup confirmation pattern

For a project that people sign up for ahead of its start, such as one with a waitlist, the confirmation is: greeting, thanks naming the project, the time it takes and how long it runs, a line saying we'll tell them when it begins, then a button to a preview of the work. The Safer Chatbots for Children version, which was designed but not shipped:

```pug
extends layout.pug

block title
  | Thank you for signing up for Safer Chatbots for Children

block content
  p Hi #{name},
  p Thank you for signing up for Safer Chatbots for Children with the Alliance!
  p This project will be ~1 hour of work and will run through Early 2027.
  p We’ll let you know when it begins!
  +button(url, "See a demo task")
```

Subject: "Thank you for signing up for [project]". The button links to the project page.
