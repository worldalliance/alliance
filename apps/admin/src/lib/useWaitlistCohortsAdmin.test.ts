import type { WaitlistCohortDto } from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useWaitlistCohortsAdmin } from "./useWaitlistCohortsAdmin";

afterEach(cleanup);

const cohort = {
  id: 3,
  name: "Waiting",
  filter: { mobilized: false },
  updatedAt: "2026-08-01T00:00:00.000Z",
} satisfies WaitlistCohortDto;

serveApi(
  routes({
    "GET /waitlist/admin/cohorts": () => Response.json([cohort]),
  }),
);

describe("useWaitlistCohortsAdmin", () => {
  it("loads the cohorts", async () => {
    const view = renderHook(() => useWaitlistCohortsAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.data).toEqual([cohort]));
  });
});
