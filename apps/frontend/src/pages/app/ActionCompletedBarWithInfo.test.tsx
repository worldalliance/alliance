import { ActionDto } from "@alliance/shared/client";
import { makeAction } from "@alliance/shared/lib/testFixtures";
import { render, screen } from "@testing-library/react";
import ActionCompletedBarWithInfo from "./ActionCompletedBarWithInfo";

const renderBar = (action: ActionDto) =>
  render(
    <ActionCompletedBarWithInfo
      action={action}
      friendActivities={[]}
      showInfoTooltip
    />,
  ).container;

it("explains the denominator of a regular action's count", () => {
  const container = renderBar(
    makeAction({ usersCompleted: 3, usersJoined: 10 }),
  );

  screen.getByText("3 / 10 members completed");
  expect(container.querySelector(".lucide-info")).not.toBeNull();
});

it("shows no denominator explanation on an optional action", () => {
  const container = renderBar(
    makeAction({ optional: true, usersCompleted: 3, usersJoined: 10 }),
  );

  screen.getByText("3 members completed");
  expect(container.querySelector(".lucide-info")).toBeNull();
});

it("shows no denominator explanation on an onboarding action", () => {
  const container = renderBar(
    makeAction({ onboarding: true, usersCompleted: 3, usersJoined: 10 }),
  );

  screen.getByText("3 members completed");
  expect(container.querySelector(".lucide-info")).toBeNull();
});
