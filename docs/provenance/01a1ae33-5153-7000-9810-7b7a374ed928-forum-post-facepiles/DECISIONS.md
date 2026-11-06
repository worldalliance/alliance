# Decisions

- Callers that used `findOnePost` only as a visibility check (`LikesService.getPostLikers`, `getCommentLikers`, `FeedMembersService`) call `assertPostVisible`, so they don't load every liker of a post they throw away. (agent decision)
- `ForumLikesService.likePostOrComment` checks post membership against `likesIds` rather than the full `likes` relation. Comments have no liker-id column, so the comment branch still loads `likes`. (agent decision)
- Removing the action endpoint's tests drops no coverage of scheduled-post visibility: the same filter (`addPostVisibilityFilter`) has its own tests through the index, detail and profile endpoints in `forum.e2e-spec.ts`. (agent decision)
