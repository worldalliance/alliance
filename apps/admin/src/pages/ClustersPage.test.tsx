import type { ClusterAdminDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { sessionExpiredMessage } from "../lib/sessionExpired";
import ClustersPage from "./ClustersPage";

afterEach(cleanup);

const cluster = (id: number, displayName: string) =>
  ({
    id,
    displayName,
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    members: [{ id: id * 10, displayName: `Member ${id}` }],
  }) satisfies ClusterAdminDto;

let loadStatus = 200;
let loads = 0;
let renameAnswer: () => Response = () => Response.json({});

serveApi(
  routes({
    "GET /cluster/admin": () => {
      loads += 1;
      return loadStatus === 200
        ? Response.json([cluster(1, "North"), cluster(2, "South")])
        : Response.json({}, { status: loadStatus });
    },
    "PATCH /cluster/admin/:id": () => renameAnswer(),
  }),
);

beforeEach(() => {
  loadStatus = 200;
  loads = 0;
});

const renderPage = (query = queryWrapper()) =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <ClustersPage />
      </ToastProvider>
    </MemoryRouter>,
    query,
  );

it("lists the loaded clusters with their members", async () => {
  renderPage();
  expect(await screen.findByText("North")).toBeTruthy();
  expect(screen.getByText("South")).toBeTruthy();
  expect(screen.getByText("Member 1")).toBeTruthy();
  expect(screen.getByText("2 clusters")).toBeTruthy();
});

it("fetches the clusters once on load", async () => {
  renderPage();
  await screen.findByText("North");
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(loads).toBe(1);
});

it("says the clusters failed to load instead of listing none", async () => {
  loadStatus = 500;
  renderPage();
  expect(await screen.findByText("Unable to load clusters.")).toBeTruthy();
  expect(screen.queryByText("No clusters yet.")).toBeNull();
  expect(screen.queryByText("0 clusters")).toBeNull();
});

it("says the session expired when the load is refused with a 401", async () => {
  loadStatus = 401;
  renderPage();
  expect(await screen.findByText(sessionExpiredMessage)).toBeTruthy();
});

it("keeps the loaded clusters beside a refetch error", async () => {
  const query = queryWrapper();
  renderPage(query);
  await screen.findByText("North");

  loadStatus = 500;
  await act(() => query.client.refetchQueries());

  expect(await screen.findByText("Unable to load clusters.")).toBeTruthy();
  expect(screen.getByText("North")).toBeTruthy();
});

const renameNorthTo = async (name: string) => {
  fireEvent.click(screen.getAllByRole("button", { name: "Rename cluster" })[0]);
  fireEvent.change(screen.getByDisplayValue("North"), {
    target: { value: name },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
  });
};

it("shows the renamed cluster once the server accepts the name", async () => {
  renameAnswer = () => Response.json(cluster(1, "Northeast"));
  renderPage();
  await screen.findByText("North");

  await renameNorthTo("Northeast");

  expect(await screen.findByText("Northeast")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  expect(screen.queryByText("North")).toBeNull();
});

it("keeps the rename open and says why when the server refuses it", async () => {
  renameAnswer = () =>
    Response.json({ message: "Cluster 1 not found" }, { status: 404 });
  renderPage();
  await screen.findByText("North");

  await renameNorthTo("South");

  expect(await screen.findByText("Cluster 1 not found")).toBeTruthy();
  expect(screen.getByDisplayValue("South")).toBeTruthy();
});

it("says the session expired when the rename is refused with a 401", async () => {
  renameAnswer = () => Response.json({}, { status: 401 });
  renderPage();
  await screen.findByText("North");

  await renameNorthTo("Northeast");

  expect(await screen.findByText(sessionExpiredMessage)).toBeTruthy();
});
