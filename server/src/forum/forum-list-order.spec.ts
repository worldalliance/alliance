import { byForumListOrder } from "./forum-list-order";

const entry = (params: {
  name: string;
  updatedAt: string;
  pinned?: boolean;
  lastCommentAt?: string;
}) => ({
  name: params.name,
  post: {
    pinned: params.pinned ?? false,
    updatedAt: new Date(params.updatedAt),
  },
  lastComment: params.lastCommentAt
    ? { createdAt: new Date(params.lastCommentAt) }
    : undefined,
});

describe("byForumListOrder", () => {
  it("puts pinned posts first, then the latest comment or update", () => {
    const entries = [
      entry({ name: "updated", updatedAt: "2026-01-03" }),
      entry({ name: "stale", updatedAt: "2026-01-01" }),
      entry({ name: "pinned", updatedAt: "2025-01-01", pinned: true }),
      entry({
        name: "commented",
        updatedAt: "2026-01-02",
        lastCommentAt: "2026-01-04",
      }),
      entry({
        name: "pinned recent",
        updatedAt: "2025-06-01",
        pinned: true,
      }),
    ];

    expect(entries.sort(byForumListOrder).map(({ name }) => name)).toEqual([
      "pinned recent",
      "pinned",
      "commented",
      "updated",
      "stale",
    ]);
  });
});
