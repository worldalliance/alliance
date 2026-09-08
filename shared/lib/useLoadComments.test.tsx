import { ExceptionEvent } from "@alliance/common/analytics";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { CommentDto, CommentParentObject } from "../client";
import { client } from "../client/client.gen";
import * as realSdk from "../client/sdk.gen";

const requests: { endpoint: string; id: string }[] = [];
// A null thread stands for a request the server refused, answered with the
// status and body below.
let served: CommentDto[] | null = [];
const DEFAULT_REFUSAL = {
  status: 403,
  body: { statusCode: 403, message: "the server said no" },
};
let refusal: { status: number; body: unknown } = DEFAULT_REFUSAL;
let unreachable = false;
// While set, a request parks its resolver here instead of answering, so a test
// can land two of them out of order.
let inFlight: ((thread: CommentDto[] | null) => void)[] | null = null;
// While set, the call goes to the generated client rather than the canned
// answer below, which is the only way to see how a refusal really arrives.
let throughRealClient = false;
const clientConfig = client.getConfig();

const record =
  <O extends { path: { id: string } }, T>(
    endpoint: string,
    real: (options: O) => T,
  ) =>
  async (options: O) => {
    if (throughRealClient) return real(options);
    requests.push({ endpoint, id: options.path.id });
    if (unreachable) throw new TypeError("Failed to fetch");
    const thread = inFlight
      ? await new Promise<CommentDto[] | null>((resolve) =>
          inFlight?.push(resolve),
        )
      : served;
    if (!thread) {
      return {
        error: refusal.body,
        response: new Response(null, { status: refusal.status }),
      };
    }
    return { data: thread };
  };

const reported: {
  event: ExceptionEvent;
  error: unknown;
  properties: unknown;
}[] = [];

jest.mock("./analytics", () => ({
  captureException: (
    event: ExceptionEvent,
    error: unknown,
    properties: unknown,
  ) => {
    reported.push({ event, error, properties });
  },
}));

jest.mock("@alliance/shared/client", () => ({
  forumFindCommentsForPost: record("post", realSdk.forumFindCommentsForPost),
  forumFindCommentsForActivity: record(
    "activity",
    realSdk.forumFindCommentsForActivity,
  ),
  forumFindCommentsForAction: record(
    "action",
    realSdk.forumFindCommentsForAction,
  ),
}));

import { useLoadComments } from "./useLoadComments";

const comment = (id: number): CommentDto => ({
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
  children: [],
  likes: [],
  likesCount: 0,
  editableContent: { body: "a comment", attachments: [] },
});

afterEach(() => {
  requests.length = 0;
  reported.length = 0;
  served = [];
  refusal = DEFAULT_REFUSAL;
  unreachable = false;
  inFlight = null;
  throughRealClient = false;
  client.setConfig({ ...clientConfig, fetch: undefined, throwOnError: false });
  cleanup();
});

const endpointFor: Record<CommentParentObject, string> = {
  post: "post",
  activity: "activity",
  action: "action",
};

for (const type of Object.keys(endpointFor) as CommentParentObject[]) {
  it(`asks the ${type} endpoint for a ${type} thread`, async () => {
    renderHook(() => useLoadComments({ objectId: 7, type }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests).toEqual([{ endpoint: endpointFor[type], id: "7" }]);
  });
}

it("skips the request when the caller already has the thread", async () => {
  const initialComments = [comment(3)];

  const { result } = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post", initialComments }),
  );

  await waitFor(() => expect(result.current.comments).toBe(initialComments));
  expect(requests).toEqual([]);
});

it("takes the thread the caller hands down after a refresh", async () => {
  const { result, rerender } = renderHook(
    ({ initialComments }: { initialComments: CommentDto[] }) =>
      useLoadComments({ objectId: 7, type: "post", initialComments }),
    { initialProps: { initialComments: [comment(3)] } },
  );

  const refreshed = [comment(3), comment(4)];
  rerender({ initialComments: refreshed });

  await waitFor(() => expect(result.current.comments).toEqual(refreshed));
  expect(requests).toEqual([]);
});

