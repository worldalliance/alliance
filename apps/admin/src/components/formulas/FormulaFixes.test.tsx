import type { FormulaProblemDto } from "@alliance/shared/client";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import FormulaFixes from "./FormulaFixes";
import type { GroupFixDraft } from "./GroupFixFields";

const groupProblem: FormulaProblemDto = {
  kind: "dependent",
  id: "split:7:group-1",
  text: "gate",
  diagnostics: [{ message: "This is undecided.", start: 0, end: 4 }],
  split: {
    suiteId: 7,
    suiteName: "Week 12",
    versionId: 3,
    groupId: "group-1",
    groupName: "Gated",
    fallback: null,
  },
};

let latest: GroupFixDraft[] = [];
let stopped: string[] = [];

const Harness = () => {
  const [groupFixes, setGroupFixes] = useState<GroupFixDraft[]>([]);
  latest = groupFixes;
  return (
    <FormulaFixes
      fixes={[]}
      onFixesChange={() => {}}
      groupFixes={groupFixes}
      onGroupFixesChange={setGroupFixes}
      problems={[groupProblem]}
      formulas={[]}
      readOnly={false}
      heading="Problems in other formulas and groups"
      onStopped={(id) => stopped.push(id)}
    />
  );
};

it("names a split group's problem and fixes its fallback in the same save", () => {
  const router = createMemoryRouter([{ path: "/", element: <Harness /> }]);
  render(<RouterProvider router={router} />);
  expect(
    screen
      .getByRole("link", { name: /Group "Gated" of Week 12/ })
      .getAttribute("href"),
  ).toBe("/suites/7");
  fireEvent.click(screen.getByRole("button", { name: "Fix it in this save" }));
  expect(
    screen.getByRole("heading", {
      name: 'Fixing group "Gated" of Week 12 in this save',
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
      groupId: "group-1",
      text: "gate",
      fallback: "continue",
    },
  ]);
});

it("drops a group fix and tells the page when the admin stops fixing it", () => {
  stopped = [];
  const router = createMemoryRouter([{ path: "/", element: <Harness /> }]);
  render(<RouterProvider router={router} />);
  fireEvent.click(screen.getByRole("button", { name: "Fix it in this save" }));
  fireEvent.click(screen.getByRole("button", { name: "Stop fixing it" }));
  expect(latest).toEqual([]);
  expect(stopped).toEqual(["split:7:group-1"]);
  expect(
    screen.getByRole("button", { name: "Fix it in this save" }),
  ).toBeTruthy();
});
