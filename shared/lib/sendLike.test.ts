import { withLike } from "./sendLike";

it("counts a missing like count as 0", () => {
  const item: { likedByMe?: boolean; likeCount?: number } = {};
  expect(withLike(item, { liked: true, countKey: "likeCount" })).toEqual({
    likedByMe: true,
    likeCount: 1,
  });
});
