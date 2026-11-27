import { makeProfile } from "@alliance/shared/lib/testFixtures";
import { describe, expect, it } from "bun:test";
import { ScheduledJobKind, scheduledJobs } from "./scheduledJobRules";

describe("scheduledJobs", () => {
  it("merges suspensions and forum auto-completes, soonest first", () => {
    const sam = makeProfile(3);
    const jobs = scheduledJobs({
      suspensionPlans: [
        { date: "2026-01-03T08:00:00.000Z", users: [sam] },
        { date: "2026-01-01T08:00:00.000Z", users: [makeProfile(4)] },
      ],
      forumAutocompletePlans: [
        {
          date: "2026-01-02T05:00:00.000Z",
          action: { id: 7, name: "Forum task" },
          users: [sam],
        },
      ],
    });

    expect(jobs.map((job) => [job.kind, job.date, job.task?.name])).toEqual([
      [ScheduledJobKind.Suspension, "2026-01-01T08:00:00.000Z", undefined],
      [
        ScheduledJobKind.ForumAutocomplete,
        "2026-01-02T05:00:00.000Z",
        "Forum task",
      ],
      [ScheduledJobKind.Suspension, "2026-01-03T08:00:00.000Z", undefined],
    ]);
    expect(new Set(jobs.map((job) => job.key)).size).toBe(3);
  });

  it("keeps a suspension's key when a refetch moves its sampled date", () => {
    const suspension = (date: string) =>
      scheduledJobs({
        suspensionPlans: [{ date, users: [makeProfile(3), makeProfile(4)] }],
        forumAutocompletePlans: [],
      })[0]?.key;

    expect(suspension("2026-01-03T08:00:00.000Z")).toBe(
      suspension("2026-01-03T08:07:00.000Z"),
    );
  });
});
