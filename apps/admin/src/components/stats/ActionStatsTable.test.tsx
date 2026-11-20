import { render, screen, within } from "@testing-library/react";
import ActionStatsTable from "./ActionStatsTable";
import { actionStat } from "./actionStatFixture";

it("lists each action's figures, with no rate for an action nobody joined", () => {
  render(
    <ActionStatsTable
      actionStats={[
        actionStat({
          actionId: 1,
          actionName: "Call a rep",
          usersCompleted: 9,
          usersJoined: 10,
          completionRate: 0.9,
        }),
        actionStat({ actionId: 2, actionName: "Write a letter" }),
      ]}
    />,
  );

  expect(
    screen.getByRole("region", { name: "Action stats 2 actions" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("region", { name: "Action stats table" }).tabIndex,
  ).toBe(0);
  const rows = screen.getAllByRole("row").slice(1);
  expect(within(rows[0]).getByText("90%")).toBeTruthy();
  expect(within(rows[1]).getAllByText("N/A")).toHaveLength(2);
});

it("renders nothing without action stats", () => {
  const { container } = render(<ActionStatsTable actionStats={[]} />);
  expect(container.textContent).toBe("");
});
