import { Temporal } from "@js-temporal/polyfill";
import { ActionEvent } from "src/actions/entities/action-event.entity";
import { getTimeLeftString } from "./textnotifcontents";

export function deadlineEventFor(
  now: Date,
  dur: Temporal.DurationLike,
): ActionEvent {
  const instant = Temporal.Instant.fromEpochMilliseconds(now.getTime());

  const zoned = instant.toZonedDateTimeISO("UTC");
  const futureInstant = zoned.add(dur).toInstant();

  return {
    date: new Date(futureInstant.epochMilliseconds),
  } as ActionEvent;
}

describe("textnotifcontents", () => {
  it("should compute desired time strings from deadline", () => {
    const dateNow = new Date(Date.now());

    const threedays1 = deadlineEventFor(dateNow, {
      days: 2,
      hours: 23,
      minutes: 59,
    });

    expect(getTimeLeftString(threedays1, dateNow)).toBe("3 days");
    expect(getTimeLeftString(threedays1, dateNow, "days")).toBe("3 days");
    expect(getTimeLeftString(threedays1, dateNow, "hours")).toBe("0 hours");

    const threedays2 = deadlineEventFor(dateNow, {
      days: 3,
      hours: 0,
      minutes: 2,
    });

    expect(getTimeLeftString(threedays2, dateNow)).toBe("3 days");
    expect(getTimeLeftString(threedays2, dateNow, "days")).toBe("3 days");
    expect(getTimeLeftString(threedays2, dateNow, "hours")).toBe("0 hours");

    const both = deadlineEventFor(dateNow, {
      days: 1,
      hours: 8,
      minutes: 0,
    });

    expect(getTimeLeftString(both, dateNow)).toBe("1 day, 8 hours");
    expect(getTimeLeftString(both, dateNow, "days")).toBe("1 day");
    expect(getTimeLeftString(both, dateNow, "hours")).toBe("8 hours");

    const threehours1 = deadlineEventFor(dateNow, {
      days: 0,
      hours: 3,
      minutes: 0,
    });

    expect(getTimeLeftString(threehours1, dateNow)).toBe("3 hours");
    expect(getTimeLeftString(threehours1, dateNow, "days")).toBe("0 days");
    expect(getTimeLeftString(threehours1, dateNow, "hours")).toBe("3 hours");

    const threehours2 = deadlineEventFor(dateNow, {
      days: 0,
      hours: 2,
      minutes: 59,
    });

    expect(getTimeLeftString(threehours2, dateNow)).toBe("3 hours");
    expect(getTimeLeftString(threehours2, dateNow, "days")).toBe("0 days");
    expect(getTimeLeftString(threehours2, dateNow, "hours")).toBe("3 hours");

    const oneHour = deadlineEventFor(dateNow, {
      days: 0,
      hours: 0,
      minutes: 59,
    });

    expect(getTimeLeftString(oneHour, dateNow)).toBe("1 hour");
    expect(getTimeLeftString(oneHour, dateNow, "days")).toBe("0 days");
    expect(getTimeLeftString(oneHour, dateNow, "hours")).toBe("1 hour");
  });
});
