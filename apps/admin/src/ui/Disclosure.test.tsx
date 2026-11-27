import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "bun:test";
import { Disclosure } from "./Disclosure";

afterEach(cleanup);

it("hides its content until the summary is pressed", () => {
  render(<Disclosure summary="Visibility profiles">Profile list</Disclosure>);
  const details = screen.getByText("Profile list").closest("details");
  expect(details?.open).toBe(false);
  fireEvent.click(screen.getByText("Visibility profiles"));
  expect(details?.open).toBe(true);
});

it("starts open with defaultOpen", () => {
  render(
    <Disclosure summary="Visibility profiles" defaultOpen>
      Profile list
    </Disclosure>,
  );
  expect(screen.getByText("Profile list").closest("details")?.open).toBe(true);
});
