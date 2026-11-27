import type { ActionEventDto, ActionUpdateDto } from "@alliance/shared/client";
import { HistoryKind, historyRows, noDecisionsReason } from "./activityRules";

const now = new Date("2026-03-10T12:00:00Z");

const event = (
  id: number,
  newStatus: ActionEventDto["newStatus"],
  date: string,
) => ({ id, title: "", description: "", newStatus, date, suiteManaged: false });

const update = (
  id: number,
  fields: Pick<ActionUpdateDto, "visibleAt" | "notifiedAt"> &
    Partial<Pick<ActionUpdateDto, "date">>,
) =>
  ({
    id,
    title: `Update ${id}`,
    date: "2026-03-01T00:00:00Z",
    ...fields,
  }) as ActionUpdateDto;

describe("historyRows", () => {
  it("lists phase starts, publications and notifications newest first, scheduled ones marked", () => {
    const rows = historyRows({
      events: [
        event(1, "office_action", "2026-03-01T00:00:00Z"),
        event(2, "member_action", "2026-03-20T00:00:00Z"),
      ],
      updates: [
        update(5, {
          visibleAt: "2026-03-05T00:00:00Z",
          notifiedAt: "2026-03-06T00:00:00Z",
        }),
      ],
      now,
    });
    expect(rows.map((row) => [row.key, row.scheduled])).toEqual([
      ["event-2", true],
      ["notified-5", false],
      ["published-5", false],
      ["event-1", false],
    ]);
    expect(rows.map((row) => row.kind)).toEqual([
      HistoryKind.Phase,
      HistoryKind.Notified,
      HistoryKind.Published,
      HistoryKind.Phase,
    ]);
  });

  it("times a notification when it was sent, even if the update's date moved later", () => {
    const rows = historyRows({
      events: [],
      updates: [
        update(1, {
          date: "2026-03-20T00:00:00Z",
          visibleAt: "2026-03-20T00:00:00Z",
          notifiedAt: "2026-03-10T11:00:00Z",
        }),
      ],
      now,
    });
    expect(rows.find((row) => row.key === "notified-1")).toMatchObject({
      at: "2026-03-10T11:00:00Z",
      scheduled: false,
    });
  });

  it("leaves out a draft update and one never notified", () => {
    const rows = historyRows({
      events: [],
      updates: [
        update(1, { visibleAt: null, notifiedAt: null }),
        update(2, { visibleAt: "2026-03-01T00:00:00Z", notifiedAt: null }),
      ],
      now,
    });
    expect(rows.map((row) => row.key)).toEqual(["published-2"]);
  });
});

describe("noDecisionsReason", () => {
  it("says an open-by-link task keeps none", () => {
    expect(noDecisionsReason({ publicOnly: true, events: [] }, now)).toMatch(
      /open by link/,
    );
  });

  it("tells a draft from a task whose member action has started", () => {
    expect(noDecisionsReason({ publicOnly: false, events: [] }, now)).toMatch(
      /draft/,
    );
    expect(
      noDecisionsReason(
        {
          publicOnly: false,
          events: [event(1, "member_action", "2026-03-01T00:00:00Z")],
        },
        now,
      ),
    ).toMatch(/has started/);
  });
});
