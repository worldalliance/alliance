import {
  displayFormSlug,
  FormSlugSequence,
  isDefaultOrphanSlug,
  nextSequenceSlug,
} from "./form-slug";

describe("nextSequenceSlug", () => {
  it("starts at 1", () => {
    expect(nextSequenceSlug(FormSlugSequence.Main, [])).toBe("v1");
  });

  it("takes one past the highest number in its own sequence", () => {
    expect(
      nextSequenceSlug(FormSlugSequence.Main, [
        "v1",
        "v3",
        "f9",
        "control",
        "v2x",
      ]),
    ).toBe("v4");
    expect(nextSequenceSlug(FormSlugSequence.FollowUp, ["v5", "f1"])).toBe(
      "f2",
    );
  });
});

describe("isDefaultOrphanSlug", () => {
  it("matches the id in base36, with or without a collision suffix", () => {
    expect(isDefaultOrphanSlug({ id: 123, slug: "3f" })).toBe(true);
    expect(isDefaultOrphanSlug({ id: 123, slug: "3f-2" })).toBe(true);
    expect(isDefaultOrphanSlug({ id: 123, slug: "3f-draft" })).toBe(false);
    expect(isDefaultOrphanSlug({ id: 123, slug: "v1" })).toBe(false);
  });
});

describe("displayFormSlug", () => {
  it("prefixes the action slug when there is one", () => {
    expect(
      displayFormSlug({ slug: "v1", actionSlug: "grantmaking-prep-2" }),
    ).toBe("grantmaking-prep-2::v1");
    expect(displayFormSlug({ slug: "3f", actionSlug: undefined })).toBe("3f");
  });
});
