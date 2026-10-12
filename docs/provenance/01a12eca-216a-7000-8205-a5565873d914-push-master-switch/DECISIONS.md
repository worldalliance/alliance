## Decisions

- The rule lives in `notificationPushesEnabled(user, category)` in `server/src/user/user.utils.ts`, beside `userActionNotifsEnabled_push` and the email and text eligibility helpers. It is a `Record<NotificationCategory, boolean>`, so a new category fails the build until someone states its preference.
- The master switch blocks every category, including those with no per-category preference. Email and text already treat `turnedOffAllNotifs` this way: every notification email (action reminders, contract suspension, forum digest) and every text (`textable`) checks it, and only transactional mail (welcome, password reset, waitlist) ignores it. No push category is transactional, and members cannot set the switch themselves (it is absent from `UpdateProfileDto`), so it acts as an admin-set "contact this member by no notification channel".
- Unread content maps its `UnreadContentType` onto the `NotificationCategory` of the same name in the dispatcher, so both dispatcher paths share one per-category answer.
- `message-push.listener.ts` keeps its own `pushesForMessages` and `turnedOffAllNotifs` checks: messages are not a notification category, and that check already honors the master switch.
- The first commit moves the rule into the helper with behavior unchanged; the second applies the master switch to every category, so each deploys alone.
