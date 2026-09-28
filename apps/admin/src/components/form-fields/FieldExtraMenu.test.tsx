import type {
  AnyField,
  CheckboxField,
  PhoneField,
} from "@alliance/common/forms/form-schema";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, mock } from "bun:test";
import { FieldExtraMenu } from "./FieldExtraMenu";

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

const renderMenu = (field: AnyField) => {
  const handlers = {
    onCustomValidatorToggle: mock(),
    onConditionalVisibilityToggle: mock(),
    onExtractionToggle: mock(),
    onCheckboxExtractionTargetChange: mock(),
  };
  render(
    <FieldExtraMenu
      field={field}
      showCustomValidatorControl={false}
      showConditionalVisibilityControl={false}
      {...handlers}
    />,
  );
  return handlers;
};

const openMenu = () =>
  fireEvent.click(screen.getByRole("button", { name: "Extra form options" }));

describe("FieldExtraMenu", () => {
  it("closes on Escape and on a click outside", () => {
    renderMenu(phone);
    openMenu();
    expect(screen.getByLabelText("Use custom validator")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByLabelText("Use custom validator")).toBeNull();

    openMenu();
    fireEvent.mouseDown(screen.getByLabelText("Use custom validator"));
    expect(screen.getByLabelText("Use custom validator")).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByLabelText("Use custom validator")).toBeNull();
  });

  it("reports toggles to its handlers", () => {
    const handlers = renderMenu(phone);
    openMenu();
    fireEvent.click(screen.getByLabelText("Use custom validator"));
    fireEvent.click(screen.getByLabelText("Use conditional visibility"));
    fireEvent.click(screen.getByLabelText("Extract response into user data"));
    expect(handlers.onCustomValidatorToggle).toHaveBeenCalledWith(true);
    expect(handlers.onConditionalVisibilityToggle).toHaveBeenCalledWith(true);
    expect(handlers.onExtractionToggle).toHaveBeenCalledWith(true);
  });

  it("offers an extraction target for checkbox fields", () => {
    const handlers = renderMenu(checkbox);
    openMenu();
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "shareInfoPublicly" },
    });
    expect(handlers.onCheckboxExtractionTargetChange).toHaveBeenCalledWith(
      "shareInfoPublicly",
    );
  });
});
