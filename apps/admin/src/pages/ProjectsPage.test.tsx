import type { ActionEventDto, AdminProjectDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { adminActionListItem } from "../lib/testing/adminActionListItem";
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
      ]),
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
  }),
);

beforeEach(() => {
  projectsStatus = 200;
  created = [];
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/projects"]}>
      <ToastProvider>
        <Routes>
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<p>Project page</p>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

it("groups projects and standalone actions into lifecycle sections", async () => {
  renderPage();

  expect(await screen.findByRole("link", { name: "Clean air" })).toBeTruthy();
  expect(screen.getByText("Live")).toBeTruthy();
  expect(screen.getByText("Upcoming")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Lone survey" })).toBeTruthy();
  expect(screen.getByText("Standalone action")).toBeTruthy();
  expect(screen.queryByText("Archived thing")).toBeNull();
});

it("flags a deadline within three days and draws the project's timeline", async () => {
  renderPage();

  expect(
    await screen.findByText('"Measure the air" closes in 2 days'),
  ).toBeTruthy();
  expect(screen.getByTitle(/^Measure the air: Member Action/)).toBeTruthy();
});

it("makes a project from a standalone action, prefilled with its name", async () => {
  renderPage();

  fireEvent.click(
    await screen.findByRole("button", {
      name: "Make a project from this action",
    }),
  );
  const input = screen.getByPlaceholderText("Project name");
  expect(input).toHaveProperty("value", "Lone survey");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

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

it("creates a project from the name input", async () => {
  renderPage();

  fireEvent.click(await screen.findByRole("button", { name: "New project" }));
  fireEvent.change(screen.getByPlaceholderText("New project name"), {
    target: { value: "  Clean soil " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  expect(
    await screen.findByRole("button", { name: "New project" }),
  ).toBeTruthy();
  expect(created).toEqual(["Clean soil"]);
});

it("says the projects failed to load", async () => {
  projectsStatus = 500;
  renderPage();

  expect(await screen.findByText("Could not load projects")).toBeTruthy();
});
