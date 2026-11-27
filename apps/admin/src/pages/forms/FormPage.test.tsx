import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { ToastProvider } from "../../ui/ToastProvider";
import FormPage from "./FormPage";

afterEach(cleanup);

let formStatus = 200;
let formLoads = 0;

serveApi(
  routes({
    "GET /tasks/adminForm/:id": () => {
      formLoads += 1;
      return formStatus === 200
        ? Response.json({
            id: 3,
            title: "Intake",
            formSnapshotId: 9,
            schema: { pages: [], outputViews: [] },
          })
        : Response.json({}, { status: formStatus });
    },
    "GET /tasks/listForms": () =>
      Response.json([
        {
          id: 3,
          title: "Intake",
          slug: "intake",
          formSnapshotId: 9,
          displaySlug: "intake",
          usedInAction: { id: 12, name: "Call your MP" },
        },
      ]),
    "GET /tasks/forms/:formId/snapshotMigration": () =>
      Response.json({
        formTitle: "Intake",
        latestSnapshot: {
          id: 9,
          hash: "hash-9",
          createdAt: "2026-01-01T00:00:00.000Z",
          schema: { pages: [], outputViews: [] },
        },
        groups: [],
      }),
  }),
);

beforeEach(() => {
  formStatus = 200;
  formLoads = 0;
});

const renderPage = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <ToastProvider>
        <Routes>
          <Route path="/tasks/forms/:formId" element={<FormPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

it("names the form and links the task it belongs to", async () => {
  renderPage("/tasks/forms/3?tab=versions");

  expect(await screen.findByRole("heading", { name: "Intake" })).toBeTruthy();
  const task = await screen.findByRole("link", { name: "Call your MP" });
  expect(task.getAttribute("href")).toBe("/tasks/12");
  expect(
    await screen.findByText("Every response is on the current version"),
  ).toBeTruthy();
});

it("says a form that isn't there is not found", async () => {
  formStatus = 404;
  renderPage("/tasks/forms/3?tab=versions");

  expect(await screen.findByText("Form not found")).toBeTruthy();
});

it("says an id that can't be a form's is not found without asking the server", () => {
  renderPage("/tasks/forms/abc");

  expect(screen.getByText("Form not found")).toBeTruthy();
  expect(formLoads).toBe(0);
});
