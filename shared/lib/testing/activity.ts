/** A feed activity that passes actionActivityDtoIsVisibleInFeed. */
export const activity = (id: number) => ({
  id,
  type: "user_completed",
  createdAt: "2026-01-01T00:00:00.000Z",
  likedByMe: false,
  likesCount: 0,
  likes: [],
});
