## What the submit changes

On the server a follow-up submission saves a response to the follow-up's form and records a `USER_SUBMITTED_FOLLOW_UP_FORM` activity on the action. The viewer's cached reads that change:

- The form's aggregate views (`queryKeys.taskFormAggregateViews(formId)`), totalled over every response to the form.
- The activity lists (`queryKeys.activitiesAll()`) and the home feed (`resetHomeFeed`): the activity is feed-visible (`ACTION_ACTIVITY_FEED_VISIBLE` in `common/src/actionActivity.ts`), and the home feed includes the viewer's own activity. The web action page renders the action's activity list beside its follow-up panels.
- The actions list (`queryKeys.actions()`): follow-up forms and assignments are filtered by cohort expressions, and a `FormFieldValue` condition can read the answer just submitted.

## The hook

`useTaskFormSubmission` gains `submitFollowUp`, so the viewer's writes of a response to an action's forms, and the caches they move, sit in one hook. The call moves out of `shared/lib/followUpForm.ts`, which drops its lint disable and keeps its pure helpers.

Before, the home pages (web `HomePage`, mobile `(app)/index`) refreshed the actions list and home feed in `onSubmitted`, and the web action page refreshed nothing. Those refreshes move into the hook, so every surface gets them, and `FollowUpFormPanel`'s `onSubmitted` prop, which only carried them, goes on web and mobile.

`submitFollowUp` keeps `submitFollowUpForm`'s contract: it resolves to a `Result`, reports refusals other than changed formula sources, and passes `throwOnError: false` so mobile's throwing client resolves with the refusal too. Plain callback rather than `useMutation`, as for `submit` and `optOut`: callers branch on the refusal and read no pending state.

The home feed is reset rather than invalidated, as its existing callers do, so a paginated feed refetches one page. The activity lists are invalidated: no list mounted beside a follow-up panel pages far.

`queryKeys.action(actionId)` stays alone: it backs link previews and the activity-feed page header, which show nothing a follow-up response changes.
