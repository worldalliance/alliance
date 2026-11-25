import type { Queryable } from "src/datasources/advisory-lock";
import { phoneNumberTransformer } from "src/utils/phone";
import {
  hasPassword,
  loadedUserTags,
  lockPhoneNumber,
  textReachable,
} from "./user.utils";

describe("textReachable", () => {
  const reachable = {
    phoneNumber: "+14155552671",
    phoneNumberUnsubscribed: false,
  };

  it("reaches a canonical, subscribed phone number", () => {
    expect(textReachable(reachable)).toBe(true);
  });

  it("can't reach a member without a phone number", () => {
    expect(textReachable({ ...reachable, phoneNumber: null })).toBe(false);
  });

  it("can't reach an invalid or non-canonical phone number", () => {
    for (const phoneNumber of ["not-a-phone", "15550100", "(415) 555-2671"]) {
      expect(textReachable({ ...reachable, phoneNumber })).toBe(false);
    }
  });

  it("can't reach a number that replied STOP", () => {
    expect(textReachable({ ...reachable, phoneNumberUnsubscribed: true })).toBe(
      false,
    );
  });
});

describe("hasPassword", () => {
  it.each([
    { password: "hunter2", expected: true },
    { password: "", expected: false },
    { password: null, expected: false },
  ])("is $expected for password $password", ({ password, expected }) => {
    expect(hasPassword({ password })).toBe(expected);
  });
});

describe("loadedUserTags", () => {
  it("returns the loaded tags", () => {
    expect(loadedUserTags({ id: 3, tags: [] })).toEqual([]);
  });

  it("throws when the tags aren't loaded", () => {
    expect(() => loadedUserTags({ id: 3, tags: undefined })).toThrow(
      "tags of user 3 not loaded",
    );
  });
});

describe("lockPhoneNumber", () => {
  it("locks a number as the column stores it", async () => {
    const keys: unknown[] = [];
    const em: Queryable = {
      queryRunner: { isTransactionActive: true },
      query: async (_sql, parameters) => keys.push(...parameters),
    };
    const formats = ["+1 (415) 555-2671", "(415) 555-2671", "+14155552671"];
    for (const phoneNumber of formats) {
      await lockPhoneNumber(em, phoneNumber);
    }
    expect(keys).toEqual(
      formats.map((n) => `phone-number:${phoneNumberTransformer.to(n)}`),
    );
  });
});
