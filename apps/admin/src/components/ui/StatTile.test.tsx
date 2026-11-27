import { render, screen } from "@testing-library/react";
import StatTile from "./StatTile";

it("shows the value and its hint", () => {
  render(<StatTile label="Members" value={0} hint="Signed" />);
  expect(screen.getByText("0")).toBeTruthy();
  expect(screen.getByText("Signed")).toBeTruthy();
});

it.each([null, undefined])("shows a dash, not 0, for %p", (value) => {
  const { container } = render(<StatTile label="Churn" value={value} />);
  expect(container.textContent).toBe("Churn—No data");
});
