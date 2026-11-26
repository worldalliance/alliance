import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "bun:test";
import { ContextMenu } from "./ContextMenu";

afterEach(cleanup);

describe("ContextMenu", () => {
  it("opens the items on a context click and runs one", async () => {
    const run = jest.fn();
    render(
      <ContextMenu label="Town" items={[{ label: "Duplicate", onSelect: run }]}>
        <div>Row</div>
      </ContextMenu>,
    );
    fireEvent.contextMenu(screen.getByText("Row"));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Duplicate" }));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("stays closed while busy", () => {
    render(
      <ContextMenu
        busy
        label="Town"
        items={[{ label: "Duplicate", onSelect: jest.fn() }]}
      >
        <div>Row</div>
      </ContextMenu>,
    );
    fireEvent.contextMenu(screen.getByText("Row"));
    expect(screen.queryByRole("menuitem")).toBeNull();
  });
});
