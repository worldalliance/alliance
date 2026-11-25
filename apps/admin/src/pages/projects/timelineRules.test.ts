import type { ActionEventDto, ActionStatus } from "@alliance/shared/client";
import { describe, expect, it } from "bun:test";
import { addDays } from "date-fns";
import { adminActionListItem } from "../../lib/testing/adminActionListItem";
import { projectTimeline } from "./timelineRules";

const NOW = new Date("2026-10-26T12:00:00.000Z");
const day = (offset: number) => addDays(NOW, offset).toISOString();

const event = (newStatus: ActionStatus, date: string): ActionEventDto => ({
  id: 0,
  title: newStatus,
  description: "",
  newStatus,
  date,
  suiteManaged: false,
});

const step = (id: number, events: ActionEventDto[]) =>
  adminActionListItem(id, `Task ${id}`, {
    status: events.at(-1)?.newStatus ?? "draft",
    events,
  });

describe("projectTimeline", () => {
  it("ends a finished project's scale at its last event, with no now mark", () => {
    const timeline = projectTimeline(
      [
        step(1, [
          event("member_action", day(-200)),
          event("completed", day(-180)),
        ]),
        step(2, [
          event("member_action", day(-170)),
          event("completed", day(-150)),
        ]),
      ],
      NOW,
    );
    expect(timeline?.end.toISOString()).toBe(day(-150));
    expect(timeline?.now).toBeNull();
  });

  it("runs to now while a phase is still open", () => {
    const timeline = projectTimeline(
      [
        step(1, [
          event("member_action", day(-200)),
          event("completed", day(-180)),
        ]),
        step(2, [
          event("member_action", day(-170)),
          event("office_action", day(-150)),
        ]),
      ],
      NOW,
    );
    expect(timeline?.end.toISOString()).toBe(NOW.toISOString());
    expect(timeline?.now).toBe("100%");
  });
});
