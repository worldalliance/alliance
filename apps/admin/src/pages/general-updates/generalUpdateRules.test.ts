import {
  EMPTY_FORM,
  GeneralUpdateStatus,
  groupByStatus,
  saveBodyOf,
  saveReachOf,
  statusOf,
} from "./generalUpdateRules";

const now = new Date("2026-06-15T12:00:00.000Z");
const past = "2026-06-01T00:00:00.000Z";
const future = "2026-07-01T00:00:00.000Z";

it("reads an update's status from its dates", () => {
  expect(statusOf({ startDate: null, endDate: future }, now)).toBe(
    GeneralUpdateStatus.Draft,
  );
  expect(statusOf({ startDate: future }, now)).toBe(
    GeneralUpdateStatus.Scheduled,
  );
  expect(statusOf({ startDate: past }, now)).toBe(GeneralUpdateStatus.Active);
  expect(statusOf({ startDate: past, endDate: future }, now)).toBe(
    GeneralUpdateStatus.Active,
  );
  expect(statusOf({ startDate: past, endDate: past }, now)).toBe(
    GeneralUpdateStatus.Expired,
  );
});

it("groups in the list's order and leaves empty groups out", () => {
  const groups = groupByStatus(
    [
      { id: 1, startDate: past, endDate: past },
      { id: 2, startDate: null },
      { id: 3, startDate: past },
      { id: 4, startDate: null },
    ],
    now,
  );
  expect(
    groups.map((group) => [group.status, group.updates.map((u) => u.id)]),
  ).toEqual([
    [GeneralUpdateStatus.Draft, [2, 4]],
    [GeneralUpdateStatus.Active, [3]],
    [GeneralUpdateStatus.Expired, [1]],
  ]);
});

it("leaves a suite's schedule and an unticked cohort out of the save", () => {
  const body = saveBodyOf({
    ...EMPTY_FORM,
    name: "Note",
    startDate: past,
    suiteIds: [7],
    manualCohortUserIds: [5],
  });
  expect(body.startDate).toBeUndefined();
  expect(body.endDate).toBeUndefined();
  expect(body.manualCohortUserIds).toEqual([]);
  expect(body.suiteIds).toEqual([7]);
});

it("sends an emptied date as null, so the save clears the stored one", () => {
  const body = saveBodyOf({ ...EMPTY_FORM, name: "Note", endDate: future });
  expect(body.startDate).toBeNull();
  expect(body.endDate).toBe(future);
});

it("says what a save does for members", () => {
  const form = { ...EMPTY_FORM, name: "Note" };
  expect(saveReachOf(form, now)).toMatch(/no start date, so members don't/);
  expect(saveReachOf({ ...form, startDate: past }, now)).toMatch(
    /Members see this on save/,
  );
  expect(saveReachOf({ ...form, startDate: future }, now)).toMatch(
    /from its start date/,
  );
  expect(saveReachOf({ ...form, startDate: past, endDate: past }, now)).toMatch(
    /still under General updates for every member/,
  );
  expect(saveReachOf({ ...form, suiteIds: [7] }, now)).toMatch(
    /follows its suite's/,
  );
});
