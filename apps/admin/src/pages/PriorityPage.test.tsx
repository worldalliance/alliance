import type {
  AdminActionListItemDto,
  GeneralUpdateAdminDto,
  SetPriorityDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { makeEvent } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { sessionExpiredMessage } from "../lib/sessionExpired";
import { adminActionListItem } from "../lib/testing/adminActionListItem";
import { generalUpdateAdmin } from "../lib/testing/generalUpdateAdmin";
import PriorityPage from "./PriorityPage";

afterEach(cleanup);

const loaded = [
  adminActionListItem(1, "Call your rep", { priority: 2 }),
  adminActionListItem(2, "Sign the petition", { priority: 1 }),
];

let loadStatus = 200;
let generalUpdatesStatus = 200;
let saveStatus = 200;
let servedActions: AdminActionListItemDto[] = loaded;
let servedGeneralUpdates: GeneralUpdateAdminDto[] = [];
let actionLoads = 0;
let generalUpdateLoads = 0;
let saved: SetPriorityDto | null = null;

serveApi(
  routes({
    "GET /actions/all": () => {
      actionLoads += 1;
      return loadStatus === 200
        ? Response.json(servedActions)
        : Response.json({}, { status: loadStatus });
    },
    "GET /actions/generalUpdates/admin": () => {
      generalUpdateLoads += 1;
      return generalUpdatesStatus === 200
        ? Response.json(servedGeneralUpdates)
        : Response.json({}, { status: generalUpdatesStatus });
    },
    "POST /actions/priorities": async ({ request }) => {
      if (saveStatus !== 200) {
        return Response.json({}, { status: saveStatus });
      }
      const body: SetPriorityDto = await request.json();
      saved = body;
      const priorityOf = new Map(
        body.actionPriorities.map(({ id, priority }) => [id, priority]),
      );
      servedActions = servedActions.map((a) => ({
        ...a,
        priority: priorityOf.get(a.id) ?? a.priority,
      }));
      return Response.json({});
    },
  }),
);

beforeEach(() => {
  loadStatus = 200;
  generalUpdatesStatus = 200;
  saveStatus = 200;
  servedActions = loaded;
  servedGeneralUpdates = [];
  actionLoads = 0;
  generalUpdateLoads = 0;
  saved = null;
});

const renderPage = (query = queryWrapper()) =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <PriorityPage />
      </ToastProvider>
    </MemoryRouter>,
    query,
  );

const rowOf = (name: string) => {
  const row = screen.getByText(name).closest("[draggable]");
  if (!row) throw new Error(`no draggable row for ${name}`);
  return row;
};

const dragBelow = (dragged: string, target: string) => {
  fireEvent.dragStart(rowOf(dragged), { dataTransfer: {} });
  fireEvent.dragOver(rowOf(target), { dataTransfer: {}, clientY: 1 });
  fireEvent.drop(rowOf(target), { dataTransfer: {}, clientY: 1 });
};

const refetchWith = async (
  query: ReturnType<typeof queryWrapper>,
  actions: AdminActionListItemDto[],
) => {
  servedActions = actions;
  await act(() => query.client.refetchQueries());
  await waitFor(() =>
    expect(query.client.getQueryData(queryKeys.actionsAllAdmin())).toEqual(
      actions,
    ),
  );
  await act(async () => {});
};

it("lists the loaded actions and general updates", async () => {
  servedGeneralUpdates = [generalUpdateAdmin(4, "Weekly note")];
  renderPage();
  expect(await screen.findByText("Call your rep")).toBeTruthy();
  expect(screen.getByText("Sign the petition")).toBeTruthy();
  expect(screen.getByText("Weekly note")).toBeTruthy();
  expect(screen.getByText("No changes to save")).toBeTruthy();
});

it("says the list failed to load instead of showing none", async () => {
  loadStatus = 500;
  renderPage();
  expect(
    await screen.findByText("Failed to load actions and general updates"),
  ).toBeTruthy();
});

it("says the general updates failed to load instead of loading forever", async () => {
  generalUpdatesStatus = 500;
  renderPage();
  expect(
    await screen.findByText("Failed to load actions and general updates"),
  ).toBeTruthy();
});

it("keeps the loaded list beside a refetch error", async () => {
  const query = queryWrapper();
  renderPage(query);
  await screen.findByText("Call your rep");

  loadStatus = 500;
  await act(() => query.client.refetchQueries());

  expect(
    await screen.findByText("Failed to load actions and general updates"),
  ).toBeTruthy();
  expect(screen.getByText("Call your rep")).toBeTruthy();
});

it("says the session expired when the load is refused with a 401", async () => {
  loadStatus = 401;
  renderPage();
  expect(await screen.findByText(sessionExpiredMessage)).toBeTruthy();
});

