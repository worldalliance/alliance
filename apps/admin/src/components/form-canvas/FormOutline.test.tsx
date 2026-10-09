import { cleanup, render, screen } from "@testing-library/react";
import { nestedSchema } from "../../lib/testing/nestedForm";
import { CanvasTargetKind, ChildKind } from "./canvasSelection";
import { FormOutline } from "./FormOutline";

afterEach(cleanup);

it("shows a child selected before it mounts", () => {
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
      selectionKey="age"
      onSelect={() => {}}
      onAddPage={() => {}}
      onMovePage={() => {}}
      onMoveElement={() => {}}
    />,
  );
  expect(
    screen
      .getByRole("button", { name: "Number Field: Age" })
      .getAttribute("aria-current"),
  ).toBe("true");
});
