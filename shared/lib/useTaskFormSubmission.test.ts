import { ExceptionEvent } from "@alliance/common/analytics";
import { FORMULA_SOURCES_CHANGED } from "@alliance/common/forms/formula-options";
import { GUEST_HEADER } from "@alliance/common/guest";
import { act, renderHook } from "@testing-library/react";
import type { ActionDto, SubmitFormDto } from "../client";
import { formulaSourcesChanged } from "../forms/formulaChoices";
import { queryKeys } from "./queryKeys";
import { makeAction, makeFormResponse } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { recordExceptions } from "./testing/recordExceptions";
import { routes, serveApi } from "./testing/serveApi";
import { ActivityList } from "./useActivities";
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

  it("leaves a deferred completion to recordCompleted", async () => {
    api.alsoServing({ "POST /tasks/submitForm/:id": accepted });
    const s = renderSubmission();

    await act(() =>
      s.submission().submit({
        taskFormId: 7,
        body,
        isMember: true,
        deferCompletion: true,
      }),
    );

    expect(s.cachedRelation()).toBe("none");
    expect(s.visibilityInvalidated()).toBe(true);

    act(() => s.submission().recordCompleted({ actionId: 1, isMember: false }));
    expect(s.cachedRelation()).toBe("none");

    act(() => s.submission().recordCompleted({ actionId: 1, isMember: true }));
    expect(s.cachedRelation()).toBe("completed");
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

describe("submitFollowUp", () => {
  const reported = recordExceptions();
  const followUpForm = { id: 5, formId: 8 };
  const data: SubmitFormDto = {
    answers: { q1: "yes" },
    formSnapshotId: 3,
    schemaSnapshot: {},
    actionId: 9,
    visibilityValidatorResults: { q1: true },
    deviceType: "desktop",
    publicAnswers: { q1: "yes" },
    phDistinctId: "ph-id",
    sessionReplayUrl: "https://replay.example.com/1",
    sid: "session-id",
    formulaSources: [{ formId: 3, responseIds: [5, 9] }],
  };
  const homeFeedKey = ["useHomeFeed", 20, false];
  const activitiesKey = queryKeys.activities({
    list: ActivityList.Action,
    objectId: 9,
    limit: 10,
  });

  const renderFollowUp = () => {
    const { client, wrapper } = queryWrapper();
    client.setQueryData(queryKeys.actions(), [makeAction({ id: 9 })]);
    client.setQueryData(queryKeys.taskFormAggregateViews(8), []);
    client.setQueryData(homeFeedKey, { pages: [], pageParams: [] });
    client.setQueryData(activitiesKey, { pages: [], pageParams: [] });
    const view = renderHook(() => useTaskFormSubmission(), { wrapper });
    return {
      submitFollowUp: () =>
        view.result.current.submitFollowUp({ followUpForm, data }),
      refreshed: () => ({
        actions: client.getQueryState(queryKeys.actions())?.isInvalidated,
        aggregateViews: client.getQueryState(
          queryKeys.taskFormAggregateViews(8),
        )?.isInvalidated,
        homeFeed: client.getQueryData(homeFeedKey) === undefined,
        activities: client.getQueryState(activitiesKey)?.isInvalidated,
      }),
    };
  };

  const untouched = {
    actions: false,
    aggregateViews: false,
    homeFeed: false,
    activities: false,
  };

  it("posts the answers and refreshes what the response moves", async () => {
    const bodies: unknown[] = [];
    api.alsoServing({
      "POST /tasks/submitFollowUpForm/:id": async ({ request, params }) => {
        bodies.push({ params, body: await request.json() });
        return accepted();
      },
    });
    const s = renderFollowUp();

    const submitted = await act(s.submitFollowUp);

    expect(submitted.ok).toBe(true);
    expect(bodies).toEqual([
      {
        params: { id: "5" },
        body: {
          answers: { q1: "yes" },
          formSnapshotId: 3,
          schemaSnapshot: {},
          visibilityValidatorResults: { q1: true },
          deviceType: "desktop",
          publicAnswers: { q1: "yes" },
          phDistinctId: "ph-id",
          sessionReplayUrl: "https://replay.example.com/1",
          sid: "session-id",
          formulaSources: [{ formId: 3, responseIds: [5, 9] }],
        },
      },
    ]);
    expect(s.refreshed()).toEqual({
      actions: true,
      aggregateViews: true,
      homeFeed: true,
      activities: true,
    });
  });

  it("reports a refusal, touching no cache", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    api.alsoServing({ "POST /tasks/submitFollowUpForm/:id": refused });
    const s = renderFollowUp();

    const submitted = await act(s.submitFollowUp);

    expect(submitted.ok).toBe(false);
    expect(reported).toEqual([
      {
        event: ExceptionEvent.FollowUpFormSubmitError,
        error: expect.anything(),
        properties: { actionId: 9, followUpFormId: 5 },
      },
    ]);
    expect(s.refreshed()).toEqual(untouched);
  });

  it("leaves unreported a refusal because the histories its options read changed", async () => {
    api.throwingOnRefusal({
      "POST /tasks/submitFollowUpForm/:id": () =>
        Response.json(
          { statusCode: 409, message: FORMULA_SOURCES_CHANGED },
          { status: 409 },
        ),
    });
    const s = renderFollowUp();

    const submitted = await act(s.submitFollowUp);

    expect(!submitted.ok && formulaSourcesChanged(submitted.error)).toBe(true);
    expect(reported).toEqual([]);
    expect(s.refreshed()).toEqual(untouched);
  });
});
