import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "bun:test";
import { ToastProvider } from "../../../../ui/ToastProvider";
import { EditorSize, ExpandableEditor } from "./ExpandableEditor";
import { InspectorGroup } from "./InspectorGroup";
import { AddItemButton, ItemList, ItemRow } from "./ItemList";
import { ReadOnlyId } from "./ReadOnlyId";

afterEach(cleanup);

describe("ItemRow", () => {
  it("moves and removes its row from a menu named for it, the edge move disabled with its reason", async () => {
    const moveDown = jest.fn();
    const remove = jest.fn();
    render(
      <ItemList label="Options">
        <ItemRow
          name="Option Yes"
          onMoveUp={null}
          onMoveDown={moveDown}
          onRemove={remove}
          removeLabel="Remove option"
        >
          <span>Yes</span>
        </ItemRow>
      </ItemList>,
    );
    expect(screen.getByRole("list", { name: "Options" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "More: Option Yes" }));
    const up = await screen.findByRole("menuitem", { name: /Move up/ });
    expect(up.getAttribute("aria-disabled")).toBe("true");
    expect(up.textContent).toContain("It's the first.");
    fireEvent.click(screen.getByRole("menuitem", { name: "Move down" }));
    expect(moveDown).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "More: Option Yes" }));
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Remove option" }),
    );
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("offers no menu when the row has no actions", () => {
    render(
      <ItemList label="Rows">
        <ItemRow name="Row">
          <span>Row</span>
        </ItemRow>
      </ItemList>,
    );
    expect(screen.queryByRole("button", { name: "More: Row" })).toBeNull();
  });
});

describe("AddItemButton", () => {
  it("is a button in words", () => {
    const add = jest.fn();
    render(<AddItemButton onClick={add}>Add option</AddItemButton>);
    fireEvent.click(screen.getByRole("button", { name: "Add option" }));
    expect(add).toHaveBeenCalledTimes(1);
  });
});

describe("InspectorGroup", () => {
  it("names a titled group by its heading", () => {
    render(
      <InspectorGroup title="Options">
        <span>Yes</span>
      </InspectorGroup>,
    );
    expect(screen.getByRole("group", { name: "Options" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Options" })).toBeDefined();
  });
});

describe("ExpandableEditor", () => {
  it("opens the same control at full size in a sheet", async () => {
    render(
      <ExpandableEditor
        title="Edit HTML"
        render={(size) => <span>{`control ${size}`}</span>}
        preview={() => <span>preview</span>}
      />,
    );
    expect(screen.getByText(`control ${EditorSize.Inspector}`)).toBeDefined();
    expect(screen.queryByText("preview")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Open larger editor: Edit HTML" }),
    );
    const sheet = await screen.findByRole("dialog");
    expect(sheet.textContent).toContain(`control ${EditorSize.Sheet}`);
    expect(sheet.textContent).toContain("preview");
  });
});

describe("ReadOnlyId", () => {
  it("shows the id read-only with a Copy button", () => {
    render(
      <ToastProvider>
        <ReadOnlyId label="Element ID" value="q-1" />
      </ToastProvider>,
    );
    const input = screen.getByRole("textbox", { name: "Element ID" });
    expect(input.getAttribute("readonly")).not.toBeNull();
    expect(input).toHaveProperty("value", "q-1");
    expect(
      screen.getByRole("button", { name: "Copy element id" }),
    ).toBeDefined();
  });
});
