import { getDirectSnapshotTarget, getReturnTo } from "./navigation";

describe("getReturnTo", () => {
  it("accepts an internal path with search parameters", () => {
    expect(
      getReturnTo(
        { returnTo: "/actions/12?tab=responses&responses_variant=default" },
        "/fallback",
      ),
    ).toBe("/actions/12?tab=responses&responses_variant=default");
  });

  it("preserves the fragment", () => {
    expect(getReturnTo({ returnTo: "/forms/10/responses#row-3" }, "/f")).toBe(
      "/forms/10/responses#row-3",
    );
  });

  it("rejects absent and malformed destinations", () => {
    const fallback = "/forms/10/responses";
    expect(getReturnTo(undefined, fallback)).toBe(fallback);
    expect(getReturnTo({ returnTo: 42 }, fallback)).toBe(fallback);
    expect(getReturnTo({}, fallback)).toBe(fallback);
    expect(getReturnTo({ returnTo: "" }, fallback)).toBe(fallback);
    expect(getReturnTo({ returnTo: "actions/12" }, fallback)).toBe(fallback);
    expect(getReturnTo({ returnTo: "javascript:alert(1)" }, fallback)).toBe(
      fallback,
    );
  });

  it("rejects destinations that resolve off-origin", () => {
    const fallback = "/forms/10/responses";
    expect(getReturnTo({ returnTo: "https://example.com" }, fallback)).toBe(
      fallback,
    );
    expect(getReturnTo({ returnTo: "//example.com" }, fallback)).toBe(fallback);
    // Backslashes are folded into slashes during URL parsing, so these are
    // protocol-relative too despite the leading `/`.
    expect(getReturnTo({ returnTo: "/\\example.com" }, fallback)).toBe(
      fallback,
    );
    expect(getReturnTo({ returnTo: "/\\/example.com" }, fallback)).toBe(
      fallback,
    );
    expect(getReturnTo({ returnTo: "\\/example.com" }, fallback)).toBe(
      fallback,
    );
  });
});

describe("getDirectSnapshotTarget", () => {
  const targets = [
    { formId: 10, name: "Default" },
    { formId: 20, name: "Variant A" },
  ];

  it("returns the only target without requiring a selection", () => {
    expect(getDirectSnapshotTarget({ targets: [targets[0]] })).toEqual(
      targets[0],
    );
  });

  it("returns the selected variant when several targets are available", () => {
    expect(getDirectSnapshotTarget({ targets, selectedFormId: 20 })).toEqual(
      targets[1],
    );
  });

  it("requires the picker when several targets are ambiguous or stale", () => {
    expect(getDirectSnapshotTarget({ targets })).toBeNull();
    expect(
      getDirectSnapshotTarget({ targets, selectedFormId: 999 }),
    ).toBeNull();
  });

  it("does not provide a target when none are available", () => {
    expect(getDirectSnapshotTarget({ targets: [] })).toBeNull();
    expect(getDirectSnapshotTarget({})).toBeNull();
  });
});
