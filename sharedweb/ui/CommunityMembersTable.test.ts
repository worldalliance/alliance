import {
  signedContractEvent,
  suspendedContractEvent,
} from "@alliance/shared/lib/contract";
import {
  ContractFilterMode,
  matchesContractFilter,
} from "./CommunityMembersTable";

const members = {
  signed: {
    lastContractEvent: signedContractEvent({ contractId: 1, date: "d" }),
  },
  suspended: { lastContractEvent: suspendedContractEvent("d") },
  none: {},
};

it.each([
  [ContractFilterMode.ALL, ["signed", "suspended", "none"]],
  [ContractFilterMode.SIGNED, ["signed"]],
  [ContractFilterMode.SUSPENDED, ["suspended"]],
  [ContractFilterMode.NOT_SIGNED, ["none"]],
])("the %s contract filter matches %j", (mode, expected) => {
  expect(
    Object.entries(members)
      .filter(([, member]) => matchesContractFilter(mode, member))
      .map(([name]) => name),
  ).toEqual(expected);
});
