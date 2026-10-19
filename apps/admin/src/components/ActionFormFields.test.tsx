import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ActionFieldDef } from "../lib/actionFieldDefs";
import { createActionForm } from "../lib/testing/createActionForm";
import ActionFormFields from "./ActionFormFields";

afterEach(cleanup);

const form = createActionForm({ image: "cover.png", optional: true });

const renderFields = (params: {
  fields: ActionFieldDef[];
  isNew?: boolean;
}) => {
  const onInputChange = jest.fn();
  render(
    <ActionFormFields
      fields={params.fields}
      form={form}
      onInputChange={onInputChange}
      onImageChange={jest.fn()}
      imagePreview={null}
      onCancelImageUpload={jest.fn()}
      isNew={params.isNew ?? false}
      baseUrl="https://api.example"
      onCategoryChange={jest.fn()}
    />,
  );
  return onInputChange;
};

describe("ActionFormFields", () => {
  it("lays out full-width fields, then grid fields, then checkboxes", () => {
    renderFields({
      fields: [
        {
          name: "optional",
          label: "Optional",
          type: "checkbox",
          section: "settings",
        },
        {
          name: "timeEstimate",
          label: "Time",
          type: "number",
          section: "settings",
          gridCol: true,
        },
        { name: "name", label: "Name", type: "text", section: "content" },
      ],
    });

    expect(
      Array.from(document.querySelectorAll("input")).map((input) => input.id),
    ).toEqual(["name", "timeEstimate", "optional"]);
    expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe(
      "Call your rep",
    );
    expect(screen.getByLabelText<HTMLInputElement>("Optional").checked).toBe(
      true,
    );
  });

  it("forwards edits to onInputChange", () => {
    const onInputChange = renderFields({
      fields: [
        { name: "name", label: "Name", type: "text", section: "content" },
      ],
    });

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Write your rep" },
    });

    expect(onInputChange).toHaveBeenCalledTimes(1);
  });

  it("shows the current cover image only when editing", () => {
    const fields: ActionFieldDef[] = [
      { name: "image", label: "Cover image", type: "file", section: "content" },
    ];

    renderFields({ fields });
    expect(screen.getByAltText<HTMLImageElement>("Current").src).toBe(
      "https://api.example/images/cover.png",
    );

    cleanup();
    renderFields({ fields, isNew: true });
    expect(screen.queryByAltText("Current")).toBeNull();
  });
});
