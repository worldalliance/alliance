import type { HeaderBlock } from "@alliance/common/forms/display-blocks";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { render, screen } from "@testing-library/react";
import { EditorSidebar } from "../../../../lib/testing/EditorSidebar";
import { ToastProvider } from "../../../../ui/ToastProvider";
import { EditableHeaderBlock } from "./EditableHeaderBlock";

const HINT =
  "Write headers in the active voice: “Select a date”, not “Date selection”.";

const block: HeaderBlock = {
  type: "display",
  kind: "header",
  id: "h",
  text: "",
};

const editor = (
  <EditableHeaderBlock block={block} onUpdate={() => {}} onRemove={() => {}} />
);

it("tells the author in the sidebar to write the header in the active voice", () => {
  render(
    <ToastProvider>
      <EditorSidebar>{editor}</EditorSidebar>
    </ToastProvider>,
    queryWrapper(),
  );
  expect(screen.getByRole("textbox", { description: HINT })).toBeTruthy();
});
