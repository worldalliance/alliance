import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "bun:test";
import { useState } from "react";
import Sheet from "./Sheet";

afterEach(cleanup);

function Page({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open row</button>
      <button>Other row</button>
      <Sheet
        open={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        title="Peek"
        modal={false}
      >
        <button>Inside</button>
      </Sheet>
    </>
  );
}

describe("a non-modal Sheet", () => {
  it("shows no scrim and leaves the page behind it usable", async () => {
    const onClose = jest.fn();
    render(<Page onClose={onClose} />);
    const opener = screen.getByRole("button", { name: "Open row" });
    opener.focus();
    fireEvent.click(opener);
    expect(await screen.findByText("Peek")).toBeTruthy();
    expect(document.querySelector(".bg-scrim")).toBeNull();

    const other = screen.getByRole("button", { name: "Other row" });
    fireEvent.pointerDown(other);
    fireEvent.click(other);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Peek")).toBeTruthy();
  });

  it("closes on Escape and returns focus to what opened it", async () => {
    const onClose = jest.fn();
    render(<Page onClose={onClose} />);
    const opener = screen.getByRole("button", { name: "Open row" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(opener);
  });
});