it("keeps one caller's thread out of another's", async () => {
  const card = renderHook(
    ({ initialComments }: { initialComments: CommentDto[] }) =>
      useLoadComments({ objectId: 7, type: "post", initialComments }),
    { initialProps: { initialComments: [comment(3)] } },
  );
  await waitFor(() => expect(card.result.current.comments).toHaveLength(1));

  served = [comment(3), comment(4)];
  const screen = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post" }),
  );
  await waitFor(() => expect(screen.result.current.comments).toHaveLength(2));

  // The feed the card follows refreshed while the screen sat over it.
  card.rerender({ initialComments: [comment(3), comment(9)] });

  await waitFor(() =>
    expect(card.result.current.comments?.map((c) => c.id)).toEqual([3, 9]),
  );
  expect(screen.result.current.comments).toHaveLength(2);
});

it("says nothing on a card when the screen's fetch fails", async () => {
  const initialComments = [comment(3)];
  const card = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post", initialComments }),
  );
  await waitFor(() => expect(card.result.current.comments).toHaveLength(1));

  served = null;
  const screen = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post" }),
  );

  await waitFor(() =>
    expect(screen.result.current.error).toBe("the server said no"),
  );
  expect(card.result.current.error).toBeNull();
  expect(card.result.current.comments).toHaveLength(1);
});

it("reports a card's own refetch failing", async () => {
  const initialComments = [comment(3)];
  const { result } = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post", initialComments }),
  );
  await waitFor(() => expect(result.current.comments).toHaveLength(1));

  served = null;
  await act(async () => {
    await result.current.fetchComments();
  });

  expect(result.current.error).toBe("the server said no");
  expect(result.current.comments).toHaveLength(1);
});

it("says the session went rather than repeating the server's word for it", async () => {
  served = null;
  refusal = { status: 401, body: { statusCode: 401, message: "Unauthorized" } };

  const { result } = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post" }),
  );

  await waitFor(() =>
    expect(result.current.error).toBe(
      "Your session has expired. Sign in again to load the replies.",
    ),
  );
});

it("reads the status off the response rather than the body", async () => {
  served = null;
  refusal = { status: 401, body: {} };

  const { result } = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post" }),
  );

  await waitFor(() =>
    expect(result.current.error).toBe(
      "Your session has expired. Sign in again to load the replies.",
    ),
  );
});

it("keeps the server's own fault out of the reader's message", async () => {
  served = null;
  refusal = {
    status: 500,
    body: { statusCode: 500, message: "Internal Server Error" },
  };

  const { result } = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post" }),
  );

  await waitFor(() =>
    expect(result.current.error).toBe("Failed to load comments"),
  );
});

it("offers a second try for a refusal the server was at fault for", async () => {
  served = null;
  refusal = {
    status: 500,
    body: { statusCode: 500, message: "Internal Server Error" },
  };

  const { result } = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post" }),
  );

  await waitFor(() => expect(result.current.canRetry).toBe(true));
});

it("offers none where a second request would be refused the same way", async () => {
  served = null;
  refusal = { status: 401, body: { statusCode: 401, message: "Unauthorized" } };

  const { result } = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post" }),
  );

  await waitFor(() =>
    expect(result.current.error).toBe(
      "Your session has expired. Sign in again to load the replies.",
    ),
  );
  expect(result.current.canRetry).toBe(false);
});

// Mobile configures the client like this. Throwing hands the hook a body with
// no response, and so no status to read.
it("reads a refusal the client is configured to throw", async () => {
  throughRealClient = true;
  client.setConfig({
    baseUrl: "https://comments.test",
    throwOnError: true,
    fetch: async () =>
      new Response(
        JSON.stringify({ statusCode: 401, message: "Unauthorized" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      ),
  });
  const logged = jest.spyOn(console, "error").mockImplementation(() => {});

  const { result } = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post" }),
  );

  await waitFor(() =>
    expect(result.current.error).toBe(
      "Your session has expired. Sign in again to load the replies.",
    ),
  );
  logged.mockRestore();
});

it("reports a refusal with the status it came back with", async () => {
  served = null;
  const logged = jest.spyOn(console, "error").mockImplementation(() => {});

  const { result } = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post" }),
  );

  await waitFor(() => expect(result.current.error).toBe("the server said no"));
  expect(reported).toEqual([
    {
      event: ExceptionEvent.LoadCommentsError,
      error: { statusCode: 403, message: "the server said no" },
      properties: { type: "post", objectId: 7, status: 403 },
    },
  ]);
  logged.mockRestore();
});

