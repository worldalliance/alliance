import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, jest } from "bun:test";
import { ReminderClickRateBarChart } from "./ReminderClickRateBarChart";
import { ReminderChannel } from "./reminderClickRateData";

afterEach(() => jest.restoreAllMocks());

it("scrolls a bar reached by the arrow keys into view", () => {
  const scroll = jest.spyOn(Element.prototype, "scrollIntoView");
  render(
    <ReminderClickRateBarChart
      channel={ReminderChannel.Email}
      bars={[1, 2, 3].map((actionId) => ({
        actionId,
        actionName: `Task ${actionId}`,
        averageRate: 0.5,
        reminderGroupCount: 1,
        clickedCount: 1,
        sentCount: 2,
      }))}
    />,
  );

  fireEvent.keyDown(screen.getByRole("img"), { key: "End" });

  expect(scroll.mock.contexts.at(-1)).toBe(
    document.querySelectorAll("[data-bar]")[2],
  );
});
