import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import PrerequisitePicker from "./PrerequisitePicker";

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
    ).toEqual(["Add prerequisite…", "Share the post"]);
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
        name: "Remove prerequisite: Sign the letter",
      }),
    );

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("moves focus to the next chip, else the previous, else the add select", () => {
    function Harness() {
      const [value, setValue] = useState([2, 3]);
      return (
        <PrerequisitePicker
          value={value}
          onChange={setValue}
          availableActions={availableActions}
          actionId={1}
        />
      );
    }
    render(<Harness />);
    const remove = (name: string) =>
      screen.getByRole("button", { name: `Remove prerequisite: ${name}` });

    fireEvent.click(remove("Sign the letter"));
    expect(document.activeElement).toBe(remove("Share the post"));

    fireEvent.click(remove("Share the post"));
    expect(document.activeElement).toBe(
      screen.getByRole("combobox", { name: "Add prerequisite" }),
    );
  });

  it("disables adding while the actions load", () => {
    render(
      <PrerequisitePicker
        value={[]}
        onChange={jest.fn()}
        availableActions={[]}
        loading
      />,
    );

    const select = screen.getByRole("combobox", { name: "Add prerequisite" });
    expect(select).toHaveProperty("disabled", true);
    expect(select.textContent).toBe("Loading tasks…");
  });

  it("says tasks are loading instead of naming a saved one by its id", () => {
    render(
      <PrerequisitePicker
        value={[2]}
        onChange={jest.fn()}
        availableActions={[]}
        loading
      />,
    );

    expect(screen.getByRole("listitem").textContent).toBe("Loading…");
  });

  it("says the tasks failed to load", () => {
    render(
      <PrerequisitePicker
        value={[]}
        onChange={jest.fn()}
        availableActions={[]}
        loadFailed
      />,
    );

    expect(
      screen.getByRole("combobox", { name: "Add prerequisite" }).textContent,
    ).toBe("Couldn't load tasks");
  });
});
