import { ANONYMOUS_DISPLAY_NAME, publicDisplayName } from "./displayName";

describe("publicDisplayName", () => {
  it("shows the name of a member who is not anonymous", () => {
    expect(publicDisplayName({ anonymous: false, name: "Ada Lovelace" })).toBe(
      "Ada Lovelace",
    );
  });

  it("hides the name of an anonymous member", () => {
    expect(publicDisplayName({ anonymous: true, name: "Ada Lovelace" })).toBe(
      ANONYMOUS_DISPLAY_NAME,
    );
  });
});
