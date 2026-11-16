import { KoraUserBatchStatus } from "@alliance/common/kora";
import { type KoraAssignmentProgress, koraHome } from "./kora-home";

const now = new Date("2026-11-20T12:00:00Z");
const day = (d: number) => new Date(now.getTime() + d * 86_400_000);

const assignment = (
  overrides: Partial<KoraAssignmentProgress>,
): KoraAssignmentProgress => ({
  id: "a",
  createdAt: day(-1),
  releasedAt: day(-3),
  closesAt: day(5),
  completedAt: null,
  total: 10,
  progress: 0,
  ranked: 0,
  ...overrides,
});
const offer = { releasedAt: day(-3), closesAt: day(5), size: 10 };

describe("koraHome", () => {
  it("names each assignment's status and lists the newest first", () => {
    const home = koraHome({
      now,
      offer: null,
      assignments: [
        assignment({ id: "done", createdAt: day(-9), completedAt: day(-8) }),
        assignment({ id: "open", createdAt: day(-1) }),
        assignment({ id: "closed", createdAt: day(-5), closesAt: now }),
      ],
    });
    expect(home.userBatches.map((b) => [b.id, b.status])).toEqual([
      ["open", KoraUserBatchStatus.Open],
      ["closed", KoraUserBatchStatus.Closed],
      ["done", KoraUserBatchStatus.Done],
    ]);
  });

  it("counts skipped pairs toward progress but not toward pairs ranked", () => {
    const home = koraHome({
      now,
      offer: null,
      assignments: [
        assignment({ id: "x", progress: 4, ranked: 3 }),
        assignment({ id: "y", completedAt: day(-1), progress: 10, ranked: 9 }),
      ],
    });
    expect(home.totalRanked).toBe(12);
    expect(home.userBatches[0]).toMatchObject({ progress: 4, total: 10 });
  });

  it("shows an offer first, only while no assignment is open", () => {
    const finished = assignment({ completedAt: day(-1) });
    expect(
      koraHome({ now, offer, assignments: [finished] }).userBatches[0],
    ).toEqual({
      id: null,
      status: KoraUserBatchStatus.Ready,
      releasedAt: offer.releasedAt,
      closesAt: offer.closesAt,
      progress: 0,
      total: 10,
    });
    expect(
      koraHome({ now, offer, assignments: [assignment({})] }).userBatches,
    ).toHaveLength(1);
  });

  it("leaves out an assignment a retire emptied, and falls back to its creation date", () => {
    const home = koraHome({
      now,
      offer: null,
      assignments: [
        assignment({ id: "empty", total: 0 }),
        assignment({ id: "kept", releasedAt: null }),
      ],
    });
    expect(home.userBatches).toEqual([
      expect.objectContaining({ id: "kept", releasedAt: day(-1) }),
    ]);
  });
});
