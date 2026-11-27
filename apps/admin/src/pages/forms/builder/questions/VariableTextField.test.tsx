import type { FormVariable } from "@alliance/common/forms/variables";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Field } from "../../../../ui/templates/Form";
import { FormVariablesProvider } from "../formulas/FormVariablesContext";
import { VariableTextField } from "./VariableTextField";

const total: FormVariable = {
  name: "total",
  inputs: { input1: { kind: "field", fieldId: "qty" } },
  formula: "input1 * 2",
};

const renderField = (initial: string) => {
  const onChange = jest.fn();

  function Harness() {
    const [value, setValue] = useState(initial);
    return (
      <FormVariablesProvider variables={[total]}>
        <VariableTextField
          value={value}
          onChange={(next) => {
            onChange(next);
            setValue(next);
          }}
          aria-label="Header text"
        />
      </FormVariablesProvider>
    );
  }

  render(<Harness />);
  const input = screen.getByLabelText<HTMLInputElement>("Header text");
  return {
    onChange,
    input,
    type: (value: string) => fireEvent.change(input, { target: { value } }),
    openPicker: () =>
      fireEvent.click(screen.getByLabelText("Insert a formula")),
    pickTotal: () => fireEvent.click(screen.getByRole("option")),
  };
};

describe("VariableTextField picker", () => {
  // Browsers report selectionStart 0 for an input that was never focused, so
  // opening the picker has to establish a caret rather than trust the 0 and
  // insert before the existing text. happy-dom reports value.length instead,
  // which is why this asserts the focusing itself and not just the result.
  it("focuses a field the user has not touched, at the end of its text", () => {
    const { onChange, input, openPicker, pickTotal } =
      renderField("Total so far");
    expect(document.activeElement).not.toBe(input);

    openPicker();

    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe("Total so far".length);

    pickTotal();
    expect(onChange).toHaveBeenCalledWith("Total so far#{total}");
  });

  it("inserts at the caret when the field already has one", () => {
    const { onChange, input, openPicker, pickTotal } = renderField("ab cd");
    input.focus();
    input.setSelectionRange(3, 3);

    openPicker();
    pickTotal();

    expect(onChange).toHaveBeenCalledWith("ab #{total}cd");
  });

  it("replaces the reference being typed rather than nesting it", () => {
    const { onChange, input, type, pickTotal } = renderField("Saved ");
    input.focus();
    type("Saved #{tot");

    pickTotal();

    expect(onChange).toHaveBeenLastCalledWith("Saved #{total}");
  });
});

it.each([false, true])(
  "takes its accessible description from aria-describedby, multiline=%p",
  (multiline) => {
    render(
      <FormVariablesProvider variables={[]}>
        <VariableTextField
          value=""
          onChange={() => {}}
          multiline={multiline}
          aria-describedby="hint"
        />
        <p id="hint">Some hint</p>
      </FormVariablesProvider>,
    );
    expect(
      screen.getByRole("textbox", { description: "Some hint" }),
    ).toBeTruthy();
  },
);

describe("VariableTextField in a Field", () => {
  it("takes the Field's label and marks itself invalid with its error", () => {
    render(
      <FormVariablesProvider variables={[total]}>
        <Field label="Header" error="Add a header.">
          {(control) => (
            <VariableTextField {...control} value="" onChange={() => {}} />
          )}
        </Field>
      </FormVariablesProvider>,
    );
    const input = screen.getByLabelText("Header");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("textbox", { description: "Add a header." })).toBe(
      input,
    );
  });
});