it("reports a mount request that never reached the server", async () => {
  unreachable = true;
  const logged = jest.spyOn(console, "error").mockImplementation(() => {});

  const { result } = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post" }),
  );

  await waitFor(() =>
    expect(result.current.error).toBe("Failed to load comments"),
  );
  expect(reported).toEqual([
    {
      event: ExceptionEvent.LoadCommentsError,
      error: expect.any(TypeError),
      properties: { type: "post", objectId: 7 },
    },
  ]);
  logged.mockRestore();
});

it("keeps the thread when a refetch never reaches the server", async () => {
  const initialComments = [comment(3)];
  const { result } = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post", initialComments }),
  );
  await waitFor(() => expect(result.current.comments).toHaveLength(1));

  unreachable = true;
  const logged = jest.spyOn(console, "error").mockImplementation(() => {});
  await act(async () => {
    await result.current.fetchComments();
  });

  expect(result.current.error).toBe("Failed to load comments");
  expect(result.current.canRetry).toBe(true);
  expect(result.current.comments).toHaveLength(1);
  expect(logged).toHaveBeenCalledWith(expect.any(String), expect.any(Error));
  logged.mockRestore();
});

it("takes its message back down when a later load lands", async () => {
  const initialComments = [comment(3)];
  const { result } = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post", initialComments }),
  );
  await waitFor(() => expect(result.current.comments).toHaveLength(1));

  served = null;
  await act(async () => {
    await result.current.fetchComments();
  });
  expect(result.current.error).toBe("the server said no");

  served = [comment(3), comment(4)];
  await act(async () => {
    await result.current.fetchComments();
  });

  expect(result.current.comments).toHaveLength(2);
  expect(result.current.error).toBeNull();
});

it("clears a stale error when the caller hands the thread down", async () => {
  const { result, rerender } = renderHook(
    ({ initialComments }: { initialComments: CommentDto[] }) =>
      useLoadComments({ objectId: 7, type: "post", initialComments }),
    { initialProps: { initialComments: [comment(3)] } },
  );
  await waitFor(() => expect(result.current.comments).toHaveLength(1));

  served = null;
  await act(async () => {
    await result.current.fetchComments();
  });
  expect(result.current.error).toBe("the server said no");

  rerender({ initialComments: [comment(3), comment(4)] });

  await waitFor(() => expect(result.current.comments).toHaveLength(2));
  expect(result.current.error).toBeNull();
});

it("keeps a request the caller outran from reporting its failure", async () => {
  inFlight = [];
  const { result, rerender } = renderHook(
    ({ initialComments }: { initialComments: CommentDto[] }) =>
      useLoadComments({ objectId: 7, type: "post", initialComments }),
    { initialProps: { initialComments: [comment(3)] } },
  );
  await waitFor(() => expect(result.current.comments).toHaveLength(1));

  const pending = result.current.fetchComments();
  rerender({ initialComments: [comment(3), comment(4)] });
  await waitFor(() => expect(result.current.comments).toHaveLength(2));

  await act(async () => {
    inFlight?.[0](null);
    await pending;
  });

  expect(result.current.error).toBeNull();
  expect(result.current.comments).toHaveLength(2);
});

it("takes the thread off a request the caller outran", async () => {
  inFlight = [];
  const { result, rerender } = renderHook(
    ({ initialComments }: { initialComments: CommentDto[] }) =>
      useLoadComments({ objectId: 7, type: "post", initialComments }),
    { initialProps: { initialComments: [comment(3)] } },
  );
  await waitFor(() => expect(result.current.comments).toHaveLength(1));

  // The reader posted a reply, and the feed handed its card down again while
  // the reload that would pick the reply up was still out.
  const pending = result.current.fetchComments();
  rerender({ initialComments: [comment(3)] });

  await act(async () => {
    inFlight?.[0]([comment(3), comment(4)]);
    await pending;
  });

  expect(result.current.comments).toHaveLength(2);
});

