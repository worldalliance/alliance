import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import PrerequisitePicker from "./PrerequisitePicker";

afterEach(cleanup);

const availableActions = [
  { id: 1, name: "Call your rep" },
  { id: 2, name: "Sign the letter" },
  { id: 3, name: "Share the post" },
];

const renderPicker = () => {
  const onChange = jest.fn();
  render(
    <PrerequisitePicker
      value={[2]}
      onChange={onChange}
      availableActions={availableActions}
      actionId={1}
    />,
  );
  return onChange;
};

describe("PrerequisitePicker", () => {
  it("offers only actions other than itself and those already picked", () => {
    renderPicker();

    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Add prerequisite...", "Share the post"]);
  });

  it("adds a picked action", () => {
    const onChange = renderPicker();

    fireEvent.change(
      screen.getByRole("combobox", { name: "Add prerequisite" }),
      { target: { value: "3" } },
    );

    expect(onChange).toHaveBeenCalledWith([2, 3]);
  });

  it("removes a prerequisite", () => {
    const onChange = renderPicker();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove prerequisite Sign the letter",
      }),
    );

    expect(onChange).toHaveBeenCalledWith([]);
  });
});
