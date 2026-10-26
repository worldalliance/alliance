import type { AdminProjectDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { adminActionListItem } from "../lib/testing/adminActionListItem";
import ProjectDetailPage from "./ProjectDetailPage";

const cleanAir: AdminProjectDto = {
  id: 1,
  name: "Clean air",
  slug: "clean-air",
  category: [],
};

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
      ]),
    "GET /projects": () => Response.json([cleanAir]),
    "GET /user/tags": () => Response.json([]),
    "PUT /projects/actions/:actionId": async ({ request, params }) => {
      const { projectId }: { projectId: number | null } = await request.json();
      requests.push(`assign ${params.actionId} to ${projectId}`);
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
  expect(screen.getByText(/2 won't · 5/)).toBeTruthy();
});

it("says so when the project does not exist", async () => {
  renderPage(99);

  expect(await screen.findByText("Project not found.")).toBeTruthy();
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

  fireEvent.click(
    await screen.findByRole("button", { name: /Delete project/ }),
  );
  expect(screen.getByText("Delete project 'Clean air'?")).toBeTruthy();
  expect(
    screen.getByText("Its 1 actions stay and become standalone."),
  ).toBeTruthy();
  fireEvent.click(
    screen.getAllByRole("button", { name: "Delete project" }).at(-1)!,
  );

  expect(await screen.findByText("Projects list")).toBeTruthy();
  expect(requests).toEqual(["delete 1"]);
});