it("drops the thread when the caller asks about another object", async () => {
  served = [comment(3)];
  const { result, rerender } = renderHook(
    ({ objectId }: { objectId: number }) =>
      useLoadComments({ objectId, type: "post" }),
    { initialProps: { objectId: 7 } },
  );
  await waitFor(() => expect(result.current.comments).toHaveLength(1));

  served = [comment(3), comment(4)];
  rerender({ objectId: 8 });
  expect(result.current.comments).toBeNull();

  await waitFor(() => expect(result.current.comments).toHaveLength(2));
  expect(requests).toEqual([
    { endpoint: "post", id: "7" },
    { endpoint: "post", id: "8" },
  ]);
});

it("keeps nothing of one object's thread when another's load fails", async () => {
  served = [comment(3)];
  const { result, rerender } = renderHook(
    ({ objectId }: { objectId: number }) =>
      useLoadComments({ objectId, type: "post" }),
    { initialProps: { objectId: 7 } },
  );
  await waitFor(() => expect(result.current.comments).toHaveLength(1));

  served = null;
  rerender({ objectId: 8 });

  await waitFor(() => expect(result.current.error).toBe("the server said no"));
  expect(result.current.comments).toBeNull();
});

it("keeps a stale request's failure off the thread that landed", async () => {
  inFlight = [];
  const initialComments = [comment(3)];
  const { result } = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post", initialComments }),
  );

  const older = result.current.fetchComments();
  const newer = result.current.fetchComments();

  await act(async () => {
    inFlight?.[1]([comment(3), comment(4)]);
    inFlight?.[0](null);
    await Promise.all([older, newer]);
  });

  expect(result.current.error).toBeNull();
  expect(result.current.comments).toHaveLength(2);
});

it("spins until the request the reader asked for lands", async () => {
  inFlight = [];
  const initialComments = [comment(3)];
  const { result } = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post", initialComments }),
  );
  expect(result.current.spinning).toBe(false);

  act(() => result.current.retry());
  expect(result.current.spinning).toBe(true);

  await act(async () => {
    inFlight?.[0](null);
  });

  await waitFor(() => expect(result.current.error).toBe("the server said no"));
  await waitFor(() => expect(result.current.spinning).toBe(false));
});

it("keeps quiet about a load the reader never asked for", async () => {
  const { result } = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post" }),
  );
  await waitFor(() => expect(result.current.comments).toEqual([]));

  expect(result.current.status).toBeNull();
});

it("says how the load the reader asked for ended", async () => {
  served = null;
  const initialComments = [comment(3)];
  const { result } = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post", initialComments }),
  );

  act(() => result.current.retry());
  expect(result.current.status).toBe("Loading comments");

  await waitFor(() =>
    expect(result.current.status).toBe("Loading comments failed"),
  );

  served = [comment(3)];
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.status).toBe("Comments loaded"));
});

it("moves nobody for a load the reader never asked for", async () => {
  const { result } = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post" }),
  );
  await waitFor(() => expect(result.current.comments).toEqual([]));

  expect(result.current.movesReader).toBe(false);
});

it("moves the reader once the load they asked for lands", async () => {
  served = null;
  const initialComments = [comment(3)];
  const { result } = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post", initialComments }),
  );

  act(() => result.current.retry());
  expect(result.current.movesReader).toBe(false);

  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(result.current.movesReader).toBe(false);

  served = [comment(3)];
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.movesReader).toBe(true));
});

it("moves the reader onto the thread the caller hands down over their press", async () => {
  inFlight = [];
  const { result, rerender } = renderHook(
    ({ initialComments }: { initialComments: CommentDto[] }) =>
      useLoadComments({ objectId: 7, type: "post", initialComments }),
    { initialProps: { initialComments: [comment(3)] } },
  );

  act(() => result.current.retry());
  // The thread going up takes the control the press was on with it, so the
  // hand-down is what answers the press.
  rerender({ initialComments: [comment(3), comment(4)] });
  await waitFor(() => expect(result.current.movesReader).toBe(true));

  await act(async () => {
    inFlight?.[0](null);
  });

  await waitFor(() => expect(result.current.status).toBe("Comments loaded"));
  expect(result.current.movesReader).toBe(true);
});

