# Notifications

Source: <https://carbondesignsystem.com/patterns/notification-pattern/>

Retrieved: 2026-11-09

Copyright © 2026 IBM. Excerpts only, quoted for the guidelines items that cite this page; the page itself has the rest.

---

> | Type               | Usage                                                                                                                     | Duration and interaction                                                                                                                                              |
> | ------------------ | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
> | Inline             | Provide users with nondisruptive feedback or the status of an action                                                      | Persist until the message is resolved or dismissed by user and may include a ghost button action                                                                      |
> | Toast              | Short, time-based messages that slide in and out of a page and provide nondisruptive information.                         | Toast notifications without actions can disappear automatically or can be dismissed by user. Toast notifications with actions persist until dismissed by user.        |
> | Actionable         | Actionable notifications allow for interactive elements within a notification styled like an inline or toast notification | Persist until action is taken or dismissed by user                                                                                                                    |
> | Callout            | Callouts are used to highlight important information, contextually within the contents of the page.                       | Unlike other notification components, they are not triggered by the user or system. They load with the contents of the page, are persistent, and cannot be dismissed. |
> | Banner             | System or product level notifications that are not specific to a task                                                     | Persist until dismissed by user and may include a ghost button or link                                                                                                |
> | Notification panel | Notification center that provides users with system-generated messages                                                    | Opened and closed by user                                                                                                                                             |
> | Modal              | Highly disruptive notifications that provide users with critical information that needs their attention or action         | Persist and block tasks until dismissed by user. Modals allow more user action than other notifications and can include other Carbon components.                      |
>
> [Inline notifications](https://carbondesignsystem.com/building-blocks/core/components/notification/guidelines) are nondisruptive and confined to a specific area in the UI. Inline notifications display both task-generated and system-generated messages and persist until they are dismissed by the user or the notification is resolved. They are frequently used in conjunction with field-level messages for errors in forms or other input areas.
>
> Actionable notifications styled as toast notifications can only contain one tertiary button. If the toast includes an action button, then the notification should remain on screen until the user dismisses it. With the notification remaining open, the user has enough time to interact with the button without the toast closing too soon.
>
> - An actionable notification should persist until user dismisses it, allowing users time to interact with the notification.
>
> Banners take over the top of an interface to show general notifications for the product or system, not a specific task. They persist until they are dismissed by the user. Depending on the message, the user resolving a product or system issue (for example, updating necessary account information), may dismiss the banner. Banners may also persist across multiple sessions.
>
> **Don’t use notifications that dismiss on a timer for critical or emergency messages.** Some users with disabilities need more time to read or interact with messages and timed actionable toasts may not provide sufficient time. [WCAG 2.1 success criterion 2.2.4 (AAA)](https://www.w3.org/WAI/WCAG21/Understanding/no-timing.html)
