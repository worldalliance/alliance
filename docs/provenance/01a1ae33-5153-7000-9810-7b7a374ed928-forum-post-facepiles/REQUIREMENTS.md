---
user: Charles Lien
task: Fix ALL-2048 and ALL-2049 in one PR. ALL-2049, delete the unused GET /forum/posts/action/:actionId endpoint; ALL-2048, build post like facepiles with the bounded facepile query on every post endpoint.
---

# Requirements

- Delete `GET /forum/posts/action/:actionId` and its service method, together with its test coverage, and regenerate the shared API client with the repo's codegen rather than editing generated files. No client calls it. (user-originated, ALL-2049)
- Every forum post endpoint builds its `likes` facepile with `FacepileService.loadFacepiles` instead of loading every liker's full user row, all in the same change, because clients keep one normalized record per post and a post's `likes` must not depend on which response arrived last. `likeCount` and `likedByMe` keep coming from the post's liker ids. (user-originated, ALL-2048)
- Check `forum-likes.service.ts` and `forum-admin.service.ts` for post loads of the full likes relation. (user-originated, ALL-2048)
- `server/test/forum-post-records.e2e-spec.ts` checks the full facepile shape in its `likes` expectation. (user-originated, ALL-2048)
