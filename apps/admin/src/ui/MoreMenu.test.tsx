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

  it("stays closed when a write starts and ends while it is open", async () => {
    const items = [{ label: "Archive", onSelect: jest.fn() }];
    const { rerender } = render(<MoreMenu items={items} />);
    open("More");
    await screen.findByRole("menu");
    rerender(<MoreMenu busy items={items} />);
    rerender(<MoreMenu items={items} />);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("puts destructive items last whatever order they come in", async () => {
    render(
      <MoreMenu
        items={[
          { label: "Edit", onSelect: jest.fn() },
          { label: "Delete", onSelect: jest.fn(), destructive: true },
          { label: "Duplicate", onSelect: jest.fn() },
        ]}
      />,
    );
    open("More");
    await screen.findByRole("menu");
    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(["Edit", "Duplicate", "Delete"]);
  });

  it("keeps a disabled item's reason out of its name", async () => {
    render(
      <MoreMenu
        items={[
          {
            label: "Move up",
            onSelect: jest.fn(),
            disabledReason: "It's at the top.",
          },
        ]}
      />,
    );
    open("More");
    const item = await screen.findByRole("menuitem", { name: "Move up" });
    expect(item.getAttribute("aria-describedby")).toBeTruthy();
    expect(
      document.getElementById(item.getAttribute("aria-describedby") ?? "")
        ?.textContent,
    ).toBe("It's at the top.");
  });

  it("heads adjacent items that share a group", async () => {
    render(
      <MoreMenu
        items={[
          { label: "Edit", onSelect: jest.fn() },
          { label: "Page 1", onSelect: jest.fn(), group: "Move to page" },
          { label: "Page 2", onSelect: jest.fn(), group: "Move to page" },
          { label: "Delete", onSelect: jest.fn(), destructive: true },
        ]}
      />,
    );
    open("More");
    const group = await screen.findByRole("group", { name: "Move to page" });
    expect(group.querySelectorAll("[role=menuitem]")).toHaveLength(2);
    expect(screen.getAllByText("Move to page")).toHaveLength(1);
  });

  it("is an icon-only button with the same name when compact", async () => {
    render(
      <MoreMenu
        compact
        subject="Town"
        items={[{ label: "Archive", onSelect: jest.fn() }]}
      />,
    );
    const trigger = screen.getByRole("button", { name: "More: Town" });
    expect(trigger.textContent).toBe("");
    fireEvent.click(trigger);
    expect(
      await screen.findByRole("menuitem", { name: "Archive" }),
    ).toBeDefined();
  });

  it("shows a decorative spinner, not a status, while busy", () => {
    render(
      <MoreMenu busy items={[{ label: "Archive", onSelect: jest.fn() }]} />,
    );
    expect(screen.queryByRole("status")).toBeNull();
  });
});
