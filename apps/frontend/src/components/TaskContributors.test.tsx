import { taskFlow } from "@alliance/shared/lib/copy";
import { makeAction } from "@alliance/shared/lib/testFixtures";
import { render, screen } from "@testing-library/react";
import TaskContributors from "./TaskContributors";

it("lists a task's contributors under a Contributors heading", () => {
  render(
    <TaskContributors
      action={makeAction({ reviewers: [{ name: "Sam Reviewer" }] })}
    />,
  );
  expect(
    screen.getByRole("heading", { name: taskFlow.contributors }),
  ).toBeTruthy();
  expect(screen.getByText("Sam Reviewer")).toBeTruthy();
  expect(screen.getByText(taskFlow.expert)).toBeTruthy();
});

it("shows nothing for a task without contributors", () => {
  const { container } = render(
    <TaskContributors action={makeAction({ reviewers: [] })} />,
  );
  expect(container.childElementCount).toBe(0);
});
