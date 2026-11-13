import { KoraUserBatchStatus } from "@alliance/common/kora";
import type { KoraUserBatchDto } from "@alliance/shared/client";
import { expect, test } from "bun:test";
import { HeroAction, heroOf, showBatchTable } from "./koraHomeHero";

const now = new Date(2026, 10, 20, 12);
const local = (day: number) => new Date(2026, 10, day, 23, 59).toISOString();

const row = (overrides: Partial<KoraUserBatchDto>): KoraUserBatchDto => ({
  id: "a1",
  status: KoraUserBatchStatus.Open,
  releasedAt: local(17),
  closesAt: local(30),
  progress: 0,
  total: 10,
  ...overrides,
});
const home = (...userBatches: KoraUserBatchDto[]) => ({
  totalRanked: 0,
  userBatches,
});

test("asks for the whole open user-batch before any pair is ranked", () => {
  expect(heroOf(home(row({})), now)).toEqual({
    heading: "Rank 10 pairs by November 30",
    action: { kind: HeroAction.Continue, label: "Start ranking" },
    note: null,
  });
});

test("asks for what's left once some are ranked, with one pair in the singular", () => {
  expect(heroOf(home(row({ progress: 3 })), now)).toMatchObject({
    heading: "Rank 7 more pairs by November 30",
    action: { label: "Continue ranking" },
  });
  expect(heroOf(home(row({ progress: 9 })), now).heading).toBe(
    "Rank 1 more pair by November 30",
  );
});

test("says when a user-batch closes within two days", () => {
  const heading = (day: number) =>
    heroOf(home(row({ closesAt: local(day) })), now).heading;
  expect(heading(20)).toBe("Rank 10 pairs by November 20 · closes today");
  expect(heading(21)).toBe("Rank 10 pairs by November 21 · closes tomorrow");
  expect(heading(22)).toBe("Rank 10 pairs by November 22 · closes in 2 days");
  expect(heading(23)).toBe("Rank 10 pairs by November 23");
});

test("leaves out the date when the user-batch has no closing date", () => {
  expect(heroOf(home(row({ closesAt: null })), now).heading).toBe(
    "Rank 10 pairs",
  );
});

test("thanks a participant who finished, offering another", () => {
  const ready = row({ id: null, status: KoraUserBatchStatus.Ready, total: 8 });
  const done = row({
    status: KoraUserBatchStatus.Done,
    progress: 10,
  });
  expect(heroOf(home(ready, done), now)).toEqual({
    heading: "You ranked all 10. Thank you",
    action: { kind: HeroAction.Start, label: "Rank another 8" },
    note: null,
  });
});

test("offers a fresh start after a closed user-batch", () => {
  const ready = row({ id: null, status: KoraUserBatchStatus.Ready });
  const closed = row({ status: KoraUserBatchStatus.Closed, progress: 4 });
  expect(heroOf(home(ready, closed), now)).toMatchObject({
    heading: "Rank 10 pairs by November 30",
    action: { kind: HeroAction.Start, label: "Start ranking" },
  });
});

test("says all caught up with nothing to rank", () => {
  expect(heroOf(home(row({ status: KoraUserBatchStatus.Done })), now)).toEqual({
    heading: "You’re all caught up",
    action: null,
    note: "We’ll let you know when more pairs are ready.",
  });
});

test("hides the table when its only row is the one the hero describes", () => {
  expect(showBatchTable(home())).toBe(false);
  expect(showBatchTable(home(row({})))).toBe(false);
  expect(showBatchTable(home(row({ status: KoraUserBatchStatus.Ready })))).toBe(
    false,
  );
  expect(showBatchTable(home(row({ status: KoraUserBatchStatus.Done })))).toBe(
    true,
  );
  expect(showBatchTable(home(row({}), row({ id: "a0" })))).toBe(true);
});
