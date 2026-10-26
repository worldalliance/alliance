import type { ActionEventDto, ActionStatus } from "@alliance/shared/client";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  getDayOfYear,
  isTuesday,
  milliseconds,
  previousTuesday,
  startOfDay,
} from "date-fns";
import { MemoryRouter } from "react-router";
import {
  TIMELINE_ROW_HEIGHT,
  type TimelineReminder,
} from "../lib/actionTimelineData";
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
  slug: "finished-action",
  status: "completed" as const,
  events: [
    timelineEvent(1, -60, "planned"),
    timelineEvent(2, -50, "completed"),
  ],
};
const running = {
  id: 2,
  name: "Running action",
  slug: "running-action",
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

  it("shows each action's slug", () => {
    renderTimeline();

    expect(screen.getByText("finished-action")).toBeTruthy();
    expect(screen.getByText("running-action")).toBeTruthy();
  });

  it("colors member action bars by project, falling back to slug", () => {
    const project = { id: 1, name: "Shared project", category: [] };
    const withEvents = (id: number, name: string) => ({
      ...running,
      id,
      name,
      slug: `slug-${id}`,
      events: [timelineEvent(id, -10, "member_action")],
    });
    renderTimeline({
      actions: [
        { ...withEvents(10, "First"), project },
        { ...withEvents(11, "Second"), project },
        withEvents(12, "Third"),
      ],
    });
    const barStyle = (name: string) =>
      screen.getByTitle(new RegExp(`^${name}:`)).querySelector("div")!.style
        .cssText;

    expect(barStyle("First")).toBe(barStyle("Second"));
    expect(barStyle("Third")).not.toBe(barStyle("First"));
  });

  it("draws a stripe per form, at most five", () => {
    renderTimeline({
      actions: [
        { ...running, variantFormIds: [11, 12] },
        { ...finished, variantFormIds: [21, 22, 23, 24, 25, 26] },
      ],
    });
    const stripeCount = (title: RegExp) =>
      screen.getAllByTitle(title)[0].childElementCount;

    expect(stripeCount(/^Running action:/)).toBe(3);
    expect(stripeCount(/^Finished action:/)).toBe(5);
  });

  it("highlights every row of the hovered action's project", () => {
    const project = { id: 1, name: "Shared project", category: [] };
    renderTimeline({
      actions: [
        { ...finished, project },
        { ...running, project },
        { ...running, id: 3, name: "Loner", slug: "loner" },
      ],
    });
    const nameRow = (slug: string) => screen.getByText(slug).closest("a")!;

    fireEvent.mouseEnter(nameRow("finished-action"));

    expect(nameRow("running-action").className).toContain(" bg-zinc-50");
    expect(nameRow("loner").className).not.toContain(" bg-zinc-50");
    expect(
      screen.getByTitle(/^Running action:/).parentElement!.className,
    ).toContain(" bg-gray-50");

    fireEvent.mouseLeave(nameRow("finished-action"));

    expect(nameRow("running-action").className).not.toContain(" bg-zinc-50");
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

    expect(container.querySelector(".overflow-auto")?.scrollTop).toBe(
      TIMELINE_ROW_HEIGHT,
    );
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

  it("scrolls to a focused action's row and bar once, flashing its row", async () => {
    const realSetTimeout = window.setTimeout;
    // Shortens the flash so the test doesn't wait it out; bun's fake timers
    // break `waitFor` in later test files. The cast only bridges the DOM and
    // bun overloads of setTimeout.
    window.setTimeout = ((handler: TimerHandler, delay?: number) =>
      realSetTimeout(
        handler,
        delay === milliseconds({ seconds: 2 }) ? 10 : delay,
      )) as typeof window.setTimeout;
    try {
      const focusAction = { id: running.id };
      const { container, rerender } = renderTimeline({ focusAction });
      const chart = container.querySelector<HTMLElement>(".overflow-auto");
      const row = () =>
        screen.getByText("Running action").closest("a")?.dataset.flashed;

      expect(chart?.scrollTop).toBe(TIMELINE_ROW_HEIGHT);
      expect(chart?.scrollLeft).toBeGreaterThan(0);
      expect(row()).toBe("true");

      chart!.scrollTop = 0;
      rerender(
        <MemoryRouter>
          <ActionTimeline
            actions={[finished, running]}
            focusAction={focusAction}
          />
        </MemoryRouter>,
      );
      expect(chart?.scrollTop).toBe(0);

      await waitFor(() => expect(row()).toBeUndefined());
    } finally {
      window.setTimeout = realSetTimeout;
    }
  });
});
