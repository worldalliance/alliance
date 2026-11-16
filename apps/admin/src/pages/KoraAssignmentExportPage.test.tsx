import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import KoraAssignmentExportPage from "./KoraAssignmentExportPage";

let found: boolean;
let exported: Record<string, unknown> | null;

serveApi(
  routes({
    "GET /kora/admin/results/assignments/:id": ({ params }) =>
      found
        ? Response.json({
            id: params.id,
            reviewerId: "rev-1",
            completedAt: "2026-11-11T10:00:00.000Z",
            export: exported,
          })
        : Response.json({ message: "Assignment not found" }, { status: 404 }),
  }),
);

beforeEach(() => {
  found = true;
  exported = {
    results: [
      { transcriptId: "T1", status: "done", optedOut: false },
      { transcriptId: "T2", status: "pending", optedOut: true },
    ],
  };
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/kora-participants/assignments/a1"]}>
      <Routes>
        <Route
          path="/kora-participants/assignments/:assignmentId"
          element={<KoraAssignmentExportPage />}
        />
      </Routes>
    </MemoryRouter>,
    queryWrapper(),
  );

test("lists each transcript's result, with the raw export below", async () => {
  renderPage();
  const row = (await screen.findByText("T2")).closest("tr");
  expect(row?.textContent).toBe("T2pendingYes");
  expect(screen.getByText("rev-1")).toBeTruthy();
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
});
