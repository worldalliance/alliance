import { type AnyField } from "@alliance/common/forms/form-schema";
import { outputFieldPublicToggle } from "@alliance/shared/lib/copy";
import { fireEvent, render, screen } from "@testing-library/react";
import OutputPublicToggle from "./OutputPublicToggle";

const field = (output?: AnyField["output"]): AnyField => ({
  id: "answer",
  type: "input",
  kind: "text",
  label: "Answer",
  output,
});

const renderToggle = (
  fieldDef: AnyField,
  sharePublicly: boolean,
  { disabled = false } = {},
) => {
  const onChange = jest.fn();
  const { container } = render(
    <OutputPublicToggle
      field={fieldDef}
      sharePublicly={sharePublicly}
      disabled={disabled}
      onChange={onChange}
    />,
  );
  return { onChange, container };
};

it("renders nothing for a field that isn't an output", () => {
  const { container } = renderToggle(field(), true);

  expect(container.innerHTML).toBe("");
});

it("hides a public-by-default response when checked", () => {
  const { onChange } = renderToggle(field({ output: true }), true);
  const checkbox = screen.getByRole("checkbox", {
    name: outputFieldPublicToggle.hidePublicly,
  });

  expect(checkbox).toHaveProperty("checked", false);
  fireEvent.click(checkbox);

  expect(onChange).toHaveBeenCalledWith(false);
});

it("shows a private-by-default response when checked", () => {
  const { onChange } = renderToggle(
    field({ output: true, privateByDefault: true }),
    false,
  );
  const checkbox = screen.getByRole("checkbox", {
    name: outputFieldPublicToggle.showPublicly,
  });

  expect(checkbox).toHaveProperty("checked", false);
  fireEvent.click(checkbox);

  expect(onChange).toHaveBeenCalledWith(true);
});

it("locks the checkbox on a completed form", () => {
  renderToggle(field({ output: true }), true, { disabled: true });

  expect(
    screen.getByRole("checkbox", {
      name: outputFieldPublicToggle.hidePublicly,
    }),
  ).toHaveProperty("disabled", true);
});
