import { CommentDto } from "@alliance/shared/client";
import { CommentSort, sortComments } from "./commentsFilter";

const comment = (
  id: number,
  createdAt: string,
  {
    pinned = false,
    children = [],
  }: { pinned?: boolean; children?: CommentDto[] } = {},
) => ({ id, createdAt, pinned, children }) as CommentDto;

describe("sortComments by newest", () => {
  it("orders pinned comments by their most recent reply, then the rest by their own date", () => {
    const oldPinnedWithNewReply = comment(1, "2026-01-01T00:00:00Z", {
      pinned: true,
      children: [
        comment(2, "2026-01-02T00:00:00Z", {
          children: [comment(3, "2026-03-01T00:00:00Z")],
        }),
      ],
    });
    const newPinnedWithoutReplies = comment(4, "2026-02-01T00:00:00Z", {
      pinned: true,
    });
    const oldUnpinned = comment(5, "2026-01-15T00:00:00Z");
    const newUnpinned = comment(6, "2026-04-01T00:00:00Z");

    const sorted = sortComments(
      [
        oldPinnedWithNewReply,
        newPinnedWithoutReplies,
        oldUnpinned,
        newUnpinned,
      ],
      CommentSort.Newest,
    );

    expect(sorted.map((c) => c.id)).toEqual([1, 4, 6, 5]);
  });
});
