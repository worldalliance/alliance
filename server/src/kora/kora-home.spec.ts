import { KoraUserBatchStatus } from "@alliance/common/kora";
import { type KoraSessionProgress, koraHome } from "./kora-home";

const now = new Date("2026-11-20T12:00:00Z");
const day = (d: number) => new Date(now.getTime() + d * 86_400_000);

const session = (
  overrides: Partial<KoraSessionProgress>,
): KoraSessionProgress => ({
  id: "a",
  createdAt: day(-1),
  releasedAt: day(-3),
  closesAt: day(5),
  endedAt: null,
  total: 10,
  progress: 0,
  ranked: 0,
  ...overrides,
});
const offer = { releasedAt: day(-3), closesAt: day(5) };

describe("koraHome", () => {
  it("names each assignment's status and lists the newest first", () => {
    const home = koraHome({
      now,
      offer: null,
      sessions: [
        session({ id: "done", createdAt: day(-9), endedAt: day(-8) }),
        session({ id: "open", createdAt: day(-1) }),
        session({ id: "closed", createdAt: day(-5), closesAt: now }),
      ],
    });
    expect(home.userBatches.map((b) => [b.id, b.status])).toEqual([
      ["open", KoraUserBatchStatus.Open],
      ["closed", KoraUserBatchStatus.Closed],
      ["done", KoraUserBatchStatus.Done],
    ]);
  });

  it("counts skipped conversations toward progress but not toward conversations ranked", () => {
    const home = koraHome({
      now,
      offer: null,
      sessions: [
        session({ id: "x", progress: 4, ranked: 3 }),
        session({ id: "y", endedAt: day(-1), progress: 10, ranked: 9 }),
      ],
    });
    expect(home.totalRanked).toBe(12);
    expect(home.userBatches[0]).toMatchObject({ progress: 4, total: 10 });
  });

  it("shows an offer first, only while no session is open", () => {
    const finished = session({ endedAt: day(-1) });
    expect(
      koraHome({ now, offer, sessions: [finished] }).userBatches[0],
    ).toEqual({
      id: null,
      status: KoraUserBatchStatus.Ready,
      releasedAt: offer.releasedAt,
      closesAt: offer.closesAt,
      progress: 0,
      total: 0,
    });
    expect(
      koraHome({ now, offer, sessions: [session({})] }).userBatches,
    ).toHaveLength(1);
  });

  it("leaves out a session a retire emptied, and falls back to its creation date", () => {
    const home = koraHome({
      now,
      offer: null,
      sessions: [
        session({ id: "empty", total: 0 }),
        session({ id: "kept", releasedAt: null }),
      ],
    });
    expect(home.userBatches).toEqual([
      expect.objectContaining({ id: "kept", releasedAt: day(-1) }),
    ]);
  });
});
