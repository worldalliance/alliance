import { ContractEventType, isContractActiveAt } from "./contract-event.entity";

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
