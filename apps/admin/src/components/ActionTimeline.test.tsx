import type { ActionEventDto, ActionStatus } from "@alliance/shared/client";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  getDayOfYear,
  isTuesday,
  milliseconds,
  previousTuesday,
  startOfDay,
} from "date-fns";
import { MemoryRouter } from "react-router";
import type { TimelineReminder } from "../lib/actionTimelineData";
import ActionTimeline from "./ActionTimeline";

const daysFromNow = (days: number) =>
  new Date(Date.now() + milliseconds({ days })).toISOString();

const timelineEvent = (
  id: number,
  days: number,
  newStatus: ActionStatus,
): ActionEventDto => ({
  id,
  title: `Event ${id}`,
  description: "",
  newStatus,
  date: daysFromNow(days),
  suiteManaged: false,
});

const finished = {
  id: 1,
  name: "Finished action",
  status: "completed" as const,
  events: [
    timelineEvent(1, -60, "planned"),
    timelineEvent(2, -50, "completed"),
  ],
};
const running = {
  id: 2,
  name: "Running action",
  status: "member_action" as const,
  events: [timelineEvent(3, -10, "member_action")],
};

const timelineReminder = (
  id: number,
  overrides: Partial<TimelineReminder>,
): TimelineReminder => ({
  id,
  name: `Reminder ${id}`,
  timingMode: "absolute",
  send_range_start: null,
  send_range_end: null,
  sendAtAbsolute: null,
  sendAtSecondsFromDeadline: null,
  memberActionEvent: {
    ...timelineEvent(3, -10, "member_action"),
    updatedAt: daysFromNow(-10),
  },
  ...overrides,
});

const renderTimeline = (
  props: Partial<React.ComponentProps<typeof ActionTimeline>> = {},
) =>
  render(
    <MemoryRouter>
      <ActionTimeline actions={[finished, running]} {...props} />
    </MemoryRouter>,
  );

describe("ActionTimeline", () => {
  it("says so when there is nothing to chart", () => {
    renderTimeline({ actions: [] });

    expect(
      screen.getByText("No actions with timeline events found."),
    ).toBeTruthy();
  });

  it("colors member action bars by project, falling back to name", () => {
    const project = { id: 1, name: "Shared project", category: [] };
    const withEvents = (id: number, name: string) => ({
      ...running,
      id,
      name,
      events: [timelineEvent(id, -10, "member_action")],
    });
    renderTimeline({
      actions: [
        { ...withEvents(10, "First"), project },
        { ...withEvents(11, "Second"), project },
        withEvents(12, "Third"),
      ],
    });
    const barColor = (name: string) =>
      /#[0-9a-f]{6}/.exec(
        screen.getByTitle(new RegExp(`^${name}:`)).style.cssText,
      )?.[0];

    expect(barColor("First")).toBeDefined();
    expect(barColor("First")).toBe(barColor("Second"));
    expect(barColor("Third")).not.toBe(barColor("First"));
  });

  it("highlights every row of the hovered action's project", () => {
    const project = { id: 1, name: "Shared project", category: [] };
    renderTimeline({
      actions: [
        { ...finished, project },
        { ...running, project },
        { ...running, id: 3, name: "Loner" },
      ],
    });
    const nameRow = (name: string) => screen.getByText(name).closest("a")!;

    fireEvent.mouseEnter(nameRow("Finished action"));

    expect(nameRow("Running action").className).toContain(" bg-zinc-50");
    expect(nameRow("Loner").className).not.toContain(" bg-zinc-50");
    expect(
      screen.getByTitle(/^Running action:/).parentElement!.className,
    ).toContain(" bg-gray-50");

    fireEvent.mouseLeave(nameRow("Finished action"));

    expect(nameRow("Running action").className).not.toContain(" bg-zinc-50");
  });

  it("scrolls a week's header to the first action with a bar that week", () => {
    const { container } = renderTimeline();
    const today = startOfDay(new Date());
    const weekStart = isTuesday(today) ? today : previousTuesday(today);
    const weekNumber = Math.ceil(getDayOfYear(weekStart) / 7) + 1;

    fireEvent.click(
      screen.getByRole("button", {
        name: `Scroll to actions active in week ${weekNumber}`,
      }),
    );

    expect(container.querySelector(".overflow-auto")?.scrollTop).toBe(64);
  });

  it("reports which reminder was clicked", () => {
    const onReminderClick = jest.fn();
    renderTimeline({
      onReminderClick,
      reminders: [
        timelineReminder(7, { sendAtAbsolute: daysFromNow(-5) }),
        timelineReminder(8, {
          timingMode: "within_range",
          send_range_start: daysFromNow(-4),
          send_range_end: daysFromNow(-2),
        }),
      ],
    });

    fireEvent.click(screen.getByTitle("Reminder: Reminder 7"));
    fireEvent.click(screen.getByTitle("Reminder window: Reminder 8"));

    expect(onReminderClick.mock.calls).toEqual([[7], [8]]);
  });
});
