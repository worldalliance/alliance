import type { ContractAdminDto } from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { renderHook, waitFor } from "@testing-library/react";
import { useContractAdmin } from "./useContractAdmin";

const contract = (id: number, name: string) =>
  ({
    id,
    name,
    createdAt: "2026-01-02T00:00:00.000Z",
    markdown: "Terms",
    startDate: null,
    endDate: null,
    description: [],
  }) satisfies ContractAdminDto;

const renamed = { name: "Renamed", startDate: null, endDate: null };

let findStatus = 200;
let updateStatus = 200;
let fetched = 0;
let findDelay = 0;

serveApi(
  routes({
    "GET /contract/admin/:id": async ({ params }) => {
      fetched += 1;
      await new Promise((resolve) => setTimeout(resolve, findDelay));
      return findStatus === 200
        ? Response.json(contract(Number(params.id), "Pledge"))
        : Response.json({}, { status: findStatus });
    },
    "POST /contract/create": () => Response.json(contract(2, "New")),
    "PATCH /contract/update/:id": ({ params }) =>
      updateStatus === 200
        ? Response.json(contract(Number(params.id), "Renamed"))
        : Response.json({}, { status: updateStatus }),
  }),
);

afterEach(() => {
  findStatus = 200;
  updateStatus = 200;
  fetched = 0;
  findDelay = 0;
});

const renderContract = (id: number | null) => {
  const query = queryWrapper();
  query.client.setQueryData(queryKeys.contractsAdmin(), []);
  const view = renderHook(() => useContractAdmin(id), query);
  const listInvalidated = () =>
    query.client.getQueryState(queryKeys.contractsAdmin())?.isInvalidated;
  return { view, client: query.client, listInvalidated };
};

it("loads the contract", async () => {
  const { view } = renderContract(1);

  await waitFor(() =>
    expect(view.result.current.query.data).toEqual(contract(1, "Pledge")),
  );
});

it("requests nothing without an id", async () => {
  const { view } = renderContract(null);

  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(view.result.current.query.isLoading).toBe(false);
  expect(fetched).toBe(0);
});

it("reports a failed load", async () => {
  findStatus = 404;
  const { view } = renderContract(1);

  await waitFor(() => expect(view.result.current.query.isError).toBe(true));
});

it("caches a created contract and refreshes the list", async () => {
  const { view, client, listInvalidated } = renderContract(null);

  view.result.current.create.mutate({
    name: "New",
    markdown: "Terms",
    startDate: null,
    endDate: null,
  });

  await waitFor(() =>
    expect(view.result.current.create.data).toEqual(contract(2, "New")),
  );
  expect(client.getQueryData(queryKeys.contractAdmin(2))).toEqual(
    contract(2, "New"),
  );
  expect(listInvalidated()).toBe(true);
});

it("caches an updated contract and refreshes the list", async () => {
  const { view, listInvalidated } = renderContract(1);
  await waitFor(() => expect(view.result.current.query.data).toBeDefined());

  view.result.current.update.mutate(renamed);

  await waitFor(() =>
    expect(view.result.current.query.data).toEqual(contract(1, "Renamed")),
  );
  expect(listInvalidated()).toBe(true);
});

it("keeps the saved contract over a reload that started before the save", async () => {
  const { view, client } = renderContract(1);
  await waitFor(() => expect(view.result.current.query.data).toBeDefined());
  findDelay = 50;
  const reload = client.refetchQueries({
    queryKey: queryKeys.contractAdmin(1),
  });

  view.result.current.update.mutate(renamed);

  await waitFor(() => expect(view.result.current.update.isSuccess).toBe(true));
  await reload;
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(client.getQueryData(queryKeys.contractAdmin(1))).toEqual(
    contract(1, "Renamed"),
  );
});

it("keeps the contract and list on a refused update", async () => {
  updateStatus = 400;
  const { view, listInvalidated } = renderContract(1);
  await waitFor(() => expect(view.result.current.query.data).toBeDefined());

  view.result.current.update.mutate(renamed);

  await waitFor(() => expect(view.result.current.update.isError).toBe(true));
  expect(view.result.current.query.data).toEqual(contract(1, "Pledge"));
  expect(listInvalidated()).toBe(false);
});

it("refuses an update without an id", async () => {
  const { view } = renderContract(null);

  view.result.current.update.mutate(renamed);

  await waitFor(() =>
    expect(view.result.current.update.error?.message).toBe(
      "No contract to update",
    ),
  );
});
