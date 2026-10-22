import { addHours } from "date-fns";
import { checkActionShowsWhenEntriesArrive } from "./action-update-visibility";
import { ActionStatus } from "./entities/action-event.entity";

const now = new Date("2026-06-01T12:00:00Z");
const launchAt = (date: Date) => [
  { date, newStatus: ActionStatus.MemberAction },
];
const check = (params: {
  archived?: boolean;
  events: { date: Date; newStatus: ActionStatus }[];
  date: Date;
  visibleAt?: Date | null;
}) =>
  checkActionShowsWhenEntriesArrive({
    action: { archived: params.archived ?? false, events: params.events },
    actionUpdate: { date: params.date, visibleAt: params.visibleAt ?? now },
    now,
  }).ok;

describe("checkActionShowsWhenEntriesArrive", () => {
  it("refuses an archived action", () => {
    expect(
      check({
        archived: true,
        events: launchAt(addHours(now, -1)),
        date: now,
      }),
    ).toBe(false);
  });

  it("refuses an action with no launch", () => {
    expect(check({ events: [], date: now })).toBe(false);
  });

  it("refuses entries that arrive before the launch", () => {
    expect(
      check({ events: launchAt(addHours(now, 2)), date: addHours(now, 1) }),
    ).toBe(false);
  });

  it("allows entries that arrive at the launch", () => {
    const launch = addHours(now, 1);
    expect(check({ events: launchAt(launch), date: launch })).toBe(true);
  });

  it("judges entries due in the past at now", () => {
    expect(
      check({ events: launchAt(addHours(now, -1)), date: addHours(now, -2) }),
    ).toBe(true);
  });

  it("judges entries at the update's visibility when it comes after its date", () => {
    expect(
      check({
        events: launchAt(addHours(now, 2)),
        date: addHours(now, 1),
        visibleAt: addHours(now, 3),
      }),
    ).toBe(true);
  });
});
