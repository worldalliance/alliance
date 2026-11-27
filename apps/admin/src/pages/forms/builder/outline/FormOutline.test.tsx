import { PlaceKind } from "@alliance/common/forms/form-conditions";
import type { Page } from "@alliance/common/forms/form-schema";
import { fireEvent, render, screen } from "@testing-library/react";
import { indexIssues, IssueTargetKind } from "../../../../lib/formIssues";
import { nestedSchema } from "../../../../lib/testing/nestedForm";
import { deriveVisibilityGroups } from "../../../../lib/visibilityGroups";
import { CanvasTargetKind, ChildKind } from "../selection/canvasSelection";
import { FormOutline } from "./FormOutline";

it("marks the closed list holding a selected child, without opening it", () => {
  render(
    <FormOutline
      pages={nestedSchema.pages}
      groups={new Map()}
      displayOnly={false}
      pageIndex={0}
      selected={{
        kind: CanvasTargetKind.Element,
        index: 0,
        child: { kind: ChildKind.SubField, index: 1 },
      }}
      onSelect={() => {}}
      onExtend={null}
      onCheck={null}
      issues={indexIssues([])}
      onMovePage={() => {}}
      onMoveElements={() => {}}
    />,
  );
  expect(screen.queryByRole("treeitem", { name: "Number Field: Age" })).toBe(
    null,
  );
  const list = screen.getByRole("treeitem", { name: /^List Field/ });
  expect(list.getAttribute("aria-current")).toBe("true");
  expect(list.getAttribute("aria-description")).toBe("Contains the selection");
});

it("counts a collapsed group's member issues on its row", () => {
  const shown = {
    conditions: { c1: { kind: "hasValue", when: "q", hasValue: true } },
    formula: "c1",
  } as const;
  const pages: Page[] = [
    {
      id: "p1",
      fields: [
        { id: "q", type: "input", kind: "text", label: "Q" },
        {
          id: "a",
          type: "input",
          kind: "text",
          label: "A",
          visibleIfFormula: shown,
        },
        {
          id: "b",
          type: "input",
          kind: "text",
          label: "B",
          visibleIfFormula: shown,
        },
      ],
    },
  ];
  render(
    <FormOutline
      pages={pages}
      groups={deriveVisibilityGroups(pages)}
      displayOnly={false}
      pageIndex={0}
      selected={{ kind: CanvasTargetKind.Page }}
      onSelect={() => {}}
      onExtend={null}
      onCheck={null}
      issues={indexIssues([
        {
          target: {
            kind: IssueTargetKind.Place,
            place: { kind: PlaceKind.Element, pageIndex: 0, index: 2 },
          },
          message: "broken",
          inConditions: false,
        },
      ])}
      onMovePage={() => {}}
      onMoveElements={() => {}}
    />,
  );
  fireEvent.click(
    screen
      .getByRole("treeitem", { name: /^Shared visibility/ })
      .querySelector("[data-toggle]")!,
  );
  expect(screen.queryByText("Text Field: B")).toBeNull();
  expect(
    screen
      .getByText(/^Shared visibility/)
      .closest('[role="treeitem"]')
      ?.querySelector('[aria-label="1 issue"]'),
  ).toBeTruthy();
});
