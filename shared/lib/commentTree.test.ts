import { CommentDto } from "@alliance/shared/client";
import { updateCommentInTree } from "./commentTree";

const comment = (id: number, children: CommentDto[] = []): CommentDto => ({
  id,
  parentObjectType: "post",
  parentObjectId: 7,
  deleted: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  pinned: false,
  tagId: null,
  author: {
    id: 1,
    displayName: "Jane Smith",
    profilePicture: "",
    admin: false,
    staff: false,
    ambassador: false,
    profileDescription: null,
    hasActiveContract: true,
    isCommunityLeader: false,
    anonymous: false,
  },
  children,
  likes: [],
  likesCount: 0,
  editableContent: { body: `comment ${id}`, attachments: [] },
});

const like = (target: CommentDto): CommentDto => ({
  ...target,
  likedByMe: true,
  likesCount: target.likesCount + 1,
});

describe("updateCommentInTree", () => {
  it("updates a comment nested under a reply, leaving the tree it was given alone", () => {
    const tree = [comment(1, [comment(2), comment(3, [comment(4)])])];

    const next = updateCommentInTree({ comments: tree, id: 4, update: like });

    expect(next[0].children?.[1].children?.[0]).toMatchObject({
      id: 4,
      likedByMe: true,
      likesCount: 1,
    });
    expect(tree[0].children?.[1].children?.[0].likesCount).toBe(0);
  });

  it("hands back the branches holding nothing that changed", () => {
    const tree = [comment(1, [comment(2)]), comment(3, [comment(4)])];

    const next = updateCommentInTree({ comments: tree, id: 2, update: like });

    expect(next[1]).toBe(tree[1]);
    expect(next[0]).not.toBe(tree[0]);
    expect(next).not.toBe(tree);
  });

  it("hands back the array itself when the id is not in the tree", () => {
    const tree = [comment(1, [comment(2)])];

    expect(updateCommentInTree({ comments: tree, id: 99, update: like })).toBe(
      tree,
    );
  });
});
