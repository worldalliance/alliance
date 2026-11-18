import { isNewerStoreBuild, isNewerVersion } from "./storeVersion";

describe("isNewerVersion", () => {
  it.each([
    ["1.3.0", "1.2.9", true],
    ["1.2.9", "1.2.9", false],
    ["1.2.8", "1.2.9", false],
    ["1.3", "1.2.9", true],
    ["1.2", "1.2.0", false],
    ["next", "1.2.9", false],
  ])("%s over %s is %p", (a, b, newer) => {
    expect(isNewerVersion(a, b)).toBe(newer);
  });
});

describe("isNewerStoreBuild", () => {
  const installed = { installedFingerprint: "abc", installedVersion: "1.2.0" };

  it.each([
    ["a newer build", true, { fingerprint: "def", version: "1.3.0" }],
    ["this build", false, { fingerprint: "abc", version: "1.3.0" }],
    ["an older build", false, { fingerprint: "def", version: "1.1.0" }],
    ["no build", false, null],
  ])("%s in the store counts as newer: %p", (_, newer, storeBuild) => {
    expect(isNewerStoreBuild({ storeBuild, ...installed })).toBe(newer);
  });

  it("is false when this install's fingerprint is unknown", () => {
    expect(
      isNewerStoreBuild({
        storeBuild: { fingerprint: "def", version: "1.3.0" },
        installedFingerprint: null,
        installedVersion: "1.2.0",
      }),
    ).toBe(false);
  });
});
