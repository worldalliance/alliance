import { renderHook, waitFor } from "@testing-library/react";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useContractById } from "./useContractById";

const contract = { id: 3, markdown: "Old terms", description: [] };
let status = 200;
let requests = 0;

serveApi(
  routes({
    "GET /contract/detail/3": () => {
      requests += 1;
      return status === 200
        ? Response.json(contract)
        : Response.json({ message: "down" }, { status });
    },
  }),
);

beforeEach(() => {
  status = 200;
  requests = 0;
});

it("loads the contract with the given id", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useContractById(3), { wrapper });

  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(hook.result.current.data).toEqual(contract);
});

it("resolves a failed load to null", async () => {
  status = 500;
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useContractById(3), { wrapper });

  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(hook.result.current.data).toBeNull();
});

it("does not fetch without an id", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useContractById(null), { wrapper });

  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(hook.result.current.data).toBeUndefined();
  expect(requests).toBe(0);
});
