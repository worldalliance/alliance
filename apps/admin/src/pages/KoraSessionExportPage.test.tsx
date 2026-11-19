import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import KoraSessionExportPage from "./KoraSessionExportPage";

let found: boolean;
let exported: Record<string, unknown> | null;

serveApi(
  routes({
    "GET /kora/admin/results/sessions/:id": ({ params }) =>
      found
        ? Response.json({
            id: params.id,
            reviewerId: "rev-1",
            endedAt: "2026-11-11T10:00:00.000Z",
            export: exported,
          })
        : Response.json({ message: "Session not found" }, { status: 404 }),
  }),
);

beforeEach(() => {
  found = true;
  exported = {
    ratings: [
      { conversationId: "C1", status: "done", kind: "rated" },
      { conversationId: "C2", status: "judging", kind: "practice" },
    ],
  };
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/kora-participants/sessions/s1"]}>
      <Routes>
        <Route
          path="/kora-participants/sessions/:sessionId"
          element={<KoraSessionExportPage />}
        />
      </Routes>
    </MemoryRouter>,
    queryWrapper(),
  );

test("lists each conversation's rating, with the raw export below", async () => {
  renderPage();
  const row = (await screen.findByText("C2")).closest("tr");
  expect(row?.textContent).toBe("C2judgingpractice");
  expect(screen.getByText("rev-1")).toBeTruthy();
  expect(screen.getByText("Raw export")).toBeTruthy();
});

test("says when the export has no readable ratings", async () => {
  exported = { ratings: "nope" };
  renderPage();
  await screen.findByText(/no readable list of ratings/);
});

test("says when nothing has been saved yet", async () => {
  exported = null;
  renderPage();
  await screen.findByText("No export has been saved yet.");
});

test("says when the session is gone", async () => {
  found = false;
  renderPage();
  await screen.findByText("Session not found");
});
