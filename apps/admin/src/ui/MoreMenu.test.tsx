import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "bun:test";
import { MoreMenu } from "./MoreMenu";

afterEach(cleanup);

const open = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));

describe("MoreMenu", () => {
  it("names its row, runs an item, and shows a disabled item's reason", async () => {
    const suspend = jest.fn();
    const remove = jest.fn();
    render(
      <MoreMenu
        subject="Sam Lee"
        items={[
          {
            label: "Suspend contract…",
            onSelect: suspend,
            disabledReason: "No active contract",
          },
          { label: "Delete account…", onSelect: remove, destructive: true },
        ]}
      />,
    );
    open("More: Sam Lee");
    const disabled = await screen.findByRole("menuitem", {
      name: /Suspend contract/,
    });
    expect(disabled.textContent).toContain("No active contract");
    expect(disabled.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(disabled);
    expect(suspend).not.toHaveBeenCalled();
    expect(screen.getByRole("separator")).toBeDefined();
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete account…" }));
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("doesn't open while an item's write runs", () => {
    render(
      <MoreMenu busy items={[{ label: "Archive", onSelect: jest.fn() }]} />,
    );
    const trigger = screen.getByRole("button", { name: "More" });
    expect(trigger.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(trigger);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
