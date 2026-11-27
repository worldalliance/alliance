import type { ClusterAdminDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { sessionExpiredMessage } from "../../lib/sessionExpired";
import { LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import { ToastProvider } from "../../ui/ToastProvider";
import ClustersPage from "./ClustersPage";

const cluster = (id: number, displayName: string) =>
  ({
    id,
    displayName,
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    members: [{ id: id * 10, displayName: `Member ${id}` }],
  }) satisfies ClusterAdminDto;

let loadStatus = 200;
let loaded: ClusterAdminDto[] = [];
let loads = 0;
let renameAnswer: () => Response = () => Response.json({});

serveApi(
  routes({
    "GET /cluster/admin": () => {
      loads += 1;
      return loadStatus === 200
        ? Response.json(loaded)
        : Response.json({}, { status: loadStatus });
    },
    "PATCH /cluster/admin/:id": () => renameAnswer(),
  }),
);

beforeEach(() => {
  loadStatus = 200;
  loaded = [cluster(1, "North"), cluster(2, "South")];
  loads = 0;
});

const renderPage = (query = queryWrapper(), path = "/members/clusters") =>
  render(
    <MemoryRouter initialEntries={[path]}>
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
  expect(await screen.findByText("Couldn't load clusters")).toBeTruthy();
  expect(screen.getByText(LOAD_FAILED_FALLBACK)).toBeTruthy();
  expect(screen.queryByText("No clusters yet")).toBeNull();
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

  expect(
    await screen.findByText("Couldn't refresh clusters.", { exact: false }),
  ).toBeTruthy();
  expect(screen.getByText("North")).toBeTruthy();
});

const copyFailed = "Couldn't copy the clustermates to the clipboard.";

const renameNorthTo = async (name: string) => {
  fireEvent.click(
    screen.getByRole("button", { name: "Rename cluster: North" }),
  );
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

it("moves focus into the name field when the rename opens", async () => {
  renderPage();
  await screen.findByText("North");

  fireEvent.click(
    screen.getByRole("button", { name: "Rename cluster: North" }),
  );

  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByDisplayValue("North")),
  );
});

it("keeps a cluster renamed out of the search shown, with focus on Rename", async () => {
  renameAnswer = () => Response.json(cluster(1, "Zed"));
  renderPage(queryWrapper(), "/members/clusters?q=north");
  await screen.findByText("North");
  expect(screen.queryByText("South")).toBeNull();

  await renameNorthTo("Zed");

  expect(await screen.findByText("Zed")).toBeTruthy();
  const rename = screen.getByRole("button", { name: "Rename cluster: Zed" });
  await waitFor(() => expect(document.activeElement).toBe(rename));
});

it("keeps each member list named while its cluster is being renamed", async () => {
  renderPage();
  await screen.findByText("North");

  fireEvent.click(
    screen.getByRole("button", { name: "Rename cluster: North" }),
  );

  expect(screen.getByRole("list", { name: "Members of North" })).toBeTruthy();
});

it("narrows the clusters to one whose member matches the search", async () => {
  renderPage();
  await screen.findByText("North");

  fireEvent.change(
    screen.getByRole("searchbox", { name: "Filter clusters or members" }),
    { target: { value: "member 2" } },
  );

  expect(await screen.findByText("1 of 2 clusters")).toBeTruthy();
  expect(screen.getByText("South")).toBeTruthy();
  expect(screen.queryByText("North")).toBeNull();
});

it("says nothing matches a search with no results and clears it", async () => {
  renderPage(queryWrapper(), "/members/clusters?q=nowhere");
  expect(await screen.findByText("No results")).toBeTruthy();
  expect(screen.queryByText("No clusters yet")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

  expect(await screen.findByText("North")).toBeTruthy();
  expect(screen.getByText("South")).toBeTruthy();
});

it("can't export clustermates when there are no clusters", async () => {
  loaded = [];
  renderPage();
  await screen.findByText("No clusters yet");

  const exportButton = screen.getByRole("button", {
    name: "Export clustermates",
  });
  expect(exportButton.hasAttribute("disabled")).toBe(true);
});

describe("Export clustermates", () => {
  afterEach(() => jest.restoreAllMocks());

  const exportWith = async (writeText: () => Promise<void>) => {
    const spy = jest
      .spyOn(navigator.clipboard, "writeText")
      .mockImplementation(writeText);
    renderPage();
    await screen.findByText("North");
    fireEvent.click(
      screen.getByRole("button", { name: "Export clustermates" }),
    );
    return spy;
  };

  it("copies each member's clustermates and says how many", async () => {
    const spy = await exportWith(() => Promise.resolve());

    expect(
      await screen.findByText("Copied clustermates for 2 members"),
    ).toBeTruthy();
    const copied: unknown = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(Object.keys(copied ?? {})).toEqual(["10", "20"]);
    expect(screen.queryByText(copyFailed)).toBeNull();
  });

  it("says the copy failed until dismissed", async () => {
    await exportWith(() => Promise.reject(new DOMException("denied")));

    expect(await screen.findByText(copyFailed)).toBeTruthy();
    expect(
      screen.queryByText("Copied clustermates", { exact: false }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByText(copyFailed)).toBeNull();
  });
});
