import type {
  ActionEventDto,
  ActionStatus,
  ActionUpdateDto,
  AdminProjectDto,
} from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { adminActionListItem } from "../../lib/testing/adminActionListItem";
import { ToastProvider } from "../../ui/ToastProvider";
import ProjectPage from "./ProjectPage";

const cleanAir: AdminProjectDto = {
  id: 1,
  name: "Clean air",
  slug: "clean-air",
  category: [],
};

const actionUpdate = (
  id: number,
  actionId: number,
  title: string,
): ActionUpdateDto => ({
  id,
  actionId,
  title,
  schemaSnapshotId: 1,
  cardImage: null,
  date: "2026-01-05T18:00:00.000Z",
  visibleAt: "2026-01-05T18:00:00.000Z",
  shortNotifString: "",
  associatedEventId: null,
  notifyType: "none",
  notifiedAt: null,
  schema: {},
});

const event = (
  id: number,
  newStatus: ActionStatus,
  title: string,
  day: string,
): ActionEventDto => ({
  id,
  title,
  description: "",
  newStatus,
  date: `${day}T18:00:00.000Z`,
  suiteManaged: false,
});

const rivers: AdminProjectDto = {
  id: 2,
  name: "Rivers",
  slug: "rivers",
  category: [],
};

const suite = (id: number, name: string) => ({
  id,
  name,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  events: [],
});

let requests: string[] = [];
let assignHeld: Promise<void> | undefined;

serveApi(
  routes({
    "GET /actions/all": () =>
      Response.json([
        adminActionListItem(1, "Measure the air", {
          project: cleanAir,
          status: "member_action",
          usersWontComplete: 2,
          usersDismissed: 5,
        }),
        adminActionListItem(2, "Plant trees", { status: "planned" }),
        adminActionListItem(3, "Write the letter", { project: cleanAir }),
        adminActionListItem(4, "Hold the hearing", {
          project: cleanAir,
          status: "completed",
          events: [
            event(20, "member_action", "Signing opens", "2026-01-01"),
            event(21, "completed", "Action completed", "2026-01-08"),
          ],
        }),
        adminActionListItem(5, "Survey the river", {
          project: rivers,
          suite: suite(1, "Survey"),
          usersCompleted: 10,
        }),
        adminActionListItem(6, "Write to the council", {
          project: rivers,
          suite: suite(2, "Lobby"),
          usersCompleted: 8,
        }),
        adminActionListItem(7, "Meet the council", {
          project: rivers,
          suite: suite(2, "Lobby"),
          usersCompleted: 4,
        }),
        adminActionListItem(8, "Survey again", {
          project: rivers,
          suite: suite(1, "Survey"),
          usersCompleted: 2,
        }),
      ]),
    "GET /actions/updates/admin": () =>
      Response.json([
        actionUpdate(10, 1, "Air results are in"),
        actionUpdate(11, 2, "Trees planted"),
      ]),
    "GET /projects": () => Response.json([cleanAir, rivers]),
    "GET /user/tags": () => Response.json([]),
    "GET /tasks/listForms": () => Response.json([]),
    "PUT /projects/actions/:actionId": async ({ request, params }) => {
      const { projectId }: { projectId: number | null } = await request.json();
      requests.push(`assign ${params.actionId} to ${projectId}`);
      await assignHeld;
      return Response.json(null);
    },
    "DELETE /projects/:id": ({ params }) => {
      requests.push(`delete ${params.id}`);
      return new Response(null, { status: 200 });
    },
  }),
);

beforeEach(() => {
  requests = [];
  assignHeld = undefined;
});

