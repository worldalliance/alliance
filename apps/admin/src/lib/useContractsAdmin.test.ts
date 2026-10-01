import type { ContractAdminDto } from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useContractsAdmin } from "./useContractsAdmin";

afterEach(cleanup);

const contract = {
  id: 1,
  name: "Pledge",
  createdAt: "2026-01-02T00:00:00.000Z",
  markdown: "Terms",
  startDate: null,
  endDate: null,
  description: [],
} satisfies ContractAdminDto;

serveApi(routes({ "GET /contract/admin": () => Response.json([contract]) }));

describe("useContractsAdmin", () => {
  it("loads the contracts", async () => {
    const view = renderHook(() => useContractsAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.data).toEqual([contract]));
  });
});
