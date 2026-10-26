import {
  ContractEventType,
  findLastContractEvent,
  findSuspensionEndedBy,
  isContractActiveAt,
  isContractActiveThroughout,
  isLatestSuspension,
} from "./contract-event.entity";

const at = new Date("2026-03-01T00:00:00Z");
const before = new Date("2026-02-01T00:00:00Z");
const after = new Date("2026-04-01T00:00:00Z");

describe("isContractActiveAt", () => {
  it("is inactive with no events", () => {
    expect(isContractActiveAt([], at)).toBe(false);
  });

  it("follows the latest event at or before the instant", () => {
    const events = [
      { id: 1, date: before, type: ContractEventType.SIGNED },
      { id: 2, date: at, type: ContractEventType.SUSPENDED },
    ];
    expect(isContractActiveAt(events, before)).toBe(true);
    expect(isContractActiveAt(events, at)).toBe(false);
  });

  it("ignores events after the instant", () => {
    const events = [
      { id: 1, date: before, type: ContractEventType.SIGNED },
      { id: 2, date: after, type: ContractEventType.SUSPENDED },
    ];
    expect(isContractActiveAt(events, at)).toBe(true);
  });

  it("breaks a same-instant tie by the higher id", () => {
    const signed = { id: 1, date: at, type: ContractEventType.SIGNED };
    const suspended = { id: 2, date: at, type: ContractEventType.SUSPENDED };
    expect(isContractActiveAt([signed, suspended], at)).toBe(false);
    expect(isContractActiveAt([suspended, signed], at)).toBe(false);
  });
});

describe("findLastContractEvent", () => {
  it("is null with no events", () => {
    expect(findLastContractEvent([])).toBeNull();
  });

  it("picks the latest event, including ones after now", () => {
    const signed = { id: 2, date: before, type: ContractEventType.SIGNED };
    const suspended = { id: 1, date: after, type: ContractEventType.SUSPENDED };
    expect(findLastContractEvent([signed, suspended])).toBe(suspended);
  });

  it("breaks a same-instant tie by the higher id", () => {
    const signed = { id: 1, date: at, type: ContractEventType.SIGNED };
    const suspended = { id: 2, date: at, type: ContractEventType.SUSPENDED };
    expect(findLastContractEvent([signed, suspended])).toBe(suspended);
    expect(findLastContractEvent([suspended, signed])).toBe(suspended);
  });
});

describe("isContractActiveThroughout", () => {
  const signedBefore = { id: 1, date: before, type: ContractEventType.SIGNED };

  it("is inactive without a start date", () => {
    expect(isContractActiveThroughout([signedBefore], { endDate: after })).toBe(
      false,
    );
  });

  it("is inactive when the contract isn't active at the start", () => {
    expect(
      isContractActiveThroughout([], { startDate: at, endDate: after }),
    ).toBe(false);
  });

  it("is active when signed at the start and never suspended in range", () => {
    expect(
      isContractActiveThroughout([signedBefore], {
        startDate: at,
        endDate: after,
      }),
    ).toBe(true);
  });

  it("is inactive when suspended inside the range", () => {
    const suspended = { id: 2, date: at, type: ContractEventType.SUSPENDED };
    expect(
      isContractActiveThroughout([signedBefore, suspended], {
        startDate: before,
        endDate: after,
      }),
    ).toBe(false);
  });

  it("ignores a suspension at or after the end", () => {
    const suspended = {
      id: 2,
      date: after,
      type: ContractEventType.SUSPENDED,
    };
    expect(
      isContractActiveThroughout([signedBefore, suspended], {
        startDate: at,
        endDate: after,
      }),
    ).toBe(true);
  });

  it("runs open-ended without an end date", () => {
    const suspended = {
      id: 2,
      date: after,
      type: ContractEventType.SUSPENDED,
    };
    expect(
      isContractActiveThroughout([signedBefore, suspended], { startDate: at }),
    ).toBe(false);
  });
});

describe("findSuspensionEndedBy", () => {
  const signed = { id: 1, date: before, type: ContractEventType.SIGNED };
  const suspended = { id: 2, date: before, type: ContractEventType.SUSPENDED };

  it.each([
    { label: "a first signing", events: [], ended: null },
    { label: "a signing while active", events: [signed], ended: null },
    {
      label: "a signing while suspended",
      events: [signed, suspended],
      ended: suspended,
    },
  ])("ends $ended for $label", ({ events, ended }) => {
    expect(findSuspensionEndedBy(events, at)).toBe(ended);
  });
});

describe("isLatestSuspension", () => {
  const events = [
    { id: 1, date: before, type: ContractEventType.SUSPENDED },
    { id: 2, date: at, type: ContractEventType.SIGNED },
  ];

  it("holds until a later pause", () => {
    expect(isLatestSuspension(events, 1)).toBe(true);
    expect(
      isLatestSuspension(
        [...events, { id: 3, date: after, type: ContractEventType.SUSPENDED }],
        1,
      ),
    ).toBe(false);
  });
});
