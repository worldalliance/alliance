import { CommentDto } from "@alliance/shared/client";
import { act, cleanup, renderHook } from "@testing-library/react";
import { client } from "../client/client.gen";
import * as realSdk from "../client/sdk.gen";

let unreachable = false;
let refused: { statusCode: number; message: string } | null = null;
const deleted: number[] = [];
// While set, the call goes to the generated client rather than the canned
// answer below, which is the only way to see how a refusal really arrives.
let throughRealClient = false;
const clientConfig = client.getConfig();

jest.mock("@alliance/shared/client", () => {
  // Read before the mock takes the name over, or real(options) lands back in
  // here.
  const real = realSdk.forumDeleteComment;
  return {
    forumDeleteComment: async (options: Parameters<typeof real>[0]) => {
      if (throughRealClient) return real(options);
      if (unreachable) throw new TypeError("Failed to fetch");
      if (refused) {
        return {
          error: refused,
          response: new Response(null, { status: refused.statusCode }),
        };
      }
      deleted.push(options.path.id);
      return {};
    },
  };
});

import { useDeleteComment } from "./useDeleteComment";

afterEach(() => {
  unreachable = false;
  refused = null;
  deleted.length = 0;
  throughRealClient = false;
  client.setConfig({ ...clientConfig, fetch: undefined, throwOnError: false });
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

it("reads the reason off a delete the server refused", async () => {
  const { result, deleteReply } = renderDelete();

  refused = {
    statusCode: 404,
    message: "You can only delete your own replies",
  };
  await deleteReply(5);

  expect(result.current.deleteErrorFor(5)).toBe(
    "You can only delete your own replies",
  );
});

it("reloads the thread a refusal answered for", async () => {
  const { reloads, deleteReply } = renderDelete();

  refused = { statusCode: 404, message: "That reply is no longer here" };
  await deleteReply(5);

  expect(reloads).toHaveBeenCalledTimes(1);
});

it("says the session went rather than repeating the server's word for it", async () => {
  const { result, deleteReply } = renderDelete();

  refused = { statusCode: 401, message: "Unauthorized" };
  await deleteReply(5);

  expect(result.current.deleteErrorFor(5)).toBe(
    "Your session has expired. Sign in again to delete this reply.",
  );
});

it("leaves the thread alone when the session is what went", async () => {
  const { reloads, deleteReply } = renderDelete();

  refused = { statusCode: 401, message: "Unauthorized" };
  await deleteReply(5);

  expect(reloads).not.toHaveBeenCalled();
});

it("keeps the server's own fault out of the reader's message", async () => {
  const { result, deleteReply } = renderDelete();

  refused = { statusCode: 500, message: "Internal server error" };
  await deleteReply(5);

  expect(result.current.deleteErrorFor(5)).toBe("Failed to delete reply");
});

// Mobile configures the client like this. Throwing hands the hook a rejection
// with no response, and so no status or reason to read.
it("reads a refusal the client is configured to throw", async () => {
  throughRealClient = true;
  client.setConfig({
    baseUrl: "https://comments.test",
    throwOnError: true,
    fetch: async () =>
      new Response(
        JSON.stringify({
          statusCode: 404,
          message: "You can only delete your own replies",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      ),
  });

  const { result, reloads, deleteReply } = renderDelete();

  await deleteReply(5);

  expect(result.current.deleteErrorFor(5)).toBe(
    "You can only delete your own replies",
  );
  expect(reloads).toHaveBeenCalledTimes(1);
});
