import type { FormulaDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import FormulasPage from "./FormulasPage";

const formula = (id: string, name: string, reads: string[]): FormulaDto => ({
  id,
  name,
  text: "1 + 1",
  notes: null,
  versionId: 1,
  reads,
  updatedAt: "2026-11-19T00:00:00.000Z",
});
const base = formula("00000000-0000-4000-8000-00000000000a", "base", []);

let stored: FormulaDto[];
let listFails = false;

serveApi(
  routes({
    "GET /formulas": () =>
      listFails
        ? Response.json({ message: "Unavailable" }, { status: 400 })
        : Response.json(stored),
  }),
);

afterEach(() => {
  listFails = false;
});

const renderPage = (path = "/tasks/formulas") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <FormulasPage />
    </MemoryRouter>,
    queryWrapper(),
  );

test("counts the formulas that read each one", async () => {
  stored = [
    base,
    formula("00000000-0000-4000-8000-00000000000b", "doubled", [base.id]),
    formula("00000000-0000-4000-8000-00000000000c", "tripled", [base.id]),
  ];
  renderPage();
  const row = (await screen.findByRole("link", { name: "base" })).closest("tr");
  if (row === null) throw new Error("no row for base");
  expect(within(row).getByRole("cell", { name: "2" })).toBeTruthy();
  const doubled = screen.getByRole("link", { name: "doubled" }).closest("tr");
  if (doubled === null) throw new Error("no row for doubled");
  expect(within(doubled).getByRole("cell", { name: "0" })).toBeTruthy();
});

test("says when there are no formulas", async () => {
  stored = [];
  renderPage();
  expect(await screen.findByText(/^No formulas yet/)).toBeTruthy();
});

test("finds formulas by name, and says when none match", async () => {
  stored = [
    base,
    formula("00000000-0000-4000-8000-00000000000b", "doubled", [base.id]),
  ];
  renderPage("/tasks/formulas?q=doub");
  expect(await screen.findByRole("link", { name: "doubled" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "base" })).toBeNull();
  expect(screen.getByText("1 of 2 formulas")).toBeTruthy();
  // The filtered row still counts every formula that reads it.
  cleanup();
  renderPage("/tasks/formulas?q=base");
  const row = (await screen.findByRole("link", { name: "base" })).closest("tr");
  if (row === null) throw new Error("no row for base");
  expect(within(row).getByRole("cell", { name: "1" })).toBeTruthy();
  cleanup();
  renderPage("/tasks/formulas?q=nothing");
  expect(await screen.findByText("No results")).toBeTruthy();
  expect(screen.queryByText(/^No formulas yet/)).toBeNull();
});

test("says why the formulas couldn't load, not that there are none", async () => {
  listFails = true;
  renderPage();
  expect(await screen.findByText("Couldn't load formulas")).toBeTruthy();
  expect(screen.getByText("Unavailable")).toBeTruthy();
  expect(screen.queryByText(/^No formulas yet/)).toBeNull();
});
