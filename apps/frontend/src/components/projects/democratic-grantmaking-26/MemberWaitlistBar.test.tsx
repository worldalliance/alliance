import { cleanup, render, screen } from "@testing-library/react";
import { MemberWaitlistBar } from "./MemberWaitlistBar";

afterEach(cleanup);

const widths = (members: number, waitlist: number) => {
  render(<MemberWaitlistBar members={members} waitlist={waitlist} />);
  return Array.from(
    screen.getByRole("img").querySelectorAll<HTMLElement>(":scope > div"),
    (segment) => segment.style.width,
  );
};

test("gives the waitlist only what the members leave of the goal", () => {
  expect(widths(600, 700)).toEqual(["60%", "40%"]);
});

test("fills the bar with members alone past the goal", () => {
  expect(widths(1200, 50)).toEqual(["100%", "0%"]);
});