it("leaves the answer alone when an outrun load lands a thread of its own", async () => {
  inFlight = [];
  const { result, rerender } = renderHook(
    ({ initialComments }: { initialComments: CommentDto[] }) =>
      useLoadComments({ objectId: 7, type: "post", initialComments }),
    { initialProps: { initialComments: [comment(3)] } },
  );

  act(() => result.current.retry());
  rerender({ initialComments: [comment(3), comment(4)] });
  await waitFor(() => expect(result.current.movesReader).toBe(true));

  await act(async () => {
    inFlight?.[0]([comment(3)]);
  });

  await waitFor(() => expect(result.current.comments).toHaveLength(1));
  await waitFor(() => expect(result.current.status).toBe("Comments loaded"));
  expect(result.current.movesReader).toBe(true);
});

it("leaves the failure's own words to the row that carries them", async () => {
  served = null;
  refusal = {
    status: 401,
    body: { statusCode: 401, message: "unauthorized" },
  };
  const initialComments = [comment(3)];
  const { result } = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post", initialComments }),
  );

  act(() => result.current.retry());
  await waitFor(() =>
    expect(result.current.status).toBe("Loading comments failed"),
  );

  expect(result.current.error).toBe(
    "Your session has expired. Sign in again to load the replies.",
  );
});

it("lets the reader press again while the request is out", async () => {
  inFlight = [];
  const initialComments = [comment(3)];
  const { result } = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post", initialComments }),
  );

  act(() => result.current.retry());
  act(() => result.current.retry());

  expect(requests).toHaveLength(2);
  await act(async () => {
    inFlight?.[0]([comment(3)]);
    inFlight?.[1]([comment(3)]);
  });
  await waitFor(() => expect(result.current.status).toBe("Comments loaded"));
});

it("says nothing about a refetch the reader never asked for", async () => {
  const initialComments = [comment(3)];
  const { result } = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post", initialComments }),
  );

  act(() => result.current.retry());
  await waitFor(() => expect(result.current.status).toBe("Comments loaded"));

  inFlight = [];
  let refetch: Promise<void> = Promise.resolve();
  act(() => {
    refetch = result.current.fetchComments();
  });
  expect(result.current.status).toBe("Comments loaded");

  await act(async () => {
    inFlight?.[0]([comment(3), comment(4)]);
    await refetch;
  });
  expect(result.current.status).toBe("Comments loaded");
});

it("says nothing about a thread swapped in after a press", async () => {
  const { result, rerender } = renderHook(
    ({ objectId }: { objectId: number }) =>
      useLoadComments({ objectId, type: "post" }),
    { initialProps: { objectId: 7 } },
  );

  act(() => result.current.retry());
  await waitFor(() => expect(result.current.status).toBe("Comments loaded"));

  rerender({ objectId: 9 });

  expect(result.current.status).toBeNull();
});

it("keeps spinning when a request the newer one outran answers", async () => {
  inFlight = [];
  const initialComments = [comment(3)];
  const { result } = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post", initialComments }),
  );

  act(() => result.current.retry());
  let newer: Promise<void> = Promise.resolve();
  act(() => {
    newer = result.current.fetchComments();
  });

  await act(async () => {
    inFlight?.[0]([comment(3)]);
    await new Promise((resolve) => setTimeout(resolve, 600));
  });
  expect(result.current.spinning).toBe(true);

  await act(async () => {
    inFlight?.[1]([comment(3), comment(4)]);
    await newer;
  });
  await waitFor(() => expect(result.current.spinning).toBe(false));
});

it("takes the newest of two requests that overlap", async () => {
  inFlight = [];
  const initialComments = [comment(3)];
  const { result } = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post", initialComments }),
  );

  const older = result.current.fetchComments();
  const newer = result.current.fetchComments();
  expect(inFlight).toHaveLength(2);

  await act(async () => {
    inFlight?.[1]([comment(3), comment(4)]);
    inFlight?.[0]([comment(3), comment(9)]);
    await Promise.all([older, newer]);
  });

  expect(result.current.comments?.map((c) => c.id)).toEqual([3, 4]);
});

it("drops a request the caller left behind by swapping the object", async () => {
  inFlight = [];
  const { result, rerender } = renderHook(
    ({
      objectId,
      initialComments,
    }: {
      objectId: number;
      initialComments: CommentDto[];
    }) => useLoadComments({ objectId, type: "post", initialComments }),
    { initialProps: { objectId: 7, initialComments: [comment(3)] } },
  );

  const pending = result.current.fetchComments();
  expect(inFlight).toHaveLength(1);

  rerender({ objectId: 8, initialComments: [comment(80)] });

  await act(async () => {
    inFlight?.[0]([comment(3), comment(4)]);
    await pending;
  });

  expect(result.current.comments?.map((c) => c.id)).toEqual([80]);
});

