import type { AmbassadorProgramDashboardDto } from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useAmbassadorProgramAdmin } from "./useAmbassadorProgramAdmin";

afterEach(cleanup);

const dashboard = {
  members: [],
  projection: { generatedAt: "2026-10-05T00:00:00.000Z", points: [] },
} satisfies AmbassadorProgramDashboardDto;

serveApi(
  routes({
    "GET /user/ambassadorProgram": () => Response.json(dashboard),
  }),
);

describe("useAmbassadorProgramAdmin", () => {
  it("reads the dashboard", async () => {
    const view = renderHook(() => useAmbassadorProgramAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.data).toEqual(dashboard));
  });
});
