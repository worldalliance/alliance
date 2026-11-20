import type { FormulaVersionDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen } from "@testing-library/react";
import FormulaHistory from "./FormulaHistory";

const formulaId = "00000000-0000-4000-8000-00000000000a";
const version: FormulaVersionDto = {
  id: 7,
  name: "base",
  text: "2",
  notes: "Why it is 2",
  savedByName: "Ada",
  createdAt: "2026-11-19T00:00:00.000Z",
};

let requested: string[];

serveApi(
  routes({
    "GET /formulas/:id/versions": ({ params }) => {
      requested.push(params.id);
      return Response.json([version]);
    },
  }),
);

beforeEach(() => {
  requested = [];
});

const formula = { id: formulaId, versionId: 7 };
const open = () => {
  const details = document.querySelector("details");
  if (details === null) throw new Error("no details");
  details.open = true;
  fireEvent(details, new Event("toggle"));
};

test("loads the versions once opened", async () => {
  render(<FormulaHistory formula={formula} />, queryWrapper());
  expect(requested).toEqual([]);
  open();
  expect(await screen.findByText(/by Ada as/)).toBeTruthy();
  expect(screen.getByText("Why it is 2")).toBeTruthy();
  expect(requested).toEqual([formulaId]);
});

test("loads afresh once a save adds a version", async () => {
  const query = queryWrapper();
  const { unmount } = render(<FormulaHistory formula={formula} />, query);
  open();
  await screen.findByText(/by Ada as/);
  unmount();
  render(<FormulaHistory formula={{ ...formula, versionId: 8 }} />, query);
  open();
  expect(screen.getByRole("status").textContent).toBe("Loading history…");
  expect(await screen.findByText(/by Ada as/)).toBeTruthy();
  expect(requested).toEqual([formulaId, formulaId]);
});
