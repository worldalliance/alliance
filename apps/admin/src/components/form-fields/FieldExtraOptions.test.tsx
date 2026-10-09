import type {
  AnyField,
  CheckboxField,
  PhoneField,
} from "@alliance/common/forms/form-schema";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, mock } from "bun:test";
import { FieldExtraOptions } from "./FieldExtraOptions";

afterEach(cleanup);

const phone: PhoneField = {
  id: "p",
  type: "input",
  kind: "phone",
  label: "Phone",
};
const checkbox: CheckboxField = {
  id: "c",
  type: "input",
  kind: "checkbox",
  label: "Checkbox",
};

const renderOptions = (field: AnyField) => {
  const handlers = {
    onCustomValidatorToggle: mock(),
    onExtractionToggle: mock(),
    onCheckboxExtractionTargetChange: mock(),
  };
  render(
    <FieldExtraOptions
      field={field}
      showCustomValidatorControl={false}
      {...handlers}
    />,
  );
  return handlers;
};

describe("FieldExtraOptions", () => {
  it("reports toggles to its handlers", () => {
    const handlers = renderOptions(phone);
    fireEvent.click(screen.getByLabelText("Use custom validator"));
    fireEvent.click(screen.getByLabelText("Extract response into user data"));
    expect(handlers.onCustomValidatorToggle).toHaveBeenCalledWith(true);
    expect(handlers.onExtractionToggle).toHaveBeenCalledWith(true);
  });

  it("offers an extraction target for checkbox fields", () => {
    const handlers = renderOptions(checkbox);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "shareInfoPublicly" },
    });
    expect(handlers.onCheckboxExtractionTargetChange).toHaveBeenCalledWith(
      "shareInfoPublicly",
    );
  });
});
