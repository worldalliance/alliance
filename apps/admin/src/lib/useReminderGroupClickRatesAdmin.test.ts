import type { ReminderGroupClickRatePointDto } from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useReminderGroupClickRatesAdmin } from "./useReminderGroupClickRatesAdmin";

afterEach(cleanup);

const point = {
  date: "2026-03-04T12:00:00.000Z",
  reminderGroupId: 3,
  reminderGroupName: "Day before",
  actionId: 7,
  actionName: "Call your rep",
  emailClickRate: 0.25,
  textClickRate: 0.5,
  emailSentCount: 8,
  emailClickedCount: 2,
  textSentCount: 4,
  textClickedCount: 2,
} satisfies ReminderGroupClickRatePointDto;

const api = serveApi(
  routes({
    "GET /analytics/reminder-group-click-rates": () => Response.json([point]),
  }),
);

describe("useReminderGroupClickRatesAdmin", () => {
  it("loads the points with parsed dates", async () => {
    const view = renderHook(
      () => useReminderGroupClickRatesAdmin(),
      queryWrapper(),
    );

    await waitFor(() =>
      expect(view.result.current.data).toEqual([
        { ...point, date: new Date("2026-03-04T12:00:00.000Z") },
      ]),
    );
  });

  it("reports a failed load", async () => {
    api.alsoServing({
      "GET /analytics/reminder-group-click-rates": () =>
        Response.json({ message: "boom" }, { status: 500 }),
    });
    const view = renderHook(
      () => useReminderGroupClickRatesAdmin(),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.isError).toBe(true));
  });
});