it("hands back the comments a request left alone", async () => {
  served = [comment(3)];
  const { result } = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post" }),
  );
  await waitFor(() => expect(result.current.comments).toHaveLength(1));
  const before = result.current.comments?.[0];

  served = [comment(3), comment(4)];
  await act(async () => {
    await result.current.fetchComments();
  });

  await waitFor(() => expect(result.current.comments).toHaveLength(2));
  expect(result.current.comments?.[0]).toBe(before);
});

it("keeps a refetched thread when the caller rebuilds its array", async () => {
  const { result, rerender } = renderHook(
    ({ initialComments }: { initialComments: CommentDto[] }) =>
      useLoadComments({ objectId: 7, type: "post", initialComments }),
    { initialProps: { initialComments: [comment(3)] } },
  );
  await waitFor(() => expect(result.current.comments).toHaveLength(1));

  served = [comment(3), comment(4)];
  await act(async () => {
    await result.current.fetchComments();
  });
  await waitFor(() => expect(result.current.comments).toHaveLength(2));

  rerender({ initialComments: [comment(3)] });

  expect(result.current.comments).toHaveLength(2);
});

it("takes the caller's thread back on an object it fetched in between", async () => {
  const handedIn = [comment(1)];
  const { result, rerender } = renderHook(
    (props: { objectId: number; initialComments?: CommentDto[] }) =>
      useLoadComments({ ...props, type: "post" }),
    {
      initialProps: { objectId: 7, initialComments: handedIn } as {
        objectId: number;
        initialComments?: CommentDto[];
      },
    },
  );
  await waitFor(() => expect(result.current.comments).toBe(handedIn));

  served = [comment(4), comment(5)];
  rerender({ objectId: 8, initialComments: undefined });
  await waitFor(() => expect(result.current.comments).toHaveLength(2));

  rerender({ objectId: 7, initialComments: [comment(1)] });

  await waitFor(() =>
    expect(result.current.comments?.map((c) => c.id)).toEqual([1]),
  );
});

it("keeps a request outrun by an equal thread from reporting its failure", async () => {
  inFlight = [];
  const { result, rerender } = renderHook(
    ({ initialComments }: { initialComments: CommentDto[] }) =>
      useLoadComments({ objectId: 7, type: "post", initialComments }),
    { initialProps: { initialComments: [comment(3)] } },
  );
  await waitFor(() => expect(result.current.comments).toHaveLength(1));

  const pending = result.current.fetchComments();
  rerender({ initialComments: [comment(3)] });

  await act(async () => {
    inFlight?.[0](null);
    await pending;
  });

  expect(result.current.error).toBeNull();
  expect(result.current.comments).toHaveLength(1);
});

it("clears a stale error when the caller hands an equal thread down", async () => {
  const { result, rerender } = renderHook(
    ({ initialComments }: { initialComments: CommentDto[] }) =>
      useLoadComments({ objectId: 7, type: "post", initialComments }),
    { initialProps: { initialComments: [comment(3)] } },
  );
  await waitFor(() => expect(result.current.comments).toHaveLength(1));

  served = null;
  await act(async () => {
    await result.current.fetchComments();
  });
  expect(result.current.error).toBe("the server said no");

  rerender({ initialComments: [comment(3)] });

  await waitFor(() => expect(result.current.error).toBeNull());
  expect(result.current.comments).toHaveLength(1);
});

it("asks for a thread when the caller stops handing one down", async () => {
  const { result, rerender } = renderHook(
    (props: { initialComments?: CommentDto[] }) =>
      useLoadComments({ objectId: 7, type: "post", ...props }),
    {
      initialProps: { initialComments: [comment(3)] } as {
        initialComments?: CommentDto[];
      },
    },
  );
  await waitFor(() => expect(result.current.comments).toHaveLength(1));
  expect(requests).toEqual([]);

  served = [comment(3), comment(4)];
  rerender({ initialComments: undefined });

  await waitFor(() => expect(result.current.comments).toHaveLength(2));
  expect(requests).toEqual([{ endpoint: "post", id: "7" }]);
});
