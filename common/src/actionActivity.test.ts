import { expect, test } from "bun:test";
import {
  WITHDRAWAL_OPTIONS,
  type WithdrawalOption,
  withdrawalFlagsFromOption,
  withdrawalOptionFromFlags,
} from "./actionActivity";

test.each(WITHDRAWAL_OPTIONS)("decodes the flags %p encodes to", (option) => {
  expect(withdrawalOptionFromFlags(withdrawalFlagsFromOption(option))).toBe(
    option,
  );
});

test.each<[Parameters<typeof withdrawalOptionFromFlags>[0], WithdrawalOption]>([
  [{ outOfTime: null, isMoral: null }, "other"],
  [{}, "other"],
  [{ outOfTime: null, isMoral: true }, "moral"],
  [{ outOfTime: true, isMoral: null }, "out_of_time"],
  [{ outOfTime: null, isMoral: null, doesntApply: true }, "doesnt_apply"],
])("decodes stored flags %o as %p", (flags, option) => {
  expect(withdrawalOptionFromFlags(flags)).toBe(option);
});
