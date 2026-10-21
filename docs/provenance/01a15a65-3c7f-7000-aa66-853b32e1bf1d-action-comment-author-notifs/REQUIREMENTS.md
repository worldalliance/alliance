---
user: Alex Dorey
task: When someone comments on an action, the action's authors and the authors of posts linked to it get a notification
---

## User-origin requirements

- When someone comments on an action, two groups get a notification:
  - Action authors: the users an admin sets on the action, which the action page lists as "Contributors".
  - Linked post authors: the author and co-authors of every forum post linked to the action.
- The user chose both groups over the agent's narrower proposal of action authors only.
- Code, tests, and docs name these recipients as action authors and linked post authors. They introduce no collective term such as "owners", because actions have no owner concept.

## Agent-proposed, user-approved

- Linked posts count only while visible and not deleted: the post's visibility time has passed and the post has no deletion. Any signed-in member who writes a linked post becomes a recipient, and that is accepted.
- Every comment in the action's own comment thread notifies both groups: top-level comments and replies at any depth. Comments on activities posted under the action, and comments on linked posts, do not.
- The comment's author never gets a notification about their own comment.
- Each recipient gets at most one notification per comment, even when they are both an action author and a linked post author.
- A recipient who is also the author of the comment being replied to gets only the existing reply notification, unchanged in copy and in text and email behavior.
- The existing "Comments & replies" notification preference controls the notification. There is no new preference setting. These notifications go out in-app and by push, as that preference allows. They never go out by text or email.
- One notification per comment, with no grouping or stacking.
- The copy is `<commenter's public name> commented on <action name>: <comment excerpt>`, for example "Sam Lee commented on Call your rep: I called today…". Replies use the same copy.
- Tapping or clicking the notification opens the comment on the action page, as reply notifications do today.
- No backfill: only comments created after release send these notifications.
