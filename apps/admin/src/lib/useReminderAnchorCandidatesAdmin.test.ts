import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { renderHook, waitFor } from "@testing-library/react";
import { useReminderAnchorCandidatesAdmin } from "./useReminderAnchorCandidatesAdmin";

let status: number;
const requests: string[] = [];

serveApi(
  routes({
    "GET /actions/reminderAnchorCandidates/:eventId": ({ params }) => {
      requests.push(params.eventId);
      return status === 200
        ? Response.json([
            {
              actionId: 2,
              actionName: "Sign the pledge",
              deadlineEventId: Number(params.eventId) + 1,
              deadlineEventDate: "2026-11-01T00:00:00.000Z",
            },
          ])
        : Response.json({}, { status });
    },
  }),
);

beforeEach(() => {
  status = 200;
  requests.length = 0;
});

describe("useReminderAnchorCandidatesAdmin", () => {
  it("loads the dependency deadlines for the selected event", async () => {
    const view = renderHook(
      () => useReminderAnchorCandidatesAdmin(7),
      queryWrapper(),
    );

    await waitFor(() =>
      expect(view.result.current.data).toEqual([
        expect.objectContaining({ actionId: 2, deadlineEventId: 8 }),
      ]),
    );
    expect(requests).toEqual(["7"]);
  });

  it("requests nothing until an event is selected", async () => {
    const view = renderHook(
      () => useReminderAnchorCandidatesAdmin(null),
      queryWrapper(),
    );

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(view.result.current.data).toBeUndefined();
    expect(requests).toEqual([]);
  });

  it("surfaces a failed load as an error rather than no candidates", async () => {
    status = 500;

    const view = renderHook(
      () => useReminderAnchorCandidatesAdmin(7),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(view.result.current.data).toBeUndefined();
  });
});
