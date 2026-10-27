import { render, screen } from "@testing-library/react";
import { expect, it } from "bun:test";
import ActionCustomStat from "./ActionCustomStat";

it("shows the stat of an action that tracks one", () => {
  render(
    <ActionCustomStat
      action={{
        customStatType: "users_invited",
        customStatLabel: "Invites",
        customStatValue: 12,
      }}
    />,
  );
  expect(screen.getByText("Invites:")).toBeTruthy();
  expect(screen.getByText("12")).toBeTruthy();
});

it("hides the value left over once the stat type is none", () => {
  const { container } = render(
    <ActionCustomStat
      action={{
        customStatType: "none",
        customStatLabel: "Invites",
        customStatValue: 12,
      }}
    />,
  );
  expect(container.innerHTML).toBe("");
});

it("hides a tracked stat until its value is computed", () => {
  const { container } = render(
    <ActionCustomStat
      action={{ customStatType: "users_invited", customStatLabel: "Invites" }}
    />,
  );
  expect(container.innerHTML).toBe("");
});