it("keeps an unsaved reorder through a background refetch", async () => {
  const query = queryWrapper();
  renderPage(query);
  await screen.findByText("Call your rep");
  dragBelow("Call your rep", "Sign the petition");
  expect(screen.getByText("Save")).toBeTruthy();

  await refetchWith(query, [
    ...loaded,
    adminActionListItem(3, "Join the call", { priority: 0 }),
  ]);

  expect(screen.getByText("Save")).toBeTruthy();
});

it("compares a reorder with the order it started from after a refetch", async () => {
  const query = queryWrapper();
  renderPage(query);
  await screen.findByText("Call your rep");
  dragBelow("Call your rep", "Sign the petition");

  await refetchWith(query, [
    adminActionListItem(3, "Join the call", { priority: 5 }),
    ...loaded,
  ]);
  dragBelow("Sign the petition", "Call your rep");

  expect(screen.getByText("No changes to save")).toBeTruthy();
});

it("drops an unsaved reorder when Show all is toggled", async () => {
  renderPage();
  await screen.findByText("Call your rep");
  dragBelow("Call your rep", "Sign the petition");

  fireEvent.click(screen.getByLabelText("Show all"));

  expect(screen.getByText("No changes to save")).toBeTruthy();
});

it("saves the reorder and reloads the list", async () => {
  servedGeneralUpdates = [generalUpdateAdmin(4, "Weekly note")];
  const query = queryWrapper();
  renderPage(query);
  await screen.findByText("Call your rep");
  dragBelow("Call your rep", "Sign the petition");

  fireEvent.click(screen.getByText("Save"));

  expect(await screen.findByText("No changes to save")).toBeTruthy();
  await waitFor(() => expect(generalUpdateLoads).toBe(2));
  expect(saved?.actionPriorities).toEqual([
    { id: 2, priority: 3 },
    { id: 1, priority: 2 },
  ]);
  expect(saved?.generalUpdatePriorities).toEqual([{ id: 4, priority: 1 }]);
  expect(actionLoads).toBe(2);

  await refetchWith(query, [
    ...servedActions,
    adminActionListItem(3, "Join the call", { priority: -1 }),
  ]);
  expect(screen.getByText("Join the call")).toBeTruthy();
});

it("keeps showing the saved order when the reload after a save fails", async () => {
  renderPage();
  await screen.findByText("Call your rep");
  dragBelow("Call your rep", "Sign the petition");

  loadStatus = 500;
  fireEvent.click(screen.getByText("Save"));

  expect(
    await screen.findByText("Failed to load actions and general updates"),
  ).toBeTruthy();
  expect(screen.getByText("No changes to save")).toBeTruthy();
  const names = Array.from(document.querySelectorAll("li"), (li) =>
    li.textContent?.includes("Call your rep")
      ? "Call your rep"
      : li.textContent?.includes("Sign the petition")
        ? "Sign the petition"
        : null,
  ).filter(Boolean);
  expect(names).toEqual(["Sign the petition", "Call your rep"]);
});

it("keeps the reorder and says why when the save is refused", async () => {
  saveStatus = 401;
  renderPage();
  await screen.findByText("Call your rep");
  dragBelow("Call your rep", "Sign the petition");

  fireEvent.click(screen.getByText("Save"));

  expect(await screen.findByText(sessionExpiredMessage)).toBeTruthy();
  expect(screen.getByText("Save")).toBeTruthy();
});

const pastDate = "2026-01-01T00:00:00.000Z";
const closedDate = "2026-01-10T00:00:00.000Z";
it("lists a closed action shown after its deadline and says why", async () => {
  servedActions = [
    adminActionListItem(1, "Late petition", {
      status: "office_action",
      shouldCompleteAfterDeadline: true,
      events: [
        makeEvent({ date: pastDate }),
        makeEvent({ id: 3, newStatus: "office_action", date: closedDate }),
      ],
    }),
    adminActionListItem(2, "Old petition", {
      status: "office_action",
      events: [
        makeEvent({ id: 2, date: pastDate }),
        makeEvent({ id: 4, newStatus: "office_action", date: closedDate }),
      ],
    }),
  ];
  renderPage();
  expect(await screen.findByText("Late petition")).toBeTruthy();
  expect(screen.getByText("Available after deadline")).toBeTruthy();
  expect(screen.queryByText("Old petition")).toBeNull();

  fireEvent.click(screen.getByLabelText("Show all"));

  expect(screen.getByText("Old petition")).toBeTruthy();
  expect(
    screen.getByText(/No member action open, upcoming, or shown after/),
  ).toBeTruthy();
});
