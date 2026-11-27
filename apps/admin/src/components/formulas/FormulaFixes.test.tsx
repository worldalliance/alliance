import type { FormulaProblemDto } from "@alliance/shared/client";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import FormulaFixes from "./FormulaFixes";
import type { PartFixDraft } from "./PartFixFields";

const partProblem: FormulaProblemDto = {
  kind: "dependent",
  id: "partition:7:part-1",
  text: "gate",
  diagnostics: [{ message: "This is undecided.", start: 0, end: 4 }],
  partition: {
    suiteId: 7,
    suiteName: "Week 12",
    versionId: 3,
    partId: "part-1",
    partName: "Gated",
    fallback: null,
  },
};

let latest: PartFixDraft[] = [];
let stopped: string[] = [];

const Harness = () => {
  const [partFixes, setPartFixes] = useState<PartFixDraft[]>([]);
  latest = partFixes;
  return (
    <FormulaFixes
      fixes={[]}
      onFixesChange={() => {}}
      partFixes={partFixes}
      onPartFixesChange={setPartFixes}
      problems={[partProblem]}
      formulas={[]}
      readOnly={false}
      heading="Problems in other formulas and parts"
      onStopped={(id) => stopped.push(id)}
    />
  );
};

it("names a part's problem and fixes its fallback in the same save", () => {
  const router = createMemoryRouter([{ path: "/", element: <Harness /> }]);
  render(<RouterProvider router={router} />);
  expect(
    screen
      .getByRole("link", { name: /Part "Gated" of Week 12/ })
      .getAttribute("href"),
  ).toBe("/tasks/suites/7");
  fireEvent.click(screen.getByRole("button", { name: "Fix it in this save" }));
  expect(
    screen.getByRole("heading", {
      name: 'Fixing part "Gated" of Week 12 in this save',
    }),
  ).toBe(document.activeElement);
  fireEvent.change(
    screen.getByRole("combobox", { name: /When the condition is undecided/ }),
    { target: { value: "continue" } },
  );
  expect(latest.map((draft) => draft.fix)).toEqual([
    {
      suiteId: 7,
      baseVersionId: 3,
      partId: "part-1",
      text: "gate",
      fallback: "continue",
    },
  ]);
});

it("drops a part fix and tells the page when the admin stops fixing it", () => {
  stopped = [];
  const router = createMemoryRouter([{ path: "/", element: <Harness /> }]);
  render(<RouterProvider router={router} />);
  fireEvent.click(screen.getByRole("button", { name: "Fix it in this save" }));
  fireEvent.click(screen.getByRole("button", { name: "Stop fixing it" }));
  expect(latest).toEqual([]);
  expect(stopped).toEqual(["partition:7:part-1"]);
  expect(
    screen.getByRole("button", { name: "Fix it in this save" }),
  ).toBeTruthy();
});
