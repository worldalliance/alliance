## Decisions

- The helpers live in `common/src/postAuthors.ts`, typed structurally so the server's `Post` entity and the clients' `PostDto` both satisfy them. Both expose `authorId`, `author`, and `authors`.
- Byline and permission are two separate helpers, `postBylineAuthors` and `isPostAuthor`. Admins can set a co-author list that leaves out the creator (`updatePostSettings`). The byline then omits the creator, but the server still lets the creator edit and delete. Deriving permission from the byline would revoke the creator's access.
- `isPostAuthor` reads `authorIds`, which the entity (`@RelationId`) and `PostDto` always carry, so its answer does not depend on whether the caller loaded the `authors` relation.
- `postBylineAuthors` accepts an unloaded `author` and returns an empty list then, as the export already did. The clients' `PostDto.author` is always present, so they see no difference.
- Notification recipients (`getUniquePostAuthors`, the reply notification in `forum.service.ts`) take the union of creator and co-authors. That decides who hears about activity, not who is credited or who may edit, so it stays separate.
- The scheduled-post check (`visibleAt` in the future) repeated in the same web and mobile files is a visibility rule, not an authorship rule. It stays out of this commit and goes to a follow-up issue.
- Mobile has no post edit screen. Bringing post editing to mobile is a separate feature, so this change adds only the co-author byline and co-author Delete.
