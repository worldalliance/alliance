import type { AdminProjectDto } from "@alliance/shared/client";
import { makeEvent } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { adminActionListItem } from "../lib/testing/adminActionListItem";
import ProjectDetailPage from "./ProjectDetailPage";

const cleanAir: AdminProjectDto = {
  id: 1,
  name: "Clean air",
  slug: "clean-air",
  category: [],
};

const quietStreets: AdminProjectDto = {
  id: 2,
  name: "Quiet streets",
  slug: "quiet-streets",
  category: [],
};

const daysFromNow = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

let requests: string[] = [];

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
        adminActionListItem(3, "Count the cars", {
          project: quietStreets,
          status: "member_action",
          memberActionStart: daysFromNow(-1),
          memberActionDeadline: daysFromNow(2),
          events: [
            makeEvent({ newStatus: "member_action", date: daysFromNow(-1) }),
            makeEvent({ newStatus: "office_action", date: daysFromNow(2) }),
          ],
        }),
      ]),
    "GET /projects": () => Response.json([cleanAir, quietStreets]),
    "GET /user/tags": () => Response.json([]),
    "GET /tasks/listForms": () => Response.json([]),
    "PUT /projects/actions/:actionId": async ({ request, params }) => {
      const { projectId }: { projectId: number | null } = await request.json();
      requests.push(`assign ${params.actionId} to ${projectId}`);
      return Response.json(null);
    },
    "PATCH /projects/:id": async ({ request, params }) => {
      requests.push(
        `update ${params.id} ${JSON.stringify(await request.json())}`,
      );
      return Response.json(cleanAir);
    },
    "DELETE /projects/:id": ({ params }) => {
      requests.push(`delete ${params.id}`);
      return new Response(null, { status: 200 });
    },
  }),
);

beforeEach(() => {
  requests = [];
});

const renderPage = (projectId: number) =>
  render(
    <MemoryRouter initialEntries={[`/projects/${projectId}`]}>
      <ToastProvider>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="/projects" element={<p>Projects list</p>} />
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
  expect(screen.getByText("Measure the air")).toBeTruthy();
  expect(screen.getByText(/^2 won't · 5 dismissed$/)).toBeTruthy();
  expect(
    screen.getByText("Not started · 0 completions · 2 won't · 5 dismissed"),
  ).toBeTruthy();
  expect(screen.getByText("No events scheduled")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Actions 1" })).toBeTruthy();
});

it("draws a bar for each scheduled step on the timeline", async () => {
  renderPage(2);

  expect(
    await screen.findByTitle(/^Count the cars: Member action/),
  ).toBeTruthy();
});

it("names each category in words", async () => {
  renderPage(1);

  const categories = await screen.findByRole("group", { name: "Categories" });
  expect(
    within(categories)
      .getAllByRole("button")
      .map((button) => button.textContent),
  ).toEqual([
    "Environmental destruction",
    "Extreme poverty",
    "Democratic institutional decline",
    "Dangerous technological development",
    "Meta",
  ]);
});

it("says so when the project does not exist", async () => {
  renderPage(99);

  expect(
    await screen.findByRole("heading", { level: 1, name: "Project not found" }),
  ).toBeTruthy();
  expect(screen.getByText("It may have been deleted.")).toBeTruthy();
});

it("removes a step from the project", async () => {
  renderPage(1);

  fireEvent.click(
    await screen.findByRole("button", {
      name: 'Remove "Measure the air" from project',
    }),
  );

  await waitFor(() => expect(requests).toEqual(["assign 1 to null"]));
});

it("confirms before deleting, then returns to the list", async () => {
  renderPage(1);

  fireEvent.click(await screen.findByRole("button", { name: "More" }));
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Delete project" }),
  );
  expect(screen.getByText("Delete project 'Clean air'?")).toBeTruthy();
  expect(
    screen.getByText("Its 1 actions stay and become standalone."),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Delete project" }));

  expect(await screen.findByText("Projects list")).toBeTruthy();
  expect(requests).toEqual(["delete 1"]);
});

it("renames the project in place from its details", async () => {
  renderPage(1);

  fireEvent.click(
    await screen.findByRole("button", { name: "Edit project name" }),
  );
  fireEvent.change(screen.getByPlaceholderText("Project name"), {
    target: { value: "Cleaner air" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  await waitFor(() =>
    expect(requests).toEqual(['update 1 {"name":"Cleaner air"}']),
  );
});

it("adds an existing action to the project from the actions header", async () => {
  renderPage(1);

  const actions = await screen.findByRole("region", { name: "Actions 1" });
  fireEvent.click(within(actions).getByRole("combobox"));
  fireEvent.click(await screen.findByRole("option", { name: "Plant trees" }));

  await waitFor(() => expect(requests).toEqual(["assign 2 to 1"]));
});
