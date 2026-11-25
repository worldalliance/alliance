import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, jest } from "bun:test";
import {
  actionItems,
  ElementActionsMenu,
  type ElementActions,
} from "./ElementActionsMenu";

const pageActions = (onlyPage: boolean): ElementActions => ({
  moveNoun: "page",
  onMoveUp: null,
  onMoveDown: jest.fn(),
  moveToPage: null,
  duplicateLabel: "Copy page",
  onDuplicate: jest.fn(),
  onAddBelow: null,
  editJsonLabel: "Edit page JSON…",
  onEditJson: jest.fn(),
  onShowInOutline: null,
  deleteLabel: "Delete page",
  onDelete: onlyPage ? null : jest.fn(),
  deleteDisabledReason: "A form needs at least one page",
});

describe("actionItems", () => {
  it("names a page's moves, and says why it can't move up or be deleted", () => {
    const items = actionItems(pageActions(true));
    expect(items.map(({ label }) => label)).toEqual([
      "Move page up",
      "Move page down",
      "Copy page",
      "Edit page JSON…",
      "Delete page",
    ]);
    expect(items[0]?.disabledReason).toBe("It's at the top.");
    expect(items.at(-1)).toMatchObject({
      destructive: true,
      disabledReason: "A form needs at least one page",
    });
  });

  it("lists each other page as a move", () => {
    const items = actionItems({
      ...pageActions(false),
      moveNoun: null,
      moveToPage: {
        pages: [{ index: 1, title: "Two" }],
        onMove: jest.fn(),
      },
    });
    expect(items.map(({ label }) => label)).toContain("Move to page 2: Two");
  });
});

describe("ElementActionsMenu", () => {
  it("opens the same actions as a context menu on what it wraps", () => {
    const actions = pageActions(false);
    render(
      <ElementActionsMenu label="Page 1" actions={actions} trigger="context">
        <button type="button">Page 1</button>
      </ElementActionsMenu>,
    );
    fireEvent.contextMenu(screen.getByRole("button", { name: "Page 1" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Copy page" }));
    expect(actions.onDuplicate).toHaveBeenCalledTimes(1);
  });

  it("opens from a More button named for the selection", () => {
    const actions = pageActions(false);
    render(<ElementActionsMenu label="Page 1" actions={actions} />);
    fireEvent.click(screen.getByRole("button", { name: "More: Page 1" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete page" }));
    expect(actions.onDelete).toHaveBeenCalledTimes(1);
  });
});
