import { cleanup, render, screen } from "@testing-library/react";
import Button from "./Button";

afterEach(cleanup);

it("forwards aria attributes to the button", () => {
  render(
    <Button onClick={() => {}} aria-pressed aria-label="Bold">
      B
    </Button>,
  );

  expect(
    screen.getByRole("button", { name: "Bold", pressed: true }),
  ).toBeTruthy();
});

it("forwards aria attributes to the div", () => {
  render(
    <Button asDiv onClick={() => {}} aria-label="Bold">
      B
    </Button>,
  );

  expect(screen.getByLabelText("Bold").tagName).toBe("DIV");
});
