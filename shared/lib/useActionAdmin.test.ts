import { act, renderHook, waitFor } from "@testing-library/react";
import type { CreateActionEventDto } from "../client";
import { queryKeys } from "./queryKeys";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useActionAdmin } from "./useActionAdmin";

let memberActionStart: string;
let fetches: number;
let addEventResponse: () => Response;
let acknowledged: (string | null)[];

serveApi(
  routes({
    "GET /actions/adminslug/:id": () => {
      fetches += 1;
      return new Response(
        JSON.stringify({
          id: 1,
          events: [],
          cohortExpression: null,
          memberActionStart,
          memberActionDeadline: null,
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    },
    "PATCH /actions/follow-up-forms/:followUpFormId": () => Response.json({}),
    "POST /actions/:id/events": ({ request }) => {
      acknowledged.push(
        new URL(request.url).searchParams.get("acknowledgeDeadlineShortening"),
      );
      return addEventResponse();
    },
  }),
);

const event: CreateActionEventDto = {
  title: "Launch",
  description: "",
  newStatus: "member_action",
  date: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  fetches = 0;
  acknowledged = [];
});

describe("useActionAdmin", () => {
  it("refetches the action and marks the all-actions list stale after an event is added", async () => {
    memberActionStart = "2026-01-01T00:00:00.000Z";
    addEventResponse = () => Response.json({ id: 2 }, { status: 201 });
    const query = queryWrapper();
    query.client.setQueryData(queryKeys.actionsAllAdmin(), []);
    const { result } = renderHook(() => useActionAdmin(1), query);
    await waitFor(() => expect(result.current.action).toBeDefined());

    memberActionStart = "2026-02-01T00:00:00.000Z";
    await act(() => result.current.addEvent({ body: event }));

    await waitFor(() =>
      expect(result.current.action?.memberActionStart).toBe(memberActionStart),
    );
    expect(fetches).toBe(2);
    expect(
      query.client.getQueryState(queryKeys.actionsAllAdmin())?.isInvalidated,
    ).toBe(true);
  });

  it("leaves the action cached when adding an event is refused", async () => {
    addEventResponse = () =>
      Response.json({ message: "earlier deadline" }, { status: 409 });
    const { result } = renderHook(() => useActionAdmin(1), queryWrapper());
    await waitFor(() => expect(result.current.action).toBeDefined());

    const sent = await act(async () => {
      const response = await result.current.addEvent({ body: event });
      await new Promise((resolve) => setTimeout(resolve, 0));
      return response;
    });

    expect(sent.response.status).toBe(409);
    expect(fetches).toBe(1);
  });

  it("sends staff's acknowledgement of moving the deadline earlier", async () => {
    addEventResponse = () => Response.json({ id: 2 }, { status: 201 });
    const { result } = renderHook(() => useActionAdmin(1), queryWrapper());
    await waitFor(() => expect(result.current.action).toBeDefined());

    await act(() => result.current.addEvent({ body: event }));
    await act(() =>
      result.current.addEvent({
        body: event,
        acknowledgeDeadlineShortening: true,
      }),
    );

    expect(acknowledged).toEqual([null, "true"]);
  });

  it("marks the all-actions list stale when a follow-up form is saved", async () => {
    const query = queryWrapper();
    query.client.setQueryData(queryKeys.actionsAllAdmin(), []);
    const { result } = renderHook(() => useActionAdmin(1), query);
    await waitFor(() => expect(result.current.action).toBeDefined());

    await act(() =>
      result.current.updateFollowUpForm({ followUpFormId: 7, body: {} }),
    );

    expect(
      query.client.getQueryState(queryKeys.actionsAllAdmin())?.isInvalidated,
    ).toBe(true);
  });
});
