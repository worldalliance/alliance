import { ExceptionEvent } from "@alliance/common/analytics";
import { R } from "@alliance/common/result";
import type { CommentDto } from "@alliance/shared/client";
import { onlineManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { queryWrapper } from "./testing/queryWrapper";
import { recordExceptions } from "./testing/recordExceptions";
import { routes, serveApi } from "./testing/serveApi";
import { useCommentThread } from "./useCommentThread";

const comment = (id: number, children: CommentDto[] = []): CommentDto => ({
  id,
  parentObjectType: "post",
  parentObjectId: 1,
  deleted: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  parentId: null,
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

const content = { body: "hello", attachments: [] };

let thread: CommentDto[];
let loadGate: Promise<void>;
let requests: string[];
let created: unknown[];
let createAnswer: () => Response;
let updateAnswer: () => Response;
let pinAnswer: () => Response;

const reported = recordExceptions();

const api = serveApi(
  routes({
    "GET /forum/posts/1/comments": async () => {
      requests.push("load");
      const answer = thread;
      await loadGate;
      return Response.json(answer);
    },
    "POST /forum/comments": async ({ request }) => {
      requests.push("create");
      created.push(await request.json());
      return createAnswer();
    },
    "PATCH /forum/comments/:id": ({ params }) => {
      requests.push(`update ${params.id}`);
      return updateAnswer();
    },
    "PATCH /forum/admin/comments/:id/pin": ({ params }) => {
      requests.push(`pin ${params.id}`);
      return pinAnswer();
    },
  }),
);

beforeEach(() => {
  thread = [comment(3, [comment(4)])];
  loadGate = Promise.resolve();
  requests = [];
  created = [];
  createAnswer = () => Response.json(comment(9));
  updateAnswer = () => Response.json(comment(4));
  pinAnswer = () => Response.json(comment(3));
});

const renderThread = async () => {
  const { wrapper } = queryWrapper();
  const hook = renderHook(
    () => useCommentThread({ objectId: 1, type: "post", userId: 1 }),
    { wrapper },
  );
  await waitFor(() => expect(hook.result.current.comments).toEqual(thread));
  return hook.result;
};

it("posts a top-level comment under its tag, then reloads the thread", async () => {
  const result = await renderThread();
  thread = [...thread, comment(9)];

  let posted;
  await act(async () => {
    posted = await result.current.createComment({
      content,
      parentId: null,
      tagId: 2,
    });
  });

  expect(posted).toEqual(R.success(comment(9)));
  expect(created).toEqual([
    {
      parentObjectId: 1,
      parentObjectType: "post",
      editableContent: content,
      tagId: 2,
    },
  ]);
  await waitFor(() => expect(result.current.comments).toEqual(thread));
});

it("hands back a posted comment while the thread's reload is still out", async () => {
  const result = await renderThread();
  loadGate = new Promise(() => {});

  let posted;
  await act(async () => {
    posted = await result.current.createComment({
      content,
      parentId: null,
      tagId: undefined,
    });
  });

  expect(posted).toEqual(R.success(comment(9)));
  expect(requests).toEqual(["load", "create", "load"]);
});

it("posts a reply without a tag", async () => {
  const result = await renderThread();

  await act(() =>
    result.current.createComment({ content, parentId: 3, tagId: 2 }),
  );

  expect(created).toEqual([
    {
      parentObjectId: 1,
      parentId: 3,
      parentObjectType: "post",
      editableContent: content,
    },
  ]);
});

it("reloads the thread when the comment a reply answers is gone", async () => {
  const result = await renderThread();
  createAnswer = () =>
    Response.json({ message: "No longer here" }, { status: 404 });

  let posted;
  await act(async () => {
    posted = await result.current.createComment({
      content,
      parentId: 4,
      tagId: undefined,
    });
  });

  expect(posted).toEqual(R.failure("No longer here"));
  await waitFor(() => expect(requests).toEqual(["load", "create", "load"]));
});

it("reads a refused reply through a client that throws on refusal", async () => {
  const result = await renderThread();
  api.throwingOnRefusal({
    "POST /forum/comments": () => {
      requests.push("create");
      return Response.json({ message: "No longer here" }, { status: 404 });
    },
    "GET /forum/posts/1/comments": () => {
      requests.push("load");
      return Response.json(thread);
    },
  });

  let posted;
  await act(async () => {
    posted = await result.current.createComment({
      content,
      parentId: 4,
      tagId: undefined,
    });
  });

  expect(posted).toEqual(R.failure("No longer here"));
  await waitFor(() => expect(requests).toEqual(["load", "create", "load"]));
});

it("leaves the thread alone when a top-level comment is refused", async () => {
  const result = await renderThread();
  createAnswer = () => Response.json({ message: "Too long" }, { status: 400 });

  let posted;
  await act(async () => {
    posted = await result.current.createComment({
      content,
      parentId: null,
      tagId: undefined,
    });
  });

  expect(posted).toEqual(R.failure("Too long"));
  expect(requests).toEqual(["load", "create"]);
});

it("reports a comment that never reached the server", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  const result = await renderThread();
  createAnswer = () => {
    throw new TypeError("Failed to fetch");
  };

  let posted;
  await act(async () => {
    posted = await result.current.createComment({
      content,
      parentId: null,
      tagId: undefined,
    });
  });

  expect(posted).toEqual(R.failure("Failed to submit reply"));
  expect(reported).toMatchObject([{ event: ExceptionEvent.PostReplyError }]);
});

it.each([
  ["a comment", "Failed to submit reply"],
  ["an edit", "Failed to save your edit"],
])(
  "fails a %s sent offline at once rather than holding it",
  async (write, message) => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const result = await renderThread();
    createAnswer = updateAnswer = () => {
      throw new TypeError("Failed to fetch");
    };
    onlineManager.setOnline(false);

    let sent;
    try {
      await act(async () => {
        sent = await (write === "a comment"
          ? result.current.createComment({
              content,
              parentId: null,
              tagId: undefined,
            })
          : result.current.updateComment(4, content));
      });
    } finally {
      onlineManager.setOnline(true);
    }

    expect(sent).toEqual(R.failure(message));
  },
);

it("puts a saved edit on the nested comment it changed", async () => {
  const result = await renderThread();
  const edited = { body: "edited", attachments: ["a.png"] };

  let saved;
  await act(async () => {
    saved = await result.current.updateComment(4, edited);
  });

  expect(saved).toEqual(R.success(undefined));
  expect(result.current.comments?.[0].children?.[0].editableContent).toEqual(
    edited,
  );
  expect(requests).toEqual(["load", "update 4"]);
});

it("explains an edit the server refused through a client that throws on refusal", async () => {
  const result = await renderThread();
  api.throwingOnRefusal({
    "PATCH /forum/comments/:id": () =>
      Response.json({ message: "Unauthorized" }, { status: 401 }),
  });

  let saved;
  await act(async () => {
    saved = await result.current.updateComment(4, content);
  });

  expect(saved).toEqual(
    R.failure("Your session has expired. Sign in again to save your edit."),
  );
  expect(result.current.comments).toEqual(thread);
});

it("reloads the thread after a pin", async () => {
  const result = await renderThread();
  thread = [{ ...comment(3, [comment(4)]), pinned: true }];

  await act(() => result.current.pinComment(3));

  await waitFor(() => expect(result.current.comments?.[0].pinned).toBe(true));
  expect(requests).toEqual(["load", "pin 3", "load"]);
});

it("keeps the thread when an edit never reached the server", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  const result = await renderThread();
  updateAnswer = () => {
    throw new TypeError("Failed to fetch");
  };

  let saved;
  await act(async () => {
    saved = await result.current.updateComment(4, content);
  });

  expect(saved).toEqual(R.failure("Failed to save your edit"));
  expect(result.current.comments).toEqual(thread);
});
