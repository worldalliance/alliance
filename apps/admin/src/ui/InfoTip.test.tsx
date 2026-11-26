import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";
import { InfoTip } from "./InfoTip";

afterEach(cleanup);

describe("InfoTip", () => {
  it("is a named button described by its text, so the fact is read without the tooltip", () => {
    render(<InfoTip label="About When">Times are Pacific.</InfoTip>);
    const button = screen.getByRole("button", { name: "About When" });
    expect(button.tabIndex).toBe(0);
    const description = document.getElementById(
      button.getAttribute("aria-describedby") ?? "",
    );
    expect(description?.textContent).toBe("Times are Pacific.");
  });

  it("shows its text on keyboard focus", async () => {
    render(<InfoTip label="About When">Times are Pacific.</InfoTip>);
    expect(screen.getAllByText("Times are Pacific.")).toHaveLength(1);
    await act(async () => {
      screen.getByRole("button", { name: "About When" }).focus();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.getAllByText("Times are Pacific.")).toHaveLength(2);
  });

  it("stays open while the pointer moves from the button onto its text", async () => {
    render(<InfoTip label="About When">Times are Pacific.</InfoTip>);
    const button = screen.getByRole("button", { name: "About When" });
    const settle = () =>
      act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    fireEvent.mouseEnter(button);
    fireEvent.mouseMove(button);
    await settle();
    const popup = screen.getAllByText("Times are Pacific.")[1];
    expect(popup).toBeDefined();
    fireEvent.mouseLeave(button, { relatedTarget: popup });
    fireEvent.pointerEnter(popup, { pointerType: "mouse" });
    fireEvent.mouseEnter(popup);
    await settle();
    expect(screen.getAllByText("Times are Pacific.")).toHaveLength(2);
  });
});
