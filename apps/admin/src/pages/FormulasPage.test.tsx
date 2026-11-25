import type { FormulaDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen, within } from "@testing-library/react";
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

serveApi(routes({ "GET /formulas": () => Response.json(stored) }));

const renderPage = () =>
  render(
    <MemoryRouter>
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
