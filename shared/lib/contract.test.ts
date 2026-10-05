import type { ContractEventDto } from "../client";
import { formatCurrentSigningDate } from "./contract";
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
