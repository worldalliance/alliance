import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";
import { useState } from "react";
import { type ComboboxOption, MultiCombobox } from "./Combobox";
import { Field } from "./templates/Form";

afterEach(cleanup);

const suites: ComboboxOption<number>[] = [
  { value: 1, label: "Climate" },
  { value: 2, label: "Housing" },
  { value: 3, label: "Transit" },
];

function SuitesField({ initial = [] }: { initial?: number[] }) {
  const [values, setValues] = useState(initial);
  return (
    <>
      <Field label="Suites">
        {(control) => (
          <MultiCombobox
            {...control}
            options={suites}
            values={values}
            onChange={setValues}
          />
        )}
      </Field>
      <output>{values.join(",")}</output>
    </>
  );
}

const input = () => screen.getByRole("combobox", { name: "Suites" });
const values = () => document.querySelector("output")?.textContent;

describe("MultiCombobox", () => {
  it("adds each picked option as a chip", async () => {
    render(<SuitesField />);
    const box = input();
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.input(box, { target: { value: "hous" } });
    await waitFor(() => expect(screen.getAllByRole("option").length).toBe(1));
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(values()).toBe("2"));
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.input(box, { target: { value: "tran" } });
    await waitFor(() => expect(screen.getAllByRole("option").length).toBe(1));
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(values()).toBe("2,3"));
    expect(
      screen.getByRole("button", { name: "Remove: Housing" }),
    ).toBeDefined();
  });

  it("removes a chip by its button and keeps focus in the control", async () => {
    render(<SuitesField initial={[1, 2]} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove: Climate" }));
    await waitFor(() => expect(values()).toBe("2"));
    expect(document.activeElement).toBe(input());
  });

  it("removes the last chip on Backspace in the empty input", async () => {
    render(<SuitesField initial={[1, 2]} />);
    const box = input();
    box.focus();
    fireEvent.keyDown(box, { key: "Backspace" });
    await waitFor(() => expect(values()).toBe("1"));
    expect(document.activeElement).toBe(box);
  });

  it("keeps its picks on Escape with the list closed", async () => {
    render(<SuitesField initial={[1, 2]} />);
    const box = input();
    box.focus();
    fireEvent.keyDown(box, { key: "Escape" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(values()).toBe("1,2");
  });

  it("names a picked value missing from the options by its value", () => {
    render(<SuitesField initial={[9]} />);
    expect(screen.getByRole("button", { name: "Remove: 9" })).toBeDefined();
  });
});
