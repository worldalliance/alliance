import type { ContractAdminDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { sessionExpiredMessage } from "../../lib/sessionExpired";
import { LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import ContractsPage from "./ContractsPage";

const contract = (id: number, name: string, startDate: string | null = null) =>
  ({
    id,
    name,
    createdAt: "2026-01-02T00:00:00.000Z",
    markdown: "Terms",
    startDate,
    endDate: null,
    description: [],
  }) satisfies ContractAdminDto;

let loadStatus = 200;
let currentStatus = 200;
let served = [contract(1, "Pledge"), contract(2, "Charter")];

serveApi(
  routes({
    "GET /contract/admin": () =>
      loadStatus === 200
        ? Response.json(served)
        : Response.json({}, { status: loadStatus }),
    "GET /contract/current": () =>
      currentStatus === 200
        ? Response.json(contract(1, "Pledge"))
        : Response.json({}, { status: currentStatus }),
  }),
);

beforeEach(() => {
  loadStatus = 200;
  currentStatus = 200;
  served = [contract(1, "Pledge"), contract(2, "Charter")];
});

const renderPage = (query = queryWrapper()) =>
  render(
    <MemoryRouter initialEntries={["/tasks/contracts"]}>
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
  expect(await screen.findByText("Couldn't load contracts")).toBeTruthy();
  expect(screen.getByText(LOAD_FAILED_FALLBACK)).toBeTruthy();
  expect(screen.queryByText("No contracts yet")).toBeNull();
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

  expect(await screen.findByText(/^Couldn't refresh contracts/)).toBeTruthy();
  expect(screen.getByText("Charter")).toBeTruthy();
});

it("links each contract to its record, and one with no name by its id", async () => {
  served = [contract(1, "Pledge"), contract(2, " ")];
  renderPage();
  const link = await screen.findByRole("link", { name: "Pledge" });
  expect(link.getAttribute("href")).toBe("/tasks/contracts/1");
  expect(
    screen.getByRole("link", { name: "Contract #2" }).getAttribute("href"),
  ).toBe("/tasks/contracts/2");
});

it("lists a contract that starts later as scheduled, soonest first", async () => {
  served = [
    contract(1, "Pledge"),
    contract(2, "Later", "2999-06-01T00:00:00.000Z"),
    contract(3, "Sooner", "2999-01-01T00:00:00.000Z"),
  ];
  renderPage();
  await screen.findByText("Scheduled");
  const names = screen.getAllByRole("link").map((link) => link.textContent);
  expect(names.indexOf("Sooner")).toBeLessThan(names.indexOf("Later"));
});

it("says no contract is active when none has started", async () => {
  currentStatus = 500;
  renderPage();
  expect(await screen.findByText(/^No contract is active/)).toBeTruthy();
  expect(screen.queryByText("Active")).toBeNull();
});

it("says the active contract couldn't load when one has started, marking it Active from the dates", async () => {
  currentStatus = 500;
  served = [contract(1, "Pledge", "2020-01-01T00:00:00.000Z")];
  renderPage();
  expect(
    await screen.findByText(/^Couldn't load which contract is active/),
  ).toBeTruthy();
  expect(screen.queryByText(/^No contract is active/)).toBeNull();
  expect(screen.getByText("Active")).toBeTruthy();
  expect(screen.queryByText("Inactive")).toBeNull();
});
