import type { ScheduledPlansOverviewDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useScheduledPlansAdmin } from "./useScheduledPlansAdmin";

afterEach(cleanup);

const plans: ScheduledPlansOverviewDto = {
  suspensionPlans: [],
  forumAutocompletePlans: [
    {
      date: "2026-01-02T00:00:00.000Z",
      action: { id: 7, name: "Forum action" },
      users: [],
    },
  ],
};

let requested: URL | null;
let respond: () => Response;

serveApi(
  routes({
    "GET /actions/scheduledPlans": ({ request }) => {
      requested = new URL(request.url);
      return respond();
    },
  }),
);

beforeEach(() => {
  requested = null;
  respond = () => Response.json(plans);
});

describe("useScheduledPlansAdmin", () => {
  it("reads the plans for the coming week", async () => {
    const before = Date.now();
    const view = renderHook(() => useScheduledPlansAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.data).toEqual(plans));
    const start = Date.parse(requested?.searchParams.get("rangeStart") ?? "");
    const end = Date.parse(requested?.searchParams.get("rangeEnd") ?? "");
    expect(start).toBeGreaterThanOrEqual(before);
    expect(start).toBeLessThanOrEqual(Date.now());
    expect(end - start).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("surfaces a refused load as an error carrying its status", async () => {
    respond = () => Response.json({ message: "Forbidden" }, { status: 403 });

    const view = renderHook(() => useScheduledPlansAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(view.result.current.error).toMatchObject({ statusCode: 403 });
  });
});
