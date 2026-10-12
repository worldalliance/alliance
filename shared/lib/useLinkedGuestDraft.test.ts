import { renderHook, waitFor } from "@testing-library/react";
import { makeFormResponse } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useLinkedGuestDraft } from "./useLinkedGuestDraft";

let requested: string[] = [];
let respond: () => Response;

serveApi(
  routes({
    "GET /tasks/draft/:id": ({ request, params }) => {
      const actionId = new URL(request.url).searchParams.get("actionId");
      requested.push(`${params.id}?actionId=${actionId}`);
      return respond();
    },
  }),
);

beforeEach(() => {
  requested = [];
  respond = () =>
    Response.json({ draft: makeFormResponse({ answers: { note: "hi" } }) });
});

it("loads the guest draft linked to the member", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(
    () => useLinkedGuestDraft({ taskFormId: 5, actionId: 9, enabled: true }),
    { wrapper },
  );

  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(hook.result.current.data?.answers).toEqual({ note: "hi" });
  expect(requested).toEqual(["5?actionId=9"]);
});

it("reads a form without a linked draft as null", async () => {
  respond = () => Response.json({});
  const { wrapper } = queryWrapper();

  const hook = renderHook(
    () => useLinkedGuestDraft({ taskFormId: 5, actionId: 9, enabled: true }),
    { wrapper },
  );

  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(hook.result.current.data).toBeNull();
});

it("requests nothing while disabled", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(
    () => useLinkedGuestDraft({ taskFormId: 5, actionId: 9, enabled: false }),
    { wrapper },
  );

  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(hook.result.current.fetchStatus).toBe("idle");
  expect(requested).toEqual([]);
});

it("fails rather than reading a failed load as no draft", async () => {
  respond = () => Response.json({ message: "Unauthorized" }, { status: 401 });
  const { wrapper } = queryWrapper();

  const hook = renderHook(
    () => useLinkedGuestDraft({ taskFormId: 5, actionId: 9, enabled: true }),
    { wrapper },
  );

  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(hook.result.current.error).toMatchObject({ statusCode: 401 });
  expect(hook.result.current.data).toBeUndefined();
});
