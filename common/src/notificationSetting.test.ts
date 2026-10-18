import { expect, it } from "bun:test";
import { resolveSetting } from "./notificationSetting";

it("takes an override unless the kind is required", () => {
  expect(
    resolveSetting({ required: false, override: false, fallback: true }),
  ).toBe(false);
  expect(
    resolveSetting({ required: false, override: null, fallback: true }),
  ).toBe(true);
  expect(
    resolveSetting({ required: true, override: false, fallback: true }),
  ).toBe(true);
});
