import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import InlineTextInput from "./InlineTextInput";

afterEach(cleanup);

const renderInput = () => {
  const onSave = jest.fn();
  render(
    <InlineTextInput
      aria-label="Name"
      className=""
      value="Acme"
      onSave={onSave}
    />,
  );
  return { onSave, input: screen.getByLabelText("Name") };
};

it("saves the trimmed value once on Enter", () => {
  const { onSave, input } = renderInput();
  input.focus();
  fireEvent.change(input, { target: { value: " Acme Co " } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(onSave).toHaveBeenCalledWith("Acme Co", expect.any(Function));
});

it("discards the draft on Escape", () => {
  const { onSave, input } = renderInput();
  fireEvent.change(input, { target: { value: "Other" } });
  fireEvent.keyDown(input, { key: "Escape" });
  fireEvent.blur(input);
  expect(onSave).not.toHaveBeenCalled();
  expect(input).toHaveProperty("value", "Acme");
});
