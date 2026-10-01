import type { ContractAdminDto } from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  useContractsAdmin,
  useInvalidateContractsAdmin,
} from "./useContractsAdmin";

afterEach(cleanup);

const contract = (name: string) =>
  ({
    id: 1,
    name,
    createdAt: "2026-01-02T00:00:00.000Z",
    markdown: "Terms",
    startDate: null,
    endDate: null,
    description: [],
  }) satisfies ContractAdminDto;

let stored = contract("Pledge");

serveApi(routes({ "GET /contract/admin": () => Response.json([stored]) }));

afterEach(() => {
  stored = contract("Pledge");
});

describe("useContractsAdmin", () => {
  it("loads the contracts", async () => {
    const view = renderHook(() => useContractsAdmin(), queryWrapper());

    await waitFor(() =>
      expect(view.result.current.data).toEqual([contract("Pledge")]),
    );
  });
});

describe("useInvalidateContractsAdmin", () => {
  it("refetches the contracts", async () => {
    const view = renderHook(
      () => ({
        contracts: useContractsAdmin(),
        invalidate: useInvalidateContractsAdmin(),
      }),
      queryWrapper(),
    );
    await waitFor(() =>
      expect(view.result.current.contracts.data).toEqual([contract("Pledge")]),
    );

    stored = contract("Charter");
    await view.result.current.invalidate();

    await waitFor(() =>
      expect(view.result.current.contracts.data).toEqual([contract("Charter")]),
    );
  });
});
