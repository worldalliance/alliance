import { render, screen } from "@testing-library/react";
import { MemberWaitlistBar } from "./MemberWaitlistBar";

const segmentWidths = () =>
  Array.from(
    screen.getByRole("img").querySelectorAll<HTMLElement>(":scope > div"),
    (segment) => segment.style.width,
  );

const widths = (members: number, waitlist: number) => {
  render(<MemberWaitlistBar members={members} waitlist={waitlist} />);
  return segmentWidths();
};

test("gives the waitlist only what the members leave of the goal", () => {
  expect(widths(600, 700)).toEqual(["60%", "40%"]);
});

test("fills the bar with members alone past the goal", () => {
  expect(widths(1200, 50)).toEqual(["100%", "0%"]);
});

test("measures against a custom goal", () => {
  render(<MemberWaitlistBar members={100} waitlist={50} goal={500} />);
  expect(segmentWidths()).toEqual(["20%", "10%"]);
  expect(screen.getByText("Goal: 500 members")).toBeTruthy();
});
