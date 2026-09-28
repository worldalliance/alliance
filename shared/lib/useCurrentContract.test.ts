import { renderHook, waitFor } from "@testing-library/react";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useCurrentContract } from "./useCurrentContract";

const contract = { id: 7, markdown: "Terms", description: [] };
let status = 200;

serveApi(
  routes({
    "GET /contract/current": () =>
      status === 200
        ? Response.json(contract)
        : Response.json({ message: "down" }, { status }),
  }),
);

it("loads the current contract", async () => {
  status = 200;
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useCurrentContract(), { wrapper });

  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(hook.result.current.data).toEqual(contract);
});

it("resolves a failed load to null", async () => {
  status = 500;
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useCurrentContract(), { wrapper });

  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(hook.result.current.data).toBeNull();
});
