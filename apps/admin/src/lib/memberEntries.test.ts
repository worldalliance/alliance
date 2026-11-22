import { describe, expect, test } from "bun:test";
import { matchMemberEntries } from "./memberEntries";

const users = [
  { id: 7, email: "ana@example.com" },
  { id: 12, email: "Bo@Example.com" },
];

describe("matchMemberEntries", () => {
  test("matches ids and emails, whatever the separator or email case", () => {
    expect(
      matchMemberEntries({
        text: "7,\nbo@example.COM ;  12\tana@example.com",
        users,
      }),
    ).toEqual({ userIds: [7, 12], unmatched: [] });
  });

  test("returns each entry it couldn't match as written", () => {
    expect(
      matchMemberEntries({ text: "99 nobody@example.com 7", users }),
    ).toEqual({ userIds: [7], unmatched: ["99", "nobody@example.com"] });
  });

  test("matches nothing in empty text", () => {
    expect(matchMemberEntries({ text: "  \n", users })).toEqual({
      userIds: [],
      unmatched: [],
    });
  });
});
