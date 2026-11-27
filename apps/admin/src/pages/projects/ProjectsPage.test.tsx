import type {
  ActionEventDto,
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
import ProjectsPage from "./ProjectsPage";

const project = (id: number, name: string): AdminProjectDto => ({
  id,
  name,
  slug: `project-${id}`,
  category: [],
});

const live = project(1, "Clean air");
const finished = project(2, "Old campaign");

const daysFromNow = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

const memberEvent = (date: string): ActionEventDto => ({
  id: 0,
  title: "Opens",
  description: "",
  newStatus: "member_action",
  date,
  suiteManaged: false,
});

const completedEvent = (date: string): ActionEventDto => ({
  ...memberEvent(date),
  newStatus: "completed",
});

const postedUpdate = (
  actionId: number,
  visibleAt: string,
): ActionUpdateDto => ({
  id: actionId,
  actionId,
  title: "Results",
  schemaSnapshotId: 1,
  cardImage: null,
  date: visibleAt,
  visibleAt,
  shortNotifString: "",
  associatedEventId: null,
  notifyType: "none",
  notifiedAt: null,
  schema: {},
});

let projectsStatus = 200;
let created: string[] = [];

serveApi(
  routes({
    "GET /actions/all": () =>
      Response.json([
        adminActionListItem(1, "Measure the air", {
          project: live,
          status: "member_action",
          memberActionStart: daysFromNow(-1),
          memberActionDeadline: daysFromNow(2),
          events: [
            memberEvent(daysFromNow(-1)),
            { ...memberEvent(daysFromNow(2)), newStatus: "office_action" },
          ],
        }),
        adminActionListItem(2, "Past petition", {
          project: finished,
          status: "completed",
        }),
        adminActionListItem(3, "Lone survey", { status: "planned" }),
        adminActionListItem(4, "Archived thing", { archived: true }),
        adminActionListItem(5, "Count the votes", {
          project: live,
          status: "completed",
          events: [completedEvent(daysFromNow(-30))],
        }),
        adminActionListItem(6, "Tally the turnout", {
          project: live,
          status: "completed",
          events: [completedEvent(daysFromNow(-30))],
        }),
      ]),
    "GET /actions/updates/admin": () =>
      Response.json([postedUpdate(5, daysFromNow(-25))]),
    "GET /projects": () =>
      projectsStatus === 200
        ? Response.json([live, finished])
        : Response.json({}, { status: projectsStatus }),
    "POST /projects": async ({ request }) => {
      const { name }: { name: string } = await request.json();
      created.push(name);
      return Response.json(project(3, name));
    },
    "PUT /projects/actions/:actionId": async ({ request, params }) => {
      const { projectId }: { projectId: number } = await request.json();
      created.push(`assign ${params.actionId} to ${projectId}`);
      return Response.json(null);
    },
    "GET /user/tags": () => Response.json([]),
    "GET /tasks/listForms": () => Response.json([]),
  }),
);

beforeEach(() => {
  projectsStatus = 200;
  created = [];
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/tasks/projects"]}>
      <ToastProvider>
        <Routes>
          <Route path="/tasks/projects" element={<ProjectsPage />} />
          <Route
            path="/tasks/projects/:projectId"
            element={<p>Project page</p>}
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

it("groups projects and standalone tasks into lifecycle sections", async () => {
  renderPage();

  expect(await screen.findByRole("link", { name: "Clean air" })).toBeTruthy();
  expect(screen.getByText("Live")).toBeTruthy();
  expect(screen.getByText("Upcoming")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Lone survey" })).toBeTruthy();
  expect(screen.getByText("Standalone task")).toBeTruthy();
  expect(screen.queryByText("Archived thing")).toBeNull();
});

it("flags a deadline within three days and draws the project's timeline", async () => {
  renderPage();

  expect(
    await screen.findByText('"Measure the air" closes in 2 days'),
  ).toBeTruthy();
  expect(
    screen.getByTitle(/^Measure the air: Members taking action/),
  ).toBeTruthy();
});

it("flags a completed task with no update only when none was posted", async () => {
  renderPage();

  expect(
    await screen.findByText(
      /^"Tally the turnout" completed .* with no update posted$/,
    ),
  ).toBeTruthy();
  expect(screen.queryByText(/^"Count the votes" completed/)).toBeNull();
});

it("makes a project from a standalone task, prefilled with its name", async () => {
  renderPage();

  fireEvent.click(
    await screen.findByRole("button", {
      name: "Make project…: Lone survey",
    }),
  );
  const dialog = within(screen.getByRole("dialog", { name: "New project" }));
  expect(dialog.getByLabelText("Name")).toHaveProperty("value", "Lone survey");
  fireEvent.click(dialog.getByRole("button", { name: "Create project" }));

  expect(await screen.findByText("Project page")).toBeTruthy();
  expect(created).toEqual(["Lone survey", "assign 3 to 3"]);
});

it("keeps the Done section collapsed until opened", async () => {
  renderPage();

  const toggle = await screen.findByRole("button", { name: /Done/ });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("link", { name: "Old campaign" })).toBeNull();

  fireEvent.click(toggle);

  expect(screen.getByRole("link", { name: "Old campaign" })).toBeTruthy();
});

it("creates a project from the name input, then opens it", async () => {
  renderPage();

  fireEvent.click(await screen.findByRole("button", { name: "New project…" }));
  const dialog = within(screen.getByRole("dialog", { name: "New project" }));
  fireEvent.change(dialog.getByLabelText("Name"), {
    target: { value: "  Clean soil " },
  });
  fireEvent.click(dialog.getByRole("button", { name: "Create project" }));

  expect(await screen.findByText("Project page")).toBeTruthy();
  expect(created).toEqual(["Clean soil"]);
});

it("asks for a name before creating", async () => {
  renderPage();

  fireEvent.click(await screen.findByRole("button", { name: "New project…" }));
  const dialog = within(screen.getByRole("dialog", { name: "New project" }));
  fireEvent.click(dialog.getByRole("button", { name: "Create project" }));

  expect(dialog.getByText("Enter a name")).toBeTruthy();
  expect(created).toEqual([]);
});

it("hands focus back to the button that opened the dialog", async () => {
  renderPage();

  const opener = await screen.findByRole("button", { name: "New project…" });
  opener.focus();
  fireEvent.click(opener);
  const dialog = within(screen.getByRole("dialog", { name: "New project" }));
  fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));

  await waitFor(() => expect(document.activeElement).toBe(opener));
});

it("finds a project by the name of one of its tasks, opening Done", async () => {
  render(
    <MemoryRouter initialEntries={["/tasks/projects?q=petition"]}>
      <ToastProvider>
        <ProjectsPage />
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

  expect(
    await screen.findByRole("link", { name: "Old campaign" }),
  ).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Clean air" })).toBeNull();
  expect(screen.getByText("1 project · 0 standalone tasks")).toBeTruthy();
});

it("says the projects failed to load", async () => {
  projectsStatus = 500;
  renderPage();

  expect(await screen.findByText("Couldn't load projects")).toBeTruthy();
  expect(screen.getByText("The server didn't answer. Try again.")).toBeTruthy();
  expect(screen.queryByText("No projects yet")).toBeNull();
});
