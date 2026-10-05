import { R } from "@alliance/common/result";
import {
  millisecondsInDay,
  millisecondsInHour,
  millisecondsInMinute,
} from "date-fns/constants";
import { applyMemberAwayRangeEdit } from "./away-range-history";

const now = new Date("2026-10-04T12:00:00Z");
const at = (offsetMs: number) => new Date(now.getTime() + offsetMs);
const days = (n: number) => n * millisecondsInDay;
const createdAt = at(-days(30));

describe("applyMemberAwayRangeEdit", () => {
  describe("a new or not-yet-started range", () => {
    const future = { startDate: at(days(2)), endDate: at(days(5)), createdAt };

    it("keeps a future span", () => {
      const requested = {
        startDate: future.startDate,
        endDate: future.endDate,
      };
      expect(
        applyMemberAwayRangeEdit({ before: null, requested, now }),
      ).toEqual(R.success(requested));
    });

    it("starts a range dated earlier today at now", () => {
      const requested = {
        startDate: at(-10 * millisecondsInHour),
        endDate: at(days(1)),
      };
      expect(
        applyMemberAwayRangeEdit({ before: future, requested, now }),
      ).toEqual(R.success({ startDate: now, endDate: requested.endDate }));
    });

    it("rejects a span that has already ended", () => {
      const requested = { startDate: at(-days(1)), endDate: at(-1) };
      expect(
        applyMemberAwayRangeEdit({ before: null, requested, now }),
      ).toEqual(R.failure("An away period can't end in the past."));
    });

    it("rejects a start beyond the current-day tolerance", () => {
      const requested = { startDate: at(-days(3)), endDate: at(days(1)) };
      expect(
        applyMemberAwayRangeEdit({ before: null, requested, now }).ok,
      ).toBe(false);
      expect(
        applyMemberAwayRangeEdit({ before: future, requested, now }).ok,
      ).toBe(false);
    });
  });

  describe("a range that has begun", () => {
    const ongoing = {
      startDate: at(-days(2)),
      endDate: at(days(2)),
      createdAt,
    };

    it("lets the end move to any time from now on", () => {
      for (const endDate of [now, at(days(1)), at(days(9))]) {
        const requested = { startDate: ongoing.startDate, endDate };
        expect(
          applyMemberAwayRangeEdit({ before: ongoing, requested, now }),
        ).toEqual(R.success(requested));
      }
    });

    it("rejects moving the start", () => {
      for (const startDate of [at(-days(3)), at(-days(1)), at(days(1))]) {
        expect(
          applyMemberAwayRangeEdit({
            before: ongoing,
            requested: { startDate, endDate: ongoing.endDate },
            now,
          }).ok,
        ).toBe(false);
      }
    });

    it("rejects an end before now", () => {
      expect(
        applyMemberAwayRangeEdit({
          before: ongoing,
          requested: { startDate: ongoing.startDate, endDate: at(-1) },
          now,
        }).ok,
      ).toBe(false);
    });
  });

  describe("a range that has ended", () => {
    const ended = { startDate: at(-days(5)), endDate: at(-days(1)), createdAt };

    it("accepts the unchanged span", () => {
      const requested = { startDate: ended.startDate, endDate: ended.endDate };
      expect(
        applyMemberAwayRangeEdit({ before: ended, requested, now }),
      ).toEqual(R.success(requested));
    });

    it("rejects shortening, extending, or ending it now", () => {
      for (const endDate of [at(-days(2)), now, at(days(1))]) {
        expect(
          applyMemberAwayRangeEdit({
            before: ended,
            requested: { startDate: ended.startDate, endDate },
            now,
          }).ok,
        ).toBe(false);
      }
    });
  });

  describe("a range begun within an hour of its creation", () => {
    const fresh = {
      startDate: at(-10 * millisecondsInMinute),
      endDate: at(days(1)),
      createdAt: at(-10 * millisecondsInMinute),
    };

    it("keeps its start when the edit leaves it alone", () => {
      const requested = { startDate: fresh.startDate, endDate: at(days(2)) };
      expect(
        applyMemberAwayRangeEdit({ before: fresh, requested, now }),
      ).toEqual(R.success(requested));
    });

    it("lets the start move as if the range had not begun", () => {
      const requested = { startDate: at(days(1)), endDate: at(days(2)) };
      expect(
        applyMemberAwayRangeEdit({ before: fresh, requested, now }),
      ).toEqual(R.success(requested));
    });
  });
});
