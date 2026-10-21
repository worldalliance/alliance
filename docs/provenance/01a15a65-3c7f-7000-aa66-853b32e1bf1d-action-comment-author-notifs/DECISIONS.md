## Where it hooks in

`ForumCommentService.sendNotifsForNewComment` (`server/src/forum/forum-comment.service.ts`) has a branch for post and activity comments and none for action comments, where a TODO asks for exactly this. The new branch, `actionAndLinkedPostAuthors`, adds the action authors and linked post authors to the same recipient list. That list already removes the comment author and the parent comment's author, and drops duplicate recipients, which covers the self, overlap, and one-per-comment requirements in REQUIREMENTS.md.

For a reply, the comment's `parentObjectType` is still `action`, so one branch covers top-level comments and replies.

## Recipients

- Action authors: `Action.authors`.
- Linked post authors: `Post.author` and `Post.authors` for posts linked through `actionId`, filtered by `filterVisiblePosts` (`server/src/forum/post-visibility.ts`) with no viewer. With no viewer it keeps undeleted posts whose `visibleAt` is null or past, the same rule as a member who doesn't author the post.
- Recipients are loaded when the comment is created. Changing an action's authors or posts later leaves notifications that were already sent alone.

## Storage and preference

- The rows are `UnreadContent` rows with `contentType = forum_reply`, the type reply notifications use. That type already maps to the `CommentsAndReplies` kind, so `visible` and the push dispatcher's preference check work unchanged. No enum value, preference kind, or migration is needed.
- The new branch sends no text or email. Only the existing reply path can, for posts with `notifyForReplies`.

## Copy

- `actionCommentContent`, next to `forumReplyContent` in `server/src/notifs/notification-content.ts`, builds the message from the User, Action, and CommentExcerpt segments, so `<name> commented on <action>: <excerpt>`. All three segment types already exist, so the existing format is enough and no new `NotificationFormat` is needed.
- The `ForumReply` unread-content source in `notifs.service.ts` takes an optional `actionId`. With it, the row stores the "commented on <action>" copy. Without it, the row stores the reply copy. A new `UnreadContentType` would have needed a migration and a new preference mapping, and these rows still mean "a comment for you to read".
- The `ForumReply` render branch in `notification-render.service.ts` reads the stored content, so both kinds of row render from the same branch, with `commentUrl` as the link. `NotificationReferencesService.resolve` loads the actions that segments reference for both tables. An action that is gone renders as nothing, so the row drops out.

## Access, edits, deletion

- Rendering already drops notifications about actions the recipient can't open (`notification-references.service.ts`). A recipient who loses access stops seeing the row, and nothing is filtered when the row is sent.
- Editing a comment sends nothing new.
- Deleting a comment soft-deletes only the `Notification` rows tied to it. `UnreadContent` rows drop out at render time instead, because the comment no longer loads. This is the same as reply notifications today.

## Apps

The web and mobile clients render notifications generically from `message` and the link, so no client change is expected. Admin has no notification UI. The Slack staff ping on action comments stays.

## Tests

The tests live in their own file, `server/test/action-comment-author-notifs.e2e-spec.ts`, because `forum.e2e-spec.ts` is far past the 500-line limit. They cover:

- Action author and linked post author recipients.
- Scheduled and deleted posts excluded.
- No notification for the commenter.
- One notification when someone is both an action author and a post author.
- A recipient who is the parent comment's author getting only the reply notification.
- The rendered copy and link.
