import { CreateEditableContentDto } from "@alliance/shared/client";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import EditableContentForm from "./EditableContentForm";

afterEach(cleanup);

const value: CreateEditableContentDto = {
  body: "a draft worth keeping",
  attachments: [],
};

const dragImageIn = (container: HTMLElement) => {
  const dropZone = container.firstElementChild;
  if (!dropZone) throw new Error("drop zone not found");
  fireEvent.dragEnter(dropZone);
};

describe("EditableContentForm", () => {
  it("invites a drop while the draft is editable", () => {
    const { container } = render(
      <EditableContentForm value={value} onChange={() => {}} />,
    );

    dragImageIn(container);

    expect(screen.queryByText("Drop images to attach")).not.toBeNull();
  });

  it("stops inviting a drop it would discard once frozen", () => {
    const { container } = render(
      <EditableContentForm value={value} onChange={() => {}} disabled />,
    );

    dragImageIn(container);

    expect(screen.queryByText("Drop images to attach")).toBeNull();
  });
});
