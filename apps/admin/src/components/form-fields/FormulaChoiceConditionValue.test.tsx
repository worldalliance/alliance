import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  ANY_SELECTED_VALUE,
  FormulaChoiceConditionValue,
} from "./FormulaChoiceConditionValue";

afterEach(cleanup);

it("takes a typed value for a formula select, and asks for one while empty", () => {
  const onChange = jest.fn();
  render(
    <FormulaChoiceConditionValue
      multiselect={false}
      value=""
      onChange={onChange}
    />,
  );

  expect(
    screen.getByText("Type the value of the choice to match."),
  ).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox", { name: "Choice value" }), {
    target: { value: "red" },
  });
  expect(onChange).toHaveBeenCalledWith("red");
});

it("switches a formula multiselect between any option and a typed value", () => {
  const onChange = jest.fn();
  const { rerender } = render(
    <FormulaChoiceConditionValue
      multiselect
      value={ANY_SELECTED_VALUE}
      onChange={onChange}
    />,
  );

  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.change(screen.getByRole("combobox", { name: "Match" }), {
    target: { value: "" },
  });
  expect(onChange).toHaveBeenCalledWith("");

  rerender(
    <FormulaChoiceConditionValue multiselect value="red" onChange={onChange} />,
  );
  expect(
    screen.getByRole<HTMLInputElement>("textbox", { name: "Choice value" })
      .value,
  ).toBe("red");
});
