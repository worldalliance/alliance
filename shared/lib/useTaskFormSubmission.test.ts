import { GUEST_HEADER } from "@alliance/common/guest";
import { act, renderHook } from "@testing-library/react";
import type { ActionDto, SubmitFormDto } from "../client";
import { queryKeys } from "./queryKeys";
import { makeAction, makeFormResponse } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useTaskFormSubmission } from "./useTaskFormSubmission";

const api = serveApi(routes({}));

const body: SubmitFormDto = { answers: {}, actionId: 1, deviceType: "mobile" };
const withdrawal = { actionId: 1, reason: "", outOfTime: true, isMoral: false };

const renderSubmission = () => {
  const { client, wrapper } = queryWrapper();
  client.setQueryData(queryKeys.actions(), [
    makeAction({ id: 1, taskFormId: 7 }),
  ]);
  client.setQueryData(queryKeys.myVisibilityContext(), {});
  client.setQueryData(queryKeys.taskFormAggregateViews(7), []);
  const view = renderHook(() => useTaskFormSubmission(), { wrapper });
  return {
    submission: () => view.result.current,
    cachedRelation: () =>
      client.getQueryData<ActionDto[]>(queryKeys.actions())?.[0].viewer
        ?.relation,
    visibilityInvalidated: () =>
      client.getQueryState(queryKeys.myVisibilityContext())?.isInvalidated,
    aggregateViewsInvalidated: () =>
      client.getQueryState(queryKeys.taskFormAggregateViews(7))?.isInvalidated,
  };
};

const accepted = () => Response.json(makeFormResponse(), { status: 201 });
const refused = () =>
  Response.json({ statusCode: 400, message: "Bad Request" }, { status: 400 });

describe("submit", () => {
  it("marks a member's action completed once the server accepts", async () => {
    api.alsoServing({ "POST /tasks/submitForm/:id": accepted });
    const s = renderSubmission();

    const result = await act(() =>
      s.submission().submit({ taskFormId: 7, body, isMember: true }),
    );

    expect(result.response.ok).toBe(true);
    expect(s.cachedRelation()).toBe("completed");
    expect(s.visibilityInvalidated()).toBe(true);
    expect(s.aggregateViewsInvalidated()).toBe(true);
  });

  it("sends a guest's token and leaves the member caches alone", async () => {
    let sentToken: string | null = null;
    api.alsoServing({
      "POST /tasks/submitPublicForm/:id": ({ request }) => {
        sentToken = request.headers.get(GUEST_HEADER);
        return accepted();
      },
    });
    const s = renderSubmission();

    await act(() =>
      s.submission().submit({
        taskFormId: 7,
        body,
        isMember: false,
        guestToken: "guest-token",
      }),
    );

    expect(sentToken).toBe("guest-token");
    expect(s.cachedRelation()).toBe("none");
    expect(s.visibilityInvalidated()).toBe(false);
    expect(s.aggregateViewsInvalidated()).toBe(true);
  });

  it("returns a refusal through a client that throws on one, touching no cache", async () => {
    api.throwingOnRefusal({ "POST /tasks/submitForm/:id": refused });
    const s = renderSubmission();

    const result = await act(() =>
      s.submission().submit({ taskFormId: 7, body, isMember: true }),
    );

    expect(result.response.status).toBe(400);
    expect(s.cachedRelation()).toBe("none");
    expect(s.visibilityInvalidated()).toBe(false);
    expect(s.aggregateViewsInvalidated()).toBe(false);
  });
  it("returns a guest's refusal through a client that throws on one, touching no cache", async () => {
    let sentToken: string | null = "unset";
    api.throwingOnRefusal({
      "POST /tasks/submitPublicForm/:id": ({ request }) => {
        sentToken = request.headers.get(GUEST_HEADER);
        return refused();
      },
    });
    const s = renderSubmission();

    const result = await act(() =>
      s.submission().submit({ taskFormId: 7, body, isMember: false }),
    );

    expect(result.response.status).toBe(400);
    expect(sentToken).toBeNull();
    expect(s.aggregateViewsInvalidated()).toBe(false);
  });
});

describe("optOut", () => {
  it("marks the action withdrawn once the server accepts", async () => {
    api.alsoServing({
      "POST /tasks/optout/:id": () => new Response("{}", { status: 201 }),
    });
    const s = renderSubmission();

    const result = await act(() => s.submission().optOut(7, withdrawal));

    expect(result.response.ok).toBe(true);
    expect(s.cachedRelation()).toBe("withdrawn");
    expect(s.visibilityInvalidated()).toBe(true);
    expect(s.aggregateViewsInvalidated()).toBe(true);
  });

  it("returns a refusal through a client that throws on one, touching no cache", async () => {
    api.throwingOnRefusal({ "POST /tasks/optout/:id": refused });
    const s = renderSubmission();

    const result = await act(() => s.submission().optOut(7, withdrawal));

    expect(result.error).toBeDefined();
    expect(s.cachedRelation()).toBe("none");
    expect(s.visibilityInvalidated()).toBe(false);
    expect(s.aggregateViewsInvalidated()).toBe(false);
  });
});
