import { CountId } from "../../places";
import { invalidRangeMessage, lastDays, waitingQueues } from "./homeRules";

const counts = (
  needsReply: number | null | undefined,
  welcome: number | null | undefined,
  awaitingGroup: number | null | undefined,
  partnerships: number | null | undefined,
) => ({
  [CountId.NeedsReply]: needsReply,
  [CountId.WelcomeQueue]: welcome,
  [CountId.AwaitingGroup]: awaitingGroup,
  [CountId.PartnershipResponses]: partnerships,
});

describe("waitingQueues", () => {
  it("keeps only the queues with someone waiting, in the fixed order", () => {
    expect(waitingQueues(counts(0, 3, 0, 2))).toEqual([
      { id: CountId.WelcomeQueue, count: 3 },
      { id: CountId.PartnershipResponses, count: 2 },
    ]);
  });

  it("is empty when nothing waits", () => {
    expect(waitingQueues(counts(0, 0, 0, 0))).toEqual([]);
  });

  it("keeps a queue whose count couldn't load", () => {
    expect(waitingQueues(counts(0, null, 0, 0))).toEqual([
      { id: CountId.WelcomeQueue, count: null },
    ]);
  });

  it("waits for every count before listing any", () => {
    expect(waitingQueues(counts(4, undefined, 0, 0))).toBeNull();
  });
});

describe("lastDays", () => {
  it("counts today as the last of the days", () => {
    expect(lastDays(7, new Date(2026, 1, 10))).toEqual({
      start: "2026-02-04",
      end: "2026-02-10",
    });
  });
});

describe("invalidRangeMessage", () => {
  it("accepts a range of one day", () => {
    expect(
      invalidRangeMessage({ start: "2026-02-10", end: "2026-02-10" }),
    ).toBeNull();
  });
});
