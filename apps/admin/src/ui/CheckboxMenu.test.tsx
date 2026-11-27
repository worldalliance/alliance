import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "bun:test";
import { CheckboxMenu } from "./CheckboxMenu";

afterEach(cleanup);

const items = [
  { value: "a", label: "Alpha", description: "First", checked: true },
  { value: "b", label: "Beta", checked: false },
  { value: "c", label: "Gamma", checked: false, pending: true },
];

const renderMenu = (onToggle = jest.fn()) => {
  render(
    <CheckboxMenu
      label="Edit tags"
      ariaLabel="Edit tags: Sam Lee"
      title="Tags of Sam Lee"
      items={items}
      onToggle={onToggle}
      emptyText="No tags yet."
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit tags: Sam Lee" }));
  return onToggle;
};

describe("CheckboxMenu", () => {
  it("shows checked state and reports the new one, leaving the menu open", async () => {
    const onToggle = renderMenu();
    const alpha = await screen.findByRole("menuitemcheckbox", {
      name: /Alpha/,
    });
    expect(alpha.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: /Beta/ }));
    expect(onToggle).toHaveBeenCalledWith("b", true);
    fireEvent.click(alpha);
    expect(onToggle).toHaveBeenLastCalledWith("a", false);
    expect(screen.getByRole("menu")).toBeDefined();
  });

  it("won't toggle a pending item", async () => {
    const onToggle = renderMenu();
    const gamma = await screen.findByRole("menuitemcheckbox", {
      name: /Gamma/,
    });
    expect(gamma.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(gamma);
    expect(onToggle).not.toHaveBeenCalled();
  });
});
