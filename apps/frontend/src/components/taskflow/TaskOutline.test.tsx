import { taskFlow } from "@alliance/shared/lib/copy";
import { render, screen, within } from "@testing-library/react";
import TaskOutline from "./TaskOutline";

it("marks and announces the steps the member has done", () => {
  render(
    <TaskOutline
      steps={[
        { heading: "Your story", done: true },
        { heading: "Pick a date", done: false },
      ]}
    />,
  );
  const [done, next] = within(
    screen.getByRole("group", { name: taskFlow.outline }),
  ).getAllByRole("listitem");
  expect(done.textContent).toBe(`Your story, ${taskFlow.stepDone}`);
  expect(done.querySelector(".bg-green")).not.toBeNull();
  expect(next.textContent).toBe("Pick a date");
  expect(next.querySelector(".bg-green")).toBeNull();
});
