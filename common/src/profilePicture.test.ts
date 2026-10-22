import { hasProfilePicture } from "./profilePicture";

describe("hasProfilePicture", () => {
  it.each([
    [null, false],
    ["", false],
    ["  ", false],
    ["\t\n", false],
    ["key.webp", true],
  ])("treats %p as %p", (profilePicture, expected) => {
    expect(hasProfilePicture({ profilePicture })).toBe(expected);
  });
});
