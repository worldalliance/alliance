import { PLACEHOLDER_CONTRACT_MARKDOWN } from "@alliance/shared/lib/contract";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { renderHook, waitFor } from "@testing-library/react";
import { useContract } from "./useContract";

const contract = { id: 7, markdown: "Terms", description: [] };
let current: () => Promise<Response>;

serveApi(routes({ "GET /contract/current": () => current() }));

it("shows the placeholder contract until the current one loads", async () => {
  const { promise, resolve } = Promise.withResolvers<Response>();
  current = () => promise;
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useContract(), { wrapper });

  expect(hook.result.current.latestContract?.markdown).toBe(
    PLACEHOLDER_CONTRACT_MARKDOWN,
  );
  resolve(Response.json(contract));
  await waitFor(() =>
    expect(hook.result.current.latestContract).toEqual(contract),
  );
});

it("reports no contract when the server errors", async () => {
  current = async () => Response.json({ message: "down" }, { status: 500 });
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useContract(), { wrapper });

  await waitFor(() => expect(hook.result.current.latestContract).toBeNull());
});
