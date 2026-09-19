import { conversationUpdateInfo } from "../client";
import { sendOrExplain } from "./sendOrExplain";
import { routes, serveApi } from "./testing/serveApi";

let answer: () => Response;

const api = serveApi(
  routes({
    "POST /messaging/conversations/:conversationId/update": () => answer(),
  }),
);

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

const saveGroup = () =>
  sendOrExplain({
    send: conversationUpdateInfo,
    options: { path: { conversationId: 1 }, body: { title: "Book club" } },
    action: "save the group",
  });

it("hands back the data when the server answers", async () => {
  answer = () => Response.json({ id: 1 });

  expect(await saveGroup()).toEqual({ ok: true, value: { id: 1 } });
});

it.each([
  {
    status: 403,
    message: "Only admins can do that.",
    shown: "Only admins can do that.",
  },
  {
    status: 401,
    message: "Unauthorized",
    shown: "Your session has expired. Sign in again to save the group.",
  },
  { status: 500, message: "Internal server error", shown: "Please try again." },
])("explains a $status refusal", async ({ status, message, shown }) => {
  answer = () => Response.json({ statusCode: status, message }, { status });

  expect(await saveGroup()).toEqual({
    ok: false,
    error: { title: "Couldn't save the group", message: shown },
  });
});

it("asks for a retry when the request never reaches the server", async () => {
  answer = () => {
    throw new TypeError("Network request failed");
  };

  expect(await saveGroup()).toEqual({
    ok: false,
    error: { title: "Couldn't save the group", message: "Please try again." },
  });
});

it("reads a refusal the client is configured to throw", async () => {
  api.throwingOnRefusal({
    "POST /messaging/conversations/:conversationId/update": () =>
      Response.json(
        { statusCode: 403, message: "Only admins can do that." },
        { status: 403 },
      ),
  });

  expect(await saveGroup()).toEqual({
    ok: false,
    error: {
      title: "Couldn't save the group",
      message: "Only admins can do that.",
    },
  });
});
