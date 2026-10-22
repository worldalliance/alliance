import type { PostDto } from "@alliance/shared/client";
import { makeProfile } from "@alliance/shared/lib/testFixtures";

export const postAdmin = (
  id: number,
  title: string,
  overrides: Partial<PostDto> = {},
): PostDto => ({
  id,
  title,
  authorId: 2,
  actionId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  pinned: false,
  visibleAt: null,
  deleted: false,
  qaMode: false,
  expertLabel: null,
  expertIds: [],
  authorIds: [],
  notifyForReplies: false,
  showClusterTags: false,
  author: makeProfile(2),
  editableContent: { body: "", attachments: [] },
  ...overrides,
});
