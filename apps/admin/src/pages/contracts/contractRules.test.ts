import {
  ContractStatus,
  groupByStatus,
  inForceOf,
  statusOf,
} from "./contractRules";

const now = new Date("2026-06-01T00:00:00.000Z");
const past = "2026-01-01T00:00:00.000Z";
const later = "2026-03-01T00:00:00.000Z";
const future = "2026-09-01T00:00:00.000Z";

describe("statusOf", () => {
  it("is active only for the contract the server names as current", () => {
    const started = { id: 1, startDate: past, endDate: null };
    expect(statusOf(started, { activeId: 1, now })).toBe(ContractStatus.Active);
    expect(statusOf(started, { activeId: 2, now })).toBe(
      ContractStatus.Inactive,
    );
  });

  it("is scheduled while its start is ahead, and inactive with no start", () => {
    expect(statusOf({ id: 1, startDate: future }, { activeId: 2, now })).toBe(
      ContractStatus.Scheduled,
    );
    expect(statusOf({ id: 1, startDate: null }, { activeId: 2, now })).toBe(
      ContractStatus.Inactive,
    );
  });
});

it("groups active, then scheduled, then inactive, leaving out empty groups", () => {
  const groups = groupByStatus(
    [
      { id: 1, startDate: null },
      { id: 2, startDate: past },
    ],
    { activeId: 2, now },
  );
  expect(groups.map((group) => group.status)).toEqual([
    ContractStatus.Active,
    ContractStatus.Inactive,
  ]);
});

describe("inForceOf", () => {
  it("picks the latest start that has passed", () => {
    const picked = inForceOf(
      [
        { id: 1, startDate: past },
        { id: 2, startDate: later },
        { id: 3, startDate: future },
      ],
      now,
    );
    expect(picked?.id).toBe(2);
  });

  it("skips a contract whose end has passed or that has no start", () => {
    const picked = inForceOf(
      [
        { id: 1, startDate: past },
        { id: 2, startDate: later, endDate: later },
        { id: 3, startDate: null },
      ],
      now,
    );
    expect(picked?.id).toBe(1);
    expect(inForceOf([{ id: 3, startDate: null }], now)).toBeNull();
  });
});
