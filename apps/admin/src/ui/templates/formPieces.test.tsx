import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "bun:test";
import { useState } from "react";
import { FormSection, RadioGroupField } from "./Form";
import { PaneHeader } from "./Workspace";

afterEach(cleanup);

function Harness({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState<string | null>("left");
  return (
    <RadioGroupField
      label="Checkbox position"
      help="Where the box sits."
      choices={[
        { value: "left", label: "Left", help: "Before the label." },
        { value: "right", label: "Right" },
      ]}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe("RadioGroupField", () => {
  it("is one named group of radios, with help tied to the group and each choice", () => {
    render(<Harness />);
    const group = screen.getByRole("group", { name: "Checkbox position" });
    expect(group.getAttribute("aria-describedby")).toBeTruthy();
    const left = screen.getByRole("radio", { name: "Left" });
    expect(left.getAttribute("aria-describedby")).toBeTruthy();
    expect((left as HTMLInputElement).checked).toBe(true);
    const right = screen.getByRole("radio", { name: "Right" });
    expect((right as HTMLInputElement).name).toBe(
      (left as HTMLInputElement).name,
    );
  });

  it("reports the picked value and shows it checked", () => {
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Right" }));
    expect(onChange).toHaveBeenCalledWith("right");
    expect(
      (screen.getByRole("radio", { name: "Right" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
  });
});

describe("FormSection actions", () => {
  it("puts the actions in the heading row", () => {
    render(
      <FormSection title="View" actions={<button type="button">Delete</button>}>
        body
      </FormSection>,
    );
    const section = screen.getByRole("region", { name: "View" });
    expect(section.querySelector("h2")?.parentElement?.nextElementSibling).toBe(
      screen.getByRole("button", { name: "Delete" }).parentElement,
    );
  });
});

describe("PaneHeader action", () => {
  it("lays several controls in one row", () => {
    render(
      <PaneHeader
        title="Formulas"
        action={
          <>
            <button type="button">Add formula</button>
            <button type="button">Import</button>
          </>
        }
      />,
    );
    const row = screen.getByRole("button", {
      name: "Add formula",
    }).parentElement;
    expect(row?.className).toContain("flex");
    expect(row?.contains(screen.getByRole("button", { name: "Import" }))).toBe(
      true,
    );
  });
});
