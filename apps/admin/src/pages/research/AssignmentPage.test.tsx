import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { ToastProvider } from "../../ui/ToastProvider";
import AssignmentPage from "./AssignmentPage";

const ID = "0b7c6f1e-2d1a-4c3b-9f5e-8a7d6c5b4a39";
let found: boolean;
const requested: string[] = [];
let exported: Record<string, unknown> | null;

serveApi(
  routes({
    "GET /kora/admin/results/assignments/:id": ({ params }) => {
      requested.push(params.id);
      return found
        ? Response.json({
            id: params.id,
            reviewerId: "rev-1",
            completedAt: "2026-11-11T10:00:00.000Z",
            export: exported,
          })
        : Response.json({ message: "Assignment not found" }, { status: 404 });
    },
  }),
);

beforeEach(() => {
  found = true;
  requested.length = 0;
  exported = {
    results: [
      { transcriptId: "T1", status: "done", optedOut: false },
      { transcriptId: "T2", status: "pending", optedOut: true },
    ],
  };
});

const renderPage = (id = ID) =>
  render(
    <MemoryRouter initialEntries={[`/research/assignments/${id}`]}>
      <ToastProvider>
        <Routes>
          <Route
            path="/research/assignments/:assignmentId"
            element={<AssignmentPage />}
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

test("lists each transcript's result, with the raw export below", async () => {
  renderPage();
  const row = (await screen.findByText("T2")).closest("tr");
  expect(row?.textContent).toBe("T2pendingYes");
  expect(screen.getByText(/^Reviewer rev-1 · Completed /)).toBeTruthy();
  expect(screen.getByText("Raw export")).toBeTruthy();
});

test("says when the export has no readable results", async () => {
  exported = { results: "nope" };
  renderPage();
  await screen.findByText(/no readable list of results/);
});

test("says when nothing has been saved yet", async () => {
  exported = null;
  renderPage();
  await screen.findByText("No export has been saved yet.");
});

test("says when the assignment is gone", async () => {
  found = false;
  renderPage();
  await screen.findByText("Assignment not found");
  expect(screen.queryByText("Couldn't load this assignment")).toBeNull();
});

test("treats an id that isn't a UUID as not found, without asking the server", async () => {
  renderPage("a1");
  await screen.findByText("Assignment not found");
  expect(requested).toEqual([]);
});
