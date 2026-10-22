import type { ContractEventDto } from "../client";
import {
  canSignAgreement,
  formatCurrentSigningDate,
  signedContractEvent,
  signedContractId,
  suspendedContractEvent,
  WEEKLY_COMMITMENT_CONFIRMATION,
} from "./contract";
import { formatShortDate } from "./dateFormatters";

const event = (type: ContractEventDto["type"]): ContractEventDto => ({
  type,
  date: "2026-03-10T12:00:00Z",
  automatic: false,
  contractId: null,
});

it.each([
  [
    "signed",
    event("signed"),
    formatShortDate(new Date("2026-03-10T12:00:00Z")),
  ],
  ["suspended", event("suspended"), null],
  ["no event", undefined, null],
])("formatCurrentSigningDate: %s", (_, lastContractEvent, expected) => {
  expect(formatCurrentSigningDate(lastContractEvent)).toBe(expected);
});

describe("canSignAgreement", () => {
  const ready = {
    signedName: "Jane Smith",
    confirmation: WEEKLY_COMMITMENT_CONFIRMATION,
    isSubmitting: false,
  };

  it("allows a named, confirmed signature", () => {
    expect(canSignAgreement(ready)).toBe(true);
  });

  it("accepts a confirmation with a typo", () => {
    expect(
      canSignAgreement({
        ...ready,
        confirmation: "I comit to complete each task to the best of my abilty.",
      }),
    ).toBe(true);
  });

  it.each([
    ["no name", { signedName: "" }],
    ["a short confirmation", { confirmation: "I commit." }],
    ["a submission in flight", { isSubmitting: true }],
  ])("refuses %s", (_, change) => {
    expect(canSignAgreement({ ...ready, ...change })).toBe(false);
  });
});

it.each([
  ["a signature", signedContractEvent({ contractId: 3, date: "d" }), 3],
  ["a suspension", suspendedContractEvent("d"), null],
  ["no event", null, null],
])("signedContractId: %s", (_, lastContractEvent, expected) => {
  expect(signedContractId(lastContractEvent)).toBe(expected);
});
