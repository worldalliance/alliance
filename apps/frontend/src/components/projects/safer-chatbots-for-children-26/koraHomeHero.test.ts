import { KoraUserBatchStatus } from "@alliance/common/kora";
import type { KoraUserBatchDto } from "@alliance/shared/client";
import { expect, test } from "bun:test";
import { HOME_COPY } from "./copy";
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

const homeAfter = (ranked: number, ...userBatches: KoraUserBatchDto[]) => ({
  totalRanked: ranked,
  userBatches,
});

test("asks for the whole open session before any conversation is judged", () => {
  expect(heroOf(home(row({})), now)).toEqual({
    heading: `${HOME_COPY.rank(10)} by November 30`,
    action: { kind: HeroAction.Continue, label: HOME_COPY.startRanking },
    note: HOME_COPY.startIntro(),
  });
});

test("asks for what's left once some are judged, with one in the singular", () => {
  expect(heroOf(home(row({ progress: 3 })), now)).toMatchObject({
    heading: `${HOME_COPY.rankMore(7)} by November 30`,
    action: { label: HOME_COPY.continueRanking },
    note: null,
  });
  expect(heroOf(home(row({ progress: 9 })), now).heading).toBe(
    `${HOME_COPY.rankMore(1)} by November 30`,
  );
});

test("says when a user-batch closes within two days", () => {
  const heading = (day: number) =>
    heroOf(home(row({ closesAt: local(day) })), now).heading;
  const rank = HOME_COPY.rank(10);
  expect(heading(20)).toBe(`${rank} by November 20 · closes today`);
  expect(heading(21)).toBe(`${rank} by November 21 · closes tomorrow`);
  expect(heading(22)).toBe(`${rank} by November 22 · closes in 2 days`);
  expect(heading(23)).toBe(`${rank} by November 23`);
});

test("leaves out the date when the user-batch has no closing date", () => {
  expect(heroOf(home(row({ closesAt: null })), now).heading).toBe(
    HOME_COPY.rank(10),
  );
});

test("thanks a participant who finished, offering another", () => {
  const ready = row({ id: null, status: KoraUserBatchStatus.Ready, total: 8 });
  const done = row({
    status: KoraUserBatchStatus.Done,
    progress: 10,
  });
  expect(heroOf(home(ready, done), now)).toEqual({
    heading: HOME_COPY.rankedAll(10),
    action: { kind: HeroAction.Start, label: HOME_COPY.rankAnother },
    note: null,
  });
});

test("offers a fresh start after a closed user-batch", () => {
  const ready = row({ id: null, status: KoraUserBatchStatus.Ready });
  const closed = row({ status: KoraUserBatchStatus.Closed, progress: 4 });
  expect(heroOf(home(ready, closed), now)).toMatchObject({
    heading: `${HOME_COPY.sessionReady} by November 30`,
    action: { kind: HeroAction.Start, label: HOME_COPY.startRanking },
    note: HOME_COPY.startIntro(),
  });
});

test("says all caught up to a reviewer who has judged some and has none left", () => {
  expect(
    heroOf(homeAfter(4, row({ status: KoraUserBatchStatus.Done })), now),
  ).toEqual({
    heading: HOME_COPY.caughtUp,
    action: null,
    note: HOME_COPY.caughtUpNote,
  });
});

test("says nothing is ready yet to a reviewer who has judged nothing", () => {
  expect(heroOf(home(), now)).toEqual({
    heading: HOME_COPY.nothingYet,
    action: null,
    note: HOME_COPY.nothingYetNote,
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
