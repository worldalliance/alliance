import type { ContractAdminDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { sessionExpiredMessage } from "../lib/sessionExpired";
import ContractsPage from "./ContractsPage";

afterEach(cleanup);

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

let loadStatus = 200;

serveApi(
  routes({
    "GET /contract/admin": () =>
      loadStatus === 200
        ? Response.json([contract(1, "Pledge"), contract(2, "Charter")])
        : Response.json({}, { status: loadStatus }),
    "GET /contract/current": () => Response.json(contract(1, "Pledge")),
  }),
);

beforeEach(() => {
  loadStatus = 200;
});

const renderPage = (query = queryWrapper()) =>
  render(
    <MemoryRouter>
      <ContractsPage />
    </MemoryRouter>,
    query,
  );

it("groups the loaded contracts around the current one", async () => {
  renderPage();
  expect(await screen.findByText("Pledge")).toBeTruthy();
  expect(screen.getByText("Active")).toBeTruthy();
  expect(screen.getByText("Charter")).toBeTruthy();
  expect(screen.getByText("Inactive")).toBeTruthy();
});

it("says the contracts failed to load instead of listing none", async () => {
  loadStatus = 500;
  renderPage();
  expect(await screen.findByText("Failed to load contracts")).toBeTruthy();
  expect(screen.queryByText("No contracts found.")).toBeNull();
});

it("says the session expired when the load is refused with a 401", async () => {
  loadStatus = 401;
  renderPage();
  expect(await screen.findByText(sessionExpiredMessage)).toBeTruthy();
});

it("keeps the loaded contracts beside a refetch error", async () => {
  const query = queryWrapper();
  renderPage(query);
  await screen.findByText("Charter");

  loadStatus = 500;
  await act(() => query.client.refetchQueries());

  expect(await screen.findByText("Failed to load contracts")).toBeTruthy();
  expect(screen.getByText("Charter")).toBeTruthy();
});
