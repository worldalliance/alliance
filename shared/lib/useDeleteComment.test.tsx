import { ExceptionEvent } from "@alliance/common/analytics";
import { CommentDto } from "@alliance/shared/client";
import { act, cleanup, renderHook } from "@testing-library/react";
import { registerAnalytics, type AnalyticsBackend } from "./analytics";
import { routes, serveApi } from "./testing/serveApi";
import { useDeleteComment } from "./useDeleteComment";

let unreachable = false;
let refused: { statusCode: number; message: string } | null = null;
const deleted: number[] = [];

const reported: {
  event: unknown;
  error: unknown;
  properties: unknown;
}[] = [];

// Recorded through the backend rather than a module mock of ./analytics: bun's
// module mocks outlive the file that installs them, and analytics.test.ts tests
// the real captureException.
const recorder: AnalyticsBackend = {
  capture: () => {},
  captureException: (error, properties) => {
    reported.push({
      event: properties?.event,
      error,
      properties: properties?.properties,
    });
  },
};

const api = serveApi(
  routes({
    "DELETE /forum/comments/:id": ({ params }) => {
      if (unreachable) throw new TypeError("Failed to fetch");
      if (refused) {
        return Response.json(refused, { status: refused.statusCode });
      }
      deleted.push(Number(params.id));
      return new Response(null, { status: 204 });
    },
  }),
);

beforeEach(() => {
  registerAnalytics(recorder);
  reported.length = 0;
});

afterEach(() => {
  unreachable = false;
  refused = null;
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

// The hook's own throwOnError: false overrides mobile's config, so it still has
// a response to read the status and the reason off.
it("reads a refusal the client is configured to throw", async () => {
  api.throwingOnRefusal({
    "DELETE /forum/comments/:id": () =>
      Response.json(
        { statusCode: 404, message: "You can only delete your own replies" },
        { status: 404 },
      ),
  });

  const { result, reloads, deleteReply } = renderDelete();

  await deleteReply(5);

  expect(result.current.deleteErrorFor(5)).toBe(
    "You can only delete your own replies",
  );
  expect(reloads).toHaveBeenCalledTimes(1);
});

it("reports a refusal with the status it came back with", async () => {
  const { deleteReply } = renderDelete();

  refused = { statusCode: 404, message: "That reply is no longer here" };
  await deleteReply(5);

  expect(reported).toEqual([
    {
      event: ExceptionEvent.DeleteCommentError,
      error: { statusCode: 404, message: "That reply is no longer here" },
      properties: { replyId: 5, status: 404 },
    },
  ]);
});

it("reports a request that never reached the server", async () => {
  const { deleteReply } = renderDelete();

  unreachable = true;
  await deleteReply(5);

  expect(reported).toEqual([
    {
      event: ExceptionEvent.DeleteCommentError,
      error: expect.any(TypeError),
      properties: { replyId: 5 },
    },
  ]);
});

it("reports nothing for a delete the server took", async () => {
  const { deleteReply } = renderDelete();

  await deleteReply(5);

  expect(reported).toEqual([]);
});
