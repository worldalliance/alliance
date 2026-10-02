import { cleanup, render, screen } from "@testing-library/react";
import MissedSuiteNote from "./MissedSuiteNote";

afterEach(cleanup);

it("explains the routing for a group with a suite", () => {
  render(<MissedSuiteNote hasSuite />);

  expect(screen.getByText(/third consecutive miss on/)).toBeTruthy();
  expect(screen.queryByText(/sends nothing\.$/)).toBeNull();
});

it("says a group without a suite sends nothing", () => {
  render(<MissedSuiteNote hasSuite={false} />);

  expect(
    screen.getByText(
      "This missed-suite group has no suite, so it sends nothing.",
    ),
  ).toBeTruthy();
});