const renderPage = (projectId: number, search = "") =>
  render(
    <MemoryRouter initialEntries={[`/tasks/projects/${projectId}${search}`]}>
      <ToastProvider>
        <Routes>
          <Route path="/tasks/projects/:projectId" element={<ProjectPage />} />
          <Route path="/tasks/projects" element={<p>Projects list</p>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

it("shows the project's steps with their responses", async () => {
  renderPage(1);

  expect(
    await screen.findByRole("heading", { name: "Clean air" }),
  ).toBeTruthy();
  const row = screen
    .getByRole("link", { name: "Measure the air" })
    .closest("tr")!;
  expect(within(row).getByText("2 won't · 5 dismissed")).toBeTruthy();
});

it("names an event only where its title adds to its phase", async () => {
  renderPage(1, "?tab=timeline");

  const events = await screen.findByRole("table");
  expect(within(events).getByText("Signing opens")).toBeTruthy();
  expect(within(events).queryByText("Action completed")).toBeNull();
});

it("says what a draft task still needs before staff testing", async () => {
  renderPage(1);

  expect(
    await screen.findByLabelText(
      "Staff testing needs, for Write the letter: Short description, Full body content, Task form linked, Cohort expression set",
    ),
  ).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "More: Write the letter" }),
  );
  expect(
    (
      await screen.findByRole("menuitem", { name: "Start staff testing" })
    ).getAttribute("aria-disabled"),
  ).toBe("true");
});

it("focuses the task picker when Add task is submitted empty", async () => {
  renderPage(1);

  fireEvent.click(await screen.findByRole("button", { name: "Add task…" }));
  const dialog = within(
    await screen.findByRole("dialog", { name: "Add task" }),
  );
  fireEvent.click(dialog.getByRole("button", { name: "Add task" }));

  expect((await dialog.findByRole("alert")).textContent).toBe("Choose a task");
  await waitFor(() =>
    expect(document.activeElement?.getAttribute("aria-invalid")).toBe("true"),
  );
});

it("lists only the updates on the project's tasks", async () => {
  renderPage(1, "?tab=project-updates");

  const update = await screen.findByRole("link", {
    name: "Air results are in",
  });
  expect(update.closest("tr")!.textContent).toContain("No notification");
  expect(screen.queryByText("Trees planted")).toBeNull();
});

it("compares completions only with the task in the row above", async () => {
  renderPage(2);

  const completed = async (name: string) =>
    (await screen.findByRole("link", { name })).closest("tr")!.textContent;
  expect(await completed("Survey the river")).not.toContain("of previous");
  expect(await completed("Survey again")).not.toContain("of previous");
  expect(await completed("Write to the council")).not.toContain("of previous");
  expect(await completed("Meet the council")).toContain("50% of previous");
});

it("says so when the project does not exist", async () => {
  renderPage(99);

  expect(await screen.findByText("Project not found")).toBeTruthy();
});

it("removes a step from the project", async () => {
  renderPage(1);

  fireEvent.click(
    await screen.findByRole("button", { name: "More: Measure the air" }),
  );
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Remove from project" }),
  );

  await waitFor(() => expect(requests).toEqual(["assign 1 to null"]));
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "More: Write the letter" }),
    ),
  );
});

it("lets no other row's write start while one is saving", async () => {
  let release = () => {};
  assignHeld = new Promise((resolve) => (release = resolve));
  renderPage(1);

  fireEvent.click(
    await screen.findByRole("button", { name: "More: Measure the air" }),
  );
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Remove from project" }),
  );
  await waitFor(() => expect(requests).toEqual(["assign 1 to null"]));
  fireEvent.click(
    screen.getByRole("button", { name: "More: Write the letter" }),
  );
  const remove = await screen.findByRole("menuitem", {
    name: "Remove from project",
  });

  expect(remove.getAttribute("aria-disabled")).toBe("true");
  expect(remove.textContent).toContain("Another change is saving");
  release();
  await waitFor(() =>
    expect(screen.queryByText("Another change is saving")).toBeNull(),
  );
});

it("confirms before deleting, then returns to the list", async () => {
  renderPage(1);

  fireEvent.click(await screen.findByRole("button", { name: "More" }));
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Delete project…" }),
  );
  const dialog = within(
    await screen.findByRole("dialog", {
      name: "Delete the project “Clean air”?",
    }),
  );
  expect(
    dialog.getByText(
      "Its 3 tasks stay as they are, in no project. Members no longer see the project's name on them. No one is notified.",
    ),
  ).toBeTruthy();
  fireEvent.click(dialog.getByRole("button", { name: "Delete project" }));

  expect(await screen.findByText("Projects list")).toBeTruthy();
  expect(requests).toEqual(["delete 1"]);
});
