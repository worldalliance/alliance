import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "bun:test";
import { TimelineWeeks } from "./TimelineWeeks";

const week = (day: number) => new Date(Date.UTC(2026, 10, day, 8));
const ticks = [3, 10, 17, 24].map((day, index) => ({
  date: week(day),
  left: index * 112,
}));

const weeks = (shown = ticks) => (
  <TimelineWeeks
    ticks={shown}
    x={(time) => new Date(time).getTime() / 1e7}
    now={new Date(Date.UTC(2026, 10, 19))}
    onJump={() => {}}
    onNow={() => {}}
  />
);

const renderWeeks = () => render(weeks());

const weekButtons = () =>
  screen.getAllByRole("button", { name: /^Jump to the first task/ });

describe("TimelineWeeks", () => {
  it("is one tab stop, at the week holding now", () => {
    renderWeeks();
    expect(weekButtons().map((button) => button.tabIndex)).toEqual([
      -1, -1, 0, -1,
    ]);
    const toolbar = screen.getByRole("toolbar", { name: "Weeks" });
    expect(
      within(toolbar)
        .getAllByRole("button")
        .filter((button) => button.tabIndex === 0),
    ).toHaveLength(1);
  });

  it("moves between weeks with the arrows, Home and End", () => {
    renderWeeks();
    const buttons = weekButtons();
    buttons[2].focus();
    fireEvent.keyDown(buttons[2], { key: "ArrowRight" });
    expect(document.activeElement).toBe(buttons[3]);
    fireEvent.keyDown(buttons[3], { key: "ArrowRight" });
    expect(document.activeElement).toBe(buttons[3]);
    fireEvent.keyDown(buttons[3], { key: "Home" });
    expect(document.activeElement).toBe(buttons[0]);
    expect(weekButtons().map((button) => button.tabIndex)).toEqual([
      0, -1, -1, -1,
    ]);
  });

  it("leaves modified arrows to the browser", () => {
    renderWeeks();
    const buttons = weekButtons();
    buttons[2].focus();
    expect(
      fireEvent.keyDown(buttons[2], { key: "ArrowLeft", altKey: true }),
    ).toBe(true);
    expect(document.activeElement).toBe(buttons[2]);
  });

  it("keeps the stop on its week when earlier weeks are added", () => {
    const { rerender } = render(weeks());
    const buttons = weekButtons();
    buttons[2].focus();
    fireEvent.keyDown(buttons[2], { key: "ArrowRight" });

    rerender(weeks([{ date: week(-4), left: -112 }, ...ticks]));

    expect(weekButtons().map((button) => button.tabIndex)).toEqual([
      -1, -1, -1, -1, 0,
    ]);
  });
});
