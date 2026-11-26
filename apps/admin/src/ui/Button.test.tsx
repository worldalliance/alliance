import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";
import Button, { ButtonVariant, buttonVariants } from "./Button";

afterEach(cleanup);

describe("Button", () => {
  it("lays out as a block sized to its content", () => {
    render(<Button onClick={() => {}}>Save</Button>);
    const classes = screen.getByRole("button").classList;
    expect(classes.contains("flex")).toBe(true);
    expect(classes.contains("inline-flex")).toBe(false);
    expect(classes.contains("w-fit")).toBe(true);
  });

  it("is a square, not a fitted width, at the icon size", () => {
    render(
      <Button size="icon" aria-label="Undo" onClick={() => {}}>
        ↶
      </Button>,
    );
    const classes = screen.getByRole("button", { name: "Undo" }).classList;
    expect(classes.contains("size-control-sm")).toBe(true);
    expect(classes.contains("w-fit")).toBe(false);
  });

  it("gives its classes to another element as an inline flex box", () => {
    expect(
      buttonVariants({ variant: ButtonVariant.Default, size: "small" }).split(
        " ",
      ),
    ).toContain("inline-flex");
  });
});
