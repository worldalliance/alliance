import { CommentDto } from "@alliance/shared/client";
import { act, cleanup, renderHook } from "@testing-library/react";

let unreachable = false;
const deleted: number[] = [];

jest.mock("@alliance/shared/client", () => ({
  forumDeleteComment: async (options: { path: { id: number } }) => {
    if (unreachable) throw new TypeError("Failed to fetch");
    deleted.push(options.path.id);
    return {};
  },
}));

import { useDeleteComment } from "./useDeleteComment";

afterEach(() => {
  unreachable = false;
  deleted.length = 0;
  cleanup();
});

const author: CommentDto["author"] = {
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
};

const reply = ({
  id,
  deleted = false,
  children = [],
}: {
  id: number;
  deleted?: boolean;
  children?: CommentDto[];
}): CommentDto => ({
  id,
  parentObjectType: "post",
  parentObjectId: 1,
  deleted,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  pinned: false,
  tagId: null,
  author,
  children,
  likes: [],
  likesCount: 0,
  editableContent: { body: `comment ${id}`, attachments: [] },
});

interface ThreadProps {
  comments: CommentDto[] | null;
}

const renderDelete = () => {
  const reloads = jest.fn();
  const initialProps: ThreadProps = { comments: null };
  const { result, rerender } = renderHook(
    ({ comments }: ThreadProps) =>
      useDeleteComment({ comments, fetchComments: reloads }),
    { initialProps },
  );
  const deleteReply = async (replyId: number) => {
    await act(async () => {
      await result.current.deleteReply(replyId);
    });
  };
  const loads = (comments: CommentDto[]) => rerender({ comments });
  return { result, reloads, deleteReply, loads };
};

it("reloads the thread once the reply is gone", async () => {
  const { result, reloads, deleteReply } = renderDelete();

  await deleteReply(5);

  expect(deleted).toEqual([5]);
  expect(reloads).toHaveBeenCalledTimes(1);
  expect(result.current.deleteErrorFor(5)).toBeNull();
});

it("hangs a request that never landed off the reply it was asked of", async () => {
  const { result, reloads, deleteReply } = renderDelete();

  unreachable = true;
  await deleteReply(5);

  expect(result.current.deleteErrorFor(5)).toBe("Failed to delete reply");
  expect(result.current.deleteErrorFor(3)).toBeNull();
  expect(reloads).not.toHaveBeenCalled();
});

it("takes the message back when the reader dismisses it", async () => {
  const { result, deleteReply } = renderDelete();

  unreachable = true;
  await deleteReply(5);

  act(() => {
    result.current.clearDeleteError(5);
  });

  expect(result.current.deleteErrorFor(5)).toBeNull();
});

it("takes the message back when the reader tries again", async () => {
  const { result, deleteReply } = renderDelete();

  unreachable = true;
  await deleteReply(5);

  unreachable = false;
  await deleteReply(5);

  expect(result.current.deleteErrorFor(5)).toBeNull();
});

it("keeps a message for every reply whose delete failed", async () => {
  const { result, deleteReply } = renderDelete();

  unreachable = true;
  await deleteReply(5);
  await deleteReply(7);

  expect(result.current.deleteErrorFor(5)).toBe("Failed to delete reply");
  expect(result.current.deleteErrorFor(7)).toBe("Failed to delete reply");
});

it("leaves a message the reader has not read when another reply goes", async () => {
  const { result, deleteReply } = renderDelete();

  unreachable = true;
  await deleteReply(5);

  unreachable = false;
  await deleteReply(7);

  expect(deleted).toEqual([7]);
  expect(result.current.deleteErrorFor(5)).toBe("Failed to delete reply");
});

it("takes the message back when a reload shows the reply deleted", async () => {
  const { result, deleteReply, loads } = renderDelete();

  unreachable = true;
  await deleteReply(5);

  loads([reply({ id: 5, deleted: true })]);

  expect(result.current.deleteErrorFor(5)).toBeNull();
});

it("finds the deleted reply under the comment it hangs from", async () => {
  const { result, deleteReply, loads } = renderDelete();

  unreachable = true;
  await deleteReply(6);

  loads([reply({ id: 5, children: [reply({ id: 6, deleted: true })] })]);

  expect(result.current.deleteErrorFor(6)).toBeNull();
});

it("keeps the message when a reload still shows the reply", async () => {
  const { result, deleteReply, loads } = renderDelete();

  unreachable = true;
  await deleteReply(5);

  loads([reply({ id: 5 })]);

  expect(result.current.deleteErrorFor(5)).toBe("Failed to delete reply");
});
